# 27PM.org

Site vitrine de 27PM, studio québécois de sites web, d’applications sur mesure et de systèmes propulsés par l’IA.

## Démarrage

Node 24 LTS et npm sont recommandés.

```bash
npm install
npm run dev
```

## Validation

```bash
npm run check
npx playwright install chromium
npm run test:e2e
npm run check:release
```

`npm run check` exécute le lint, les tests unitaires, le contrôle TypeScript et le build de production. Les tests de navigateur utilisent Chromium géré par Playwright et couvrent aussi les états interactifs, l’accessibilité et les largeurs de 320 à 1440 px.

## Déploiement

Vercel publie `https://27pm.org/` à partir de la branche `main`. La commande `npm run check:release` construit le site avec Vite, puis vérifie les métadonnées, les données structurées, les fichiers destinés aux moteurs de recherche et la configuration de canonicalisation Vercel.

`vercel.json` impose les URL avec slash final et redirige les chemins `index.html` vers leurs URL canoniques. Après une publication, `npm run check:public` contrôle HTTPS, les routes canoniques, les redirections permanentes, `www` et les destinations de portfolio marquées comme publiques. Ce contrôle réseau reste séparé de `npm run check` afin que la validation locale demeure déterministe.

Les commandes `build:pages`, `check:pages` et leurs variantes `preview` restent disponibles pour valider les anciens profils de build GitHub Pages. Elles ne constituent pas une voie de production tant que la politique de confidentialité nomme Vercel comme hébergeur. La variante `ales27pm.github.io/27pm/` reste en `noindex` et n’émet pas de `CNAME`.

## Structure

- `index.html` : page principale, métadonnées SEO et contenu sémantique.
- `confidentialite/index.html` : politique de confidentialité.
- `404.html` : page d’erreur de marque, exclue de l’indexation.
- `src/` : styles, interactions et logique du lien de contact.
- `public/assets/` : actifs de marque, images optimisées et aperçus des réalisations.
- `design/` : concepts visuels et sources de génération.

Le laboratoire compose localement une piste de solution à partir de trois choix et n’envoie aucune donnée. Le brief de contact prépare ensuite un courriel à partir du type de projet et du contexte saisi. L’adresse demeure visible et peut être copiée si aucune application de courriel n’est configurée.

## Avant la mise en ligne

- Dans Vercel, confirmer la branche de production `main`, le domaine `27pm.org`, la redirection `www` et le certificat TLS.
- Confirmer que Vercel sert `404.html` avec un véritable statut HTTP `404` et applique les redirections de `vercel.json`.
- Rediriger `www.27pm.org` vers `https://27pm.org/` de façon permanente, puis exécuter `npm run check:public`.
- Faire confirmer par la direction les territoires de traitement, les durées de conservation, le fournisseur de courriel, l’identité légale de l’entreprise et la personne responsable avant de présenter la politique comme une attestation juridique complète.
