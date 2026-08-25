# 27PM — identité « Confiance calme »

Statut : direction implémentée et validée sur l’accueil, la politique de confidentialité et la page 404.

## Décision

Le symbole sélectionné est l’option 3 de la passe « Confiance ». Il doit être perçu comme un emblème autonome avant que le `27` apparaisse en seconde lecture.

L’origine du nom reste une règle cachée : `27PM` correspond à `3 AM`, l’heure de fermeture des bars au Québec. Le système traduit cette histoire par une continuation discrète de `3/24` après une limite; il n’utilise aucune horloge, scène de bar ou imagerie nocturne.

## Principes

- Confiance calme, clarté et assise avant nouveauté visuelle.
- Symbole monochrome en encre ou en blanc.
- Ivoire `#F4F0E7`, carbone `#171714`, cobalt `#2846B8`.
- Titres éditoriaux amples; interface et texte en sans humaniste.
- Réalisations réelles comme preuve principale.
- Mise en page ouverte, filets fins, peu de rayons, aucune ombre.
- Aucun cadran `27:00`, rail de calibration, bento SaaS, violet-lime ou vermillon.

## Source sélectionnée

- `source/27pm-selected-mark.png` — source raster de l’emblème choisi; elle demeure intacte.

La source est transformée non destructivement en actif transparent. Le symbole possède deux composantes dont la séparation se referme sous 24 px; le favicon utilise donc une correction optique dédiée, sans altérer le master normal.

L’exporteur reproductible `export-assets.swift` dérive le master transparent, les actifs web, les icônes, le manifeste et les visuels sociaux. Les anciens canoniques sont archivés dans `public/assets/legacy-v3/`; les sorties v4 versionnées se trouvent dans `public/assets/brand-v4/`.

## Concepts de référence

- `concepts/hero-desktop.png`
- `concepts/realisations-desktop.png`
- `concepts/expertise-desktop.png`
- `concepts/methode-desktop.png`
- `concepts/studio-contact-footer-desktop.png`
- `concepts/hero-mobile-menu-closed.png`
- `concepts/menu-mobile-open.png`
- `concepts/privacy-desktop.png`

Ces images forment une seule direction coordonnée. Le texte, les contrôles, les images de projets et le logo seront implémentés comme contenus natifs; les concepts ne doivent jamais être utilisés comme captures statiques de l’interface.

## Invariants de production

- Préserver les deux réalisations, leurs captures, leurs URL externes et leurs libellés accessibles.
- Préserver le menu accessible, le sélecteur de projet, le `mailto:` contextualisé, les attributs `data-*`, le mouvement réduit et les trois pages.
- Conserver l’OG en `1200 × 630`, les icônes du manifeste et les dimensions intrinsèques du logo.
- Aucun actif de l’ancienne marque ne doit être écrasé avant validation visuelle de son remplaçant.

## Limite du master

Le master de production actuel reste une dérivation raster fidèle du symbole sélectionné. Une reconstruction vectorielle manuelle — avec un micro-master dédié sous 24 px — demeure le prochain travail de logo si la marque doit être livrée pour l’impression, la signalétique ou des agrandissements illimités.
