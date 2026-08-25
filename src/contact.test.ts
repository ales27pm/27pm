import { describe, expect, it } from 'vitest';
import { buildProjectMailto, isProjectKind } from './contact';

describe('project contact link', () => {
  it('encodes the selected project in the subject and body', () => {
    const link = buildProjectMailto('application');

    expect(link).toContain('mailto:bonjour@27pm.org');
    expect(decodeURIComponent(link)).toContain('[Projet 27PM] Une application');
    expect(decodeURIComponent(link)).toContain('une application');
  });

  it('accepts only the supported project values', () => {
    expect(isProjectKind('site')).toBe(true);
    expect(isProjectKind('application')).toBe(true);
    expect(isProjectKind('autre')).toBe(false);
  });
});
