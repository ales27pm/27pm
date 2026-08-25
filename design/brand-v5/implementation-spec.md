# 27PM v5 — spécification d’implémentation

## Sources de vérité

1. `concepts/homepage-overview.png` — ordre, rythme et copie.
2. `concepts/hero-desktop.png` — premier écran bureau.
3. `concepts/capabilities-lab-desktop.png` — capacités et laboratoire.
4. Le PDF transmis le 25 août 2026 — composition mobile de l’identité v4.

Les explorations noir, blanc et vermillon, le motif `27:00` et l’ancien mot-signe sont exclus.

## Système visuel

- Ivoire `#F4F0E7`, carbone `#171714`, cobalt `#2846B8`.
- Titres: Newsreader Variable, poids 450 à 520, interlignage serré.
- Texte et interface: Instrument Sans Variable, poids 400 à 700.
- Filets fins, sections ouvertes, rayons limités aux contrôles et cadres utiles.
- Aucun dégradé, halo, ombre décorative, capsule ou grille de cartes générique.
- Mouvement court et fonctionnel, neutralisé avec `prefers-reduced-motion`.

## Copie verrouillée

- Hero: `Clair pour vos clients. Solide pour vous.`
- Hero body: `Sites web, applications sur mesure et systèmes propulsés par l’IA pour rendre une offre complexe claire, utile et facile à faire évoluer.`
- CTA: `Voir 27PM en action`
- Capacités: `Une idée. Plusieurs métiers.`
- Réalisations: `Pas des promesses. Des systèmes à essayer.`
- Laboratoire: `Et si on bâtissait le vôtre?`
- Méthode: `De l’idée à l’impact, sans détour.`
- Studio: `Petit studio. Grande attention.`
- Contact: `On commence par une conversation.`

## Surfaces

- Hero 47/53: copie à gauche; emblème v4, champ vectoriel cobalt et labels à droite.
- Capacités 42/58: trois rangées ouvertes et une preuve concrète dans un panneau carbone.
- Réalisations: deux rangées identiques texte / capture / statut, sans inversion.
- Laboratoire: bande cobalt avec trois groupes de choix et un résultat déterministe local.
- Méthode: quatre étapes sur une trace continue.
- Studio et contact: une bande ivoire divisée verticalement.
- Footer: carbone, emblème v4 et texte natif `27PM`; aucun ancien mot-signe raster.

## Invariants

- Turner et Boulet sont toujours décrits comme des concepts 27PM en démo complète, non déployés sur les domaines clients.
- Les URL de démo permanentes restent inchangées; aucune URL Tailscale.
- Le laboratoire est explicitement déterministe et n’envoie aucune donnée.
- Le contact prépare un courriel localement; aucune soumission silencieuse ni suivi.
- HTML utile sans JavaScript, navigation clavier, focus visible, `inert`, Échap, annonces live et mouvement réduit.
- Les contenus révélés restent visibles à l’impression et dans les captures pleine page.
- Aucun débordement horizontal de 320 px à 1600 px.
