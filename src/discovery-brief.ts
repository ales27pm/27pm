import type { ProjectKind } from './contact';

export interface BriefSuggestion { project: ProjectKind; text: string }
export const discoverySources = {
  creation: { project: 'site', label: 'création de site web', prompt: 'Quelle offre doit devenir plus facile à comprendre? Pour quels clients? Quelles contraintes connaissez-vous?' },
  agence: { project: 'unsure', label: 'accompagnement par une agence web', prompt: 'Quel site, outil ou processus voulez-vous améliorer? Quel résultat concret recherchez-vous?' },
  refonte: { project: 'site', label: 'refonte de site web', prompt: 'Qu’est-ce qui bloque aujourd’hui? Que faut-il conserver? Quels parcours faut-il améliorer?' },
  fabricants: { project: 'site', label: 'sites et catalogues pour fabricants', prompt: 'Quels produits ou options sont difficiles à comprendre? Quels renseignements manquent dans les demandes reçues?' },
  applications: { project: 'application', label: 'application web sur mesure', prompt: 'Qui utilisera l’application? Quelles étapes ou quels outils faut-il relier?' },
  automatisation: { project: 'automation', label: 'automatisation ou outil d’IA', prompt: 'Quelle tâche se répète? Quels outils et données sont concernés? Quelles décisions doivent rester humaines?' },
  checklist: { project: 'site', label: 'checklist de fin de projet web — référentiel 1.0.0', prompt: 'Quels sont les trois points à clarifier en priorité : domaine, hébergement, sources, contenus, accès, formulaires, intégrations ou sauvegardes? « Je ne sais pas » est une réponse utile.' },
  barometre: { project: 'site', label: 'baromètre du consentement 2026 — édition 0.1.2', prompt: 'Souhaitez-vous discuter de la méthode ou préparer une revue du parcours de consentement de votre site? Quels comportements avez-vous observés? Cette demande n’est pas un verdict de conformité.' },
} as const satisfies Record<string, { project: ProjectKind; label: string; prompt: string }>;

export function sourceBrief(source: string | null): BriefSuggestion | undefined {
  if (!source || !Object.hasOwn(discoverySources, source)) return undefined;
  const entry = discoverySources[source as keyof typeof discoverySources];
  return { project: entry.project, text: `Source : ${entry.label} — 27PM.\n\nÀ préciser pour notre discussion :\n${entry.prompt}\n\nVotre contexte : ` };
}

const needs = { qualifier: 'Générer des demandes qualifiées', commerce: 'Vendre en ligne', operations: 'Simplifier un processus interne', data: 'Structurer et valoriser des données' } as const;
const surfaces = { editorial: 'Site éditorial', portal: 'Portail client', configurator: 'Configurateur', dashboard: 'Tableau de bord' } as const;
const capabilities = { rules: 'Règles métier, sans IA', semantic: 'Recherche sémantique', recommendation: 'Recommandation', assistant: 'Assistant conversationnel' } as const;

export function scenarioBrief(need: string, surface: string, capability: string): BriefSuggestion | undefined {
  if (!Object.hasOwn(needs, need) || !Object.hasOwn(surfaces, surface) || !Object.hasOwn(capabilities, capability)) return undefined;
  return {
    project: surface === 'editorial' ? 'site' : 'application',
    text: `Source : laboratoire 27PM — brouillon v1.\nBesoin : ${needs[need as keyof typeof needs]}.\nPiste explorée : ${surfaces[surface as keyof typeof surfaces]}.\nCapacité : ${capabilities[capability as keyof typeof capabilities]}.\n\nCe scénario reste à discuter; ce n’est ni un diagnostic ni une estimation.\nNotre situation actuelle, les outils concernés et nos priorités : `,
  };
}

export function appendBrief(current: string, suggestion: string): string {
  if (current.includes(suggestion.trim())) return current;
  return current.trim() ? `${current.trimEnd()}\n\n${suggestion}` : suggestion;
}
