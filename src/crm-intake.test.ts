import { describe, expect, it, vi } from 'vitest';
import {
  CRM_INTAKE_ENDPOINT,
  CRM_INTAKE_TIMEOUT_MS,
  createIdempotencyKey,
  createPublicIntakePayload,
  submitPublicIntake,
  validatePublicIntakeDraft,
  type PublicIntakeDraft,
} from './crm-intake';

const validDraft: PublicIntakeDraft = {
  organizationName: '  Atelier Exemple  ',
  contactName: '  Alex Tremblay  ',
  contactEmail: '  alex@example.test  ',
  projectType: 'application',
  message: '  Créer un portail client accessible.  ',
  privacyAcknowledged: true,
  turnstileToken: 'turnstile-token',
  website: '',
};

describe('public CRM intake contract', () => {
  it('normalizes the exact public payload without adding client-only fields', () => {
    expect(createPublicIntakePayload(validDraft)).toEqual({
      organizationName: 'Atelier Exemple',
      contactName: 'Alex Tremblay',
      contactEmail: 'alex@example.test',
      projectType: 'application',
      message: 'Créer un portail client accessible.',
      privacyAcknowledged: true,
      turnstileToken: 'turnstile-token',
      website: '',
    });
  });

  it('refuses to manufacture a positive privacy acknowledgement', () => {
    expect(() => createPublicIntakePayload({
      ...validDraft,
      privacyAcknowledged: false,
    })).toThrow('Privacy acknowledgement is required');
  });

  it('rejects incomplete, invalid, unacknowledged, or bot-filled drafts', () => {
    expect(validatePublicIntakeDraft({
      ...validDraft,
      organizationName: '',
      contactName: '',
      contactEmail: 'invalid',
      message: '',
      privacyAcknowledged: false,
      turnstileToken: '',
      website: 'https://spam.example',
    })).toEqual({
      organizationName: 'Indiquez le nom de votre organisation.',
      contactName: 'Indiquez votre nom.',
      contactEmail: 'Vérifiez le format de votre courriel.',
      message: 'Décrivez brièvement votre projet.',
      privacyAcknowledged: 'Confirmez avoir pris connaissance de la politique de confidentialité.',
      turnstileToken: 'Complétez la vérification antirobot.',
      website: 'Soumission non valide.',
    });
  });

  it('creates the required stable form-prefixed idempotency key', () => {
    expect(createIdempotencyKey(() => '7dd3bd70-0d7a-4d9e-9481-9489f38ea68f')).toBe(
      'form-7dd3bd70-0d7a-4d9e-9481-9489f38ea68f',
    );
  });

  it('posts JSON to the CRM contract and accepts only the queued response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    const payload = createPublicIntakePayload(validDraft);

    await expect(submitPublicIntake(payload, 'form-fixed-id', fetcher)).resolves.toEqual({
      accepted: true,
      status: 202,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(CRM_INTAKE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'form-fixed-id',
      },
      body: JSON.stringify(payload),
      signal: expect.any(AbortSignal),
    });
  });

  it('keeps service failures recoverable through the email fallback', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));

    await expect(
      submitPublicIntake(createPublicIntakePayload(validDraft), 'form-fixed-id', fetcher),
    ).resolves.toEqual({ accepted: false, status: 503 });
  });

  it('aborts a stalled request at the configured timeout boundary', async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | null = null;
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? null;
          requestSignal?.addEventListener('abort', () => {
            reject(new DOMException('Request aborted', 'AbortError'));
          });
        }));
      let settled = false;
      const submission = submitPublicIntake(
        createPublicIntakePayload(validDraft),
        'form-fixed-id',
        fetcher,
      ).finally(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(CRM_INTAKE_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      expect((requestSignal as AbortSignal | null)?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(submission).resolves.toEqual({ accepted: false, status: 0 });
      expect((requestSignal as AbortSignal | null)?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
