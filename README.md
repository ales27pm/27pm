# 27PM.org

Site vitrine de 27PM, studio montréalais de sites web et d’applications sur mesure.

## Démarrage

Node 24 LTS et npm sont recommandés.

```bash
npm install
npm run dev
```

## Validation

```bash
npm run check
npm run test:e2e
npm run build:pages
npm run check:pages
```

`npm run check` exécute le lint, les tests unitaires, le contrôle TypeScript et le build de production. Les tests de navigateur utilisent le canal Chrome installé sur la machine.

## Déploiement

GitHub Pages publie le contenu validé de la branche `gh-pages`. `npm run build:pages` prépare l’URL temporaire `ales27pm.github.io/27pm/` en `noindex`; `npm run check:pages` vérifie son chemin de base, ses liens, ses manifestes et ses icônes avant publication.

Lorsque `27pm.org` sera configuré dans Pages, fournir `PAGES_BASE_PATH=""` et `PAGES_HOST="27pm.org"` au build repassera automatiquement à la racine et en `index, follow`.

## Structure

- `index.html` : page principale, métadonnées SEO et contenu sémantique.
- `confidentialite/index.html` : politique de confidentialité.
- `404.html` : page d’erreur de marque, exclue de l’indexation.
- `src/` : styles, interactions et logique du lien de contact.
- `public/assets/` : actifs de marque, images optimisées et aperçus des réalisations.
- `design/` : concepts visuels et sources de génération.

Le bouton de contact ouvre le logiciel de courriel avec un sujet et un message adaptés au type de projet sélectionné.

## Avant la mise en ligne

- Configurer l’hébergeur pour servir `404.html` avec un véritable statut HTTP `404`.
- Réserver `index, follow` à la production et envoyer `X-Robots-Tag: noindex, nofollow` sur les previews.
- Rediriger `www.27pm.org` vers `https://27pm.org/` en `301`, puis vérifier `robots.txt`, `sitemap.xml`, l’image Open Graph et les URL canoniques.
- Remplacer les mentions provisoires de la politique de confidentialité par les fournisseurs, territoires et durées de conservation réellement retenus.
