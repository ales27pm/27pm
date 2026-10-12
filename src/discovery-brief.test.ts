import { describe, expect, it } from 'vitest';
import { appendBrief, discoverySources, scenarioBrief, sourceBrief } from './discovery-brief';

describe('editable discovery brief', () => {
  it('carries exactly the three selected lab choices, without inventing a diagnosis', () => {
    const brief = scenarioBrief('operations', 'portal', 'rules');
    expect(brief?.project).toBe('application');
    expect(brief?.text).toContain('Simplifier un processus interne');
    expect(brief?.text).toContain('Portail client');
    expect(brief?.text).toContain('Règles métier, sans IA');
    expect(brief?.text).toContain('ni un diagnostic');
  });
  it('accepts only fixed source and scenario identifiers', () => {
    for (const key of Object.keys(discoverySources)) expect(sourceBrief(key)?.text).toContain('Source :');
    for (const key of [null, '', '__proto__', 'constructor', '<script>', 'person@example.test']) expect(sourceBrief(key)).toBeUndefined();
    expect(scenarioBrief('other', 'portal', 'rules')).toBeUndefined();
    expect(scenarioBrief('operations', 'constructor', 'rules')).toBeUndefined();
  });
  it('preserves writing and does not duplicate or silently shorten appended context', () => {
    expect(appendBrief('Mon texte', 'Source : test')).toBe('Mon texte\n\nSource : test');
    expect(appendBrief('Mon texte\n\nSource : test', 'Source : test')).toBe('Mon texte\n\nSource : test');
    expect(appendBrief('x'.repeat(4999), 'texte')).toHaveLength(5006);
  });
});
