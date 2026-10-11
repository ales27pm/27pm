import { createHash, createHmac } from 'node:crypto';

const HOME_PATHS = new Set(['/', '/fr', '/fr/', '/en', '/en/', '/fr-ca', '/fr-ca/', '/en-ca', '/en-ca/', '/accueil', '/accueil/', '/home', '/home/']);
const EXCLUDED_HOST_SUFFIXES = [
  'airbnb.ca', 'airbnb.com', 'bit.ly', 'booking.com', 'facebook.com', 'fb.com',
  'bonjourquebec.com', 'doordash.com', 'eventbrite.ca', 'eventbrite.com',
  'expedia.ca', 'expedia.com', 'goo.gl', 'google.com', 'hotels.com', 'instagram.com',
  'lepointdevente.com', 'linktr.ee', 'opentable.ca', 'opentable.com', 'pagesjaunes.ca',
  'quebecvacances.com', 'resy.com', 'skipthedishes.com', 'ticketmaster.ca',
  'ticketmaster.com', 'tiktok.com', 'tripadvisor.ca', 'tripadvisor.com', 'twitter.com',
  'ubereats.com', 'vrbo.com', 'x.com', 'yellowpages.ca', 'youtube.com',
];

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function keyedDigest(seed, value) {
  return createHmac('sha256', seed).update(value).digest('hex');
}

function parseSemicolonTable(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ';') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  if (quoted) throw new Error('CSV invalide: guillemet non fermé.');
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = rows.shift().map((value, index) => index === 0 ? value.replace(/^\uFEFF/, '') : value);
  const records = rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new Error(`CSV invalide: la ligne de données ${index + 1} contient ${values.length} colonnes au lieu de ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex]]));
  });
  return { headers, records };
}

export function parseSemicolonCsv(source) {
  return parseSemicolonTable(source).records;
}

export function canonicalHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

export function isExcludedHost(hostname) {
  const canonical = canonicalHost(hostname);
  return EXCLUDED_HOST_SUFFIXES.some((suffix) => canonical === suffix || canonical.endsWith(`.${suffix}`));
}

function classifyHomepage(rawValue) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return { homepage: null, reason: 'url_missing' };
  let url;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return { homepage: null, reason: 'url_invalid' };
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) {
    return { homepage: null, reason: 'url_invalid' };
  }
  if (isExcludedHost(url.hostname)) {
    return { homepage: null, reason: 'platform_host' };
  }
  if (!HOME_PATHS.has(url.pathname.toLowerCase())) {
    return { homepage: null, reason: 'deep_path' };
  }
  url.search = '';
  url.hash = '';
  return { homepage: {
    url: url.href,
    host: canonicalHost(url.hostname),
  }, reason: null };
}

export function normalizeHomepage(rawValue) {
  return classifyHomepage(rawValue).homepage;
}

export function candidatesFromCsv(source, definition) {
  const { headers, records: rows } = parseSemicolonTable(source);
  for (const required of ['IdentifiantUnique', 'SiteInternet', 'RegionAdministrative']) {
    if (!headers.includes(required)) throw new Error(`CSV invalide: la colonne ${required} est requise.`);
  }
  const recordExclusions = {
    url_missing: 0,
    url_invalid: 0,
    platform_host: 0,
    deep_path: 0,
    region_missing: 0,
    record_id_missing: 0,
  };
  const byHost = new Map();
  for (const row of rows) {
    const classified = classifyHomepage(row.SiteInternet);
    if (!classified.homepage) {
      recordExclusions[classified.reason] += 1;
      continue;
    }
    const homepage = classified.homepage;
    const region = String(row.RegionAdministrative ?? '').trim();
    if (!region) {
      recordExclusions.region_missing += 1;
      continue;
    }
    const candidate = {
      source_id: definition.id,
      sector: definition.sector,
      region,
      url: homepage.url,
      host: homepage.host,
      source_record_id: String(row.IdentifiantUnique ?? '').trim(),
    };
    if (!candidate.source_record_id) {
      recordExclusions.record_id_missing += 1;
      continue;
    }
    if (!byHost.has(homepage.host)) byHost.set(homepage.host, []);
    byHost.get(homepage.host).push(candidate);
  }
  const candidates = [];
  let ambiguous_host_count = 0;
  for (const entries of byHost.values()) {
    const recordIds = new Set(entries.map((entry) => entry.source_record_id));
    const regions = new Set(entries.map((entry) => entry.region));
    if (recordIds.size !== 1 || regions.size !== 1) {
      ambiguous_host_count += 1;
      continue;
    }
    entries.sort((left, right) => {
      const a = digest(`${left.source_record_id}:${left.url}`);
      const b = digest(`${right.source_record_id}:${right.url}`);
      return a.localeCompare(b) || left.url.localeCompare(right.url);
    });
    candidates.push(entries[0]);
  }
  const funnel = {
    input_record_count: rows.length,
    record_exclusions: recordExclusions,
    host_stage: {
      unique_host_before_ambiguity: byHost.size,
      ambiguous_host: ambiguous_host_count,
      eligible_host: candidates.length,
    },
  };
  return {
    row_count: rows.length,
    ambiguous_host_count,
    funnel,
    candidates,
  };
}

function addFlowEdge(graph, from, to, capacity) {
  const forward = { to, reverse: graph[to].length, capacity, initialCapacity: capacity };
  const reverse = { to: from, reverse: graph[from].length, capacity: 0, initialCapacity: 0 };
  graph[from].push(forward);
  graph[to].push(reverse);
  return forward;
}

function maxFlow(graph, source, sink) {
  let total = 0;
  while (true) {
    const parentNode = Array(graph.length).fill(-1);
    const parentEdge = Array(graph.length).fill(-1);
    const queue = [source];
    parentNode[source] = source;
    for (let cursor = 0; cursor < queue.length && parentNode[sink] === -1; cursor += 1) {
      const node = queue[cursor];
      for (let edgeIndex = 0; edgeIndex < graph[node].length; edgeIndex += 1) {
        const edge = graph[node][edgeIndex];
        if (edge.capacity <= 0 || parentNode[edge.to] !== -1) continue;
        parentNode[edge.to] = node;
        parentEdge[edge.to] = edgeIndex;
        queue.push(edge.to);
        if (edge.to === sink) break;
      }
    }
    if (parentNode[sink] === -1) return total;
    let increment = Number.POSITIVE_INFINITY;
    for (let node = sink; node !== source; node = parentNode[node]) {
      increment = Math.min(increment, graph[parentNode[node]][parentEdge[node]].capacity);
    }
    for (let node = sink; node !== source; node = parentNode[node]) {
      const edge = graph[parentNode[node]][parentEdge[node]];
      edge.capacity -= increment;
      graph[node][edge.reverse].capacity += increment;
    }
    total += increment;
  }
}

export function selectRegionBalanced(sources, { perSource = 20, cellCap = 2, seed }) {
  if (!seed?.trim()) throw new Error('Une graine déterministe non vide est requise.');
  if (!Number.isInteger(perSource) || perSource < 1) throw new Error('perSource doit être un entier positif.');
  if (!Number.isInteger(cellCap) || cellCap < 1) throw new Error('cellCap doit être un entier positif.');
  const hostSourceCount = new Map();
  for (const source of sources) {
    for (const host of new Set(source.candidates.map((candidate) => candidate.host))) {
      hostSourceCount.set(host, (hostSourceCount.get(host) ?? 0) + 1);
    }
  }
  const prepared = sources.map((source) => {
    const candidates = source.candidates.filter((candidate) => hostSourceCount.get(candidate.host) === 1);
    const byRegion = new Map();
    for (const candidate of candidates) {
      if (!byRegion.has(candidate.region)) byRegion.set(candidate.region, []);
      byRegion.get(candidate.region).push(candidate);
    }
    for (const [region, entries] of byRegion) {
      entries.sort((left, right) => {
        const a = keyedDigest(seed, `${source.id}|${region}|${left.host}`);
        const b = keyedDigest(seed, `${source.id}|${region}|${right.host}`);
        return a.localeCompare(b) || left.host.localeCompare(right.host);
      });
      byRegion.set(region, entries);
    }
    return { ...source, candidates, byRegion };
  });
  const regions = [...new Set(prepared.flatMap((source) => [...source.byRegion.keys()]))].sort((left, right) => left.localeCompare(right, 'fr-CA'));
  const flowCapacities = new Map(regions.map((region) => [
    region,
    prepared.reduce((sum, source) => sum + Math.min(cellCap, source.byRegion.get(region)?.length ?? 0), 0),
  ]));
  const rawCapacities = new Map(regions.map((region) => [
    region,
    prepared.reduce((sum, source) => sum + (source.byRegion.get(region)?.length ?? 0), 0),
  ]));
  const totalTarget = sources.length * perSource;
  const quotas = new Map(regions.map((region) => [region, Math.min(3, flowCapacities.get(region))]));
  const baseQuotas = new Map(quotas);
  let quotaTotal = [...quotas.values()].reduce((sum, value) => sum + value, 0);
  if (quotaTotal > totalTarget) throw new Error(`La base régionale exige ${quotaTotal} observations pour une cible de ${totalTarget}.`);
  while (quotaTotal < totalTarget) {
    const candidate = regions
      .filter((region) => quotas.get(region) < Math.min(flowCapacities.get(region), baseQuotas.get(region) + 1))
      .sort((left, right) => {
        const residual = (rawCapacities.get(right) - quotas.get(right)) - (rawCapacities.get(left) - quotas.get(left));
        return residual || left.localeCompare(right, 'fr-CA');
      })[0];
    if (!candidate) throw new Error(`Capacité régionale insuffisante: ${quotaTotal} observations sur ${totalTarget}.`);
    quotas.set(candidate, quotas.get(candidate) + 1);
    quotaTotal += 1;
  }

  const sourceNodeStart = 1;
  const regionNodeStart = sourceNodeStart + prepared.length;
  const sink = regionNodeStart + regions.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const cellEdges = new Map();
  for (let sourceIndex = 0; sourceIndex < prepared.length; sourceIndex += 1) {
    addFlowEdge(graph, 0, sourceNodeStart + sourceIndex, perSource);
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
      const region = regions[regionIndex];
      const capacity = Math.min(cellCap, prepared[sourceIndex].byRegion.get(region)?.length ?? 0);
      const edge = addFlowEdge(graph, sourceNodeStart + sourceIndex, regionNodeStart + regionIndex, capacity);
      cellEdges.set(`${sourceIndex}:${regionIndex}`, edge);
    }
  }
  for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
    addFlowEdge(graph, regionNodeStart + regionIndex, sink, quotas.get(regions[regionIndex]));
  }
  const flow = maxFlow(graph, 0, sink);
  if (flow !== totalTarget) throw new Error(`Allocation source-région impossible: ${flow} observations sur ${totalTarget}.`);

  const selectionsBySource = [];
  const sourceStats = [];
  for (let sourceIndex = 0; sourceIndex < prepared.length; sourceIndex += 1) {
    const sourceSelection = [];
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
      const edge = cellEdges.get(`${sourceIndex}:${regionIndex}`);
      const count = edge.initialCapacity - edge.capacity;
      if (count === 0) continue;
      sourceSelection.push(...prepared[sourceIndex].byRegion.get(regions[regionIndex]).slice(0, count));
    }
    selectionsBySource.push(sourceSelection);
    sourceStats.push({
      source_id: prepared[sourceIndex].id,
      candidate_host_count: prepared[sourceIndex].candidates.length,
      cross_source_host_count: sources[sourceIndex].candidates.length - prepared[sourceIndex].candidates.length,
      selected_count: sourceSelection.length,
      selected_region_count: new Set(sourceSelection.map((item) => item.region)).size,
    });
  }
  const selected = [];
  for (let index = 0; index < perSource; index += 1) {
    for (const sourceSelection of selectionsBySource) selected.push(sourceSelection[index]);
  }
  const regionStats = regions.map((region) => ({
    region,
    raw_candidate_count: rawCapacities.get(region),
    flow_capacity: flowCapacities.get(region),
    quota: quotas.get(region),
    selected_count: selected.filter((candidate) => candidate.region === region).length,
  }));

  return {
    sites: selected.map((candidate, index) => ({
      site_id: `site-${String(index + 1).padStart(3, '0')}`,
      url: candidate.url,
      region: candidate.region,
      sector: candidate.sector,
      source_id: candidate.source_id,
      eligibility: 'included',
    })),
    source_stats: sourceStats,
    region_stats: regionStats,
  };
}
