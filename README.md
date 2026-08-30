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

GitHub Pages publie le contenu validé de la branche `gh-pages`. `npm run check:release` produit par défaut le site `https://27pm.org/`, génère `CNAME` et `.nojekyll`, puis vérifie le chemin de base, les liens publics, les manifestes et les icônes avant publication.

Pour inspecter une variante locale correspondant à `ales27pm.github.io/27pm/`, utiliser `npm run build:pages:preview && npm run check:pages:preview`. Cette variante est en `noindex` et n’émet pas de `CNAME`; elle ne doit pas remplacer la branche de production.

Après une publication, `npm run check:public` contrôle HTTPS, les routes canoniques, la redirection `www` et les destinations de portfolio marquées comme publiques. Ce contrôle réseau reste séparé de `npm run check` afin que la validation locale demeure déterministe.

## Structure

- `index.html` : page principale, métadonnées SEO et contenu sémantique.
- `confidentialite/index.html` : politique de confidentialité.
- `404.html` : page d’erreur de marque, exclue de l’indexation.
- `src/` : styles, interactions et logique du lien de contact.
- `public/assets/` : actifs de marque, images optimisées et aperçus des réalisations.
- `design/` : concepts visuels et sources de génération.

Le laboratoire compose localement une piste de solution à partir de trois choix et n’envoie aucune donnée. Le formulaire de contact peut transmettre une demande au CRM public lorsqu’une clé de site Cloudflare Turnstile est fournie au build. Sans cette configuration, l’envoi direct reste désactivé. Le courriel préparé, l’adresse visible et la copie de l’adresse demeurent disponibles dans tous les cas.

### Configuration du formulaire CRM

La seule variable cliente requise est une clé **publique** de site Turnstile. Le build `github-pages` la charge de façon déterministe depuis `.env.github-pages`; le build preview la neutralise explicitement afin de conserver le fallback hors de `27pm.org`.

```bash
npm run check:release
```

Ne jamais placer une clé secrète Turnstile dans Vite, le dépôt ou le navigateur. Le widget doit autoriser l’hôte `27pm.org` et le backend doit valider l’action `crm_intake`. Une réponse HTTP `202` indique seulement la mise en file d’examen. Si la variable manque, si Turnstile ne charge pas ou si le CRM refuse la demande, le site conserve le fallback `mailto:`.

## Avant la mise en ligne

- Dans les réglages Pages, confirmer la branche `gh-pages`, le domaine `27pm.org`, le certificat puis activer **Enforce HTTPS**. Les enregistrements DNS doivent suivre la [configuration officielle de GitHub Pages](https://docs.github.com/fr/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
- Configurer l’hébergeur pour servir `404.html` avec un véritable statut HTTP `404`.
- Rediriger `www.27pm.org` vers `https://27pm.org/` de façon permanente, puis exécuter `npm run check:public`.
- Faire confirmer par la direction les territoires de traitement, les durées de conservation, le fournisseur de courriel, l’identité légale de l’entreprise et la personne responsable avant de présenter la politique comme une attestation juridique complète.
