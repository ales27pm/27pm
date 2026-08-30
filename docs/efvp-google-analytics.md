# Évaluation des facteurs relatifs à la vie privée — Google Analytics 4

| Champ | Valeur |
|---|---|
| Organisation | 27PM |
| Service évalué | Site public `https://27pm.org/` |
| Fournisseur | Google LLC — Google Analytics 4 |
| Identifiant public de mesure | `G-S0SKT2CTV0` |
| Version du rapport | 0.5 |
| Date de l’évaluation | 29–30 août 2026 |
| Responsable de l’évaluation | Direction de 27PM — à confirmer lors de l’approbation |
| Statut | Préparé; décision conditionnelle à approuver |

> Ce rapport documente une évaluation opérationnelle adaptée à un site vitrine. Il ne constitue pas un avis juridique. Tant que les conditions préalables et l’approbation finale ne sont pas complétées, il ne faut pas activer Google Analytics en production.

## 1. Résumé de la décision

27PM souhaite mesurer les pages consultées, les sessions et la provenance générale des visites afin d’améliorer son site. Google Analytics 4 peut atteindre cet objectif, mais traite des identifiants et des données techniques susceptibles de constituer des renseignements personnels à l’extérieur du Québec.

Le projet est **acceptable uniquement sous les conditions cumulatives suivantes** :

1. aucun script ni appel Google n’est émis avant un consentement explicite;
2. le refus n’enlève aucune fonctionnalité et le retrait demeure accessible sur chaque page;
3. la mesure améliorée est limitée aux pages vues; les événements automatiques de première visite, de session et d’engagement sont documentés; les fonctions publicitaires, Google Signals et les données fournies par les utilisateurs sont désactivés;
4. les témoins sont limités à 60 jours sans renouvellement et les données utilisateur et événementielles sont réglées à deux mois sans remise à zéro lors d’une nouvelle activité;
5. les conditions de traitement des données de Google sont acceptées par une personne autorisée, conservées comme preuve et réévaluées avec la liste des sous-traitants;
6. les accès à la propriété sont limités, protégés par l’authentification multifacteur et revus périodiquement;
7. la présente EFVP est approuvée et ses risques résiduels sont acceptés par la direction.

**Décision au 30 août 2026 : NE PAS ACTIVER EN PRODUCTION.** L’implémentation locale du consentement est prête et testée, et les réglages minimaux de la propriété GA4 ont été appliqués et relus dans l’interface Google. Une garde de compilation fermée par défaut empêche l’activation tant que `VITE_ANALYTICS_APPROVED` ne vaut pas exactement `true`. L’avenant de traitement est accepté dans le compte, mais l’autorité juridique de la personne qui l’a accepté n’est pas documentée. La page d’administration du DPA ne contient toujours aucune entité juridique ni aucun contact. La validation en deux étapes est maintenant activée et vérifiée. La liste datée des sous-traitants est annexée, mais l’approbation finale, les détails du DPA et la preuve après déploiement restent à compléter.

## 2. Motif et portée de l’EFVP

L’article 3.3 de la Loi sur la protection des renseignements personnels dans le secteur privé exige une EFVP pour un projet d’acquisition, de développement ou de refonte d’un système d’information ou d’une prestation électronique impliquant des renseignements personnels. L’article 17 l’exige aussi avant de communiquer un renseignement personnel à l’extérieur du Québec ou de confier à un organisme extérieur au Québec la tâche de le recueillir, de l’utiliser, de le communiquer ou de le conserver pour une entreprise.

Cette évaluation couvre :

- la collecte facultative effectuée dans le navigateur après consentement;
- la transmission à Google Analytics;
- le traitement, la conservation, les rapports et les accès administratifs;
- le retrait du consentement et la suppression des identifiants locaux;
- les réglages du site, de la propriété GA4 et de la balise Google.

Elle ne couvre pas les échanges par courriel, les journaux techniques de Vercel ni un futur outil publicitaire. Toute liaison à Google Ads, nouvelle destination de balise, nouvelle finalité, collecte de données fournies par l’utilisateur ou modification importante des événements impose une révision avant activation.

## 3. Description du projet et solutions de rechange

### Objectif

Produire des statistiques agrégées de fréquentation pour repérer les pages utiles, comprendre les grandes sources de visite et améliorer le contenu et l’expérience du site.

### Solutions considérées

| Solution | Avantage | Limite | Conclusion |
|---|---|---|---|
| Aucune mesure d’audience | Atteinte minimale à la vie privée | Aucune preuve d’usage du site | Possible, mais ne répond pas entièrement au besoin d’amélioration |
| Outil analytique auto-hébergé ou sans témoins | Réduit potentiellement les transferts et identifiants | Exploitation, sécurité et conformité à évaluer séparément | À réévaluer si les conditions GA4 ne peuvent être satisfaites |
| GA4 par défaut ou mode avancé | Mesure plus complète | Peut charger la balise ou transmettre avant un accord; fonctions supplémentaires | Rejeté |
| GA4 en mode basique, après opt-in, configuration minimale | Répond au besoin avec une collecte limitée et facultative | Transfert hors Québec et dépendance à Google subsistent | Retenu sous conditions |

### Nécessité et proportionnalité

La finalité d’amélioration du site est légitime et reliée aux statistiques demandées. Le choix demeure proportionnel seulement si la collecte est facultative, minimale, de courte durée, sans publicité ni enrichissement par des données fournies par la personne. Les statistiques n’étant pas nécessaires au fonctionnement du site, un refus doit laisser l’expérience intacte. Si ces limites ne peuvent être maintenues, 27PM doit suspendre GA4 ou choisir une solution moins intrusive.

## 4. Rôles et responsabilités

| Partie | Rôle dans ce projet | Responsabilités |
|---|---|---|
| Direction de 27PM | Responsable du projet et des renseignements | Approuver l’EFVP, accepter les risques résiduels, autoriser les accès et répondre aux demandes des personnes |
| Responsable de la protection des renseignements personnels | Gouvernance | Maintenir le rapport, vérifier les réglages et contrats, traiter les plaintes et incidents |
| Responsable technique de 27PM | Mise en œuvre | Maintenir le blocage avant consentement, les tests, les durées, le retrait et les preuves de déploiement |
| Google LLC | Fournisseur de Google Analytics | Traiter les données selon le contrat et les instructions configurées; protéger le service et notifier les incidents selon les conditions applicables |
| Sous-traitants de Google | Soutien ou traitement délégué | Accéder uniquement dans les limites contractuelles applicables |
| Visiteur | Personne concernée | Choisir librement d’accepter ou de refuser et pouvoir retirer ce choix |

## 5. Inventaire des renseignements

| Catégorie | Source et finalité | Sensibilité contextuelle | Conservation prévue |
|---|---|---|---|
| Choix `granted` ou `denied` | Enregistré localement dans le navigateur pour respecter le choix | Faible; aucune identité déclarée | Jusqu’à modification du choix ou effacement du stockage du navigateur |
| Identifiant client aléatoire | Témoins `_ga` et `_ga_<identifiant>` après acceptation; distinction des visites et sessions | Modérée, car persistant et associable à un parcours | 60 jours maximum, sans renouvellement à chaque visite |
| Page, titre, provenance, date et heure | Événements automatiques nécessaires aux statistiques | Faible à modérée; une URL ou un référent peut révéler un contexte | Données utilisateur et événementielles : deux mois, sans remise à zéro sur nouvelle activité |
| Données de session | Nombre et durée des sessions, engagement agrégé | Faible à modérée | Même réglage de deux mois pour les données détaillées |
| Adresse IP traitée transitoirement | Acheminement, sécurité et dérivation de localisation approximative par Google | Modérée; identifiant technique | Google indique qu’elle est écartée avant journalisation; la localisation dérivée peut être conservée |
| Navigateur, appareil et localisation approximative | Compatibilité et compréhension générale de l’audience | Faible à modérée selon la granularité | Deux mois pour les données détaillées; granularité à minimiser dans la propriété |

Ne sont pas nécessaires et ne doivent pas être transmis : nom, adresse courriel, numéro de téléphone, adresse, texte du brief, contenu de courriel, identifiant utilisateur propre à 27PM, données publicitaires, intérêts ou données démographiques enrichies.

Le réglage de deux mois de GA4 vise les données utilisateur et événementielles détaillées; il ne supprime pas nécessairement les rapports agrégés standards. Cette limite doit être expliquée honnêtement et vérifiée après tout changement de produit.

## 6. Parcours des renseignements

```text
Visiteur
  ├─ refuse ou ne choisit pas ─> aucun script Google, aucune mesure GA4
  └─ accepte
       ├─ choix conservé localement dans son navigateur
       └─ balise GA4 chargée sur https://27pm.org seulement
            └─ collecte régionale Google par HTTPS
                 └─ traitement par Google et ses sous-traitants, possiblement hors Québec
                      └─ rapports GA4 accessibles aux personnes autorisées de 27PM
```

Le site est hébergé par Vercel. Cet hébergement est évalué séparément de la mesure d’audience; il ne rend pas Google Analytics nécessaire au service demandé par le visiteur.

Le brief de contact ne place aucun renseignement dans l’adresse HTTP(S) de la page et le site ne lit aucun paramètre de requête entrant. Il construit toutefois localement un URI `mailto:` dont le corps peut contenir le contexte du projet, le nom et l’adresse courriel. Ce lien demeure dans le DOM pendant la saisie et tant que la page reste ouverte, jusqu’à une nouvelle modification ou une navigation. Pour empêcher sa collecte comme destination de clic, les clics sortants et toutes les interactions automatiques autres que les pages vues sont désactivés dans le flux GA4 et dans la balise Google. Le test réseau après déploiement doit confirmer qu’aucun `link_url`, `mailto:` ou contenu du brief n’est transmis.

## 7. Communication à l’extérieur du Québec

### Destinations et régime applicable

Google LLC est une société organisée au Delaware et exploitée aux États-Unis. Les conditions de traitement de Google permettent un traitement dans tout pays où Google ou ses sous-traitants maintiennent des installations. Les États-Unis constituent donc une destination prévisible; d’autres pays peuvent intervenir selon les centres de données, l’assistance et les sous-traitants en vigueur.

Le régime américain combine des lois fédérales et étatiques, des pouvoirs réglementaires et des règles sectorielles. La Commission d’accès à l’information cite notamment les Fair Information Practice Principles parmi les principes généralement reconnus, mais cela ne crée pas à lui seul une présomption de protection adéquate pour ce projet. Des accès légalement obligatoires par des autorités étrangères et des recours différents de ceux du Québec demeurent possibles.

### Mesures contractuelles à vérifier

Avant activation, 27PM doit :

- faire confirmer par une personne autorisée l’acceptation des Google Ads Data Processing Terms applicables à Google Analytics — l’administration indique une acceptation le 29 août 2026;
- conserver la date, la version et une copie de l’avenant, puis compléter ou confirmer les coordonnées et entités juridiques dans les détails du DPA;
- définir une adresse valide pour les notifications contractuelles et de sous-traitants;
- conserver la liste courante des sous-traitants, leurs lieux et leurs fonctions;
- vérifier qu’aucune destination Google Ads ni autre produit n’est reliée à la balise ou à la propriété — vérification du 29 août 2026 : aucune association Google Ads et aucune balise de site associée;
- réévaluer le régime et les mesures lorsqu’un sous-traitant, un pays, une finalité ou les conditions changent.

### Preuve contractuelle datée

La page d’administration Google Analytics confirme une acceptation des conditions relatives au traitement des données le 29 août 2026. Le 30 août 2026, la page d’administration du DPA indiquait toutefois qu’aucune organisation Marketing Platform n’était associée au compte et ne présentait aucune entité juridique ni aucun contact DPA. Ces renseignements doivent être fournis par une personne qui connaît l’identité juridique et détient l’autorité requise; ils ne peuvent pas être déduits d’un profil technique ou d’une identité Git.

L’[annexe des sous-traitants Google Analytics](./annexe-sous-traitants-google-analytics.md) conserve le relevé applicable consulté le 30 août 2026 : 64 lignes d’entités, réparties sur 33 valeurs de localisation d’entreprise. Google exige une adresse de notification valide et prévoit un avis d’au moins 30 jours avant qu’un nouveau sous-traitant traite des données. Le flux RSS officiel est également consigné dans l’annexe. Cette preuve ne constitue pas, à elle seule, une conclusion de protection adéquate au sens québécois.

### Conclusion provisoire sur la protection adéquate

La faible sensibilité des données prévues, le consentement préalable, la minimisation, le chiffrement en transit et au repos annoncé par Google, la courte durée, l’absence de publicité et les engagements contractuels peuvent ramener la plupart des risques à un niveau faible ou modéré. Toutefois, la protection adéquate au sens de l’article 17 **n’est pas conclue dans ce rapport tant que les preuves contractuelles, les destinations et les réglages de la propriété ne sont pas annexés et approuvés**.

## 8. Mesures de protection retenues

### Mesures techniques locales déjà mises en œuvre

- mode de consentement basique : aucune balise Google avant opt-in;
- activation de production fermée par défaut et conditionnée à la valeur exacte `VITE_ANALYTICS_APPROVED=true` après approbation; dans une compilation non approuvée, le chargeur et l’identifiant sont absents, le contrôle de préférences indique la désactivation et nettoie tout ancien choix ou témoin accessible;
- garde stricte à l’origine `https://27pm.org` afin d’exclure localhost et les aperçus;
- consentements publicitaires toujours refusés;
- `allow_google_signals: false` et `allow_ad_personalization_signals: false` dans la configuration de la balise;
- témoins réglés à 60 jours avec `cookie_update: false`;
- retrait disponible sur chaque page, arrêt des mesures futures et suppression des témoins `_ga*` du navigateur;
- échec de stockage traité en mode fermé : la mesure demeure désactivée;
- réduction locale de `page_location` aux routes canoniques `/`, `/confidentialite/` et `/404.html`, classement des chemins inconnus comme `/404.html`, suppression de leurs requêtes et fragments, et réduction de `page_referrer` à son origine;
- tests unitaires et navigateur couvrant le refus, l’acceptation, la révocation et l’absence de fuite avant consentement.

Ces mesures sont présentes dans le dépôt de travail. Elles doivent encore être publiées puis confirmées par un test réseau sur le site public.

### Réglages GA4 vérifiés le 29 août 2026

- propriété `27pm.org` (`552095663`), flux Web `27pm.org` (`15525513502`) et identifiant de mesure `G-S0SKT2CTV0` : **vérifiés**;
- conservation des données utilisateur et événementielles : **2 mois**;
- remise à zéro des données utilisateur sur nouvelle activité : **désactivée**;
- interactions de formulaire de la mesure améliorée : **désactivées**;
- détection automatique des interactions de formulaire dans la balise Google : **désactivée**;
- mesure améliorée du flux : **pages vues seulement**; défilements, clics sortants, recherche interne, formulaires, vidéos et téléchargements **désactivés**;
- détection automatique de la balise Google : **pages vues au chargement seulement**; changements d’historique, défilements, clics sortants, formulaires, vidéos et téléchargements **désactivés**. GA4 peut néanmoins générer ses événements techniques de base, notamment `first_visit`, `session_start` et `user_engagement`;
- collecte de données fournies par les utilisateurs dans la propriété : **désactivée**;
- capacité de données fournies par les utilisateurs dans la balise : **désactivée**;
- Google Signals : **désactivé**;
- personnalisation publicitaire : **refusée dans les 307 régions**;
- liens Google Ads : **0**; balises de site associées : **0**;
- partages facultatifs du compte avec Google : **tous désactivés** — produits et services, modélisation et insights, assistance technique, recommandations commerciales;
- collecte granulaire de localisation et d’appareil : **désactivée**;
- rédaction automatique des adresses courriel : **active**;
- rédaction de clés de paramètres d’URL dans l’administration : **inactive**. Le code local limite `page_location` aux routes canoniques, classe les routes inconnues comme 404, retire toutes les requêtes et tous les fragments et réduit `page_referrer` à son origine; aucune exception ne doit être ajoutée sans réviser l’EFVP et les tests.
- accès au compte : **un administrateur vérifié**; le 30 août 2026, la validation en deux étapes du compte Google authentifié a été **activée et vérifiée**, avec une application d’authentification configurée. Une revue périodique des méthodes et des accès demeure requise.

Google indique qu’une modification de la conservation peut prendre jusqu’à 24 heures avant de s’appliquer. Les valeurs ci-dessus décrivent les réglages enregistrés dans l’administration; elles ne constituent pas encore une preuve de collecte en production.

## 9. Évaluation des risques

Échelle : gravité et probabilité de 1 à 4; score = gravité × probabilité. Faible : 1 à 4; modéré : 6 à 8; élevé : 9 à 16. Les cotes résiduelles supposent l’exécution de toutes les mesures indiquées.

| Risque pour les personnes | Initial | Mesures obligatoires | Résiduel prévu | État |
|---|---:|---|---:|---|
| Mesure ou transmission avant consentement | 3 × 3 = 9, élevé | Mode basique, aucun chargement préalable, tests réseau et mode fermé | 3 × 1 = 3, faible | Réalisé localement; preuve live à faire |
| Capture accidentelle d’un courriel, d’un nom, du brief ou du `mailto:` contextualisé | 4 × 3 = 12, élevé | Formulaires, clics sortants et données fournies désactivés aux deux niveaux, liste fermée de routes analytiques, routes inconnues ramenées à 404, référent limité à son origine, rédaction des courriels, test avec valeurs sentinelles | 4 × 1 = 4, faible | Code et réglages externes vérifiés; preuve live à faire |
| Profilage, enrichissement ou réutilisation publicitaire | 3 × 2 = 6, modéré | Signaux, personnalisation, consentements Ads et liaisons désactivés | 3 × 1 = 3, faible | Code et propriété vérifiés; audit périodique requis |
| Réidentification à partir d’un identifiant, du parcours ou de la localisation | 3 × 2 = 6, modéré | Durée courte, données minimales, granularité réduite, rapports agrégés | 3 × 1 = 3, faible | Réglages de granularité et de durée vérifiés; preuve live à faire |
| Accès étranger légal ou sous-traitant hors Québec | 3 × 2 = 6, modéré | Contrat, chiffrement, minimisation, revue des pays et sous-traitants | 3 × 2 = 6, modéré | Preuves contractuelles à faire approuver |
| Compromission du compte GA4 | 3 × 2 = 6, modéré | MFA, moindre privilège, revue trimestrielle des accès et historique des changements | 3 × 1 = 3, faible | MFA activée et vérifiée le 30 août 2026; revue périodique requise |
| Conservation supérieure à la décision | 2 × 3 = 6, modéré | 2 mois, reset désactivé, 60 jours côté navigateur, audit périodique | 2 × 1 = 2, faible | Code et propriété vérifiés; audit périodique requis |
| Consentement local devenu périmé après un changement important | 2 × 3 = 6, modéré | Clé de consentement versionnée, nouvelle demande après modification de finalité ou de politique, revue annuelle | 2 × 1 = 2, faible | Version technique présente; processus à instaurer |
| Changement silencieux de fournisseur ou de configuration | 3 × 2 = 6, modéré | Notifications contractuelles, revue annuelle et avant tout changement, tests automatisés | 3 × 1 = 3, faible | Processus à instaurer |

Le risque résiduel de traitement hors Québec demeure modéré et doit être explicitement accepté par la personne signataire. Tout risque élevé restant empêche l’activation.

## 10. Plan d’action et preuves

| Action | Responsable | Échéance | Preuve attendue | Statut |
|---|---|---|---|---|
| Valider le consentement basique et l’arrêt après retrait | Technique | Avant déploiement | Tests automatisés et revue du code | Fait localement |
| Ouvrir la bonne propriété `G-S0SKT2CTV0` avec un rôle Éditeur | Direction | Avant réglages | Compte, propriété et flux relus dans l’administration | Fait le 29 août 2026 |
| Appliquer tous les réglages GA4 de la section 8 | Direction / Technique | Avant activation | Relecture datée de chaque réglage | Fait le 29 août 2026; mesure améliorée limitée aux pages vues; rétention possiblement en propagation pendant 24 h |
| Confirmer les conditions de traitement et documenter les sous-traitants | Direction / Vie privée | Avant activation | Version, date, entités et contacts du DPA, liste annexée | Acceptation datée du 29 août 2026 vérifiée; liste datée annexée; entité juridique, contacts et autorité de l’accepteur à compléter |
| Vérifier l’absence de liens Ads et de destinations de balise | Direction / Technique | Avant activation | Écrans des associations et destinations | Fait le 29 août 2026 : 0 lien Google Ads et 0 balise associée |
| Vérifier MFA et limiter les utilisateurs de la propriété | Direction | Avant activation | Liste des accès, rôles et confirmation MFA | Fait le 30 août 2026 : un administrateur et validation en deux étapes active |
| Approuver l’EFVP et accepter le risque résiduel hors Québec | Direction | Avant activation | Section 12 signée | À faire |
| Ouvrir la garde de production | Technique | Après signature, avant déploiement | `VITE_ANALYTICS_APPROVED=true` dans l’environnement Vercel approuvé | Bloquée par défaut |
| Publier puis effectuer un test réseau sans envoyer de données sentinelles à Google | Technique | Après approbation | Zéro requête avant opt-in; requêtes prévues après opt-in; aucune valeur de formulaire | À faire |
| Vérifier Realtime, la rétention et les événements effectivement reçus | Technique / Vie privée | Après déploiement | Journal de vérification daté | À faire |
| Renouveler le consentement lors d’une modification substantielle de la notice ou des finalités | Vie privée / Technique | À chaque changement | Nouvelle version de notice et de clé locale | Récurrent |
| Revoir l’EFVP, les accès, réglages, contrats et sous-traitants | Vie privée | Annuellement et à chaque changement | Nouvelle version approuvée | Récurrent |

## 11. Critères de suspension et de révision

27PM doit désactiver la mesure jusqu’à correction si :

- une requête Google est observée avant le consentement;
- un nom, courriel, numéro, adresse ou contenu libre apparaît dans un événement;
- les réglages requis ne peuvent être vérifiés ou sont réactivés;
- une liaison publicitaire ou une nouvelle destination apparaît;
- l’accès au compte n’est plus limité ou protégé;
- un changement contractuel, de sous-traitant, de pays ou d’usage modifie l’analyse;
- un incident ou une plainte révèle un risque non évalué.

## 12. Approbation

En signant, la personne autorisée confirme avoir examiné la nécessité, la proportionnalité, les mesures contractuelles, le régime des destinations, les risques et les preuves annexées. Elle conclut, le cas échéant, que la protection est adéquate et accepte explicitement les risques résiduels.

| Champ | À compléter |
|---|---|
| Décision | ☐ Approuvé sous conditions remplies ☐ Refusé ☐ À réviser |
| Nom | |
| Titre et autorité | |
| Signature | |
| Date | |
| Motifs ou conditions supplémentaires | |

**L’absence de signature vaut absence d’autorisation de mise en production.**

## 13. Registre des versions

| Version | Date | Auteur | Changement | Approbation |
|---|---|---|---|---|
| 0.1 | 29 août 2026 | 27PM / préparation technique | Évaluation initiale de GA4 et plan de contrôles | En attente |
| 0.2 | 29 août 2026 | 27PM / configuration technique | Réglages GA4 minimaux appliqués et état de preuve consigné | En attente |
| 0.3 | 30 août 2026 | 27PM / configuration technique | Garde de production fermée par défaut, URLs analytiques minimisées et portée des événements précisée | En attente |
| 0.4 | 30 août 2026 | 27PM / vérification contractuelle et sécurité | État DPA, liste datée des sous-traitants et MFA désactivée consignés; garde maintenue fermée | En attente |
| 0.5 | 30 août 2026 | 27PM / vérification de sécurité | Validation en deux étapes activée et vérifiée; absence d’entité et de contact DPA reconfirmée | En attente |

## 14. Références officielles consultées

- Commission d’accès à l’information du Québec, [Guide d’accompagnement — Réaliser une EFVP](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_GU_EFVP.pdf)
- LégisQuébec, [Loi sur la protection des renseignements personnels dans le secteur privé, article 3.3](https://www.legisquebec.gouv.qc.ca/fr/version/lc/P-39.1?code=se:3_3)
- LégisQuébec, [Loi sur la protection des renseignements personnels dans le secteur privé, article 17](https://www.legisquebec.gouv.qc.ca/fr/version/lc/P-39.1?code=se:17)
- Commission d’accès à l’information du Québec, [Critères de validité du consentement](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/consentement-personnes-entreprises)
- Google, [Data retention](https://support.google.com/analytics/answer/7667196)
- Google, [Enhanced measurement events](https://support.google.com/analytics/answer/9216061)
- Google, [User-provided data collection](https://support.google.com/analytics/answer/14077171)
- Google, [Privacy controls in Google Analytics](https://support.google.com/analytics/answer/9019185)
- Google, [Google Ads Data Processing Terms](https://business.safety.google/adsprocessorterms/)
- Google, [Google Ads Data Processing Terms — Subprocessor Information](https://business.safety.google/adssubprocessors/)
- Google, [flux RSS des changements de sous-traitants](https://business.safety.google/adssubprocessors/index.rss)
- Google, [Regional data collection](https://support.google.com/analytics/answer/11598602)
