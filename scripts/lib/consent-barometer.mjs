import { createHash } from 'node:crypto';
import { lstat, mkdir, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export const SCHEMA_VERSION = '0.1.0';
export const COLLECTOR_VERSION = '0.4.0';
export const MIN_PUBLIC_BREAKDOWN_N = 5;
export const PUBLIC_METRIC_IDS = Object.freeze([
  'banner_detected',
  'reject_first_layer',
  'keyboard_reject_steps',
  'reject_action_closed',
  'axe_rule_count_banner',
  'external_hosts_before_choice_count',
  'cookies_before_choice_count',
  'document_storage_keys_before_choice_count',
]);
export const PUBLICATION_RULE = 'Aucune observation individuelle, aucun identifiant pseudonyme, aucun secteur ni aucune région ne sont publiés; seuls les agrégats globaux des huit métriques explicitement allowlistées peuvent être diffusés.';

const HOME_PATHS = new Set(['/', '/fr', '/fr/', '/en', '/en/', '/fr-ca', '/fr-ca/', '/en-ca', '/en-ca/', '/accueil', '/accueil/', '/home', '/home/']);

export function validateHomepageUrl(value, label = 'url') {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} doit être une URL HTTP ou HTTPS valide.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} doit être une URL HTTP ou HTTPS valide.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} ne doit pas contenir d’identifiants.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${label} doit viser une page d’accueil sans paramètres ni fragment.`);
  }
  if (!HOME_PATHS.has(url.pathname.toLowerCase())) {
    throw new Error(`${label} doit viser la racine ou une page d’accueil linguistique reconnue.`);
  }
  return url;
}

export function resolvePrivateArtifactsPath(value, label = 'Le chemin de sortie', root = resolve('artifacts/barometre-consentement')) {
  const target = resolve(value);
  const child = relative(root, target);
  if (!child || child.startsWith('..') || isAbsolute(child)) {
    throw new Error(`${label} doit être un enfant de artifacts/barometre-consentement/.`);
  }
  return target;
}

export async function preparePrivateArtifactsPath(value, {
  kind = 'directory',
  label = 'Le chemin de sortie',
  root = resolve('artifacts/barometre-consentement'),
} = {}) {
  const normalizedRoot = resolve(root);
  const target = resolvePrivateArtifactsPath(value, label, normalizedRoot);
  const child = relative(normalizedRoot, target);
  if (child.includes(sep)) throw new Error(`${label} doit être un enfant direct de ${normalizedRoot}.`);

  const parent = dirname(normalizedRoot);
  const parentDetails = await lstat(parent).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (parentDetails?.isSymbolicLink()) throw new Error(`Le dossier parent privé ne peut pas être un lien symbolique: ${parent}`);
  await mkdir(normalizedRoot, { recursive: true, mode: 0o700 });
  const rootDetails = await lstat(normalizedRoot);
  if (rootDetails.isSymbolicLink() || !rootDetails.isDirectory()) {
    throw new Error(`La racine privée doit être un dossier réel: ${normalizedRoot}`);
  }
  if (process.platform !== 'win32' && ((await stat(normalizedRoot)).mode & 0o077) !== 0) {
    throw new Error(`La racine privée doit avoir les permissions 0700: ${normalizedRoot}`);
  }
  const realRoot = await realpath(normalizedRoot);
  if (realRoot !== normalizedRoot) throw new Error(`La racine privée ne doit traverser aucun lien symbolique: ${normalizedRoot}`);

  const existingTarget = await lstat(target).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
  if (existingTarget) throw new Error(`${label} doit être inédit et ne peut pas déjà exister: ${target}`);
  if (kind === 'directory') {
    await mkdir(target, { mode: 0o700 });
    const realTarget = await realpath(target);
    const realChild = relative(realRoot, realTarget);
    if (!realChild || realChild.startsWith('..') || isAbsolute(realChild) || realChild.includes(sep)) {
      throw new Error(`${label} doit rester un enfant direct de la racine privée.`);
    }
  } else if (kind !== 'file') {
    throw new Error(`Type de sortie privée inconnu: ${kind}`);
  }
  return target;
}

export const METRIC_DEFINITIONS = [
  {
    id: 'banner_detected',
    label: 'Bannière de consentement détectée',
    type: 'categorical',
    unit: 'site',
    collection_method: 'automated',
    denominator_rule: 'Pages d’accueil incluses classées analysables après validation de la destination, du statut, du type HTML et de l’absence d’interstitiel.',
    interpretation_limit: 'Une bannière tardive, personnalisée ou non reconnue peut ne pas être détectée.',
    reference_url: 'https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-collaboration/international-privacy-networks/international-privacy-sweep/2024_sweep/opc-sweep-report-2024/',
  },
  {
    id: 'reject_first_layer',
    label: 'Action de refus unique reconnue au premier niveau',
    type: 'categorical',
    unit: 'site',
    collection_method: 'automated',
    denominator_rule: 'Sites inclus avec une bannière détectée.',
    interpretation_limit: 'Le libellé accessible doit correspondre au dictionnaire publié par la méthode; zéro action vaut non et plusieurs actions restent indéterminées.',
    reference_url: 'https://www.priv.gc.ca/en/about-the-opc/what-we-do/international-collaboration/international-privacy-networks/international-privacy-sweep/2024_sweep/opc-sweep-report-2024/',
  },
  {
    id: 'keyboard_reject_steps',
    label: 'Nombre de tabulations avant activation du refus',
    type: 'number',
    unit: 'tabulations',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une action de refus unique au premier niveau; measured_n indique combien ont été atteints au clavier.',
    interpretation_limit: 'Le résultat dépend du point de départ du focus et du contenu rendu lors de l’observation.',
    reference_url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
  },
  {
    id: 'dialog_accessible_name',
    label: 'Dialogue doté d’un nom accessible',
    type: 'categorical',
    unit: 'site',
    collection_method: 'automated',
    denominator_rule: 'Sites où la bannière détectée expose le rôle dialog.',
    interpretation_limit: 'Cette mesure ne démontre pas à elle seule la conformité ou la compréhension du dialogue.',
    reference_url: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html',
  },
  {
    id: 'focus_indicator_heuristic',
    label: 'Indicateur de focus détecté par heuristique sur l’action de refus',
    type: 'categorical',
    unit: 'site',
    collection_method: 'automated',
    denominator_rule: 'Sites où l’action de refus est atteinte au clavier.',
    interpretation_limit: 'L’heuristique compare plusieurs propriétés CSS avant et pendant le focus; elle ne remplace pas une revue visuelle.',
    reference_url: 'https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html',
  },
  {
    id: 'privacy_link_in_banner',
    label: 'Lien de confidentialité dans la bannière',
    type: 'categorical',
    unit: 'site',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une bannière détectée.',
    interpretation_limit: 'La présence d’un lien ne permet pas d’évaluer la qualité ou l’exactitude de son contenu.',
    reference_url: 'https://www.priv.gc.ca/en/privacy-topics/collecting-personal-information/consent/gl_omc_201805/',
  },
  {
    id: 'mobile_overflow_px',
    label: 'Débordement horizontal de la bannière sur 390 px',
    type: 'number',
    unit: 'pixels',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une bannière détectée.',
    interpretation_limit: 'Un débordement nul ne prouve pas que le contenu est lisible ou utilisable.',
    reference_url: 'https://www.w3.org/WAI/WCAG22/Understanding/reflow.html',
  },
  {
    id: 'axe_rule_count_banner',
    label: 'Règles Axe signalées dans la bannière',
    type: 'number',
    unit: 'règles',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une bannière détectée.',
    interpretation_limit: 'Axe ne détecte qu’une partie des problèmes d’accessibilité et ne produit pas un verdict de conformité.',
    reference_url: 'https://www.deque.com/axe/core-documentation/api-documentation/',
  },
  {
    id: 'external_hosts_before_choice_count',
    label: 'Hôtes externes observés avant tout choix',
    type: 'number',
    unit: 'hôtes',
    collection_method: 'automated',
    denominator_rule: 'Pages d’accueil incluses classées analysables après validation de la destination, du statut, du type HTML et de l’absence d’interstitiel.',
    interpretation_limit: 'Un hôte externe observé n’est pas nécessairement un tiers ni un traceur; aucune classification de finalité n’est inférée.',
    reference_url: 'https://developer.mozilla.org/en-US/docs/Glossary/Origin',
  },
  {
    id: 'cookies_before_choice_count',
    label: 'Témoins présents avant tout choix',
    type: 'number',
    unit: 'témoins',
    collection_method: 'automated',
    denominator_rule: 'Pages d’accueil incluses classées analysables après validation de la destination, du statut, du type HTML et de l’absence d’interstitiel.',
    interpretation_limit: 'Le décompte ne détermine ni la finalité, ni la nécessité, ni la conformité d’un témoin.',
    reference_url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies',
  },
  {
    id: 'document_storage_keys_before_choice_count',
    label: 'Clés de stockage du document principal avant tout choix',
    type: 'number',
    unit: 'clés',
    collection_method: 'automated',
    denominator_rule: 'Pages d’accueil incluses classées analysables après validation de la destination, du statut, du type HTML et de l’absence d’interstitiel.',
    interpretation_limit: 'Le décompte vise uniquement les clés localStorage et sessionStorage accessibles au document principal, sans attribuer de finalité.',
    reference_url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API',
  },
  {
    id: 'reject_action_closed',
    label: 'La bannière se ferme après activation du refus',
    type: 'categorical',
    unit: 'site',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une action de refus unique au premier niveau.',
    interpretation_limit: 'La fermeture observée ne prouve pas que le choix est conservé après rechargement ni que tous les traitements ont cessé.',
    reference_url: 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html',
  },
  {
    id: 'external_hosts_after_reject_count',
    label: 'Hôtes externes observés après la tentative de refus',
    type: 'number',
    unit: 'hôtes',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une action de refus unique au premier niveau.',
    interpretation_limit: 'La fenêtre post-interaction est courte; un hôte externe n’est pas nécessairement un tiers ni un traceur.',
    reference_url: 'https://developer.mozilla.org/en-US/docs/Glossary/Origin',
  },
  {
    id: 'cookies_after_reject_count',
    label: 'Témoins présents après la tentative de refus',
    type: 'number',
    unit: 'témoins',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une action de refus unique au premier niveau.',
    interpretation_limit: 'Le décompte n’attribue aucune finalité et ne distingue pas les témoins nécessaires.',
    reference_url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies',
  },
  {
    id: 'document_storage_keys_after_reject_count',
    label: 'Clés de stockage du document principal après la tentative de refus',
    type: 'number',
    unit: 'clés',
    collection_method: 'automated',
    denominator_rule: 'Sites avec une action de refus unique au premier niveau.',
    interpretation_limit: 'Le décompte vise uniquement les clés localStorage et sessionStorage accessibles au document principal, sans attribuer de finalité.',
    reference_url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API',
  },
];

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stableJson(value) {
  const sort = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(sort);
    if (!candidate || typeof candidate !== 'object') return candidate;
    return Object.fromEntries(Object.keys(candidate).sort().map((key) => [key, sort(candidate[key])]));
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

export function publicStudyMetadata(study) {
  const allowed = [
    'id', 'resource_version', 'title', 'language', 'scope', 'selection_rule',
    'author', 'publisher', 'citation', 'selection_seed_sha256', 'target_per_source',
    'source_region_cell_cap', 'sampling_limitations',
  ];
  return {
    ...Object.fromEntries(allowed.filter((key) => study[key] !== undefined).map((key) => [key, study[key]])),
    publication_rule: PUBLICATION_RULE,
  };
}

export function publicMetricResults(metricDefinitions, aggregates) {
  const allowed = new Set(PUBLIC_METRIC_IDS);
  return {
    metric_definitions: metricDefinitions.filter((definition) => allowed.has(definition.id)),
    aggregates: aggregates.filter((aggregate) => allowed.has(aggregate.metric_id)),
  };
}

export function validateManifest(manifest) {
  const errors = [];
  const requiredStudyFields = ['id', 'resource_version', 'title', 'language', 'scope', 'selection_rule', 'author', 'publisher', 'citation'];

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Le manifeste doit être un objet JSON.');
  }
  if (manifest.schema_version !== SCHEMA_VERSION) errors.push(`schema_version doit être ${SCHEMA_VERSION}.`);
  if (!manifest.study || typeof manifest.study !== 'object') {
    errors.push('study est requis.');
  } else {
    for (const field of requiredStudyFields) {
      if (typeof manifest.study[field] !== 'string' || !manifest.study[field].trim()) {
        errors.push(`study.${field} est requis.`);
      }
    }
    if (!Array.isArray(manifest.study.sampling_frame) || manifest.study.sampling_frame.length === 0) {
      errors.push('study.sampling_frame doit contenir au moins une source publique datée.');
    } else {
      for (const [index, source] of manifest.study.sampling_frame.entries()) {
        try {
          const url = new URL(source?.source_url);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        } catch {
          errors.push(`study.sampling_frame[${index}].source_url doit être une URL HTTP ou HTTPS valide.`);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(source?.retrieved_at ?? '')) {
          errors.push(`study.sampling_frame[${index}].retrieved_at doit suivre YYYY-MM-DD.`);
        }
      }
    }
  }
  if (!Array.isArray(manifest.sites) || manifest.sites.length === 0) {
    errors.push('sites doit contenir au moins un site.');
  } else {
    const ids = new Set();
    for (const [index, site] of manifest.sites.entries()) {
      const prefix = `sites[${index}]`;
      if (!site || typeof site !== 'object') {
        errors.push(`${prefix} doit être un objet.`);
        continue;
      }
      if (!/^(site|fixture|example|exemple)-\d{3,6}$/.test(site.site_id ?? '')) {
        errors.push(`${prefix}.site_id doit être un identifiant anonyme comme site-001.`);
      } else if (ids.has(site.site_id)) {
        errors.push(`${prefix}.site_id est dupliqué.`);
      } else {
        ids.add(site.site_id);
      }
      try {
        validateHomepageUrl(site.url, `${prefix}.url`);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${prefix}.url est invalide.`);
      }
      if (!['included', 'excluded'].includes(site.eligibility)) {
        errors.push(`${prefix}.eligibility doit être included ou excluded.`);
      }
      if (site.eligibility === 'excluded' && !site.exclusion_reason) {
        errors.push(`${prefix}.exclusion_reason est requis pour un site exclu.`);
      }
    }
  }

  if (errors.length) throw new Error(`Manifeste invalide:\n- ${errors.join('\n- ')}`);
  return manifest;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function isAnalyzableStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 300;
}

export function aggregateObservations(observations, metricDefinitions = METRIC_DEFINITIONS) {
  return metricDefinitions.map((definition) => {
    const responded = observations.filter((observation) => observation.eligibility === 'included'
      && (observation.analyzable === true || (observation.analyzable === undefined && isAnalyzableStatus(observation.final_status))));
    const withBanner = responded.filter((observation) => observation.banner_detected === 'yes');
    const withReject = withBanner.filter((observation) => observation.reject_first_layer === 'yes');
    let denominator = responded;
    if (!['banner_detected', 'external_hosts_before_choice_count', 'cookies_before_choice_count', 'document_storage_keys_before_choice_count'].includes(definition.id)) {
      denominator = withBanner;
    }
    if (['keyboard_reject_steps', 'reject_action_closed', 'external_hosts_after_reject_count', 'cookies_after_reject_count', 'document_storage_keys_after_reject_count'].includes(definition.id)) {
      denominator = withReject;
    }
    if (definition.id === 'focus_indicator_heuristic') {
      denominator = withReject.filter((observation) => Number.isFinite(observation.keyboard_reject_steps));
    }
    if (definition.id === 'dialog_accessible_name') {
      denominator = withBanner.filter((observation) => observation.dialog_role_present === true);
    }

    const values = denominator
      .map((observation) => observation[definition.id])
      .filter((value) => value !== null && value !== undefined && value !== 'indeterminate' && value !== 'not_applicable');
    const aggregate = {
      metric_id: definition.id,
      denominator_n: denominator.length,
      measured_n: values.length,
      missing_n: denominator.length - values.length,
      count: null,
      pct: null,
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
    };

    if (definition.type === 'categorical') {
      aggregate.count = values.filter((value) => value === 'yes').length;
      aggregate.pct = values.length ? Number(((aggregate.count / values.length) * 100).toFixed(1)) : null;
    } else {
      const numbers = values.filter((value) => Number.isFinite(value));
      aggregate.measured_n = numbers.length;
      aggregate.missing_n = denominator.length - numbers.length;
      aggregate.median = percentile(numbers, 0.5);
      aggregate.p25 = percentile(numbers, 0.25);
      aggregate.p75 = percentile(numbers, 0.75);
      aggregate.min = numbers.length ? Math.min(...numbers) : null;
      aggregate.max = numbers.length ? Math.max(...numbers) : null;
    }
    return aggregate;
  });
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function aggregatesToCsv(aggregates) {
  const columns = ['metric_id', 'denominator_n', 'measured_n', 'missing_n', 'count', 'pct', 'median', 'p25', 'p75', 'min', 'max'];
  return `${columns.join(',')}\n${aggregates.map((row) => columns.map((column) => csvCell(row[column])).join(',')).join('\n')}\n`;
}

export function observationsToCsv(observations) {
  const columns = [
    'site_id',
    'region',
    'sector',
    'observed_at_utc',
    'eligibility',
    'exclusion_reason',
    'final_status',
    'device_profile',
    'user_agent',
    'touch_points',
    'banner_detected',
    'reject_first_layer',
    'keyboard_reject_steps',
    'dialog_accessible_name',
    'focus_indicator_heuristic',
    'privacy_link_in_banner',
    'mobile_overflow_px',
    'axe_rule_count_banner',
    'axe_rule_ids_banner',
    'external_hosts_before_choice_count',
    'cookies_before_choice_count',
    'document_storage_keys_before_choice_count',
    'reject_action_result',
    'reject_action_closed',
    'external_hosts_after_reject_count',
    'cookies_after_reject_count',
    'document_storage_keys_after_reject_count',
    'errors',
  ];
  const serialize = (value) => Array.isArray(value) ? value.join('|') : value;
  return `${columns.join(',')}\n${observations.map((row) => columns.map((column) => csvCell(serialize(row[column]))).join(',')).join('\n')}\n`;
}
