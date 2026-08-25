export const projectKinds = ['site', 'application', 'produit'] as const;

export type ProjectKind = (typeof projectKinds)[number];

const projectLabels: Record<ProjectKind, string> = {
  site: 'Un site web',
  application: 'Une application',
  produit: 'Un produit à clarifier',
};

export function isProjectKind(value: string): value is ProjectKind {
  return projectKinds.includes(value as ProjectKind);
}

export function buildProjectMailto(project: ProjectKind): string {
  const label = projectLabels[project];
  const subject = `[Projet 27PM] ${label}`;
  const body = [
    'Bonjour 27PM,',
    '',
    `J’aimerais discuter de ce projet : ${label.toLocaleLowerCase('fr-CA')}.`,
    '',
    'Voici un peu de contexte :',
    '',
    '',
    'Merci!',
  ].join('\n');

  return `mailto:bonjour@27pm.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
