const projectKinds = ['site', 'application', 'automation', 'unsure'] as const;

export type ProjectKind = (typeof projectKinds)[number];

const projectLabels: Record<ProjectKind, string> = {
  site: 'Un site web',
  application: 'Une application sur mesure',
  automation: 'Une automatisation ou un outil d’IA',
  unsure: 'Je ne sais pas encore',
};

export interface ProjectBrief {
  context?: string;
  organization?: string;
  name?: string;
  replyEmail?: string;
}

export function isProjectKind(value: string): value is ProjectKind {
  return projectKinds.includes(value as ProjectKind);
}

export const briefLimits = { context: 5000, organization: 200, name: 120, replyEmail: 254 } as const;
// Same mailbox syntax and normalization as the receiving public intake service.
export function isContactEmail(value: string): boolean {
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value.trim());
}
const briefFieldNames = { context: 'Le projet', organization: 'L’organisation', name: 'Le nom', replyEmail: 'Le courriel' } as const;

export function validateBriefLimits(brief: ProjectBrief): Partial<Record<keyof ProjectBrief, string>> {
  const errors: Partial<Record<keyof ProjectBrief, string>> = {};
  for (const field of Object.keys(briefLimits) as (keyof typeof briefLimits)[]) {
    const value = (brief[field] ?? '').trim();
    if (value.length > briefLimits[field]) {
      errors[field] = `${briefFieldNames[field]} dépasse la limite de ${briefLimits[field].toLocaleString('fr-CA')} caractères. Raccourcissez le texte; rien ne sera coupé automatiquement.`;
    } else if (Array.from(value).some((character) => character.length === 1 && /[\uD800-\uDFFF]/u.test(character))) {
      errors[field] = `${briefFieldNames[field]} contient un caractère incomplet. Corrigez-le avant de continuer.`;
    }
  }
  return errors;
}

const clean = (value: string | undefined): string => (value ?? '').trim();

export function buildProjectMailto(project: ProjectKind, brief: ProjectBrief = {}): string {
  const error = Object.values(validateBriefLimits(brief))[0];
  if (error) throw new RangeError(error);
  const label = projectLabels[project];
  const subject = `[Projet 27PM] ${label}`;
  const context = clean(brief.context);
  const organization = clean(brief.organization);
  const name = clean(brief.name);
  const replyEmail = clean(brief.replyEmail);
  const body = [
    'Bonjour 27PM,',
    '',
    `J’aimerais discuter de ce projet : ${label.toLocaleLowerCase('fr-CA')}.`,
    '',
    'Voici un peu de contexte :',
    context || '[À compléter]',
    ...(organization ? ['', `Organisation : ${organization}`] : []),
    ...(name ? ['', `Nom : ${name}`] : []),
    ...(replyEmail ? [`Courriel de retour : ${replyEmail}`] : []),
    '',
    'Merci!',
  ].join('\n');

  return `mailto:bonjour@27pm.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function copyEmailAddress(
  email: string,
  writeText: ((value: string) => Promise<void>) | undefined,
): Promise<boolean> {
  if (!email || !writeText) return false;

  try {
    await writeText(email);
    return true;
  } catch {
    return false;
  }
}
