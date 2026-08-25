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
  name?: string;
  replyEmail?: string;
}

export function isProjectKind(value: string): value is ProjectKind {
  return projectKinds.includes(value as ProjectKind);
}

const clean = (value: string | undefined, limit: number): string =>
  (value ?? '').trim().slice(0, limit);

export function buildProjectMailto(project: ProjectKind, brief: ProjectBrief = {}): string {
  const label = projectLabels[project];
  const subject = `[Projet 27PM] ${label}`;
  const context = clean(brief.context, 5_000);
  const name = clean(brief.name, 120);
  const replyEmail = clean(brief.replyEmail, 320);
  const body = [
    'Bonjour 27PM,',
    '',
    `J’aimerais discuter de ce projet : ${label.toLocaleLowerCase('fr-CA')}.`,
    '',
    'Voici un peu de contexte :',
    context || '[À compléter]',
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
