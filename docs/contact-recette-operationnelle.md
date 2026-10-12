# Contact 27PM — recette opérationnelle

Préparé le 12 octobre 2026. Ce protocole n’atteste pas une soumission réelle. Il sépare les contrôles locaux du formulaire, la réception par le service et l’examen humain.

## État vérifié en lecture seule

- L’API publique de production répond au contrôle de santé et au preflight CORS de l’origine `https://27pm.org`. Ces appels ne créent aucune demande.
- Le code du récepteur examiné admet organisation, nom, courriel, type, message, reconnaissance de la politique, jeton Turnstile et honeypot `website`. Le contexte passe dans `message`; aucun nouveau champ ni schéma CRM n’est ajouté.
- Le récepteur normalise le courriel en minuscules. Il rejette notamment un courriel de plus de 254 unités UTF-16 ou un message de plus de 5 000; l’API et le client retirent les espaces extérieurs. Le formulaire garde une limite de nom plus stricte (120 contre 200 côté serveur).
- Le dédoublonnage serveur porte sur la clé, pas sur une empreinte du corps. Une nouvelle demande ne doit pas réutiliser la clé d’un autre contenu. Les tests locaux et la lecture du code ne prouvent pas la persistance de production.
- La lecture bornée de la file d’admission n’a trouvé aucune demande au moment du contrôle. Ce n’est pas un résultat commercial négatif ni une preuve d’absence historique; aucune première demande réelle n’a pu être qualifiée dans ce contrôle.

## Prérequis de l’essai réel

Obtenir l’autorisation explicite pour la publication du lot, puis pour **un cas synthétique identifiable**, sa reprise contrôlée et son examen dans la file. Ne pas contourner Turnstile ni utiliser un faux témoignage client. Confirmer la version déployée du site et du récepteur avant l’essai. Une éventuelle clôture, suppression ou restauration est une opération séparée.

## Cas de recette proposé — non exécuté

1. Utiliser le marqueur `QA-27PM-CONTEXTE-20261012-<suffixe>` dans l’organisation et un texte « TEST TECHNIQUE — aucun suivi commercial ». Utiliser une adresse réservée de test telle que `qa@example.test`, sans personne tierce.
2. Depuis une entrée contextualisée, modifier le brouillon, compléter la reconnaissance de confidentialité et la vérification requise, puis soumettre explicitement. Pour ce cas de reprise, laisser la première requête atteindre le service et provoquer une perte contrôlée de sa réponse avant qu’elle parvienne au formulaire. Celui-ci doit annoncer une réception non confirmée. Ne conserver dans le relevé que l’heure, le marqueur, la version, la clé de tentative et le statut; jamais de jeton Turnstile ni de secret.
3. Confirmer dans la file qu’une seule ligne correspond au marqueur et à la clé, que le texte entier et le type de projet sont conservés et que le courriel a été normalisé. Une réponse 202 seule ne suffit pas.
4. Pour le **même cas**, renouveler la vérification et réessayer le même brouillon dans la même page, en laissant cette fois parvenir la réponse. Vérifier le 202, la confirmation affichée, la clé inchangée et l’absence d’une deuxième ligne. Ne pas augmenter aveuglément le nombre de soumissions si l’état est ambigu; examiner la file avant de réessayer.
5. Ouvrir le cas dans le parcours CRM « Aujourd’hui → Qualifier → Comptes → Demandes publiques en attente ». Confirmer qui effectuera le premier examen humain. Ne pas annoncer de délai, rendez-vous ni courriel automatique non démontré.
6. Consigner succès, écart ou preuve manquante pour chaque étape. Le passage à « examiné », le rejet ou le nettoyage du cas attendent leur autorisation; ils modifient l’état de la file.

Une restauration de sauvegarde n’est pas couverte par ce seul cas. Le contrôle de bout en bout n’établit pas non plus une délivrabilité en boîte principale.

## Qualité des premières demandes

Après réception de demandes véritables, tenir un relevé privé minimal : besoin identifiable, service pertinent, contexte à redemander, prochaine étape possible, date du premier examen et suite décidée. Le responsable doit être nommé avant exploitation; cette page n’attribue personne automatiquement. Ne pas recopier les données personnelles dans le dépôt public ou l’analytique.

Définir le dénominateur de toute mesure : demandes reçues, demandes exploitables, conversations ou mandats. Avec une file vide ou très peu de cas, conclure « données insuffisantes », pas « conversion améliorée ». L’objectif est d’évaluer la qualité des conversations, pas d’ajouter un scanner ou une instrumentation sans décision distincte.
