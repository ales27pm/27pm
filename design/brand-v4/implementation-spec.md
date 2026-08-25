# 27PM v4 — spécification d’implémentation

## Vérité visuelle

- Emblème : `source/27pm-selected-mark.png`.
- Bureau : `concepts/hero-desktop.png`, `expertise-desktop.png`, `realisations-desktop.png`, `methode-desktop.png`, `studio-contact-footer-desktop.png` et `privacy-desktop.png`.
- Mobile : `concepts/hero-mobile-menu-closed.png` et `menu-mobile-open.png`.

## Texte autorisé au-dessus du pli

- Marque : `27PM`.
- Navigation : `Expertise`, `Réalisations`, `Méthode`, `Studio`.
- Action d’en-tête : `Démarrer un projet`.
- H1 : `Clair pour vos clients. Solide pour vous.`
- Paragraphe : `27PM conçoit des sites et des applications qui rendent une offre complexe plus facile à comprendre, à choisir et à faire évoluer.`
- Action principale : `Parler de votre projet`.
- Bouton mobile : `Menu`, puis `Fermer` lorsque le menu est ouvert.

Aucun sourcil, badge, chiffre de preuve, texte de nuit, cadran ou mention de l’origine du nom n’est visible dans le hero.

## Système

- Fond : ivoire `#F4F0E7`.
- Texte et surfaces sombres : carbone `#171714`.
- Accent et focus : cobalt `#2846B8`.
- Texte secondaire clair : `#5F5C55`.
- Filets : carbone à faible opacité sur ivoire; ivoire à faible opacité sur carbone/cobalt.
- Titres : Newsreader Variable, grandes tailles éditoriales, poids 450–520, interlignage serré.
- Texte et interface : Instrument Sans Variable, poids 400–650.
- Rayons : 0 pour les sections et images; 3 à 6 px seulement pour les boutons et le cadre des captures.
- Ombres et dégradés : aucun.
- Mouvement : transitions de 180–240 ms; léger déplacement des flèches et révélation verticale; neutralisé avec `prefers-reduced-motion`.

## Grille et rythme

- Gouttière : `clamp(1.25rem, 4vw, 4rem)`.
- Largeur éditoriale : environ 1440 px avec contenu plein cadre et gouttières constantes.
- Hero bureau : deux colonnes, texte 54–57 %, emblème 43–46 %, hauteur proche d’un écran, aperçu de la section suivante sous un filet cobalt.
- Sections ivoire : grands espacements verticaux, titres alignés aux gouttières, rangées ouvertes plutôt que cartes.
- Méthode : bande carbone, quatre étapes sur une ligne avec filets continus.
- Studio : texte à gauche, emblème surdimensionné à droite, filet et bloc cobalt comme ancrage de composition.
- Contact : bande cobalt en deux colonnes, choix de projet en lignes transparentes.
- Pied de page : bande carbone horizontale, cinq zones de contenu sans encadrement.

## Composants et états

- Marque : image transparente carrée + mot-symbole `27PM` en texte natif. L’image est décorative dans le lockup; le lien porte le nom accessible.
- Bouton primaire : cobalt sur ivoire; carbone sur cobalt; inversion au survol/focus.
- Services : trois rangées numérotées. Survol/focus cobalt avec texte ivoire, sans déplacement de la grille.
- Réalisations : deux compositions alternées; les captures 1440 × 900 restent intactes; aucune carte flottante.
- Menu mobile : overlay carbone plein écran, liens serif ivoire, filets fins, CTA cobalt en bas, adresse courriel visible; focus confiné et fermeture par Échap.
- Sélecteur de projet : boutons radio natifs invisuellement enrichis; état sélectionné clairement visible; `mailto:` mis à jour.

## Réponse adaptative

- Point de bascule du menu : 1100 px, synchronisé avec `src/main.ts`.
- À 1024 px : menu compact, aucun chevauchement.
- À 640 px et moins : hero en une colonne, H1 sur quatre lignes proches du concept, emblème sous le CTA et partiellement recadré par la fin du hero.
- Les services deviennent des rangées à deux lignes; les réalisations empilent texte et capture; la méthode devient une séquence verticale; contact et pied de page s’empilent.
- Aucun débordement horizontal à 320 px, y compris la politique de confidentialité et la page 404.

## Invariants fonctionnels

- Conserver `data-menu-button`, `data-navigation`, `data-select-project`, `data-project-option`, `data-project-mail`, `data-project-status`, `data-reveal` et `data-year`.
- Conserver les deux URL externes, `target="_blank"`, `rel="noopener noreferrer"`, les deux captures et leurs textes alternatifs.
- Conserver le skip link, le focus visible, `inert`, `aria-hidden`, le piège de focus, Échap, le statut live du projet et le mouvement réduit.
- Conserver les trois documents publics, les métadonnées structurées, le sitemap, le manifeste et l’Open Graph 1200 × 630.
