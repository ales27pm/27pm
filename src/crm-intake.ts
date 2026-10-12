import { isContactEmail, validateBriefLimits, type ProjectKind } from './contact';

// Public intake must reach the Worker directly to preserve the visitor IP used by Turnstile and rate limits.
export const CRM_INTAKE_ENDPOINT = 'https://api.crm.27pm.org/api/public/intake';
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

const clean = (value: string): string => value.trim();

function draftLimitErrors(draft: PublicIntakeDraft): PublicIntakeErrors {
  const limits = validateBriefLimits({ context: draft.message, organization: draft.organizationName, name: draft.contactName, replyEmail: draft.contactEmail });
  const errors: PublicIntakeErrors = {};
  if (limits.context) errors.message = limits.context;
  if (limits.organization) errors.organizationName = limits.organization;
  if (limits.name) errors.contactName = limits.name;
  if (limits.replyEmail) errors.contactEmail = limits.replyEmail;
  return errors;
}

// Same business content identifies the same attempt, independently of token renewal
// or acknowledgement UI events. This value stays in page memory, never in analytics.
export function intakeDraftIdentity(draft: PublicIntakeDraft): string {
  return JSON.stringify([draft.organizationName.trim(), draft.contactName.trim(), draft.contactEmail.trim().toLowerCase(), draft.projectType, draft.message.trim()]);
}

export function validatePublicIntakeDraft(draft: PublicIntakeDraft): PublicIntakeErrors {
  const errors: PublicIntakeErrors = {};

  if (!draft.organizationName.trim()) {
    errors.organizationName = 'Indiquez le nom de votre organisation.';
  }
  if (!draft.contactName.trim()) {
    errors.contactName = 'Indiquez votre nom.';
  }
  if (!isContactEmail(draft.contactEmail)) {
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

  return { ...errors, ...draftLimitErrors(draft) };
}

export function createPublicIntakePayload(draft: PublicIntakeDraft): PublicIntakePayload {
  if (!draft.privacyAcknowledged) {
    throw new Error('Privacy acknowledgement is required before creating the CRM payload.');
  }
  const limitError = Object.values(draftLimitErrors(draft))[0];
  if (limitError) throw new RangeError(limitError);

  return {
    organizationName: clean(draft.organizationName),
    contactName: clean(draft.contactName),
    contactEmail: clean(draft.contactEmail).toLowerCase(),
    projectType: draft.projectType,
    message: clean(draft.message),
    privacyAcknowledged: draft.privacyAcknowledged,
    turnstileToken: draft.turnstileToken,
    website: clean(draft.website),
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
