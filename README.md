# 27PM.org

Site vitrine de 27PM, studio québécois de sites web, d’applications sur mesure et de systèmes propulsés par l’IA.

[Visiter 27PM](https://27pm.org/) · [Création de sites web à Sorel-Tracy](https://27pm.org/services/creation-sites-web/) · [Sites et catalogues pour fabricants](https://27pm.org/services/sites-catalogues-fabricants/) · [Applications web sur mesure](https://27pm.org/services/applications-web-sur-mesure/) · [Automatisation et IA](https://27pm.org/services/automatisation-ia/)

Deux études présentent des concepts indépendants, sans mandat ni approbation des entreprises concernées : [Boulet](https://27pm.org/etudes/boulet/) et [Maisons S. Turner](https://27pm.org/etudes/maisons-turner/).

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

`npm run check` exécute le lint, les tests unitaires, le contrôle TypeScript et le build de production. Les tests de navigateur utilisent Chromium géré par Playwright et couvrent aussi les états interactifs, l’accessibilité et les largeurs de 320 à 1440 px. Ils simulent Turnstile et les réponses du CRM : un résultat `202` dans cette suite prouve uniquement le comportement du client, pas une mise en file ni une conservation réelles.

## Déploiement

Vercel publie `https://27pm.org/` à partir de la branche `main`. La commande `npm run check:release` construit le site avec Vite, puis vérifie les métadonnées, les données structurées, les fichiers destinés aux moteurs de recherche, la configuration de canonicalisation, la politique CSP et la mise en cache immuable limitée aux actifs générés et hachés.

À la demande du propriétaire du 11 septembre 2026, le `buildCommand` de `vercel.json` active le CRM et la mesure d’audience en production avec les deux variables d’approbation à `true`. Turnstile protège l’envoi du formulaire et Google Analytics ne charge qu’après consentement explicite. Le profil local reste désactivé par défaut; les aperçus Vercel et Pages neutralisent toujours ces fonctions. Après publication, exécuter `PUBLIC_SITE_ANALYTICS_APPROVED=true PUBLIC_SITE_CRM_APPROVED=true npm run check:public`. Cette configuration décrit le fonctionnement technique et ne vaut pas attestation des documents juridiques.

`vercel.json` impose les URL avec slash final et redirige les chemins `index.html` vers leurs URL canoniques. Après une publication, `npm run check:public` contrôle HTTPS, les routes canoniques, les en-têtes de sécurité et de cache, les redirections permanentes, `www`, les destinations de portfolio et le preflight CORS du CRM pour l’origine approuvée et une origine refusée. Ce contrôle envoie uniquement des requêtes `OPTIONS` sans données de formulaire : aucun `POST` ni soumission d’intake. Il ne prouve donc ni Turnstile côté serveur, ni persistance, ni dédoublonnage, ni restauration. Il reste séparé de `npm run check` afin que la validation locale demeure déterministe.

Les commandes `build:pages`, `check:pages` et leurs alias `preview` ne produisent plus qu’un aperçu historique sous `/27pm/`, toujours en `noindex`, sans analytique, sans CRM direct et sans `CNAME`. Elles ne constituent pas une voie de production. Le site Pages encore configuré dans GitHub doit être désactivé séparément dans le compte afin de libérer définitivement son ancienne revendication de `27pm.org`.

## Structure

- `index.html` : page principale, métadonnées SEO et contenu sémantique.
- `confidentialite/index.html` : politique de confidentialité.
- `404.html` : page d’erreur de marque, exclue de l’indexation.
- `src/` : styles, interactions et logique locale du contact et de ses fallbacks.
- `public/assets/` : actifs de marque, images optimisées et aperçus des réalisations.
- `design/` : concepts visuels et sources de génération.

### Pages de services et études

Les quatre offres disposent de pages HTML autonomes sous `/services/creation-sites-web/`, `/services/sites-catalogues-fabricants/`, `/services/applications-web-sur-mesure/` et `/services/automatisation-ia/`. Les études `/etudes/boulet/` et `/etudes/maisons-turner/` présentent les décisions de conception et les limites des démonstrations, sans les qualifier de mandats clients.

`src/content-routes.json` déclare ces routes pour le build Vite, la génération du sitemap et la liste des chemins autorisés dans la mesure d’audience. `scripts/check-content-build.mjs` vérifie le contenu initial, les métadonnées, les données structurées, les destinations locales et les liens entrants de chaque nouvelle page. Les tests de navigateur couvrent leur lecture, l’accessibilité, le retour au contact et le parcours sans JavaScript.

La commande `npm run build:preview && npm run check:preview` produit un aperçu en `noindex`, sans chargement de GA4 ni envoi CRM. Vercel sélectionne aussi ce profil lorsque `VERCEL_ENV=preview`; son `buildCommand` exécute `check:release` et valide le profil réellement construit. Les aperçus ne publient aucune directive Sitemap dans `robots.txt`. Les URL canoniques restent celles de production.

Lorsque l’envoi CRM est approuvé, Turnstile ne démarre qu’à l’approche du formulaire, au focus dans celui-ci ou à l’ouverture de `#contact`. L’envoi reste désactivé jusqu’à l’obtention d’un jeton; le courriel préparé demeure disponible en cas d’échec. Ce chargement différé évite le travail tiers sur le premier écran, sans changer l’autorisation nécessaire à la transmission.

Le [plan de visibilité externe](docs/seo-authority-plan.md) recense des profils et organismes vérifiés, avec leurs conditions et les textes préparés. La publication de profils, l’adhésion et les demandes de mention restent des actions distinctes; aucun backlink acquis n’est déduit de ce document.

Le laboratoire compose localement une piste de solution à partir de trois choix et n’envoie aucune donnée. Le formulaire de contact ne peut transmettre une demande au CRM public que si sa garde d’approbation et une clé de site Cloudflare Turnstile sont toutes deux fournies au build. Le courriel préparé, l’adresse visible et la copie de l’adresse demeurent disponibles dans tous les cas.

### Configuration du formulaire CRM

La clé de site Turnstile est **publique**, mais elle ne suffit pas à autoriser l’envoi. `.env.production` conserve `VITE_CRM_INTAKE_APPROVED=false` par défaut. L’activation exige la valeur exacte `true` après approbation de l’évaluation des facteurs relatifs à la vie privée du CRM et vérification des contrôles backend. Le profil Pages neutralise toujours les deux paramètres.

```bash
VITE_CRM_INTAKE_APPROVED=true \
VITE_TURNSTILE_SITE_KEY="<site-key-publique-pour-27pm.org>" \
npm run build
```

Cette commande décrit le profil autorisé; elle ne constitue pas une approbation. La sitekey se retrouve nécessairement dans le code client. Ne jamais placer la clé secrète Turnstile dans Vite, le dépôt ou le navigateur. Le widget doit autoriser l’hôte `27pm.org`; le backend doit valider le jeton, l’action `crm_intake`, l’origine, l’idempotence et les limites d’abus. Une réponse HTTP `202` indique seulement une acceptation en file. Après 12 secondes, le client cesse d’attendre, tente d’annuler le `fetch`, restaure le formulaire et conserve le brouillon ainsi que le fallback `mailto:`; un traitement serveur déjà commencé peut néanmoins se poursuivre.

L’intégration locale de Google Analytics 4 (`G-S0SKT2CTV0`) utilise un mode de consentement basique : aucune balise Google n’est chargée avant une acceptation explicite, et le chargement est limité à l’origine canonique `https://27pm.org`. L’activation de production est fermée par défaut; elle exige explicitement `VITE_ANALYTICS_APPROVED=true` après signature de l’EFVP. Les refus et acceptations sont conservés localement; le bouton « Préférences de mesure » permet de retirer son accord sur chaque page publique lorsque cette activation est autorisée.

## Avant la mise en ligne

- Dans Vercel, confirmer la branche de production `main`, le domaine `27pm.org`, la redirection `www` et le certificat TLS.
- Confirmer que Vercel sert `404.html` avec un véritable statut HTTP `404` et applique les redirections de `vercel.json`.
- Rediriger `www.27pm.org` vers `https://27pm.org/` de façon permanente, puis exécuter `npm run check:public`.
- Désactiver le site GitHub Pages historique ou retirer son domaine personnalisé; vérifier ensuite qu’il ne revendique plus `27pm.org`. La suppression éventuelle de la branche `gh-pages` est une opération distincte et facultative.
- Compléter et faire approuver l’EFVP du formulaire CRM, identifier les fournisseurs et territoires, fixer les durées de conservation et de suppression, puis prouver sur un environnement autorisé la validation Turnstile, le `202`, la persistance, le dédoublonnage, la reprise et une restauration de sauvegarde avant de définir `VITE_CRM_INTAKE_APPROVED=true`.
- Après cette approbation seulement, déployer le profil CRM et exécuter `PUBLIC_SITE_CRM_APPROVED=true npm run check:public`; organiser séparément l’essai désigné qui crée puis nettoie une demande réelle.
- Dans GA4, appliquer et consigner les réglages exigés par l’[EFVP Google Analytics](docs/efvp-google-analytics.md) : conservation à deux mois, remise à zéro désactivée, mesure améliorée limitée aux pages vues, aucune fonction publicitaire et aucune donnée fournie par les utilisateurs.
- Faire approuver et signer l’[EFVP Google Analytics](docs/efvp-google-analytics.md), puis joindre les preuves contractuelles et les réglages de la propriété avant d’activer la mesure d’audience en production.
- Après ces approbations seulement, définir `VITE_ANALYTICS_APPROVED=true` dans l’environnement de production Vercel, déployer, puis exécuter `PUBLIC_SITE_ANALYTICS_APPROVED=true npm run check:public` et le test réseau prévu par l’EFVP. Sans cette valeur exacte, l’identifiant, le chargeur et le code d’activation GA4 restent exclus de la compilation.
- Faire confirmer par la direction les territoires de traitement, les durées de conservation, le fournisseur de courriel, l’identité légale de l’entreprise et la personne responsable avant de présenter la politique comme une attestation juridique complète.
