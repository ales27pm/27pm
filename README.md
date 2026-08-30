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

Le laboratoire compose localement une piste de solution à partir de trois choix et n’envoie aucune donnée. Le formulaire de contact peut transmettre une demande au CRM public lorsqu’une clé de site Cloudflare Turnstile est fournie au build. Sans cette configuration, l’envoi direct reste désactivé. Le courriel préparé, l’adresse visible et la copie de l’adresse demeurent disponibles dans tous les cas.

### Configuration du formulaire CRM

La seule variable cliente requise est une clé **publique** de site Turnstile :

```bash
VITE_TURNSTILE_SITE_KEY="<site-key-publique-pour-27pm.org>" npm run build
```

En production, `VITE_TURNSTILE_SITE_KEY` doit être configurée dans Vercel. Ne jamais placer la clé secrète Turnstile dans Vite, le dépôt ou le navigateur. Le widget doit autoriser l’hôte `27pm.org` et le backend doit valider l’action `crm_intake`. Une réponse HTTP `202` indique seulement la mise en file d’examen. Si la variable manque, si Turnstile ne charge pas ou si le CRM refuse la demande, le site conserve le fallback `mailto:`.

L’intégration locale de Google Analytics 4 (`G-S0SKT2CTV0`) utilise un mode de consentement basique : aucune balise Google n’est chargée avant une acceptation explicite, et le chargement est limité à l’origine canonique `https://27pm.org`. L’activation de production est fermée par défaut; elle exige explicitement `VITE_ANALYTICS_APPROVED=true` après signature de l’EFVP. Les refus et acceptations sont conservés localement; le bouton « Préférences de mesure » permet de retirer son accord sur chaque page publique lorsque cette activation est autorisée.

## Avant la mise en ligne

- Dans Vercel, confirmer la branche de production `main`, le domaine `27pm.org`, la redirection `www` et le certificat TLS.
- Confirmer que Vercel sert `404.html` avec un véritable statut HTTP `404` et applique les redirections de `vercel.json`.
- Rediriger `www.27pm.org` vers `https://27pm.org/` de façon permanente, puis exécuter `npm run check:public`.
- Dans GA4, appliquer et consigner les réglages exigés par l’[EFVP Google Analytics](docs/efvp-google-analytics.md) : conservation à deux mois, remise à zéro désactivée, mesure améliorée limitée aux pages vues, aucune fonction publicitaire et aucune donnée fournie par les utilisateurs.
- Faire approuver et signer l’[EFVP Google Analytics](docs/efvp-google-analytics.md), puis joindre les preuves contractuelles et les réglages de la propriété avant d’activer la mesure d’audience en production.
- Après cette approbation seulement, définir `VITE_ANALYTICS_APPROVED=true` dans l’environnement de production Vercel, déployer, puis exécuter `PUBLIC_SITE_ANALYTICS_APPROVED=true npm run check:public` et le test réseau prévu par l’EFVP. Sans cette valeur exacte, l’identifiant, le chargeur et le code d’activation GA4 restent exclus de la compilation.
- Faire confirmer par la direction les territoires de traitement, les durées de conservation, le fournisseur de courriel, l’identité légale de l’entreprise et la personne responsable avant de présenter la politique comme une attestation juridique complète.
