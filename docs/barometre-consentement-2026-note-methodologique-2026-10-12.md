# Note méthodologique et limite de preuve — 12 octobre 2026

Cette note accompagne la précision ajoutée à la page HTML du Baromètre 27PM 2026. Elle ne constitue pas une attestation rétrospective du lot du 11 octobre ni de ses revues. Elle ne change ni l’édition archivée 0.1.2, ni ses huit agrégats, ni ses dénominateurs.

## Périmètre vérifiable

Le code consulté est fixé à la révision [`b75584baa2464fc4c92a14fb936b73845a43f25c`](https://github.com/ales27pm/27pm/tree/b75584baa2464fc4c92a14fb936b73845a43f25c). Le collecteur y déclare la version `0.4.0`. Ces références identifient le code inspecté le 12 octobre; leur correspondance avec l’exécution historique du lot n’a pas été établie par une preuve d’exécution.

- Le chargement attend `DOMContentLoaded`, puis 2 500 ms. Il valide ensuite la destination, le statut, le contenu HTML et l’absence d’interstitiel.
- Sans bannière détectée, les comptes avant choix sont capturés après la détection. Avec une action de refus unique, la capture suit Axe et les tabulations, juste avant Entrée. La durée d’observation varie donc selon le parcours; de l’activité déclenchée par le focus peut être incluse.
- Le parcours s’arrête après 50 tabulations au maximum. L’évaluation après activation attend 1 500 ms.
- Le nom accessible du contrôle doit correspondre au motif `REJECT_LABEL` du [collecteur fixé](https://github.com/ales27pm/27pm/blob/b75584baa2464fc4c92a14fb936b73845a43f25c/scripts/collect-consent-barometer.mjs#L27). La page HTML donne les trois familles reconnues.
- Le profil configuré est Chromium mobile, Pixel 7 avec fenêtre 390 × 844, tactile, `fr-CA` et `America/Toronto`. La version du navigateur effectivement employée pour le lot n’est pas attestée dans le dossier public.

La formulation « avant toute interaction » était plus large que cette frontière de mesure. La page emploie désormais « avant tout choix de consentement » et explicite la fenêtre variable. Aucun recalcul de données privées n’accompagne cette correction éditoriale.

## Revues historiques

Les fichiers archivés déclarent une double revue et un recalcul indépendants. Les booléens de publication, les valeurs figées dans les tests et les empreintes des livrables ne démontrent pas à eux seuls qui a réalisé ces contrôles, avec quelle indépendance ou sur quels éléments bruts. Aucune attestation détaillée de ces revues n’a été retrouvée dans le dossier public examiné.

Une clôture de cette limite demanderait un relevé daté indiquant les intervenants ou rôles, le périmètre de chaque contrôle, la méthode de recalcul indépendante et les empreintes des entrées examinées. Ce relevé devrait distinguer les contrôles internes ou automatisés d’une évaluation scientifique par les pairs. Il peut rester non identifiant pour les établissements étudiés.

## Sélection et provenance restant non attestées publiquement

Les liens SIT Québec identifient trois jeux sources. Leurs instantanés datés et empreintes, l’entonnoir d’exclusion, la provenance logicielle historique et la preuve d’exécution ne figurent pas dans les archives publiques. La description actuelle ne permet donc pas une reproduction complète du lot à partir des seules ressources publiées. Aucun nom, hôte, URL d’établissement, secteur, région, manifeste, graine ou observation individuelle n’est ajouté.

## Archives et contrôle de cohérence

Le PDF, le CSV, le JSON et le manifeste d’archive restent inchangés. `node scripts/check-archive-manifest.mjs` compare les fichiers locaux à ce manifeste; il ne contacte pas Zenodo et ne prouve ni une publication distante ni une revue scientifique. Le supplément HTML est daté séparément du Dataset archivé.
