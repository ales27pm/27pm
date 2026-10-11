# Baromètre 27PM des bannières de consentement

Ce dossier contient le contrat d’entrée du collecteur. Le fichier d’exemple n’est pas un échantillon réel et ne doit pas être publié comme résultat.

Le collecteur charge uniquement la page d’accueil publique dans un contexte Chromium mobile neuf (agent utilisateur Android/Chromium, interface tactile et fenêtre 390 × 844). Il ne prétend pas reproduire Safari ni un iPhone. Il ne crée aucun compte, ne soumet aucun formulaire et ne contourne aucun mécanisme antibot. Il identifie d’abord la bannière, puis cherche uniquement à l’intérieur de celle-ci une action de refus par son nom accessible français ou anglais. Un repère temporaire replace le départ du parcours clavier au début du document; le collecteur tente ensuite d’atteindre l’action uniquement avec Tab, puis l’active avec Entrée lorsqu’un seul candidat est détecté.

Les URL d’entrée et de destination doivent viser le même hôte canonique (préfixe `www` neutralisé), la racine ou une page d’accueil linguistique reconnue (`/`, `/fr/`, `/en/`, `/fr-ca/`, `/en-ca/`, `/accueil/` ou `/home/`), sans identifiants, paramètres ni fragment. Une redirection vers un autre hôte ou une page interne rend l’observation indéterminée. Il en va de même pour une plateforme sociale/de réservation, un interstitiel de sécurité, un statut hors 2xx ou un type MIME autre que HTML.

Seules les destinations finales qui répondent avec un statut HTTP 2xx entrent dans les dénominateurs mesurés. Pour les mesures catégorielles, `pct` est calculé parmi les valeurs effectivement mesurées; `denominator_n`, `measured_n` et `missing_n` restent publiés séparément afin qu’une valeur indéterminée ne soit jamais transformée en réponse négative.

## Garde-fous éditoriaux

- Employer « entreprises » et non « PME » tant que la taille n’est pas démontrée par la source.
- Publier uniquement les agrégats globaux des huit métriques allowlistées; ne publier aucune observation individuelle, aucun identifiant pseudonyme, aucun secteur ni aucune région. Le manifeste, les URL et la graine restent privés.
- Ne pas appeler un hôte externe un « tiers » ou un « traceur » sans classification indépendante.
- Ne pas présenter l’absence d’un signal observé comme une preuve d’absence de suivi.
- Ne produire ni note globale, ni certificat, ni verdict de conformité juridique.
- Versionner le cadre d’échantillonnage, la règle de sélection, l’environnement, le collecteur et les limites avant de lancer le lot complet.

## Utilisation

Construire le manifeste privé depuis des instantanés locaux des trois fichiers SIT Québec :

```sh
npm run barometer:sample -- \
  --restauration chemin/sit-quebec-restauration.csv \
  --hebergements chemin/sit-quebec-hebergements-collectifs.csv \
  --culture chemin/sit-quebec-culture-art-et-patrimoine.csv \
  --retrieved-at YYYY-MM-DD \
  --seed-file chemin/graine-privee.txt \
  --out artifacts/barometre-consentement/sample-manifest.json
```

Le générateur rejette les URL profondes, les plateformes sociales et de réservation, les entrées sans région et tout hôte associé à plusieurs identifiants, régions ou sources. Il conserve les empreintes et l’entonnoir d’exclusion des instantanés. Un flot déterministe retient vingt hôtes par source, au plus deux par cellule source-région, avec des quotas régionaux globaux; l’ordre dans chaque cellule vient d’un HMAC-SHA256 à graine privée. Le manifeste et la graine sont gardés dans `artifacts/`, ignoré par Git.

Valider le manifeste sans accès réseau :

```sh
npm run barometer:collect -- --manifest data/barometre-consentement/sample.example.json --validate-only
```

Lancer un pilote et écrire les résultats dans un dossier ignoré par Git :

```sh
npm run barometer:collect -- --manifest chemin/vers/sample.json --out artifacts/barometre-consentement/pilote-5 --limit 5
```

Le dossier de sortie contient un JSON allowlisté, un CSV d’agrégats globaux et leurs empreintes SHA-256. Les observations pseudonymisées, erreurs, destinations, redirections et la provenance détaillée sont écrites dans le sous-dossier privé `private/`, sous `artifacts/` ignoré par Git. Le collecteur refuse tout chemin de sortie hors de `artifacts/barometre-consentement/`. Aucune observation individuelle ni ventilation par identifiant, secteur ou région n’est destinée à la publication. Les champs `operator_declared_network_region` et `operator_declared_network_edge` sont des valeurs déclarées par l’opérateur; ils ne prouvent pas le trajet de chaque requête et aucune adresse IP n’est conservée.

Une seconde observation ne doit servir qu’à résoudre un résultat `indeterminate` ou un échec technique, jamais à choisir le résultat le plus favorable.
