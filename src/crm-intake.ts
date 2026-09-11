import type { ProjectKind } from './contact';

export const CRM_INTAKE_ENDPOINT = 'https://crm.27pm.org/api/public/intake';
export const TURNSTILE_ACTION = 'crm_intake';
export const CRM_INTAKE_TIMEOUT_MS = 12_000;

export interface PublicIntakeDraft {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  projectType: ProjectKind;
  message: string;
  privacyAcknowledged: boolean;
  turnstileToken: string;
  website: string;
}

export interface PublicIntakePayload {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  projectType: ProjectKind;
  message: string;
  privacyAcknowledged: true;
  turnstileToken: string;
  website: string;
}

export interface SubmitPublicIntakeOptions {
  timeoutMs?: number;
}

export type PublicIntakeErrors = Partial<Record<keyof PublicIntakeDraft, string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: string, limit: number): string => value.trim().slice(0, limit);

export function validatePublicIntakeDraft(draft: PublicIntakeDraft): PublicIntakeErrors {
  const errors: PublicIntakeErrors = {};

  if (!draft.organizationName.trim()) {
    errors.organizationName = 'Indiquez le nom de votre organisation.';
  }
  if (!draft.contactName.trim()) {
    errors.contactName = 'Indiquez votre nom.';
  }
  if (!emailPattern.test(draft.contactEmail.trim())) {
    errors.contactEmail = 'Vérifiez le format de votre courriel.';
  }
  if (!draft.message.trim()) {
    errors.message = 'Décrivez brièvement votre projet.';
  }
  if (!draft.privacyAcknowledged) {
    errors.privacyAcknowledged =
      'Confirmez avoir pris connaissance de la politique de confidentialité.';
  }
  if (!draft.turnstileToken) {
    errors.turnstileToken = 'Complétez la vérification antirobot.';
  }
  if (draft.website) {
    errors.website = 'Soumission non valide.';
  }

  return errors;
}

export function createPublicIntakePayload(draft: PublicIntakeDraft): PublicIntakePayload {
  if (!draft.privacyAcknowledged) {
    throw new Error('Privacy acknowledgement is required before creating the CRM payload.');
  }

  return {
    organizationName: clean(draft.organizationName, 200),
    contactName: clean(draft.contactName, 120),
    contactEmail: clean(draft.contactEmail, 320),
    projectType: draft.projectType,
    message: clean(draft.message, 5_000),
    privacyAcknowledged: draft.privacyAcknowledged,
    turnstileToken: draft.turnstileToken,
    website: clean(draft.website, 500),
  };
}

export function createIdempotencyKey(
  createUuid: () => string = () => crypto.randomUUID(),
): string {
  return `form-${createUuid()}`;
}

export async function submitPublicIntake(
  payload: PublicIntakePayload,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
  options: SubmitPublicIntakeOptions = {},
): Promise<{ accepted: boolean; status: number }> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? CRM_INTAKE_TIMEOUT_MS,
  );

  try {
    const response = await fetcher(CRM_INTAKE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    return { accepted: response.status === 202, status: response.status };
  } catch {
    return { accepted: false, status: 0 };
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
