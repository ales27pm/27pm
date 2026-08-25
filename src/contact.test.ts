import { describe, expect, it } from 'vitest';
import { buildProjectMailto, copyEmailAddress, isProjectKind } from './contact';

describe('project contact link', () => {
  it('encodes the selected project in the subject and body', () => {
    const link = buildProjectMailto('application');

    expect(link).toContain('mailto:bonjour@27pm.org');
    expect(decodeURIComponent(link)).toContain('[Projet 27PM] Une application sur mesure');
    expect(decodeURIComponent(link)).toContain('une application sur mesure');
    expect(decodeURIComponent(link)).toContain('[À compléter]');
  });

  it('includes the optional brief without keeping surrounding whitespace', () => {
    const link = buildProjectMailto('automation', {
      context: '  Automatiser la qualification des demandes.  ',
      name: '  Alexis  ',
      replyEmail: '  alexis@example.test  ',
    });
    const decoded = decodeURIComponent(link);

    expect(decoded).toContain('[Projet 27PM] Une automatisation ou un outil d’IA');
    expect(decoded).toContain('Automatiser la qualification des demandes.');
    expect(decoded).toContain('Nom : Alexis');
    expect(decoded).toContain('Courriel de retour : alexis@example.test');
    expect(decoded).not.toContain('  Alexis  ');
  });

  it('accepts only the supported project values', () => {
    expect(isProjectKind('site')).toBe(true);
    expect(isProjectKind('application')).toBe(true);
    expect(isProjectKind('automation')).toBe(true);
    expect(isProjectKind('unsure')).toBe(true);
    expect(isProjectKind('produit')).toBe(false);
    expect(isProjectKind('autre')).toBe(false);
  });

  it('copies the visible address through the provided clipboard seam', async () => {
    let copied = '';

    await expect(copyEmailAddress('bonjour@27pm.org', async (value) => {
      copied = value;
    })).resolves.toBe(true);
    expect(copied).toBe('bonjour@27pm.org');
  });

  it('reports unavailable or rejected clipboard access without throwing', async () => {
    await expect(copyEmailAddress('', async () => undefined)).resolves.toBe(false);
    await expect(copyEmailAddress('bonjour@27pm.org', undefined)).resolves.toBe(false);
    await expect(copyEmailAddress('bonjour@27pm.org', async () => Promise.reject(new Error('denied')))).resolves.toBe(false);
  });
});
