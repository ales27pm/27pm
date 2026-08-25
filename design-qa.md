# 27PM v4 — Design QA

## Comparison target

- Direction: « Confiance calme », emblème 27 sélectionné, ivoire/carbone/cobalt.
- Source visual truth:
  - `design/brand-v4/concepts/hero-desktop.png`
  - `design/brand-v4/concepts/hero-mobile-menu-closed.png`
  - `design/brand-v4/concepts/menu-mobile-open.png`
  - `design/brand-v4/concepts/expertise-desktop.png`
  - `design/brand-v4/concepts/realisations-desktop.png`
  - `design/brand-v4/concepts/methode-desktop.png`
  - `design/brand-v4/concepts/studio-contact-footer-desktop.png`
  - `design/brand-v4/concepts/privacy-desktop.png`
- Rendered implementation: `http://10.0.2.15:4175/`, `/confidentialite/` and `/404.html`.
- State: production content, fonts loaded, `prefers-reduced-motion: reduce`; desktop navigation, mobile menu closed/open, focused service row and selected contact option were exercised.

## Evidence and normalization

All implementation captures use Chrome with `deviceScaleFactor: 1`.

| Surface | Source pixels | Implementation pixels / CSS viewport | Implementation screenshot | Combined comparison |
| --- | ---: | ---: | --- | --- |
| Hero desktop | 1487 × 1058 | 1487 × 1058 | `/tmp/27pm-qa/home-desktop-1487x1058.png` | `/tmp/27pm-qa/compare-hero-desktop.png` |
| Hero mobile | 853 × 1844, approximately @2.19 | 390 × 844 | `/tmp/27pm-qa/home-mobile-390x844.png` | `/tmp/27pm-qa/compare-hero-mobile.png` |
| Menu mobile ouvert | 853 × 1844, approximately @2.19 | 390 × 844 | `/tmp/27pm-qa/menu-mobile-open-390x844.png` | `/tmp/27pm-qa/compare-menu-mobile.png` |
| Expertise | 1586 × 992 | section at 1586 px wide | `/tmp/27pm-qa/expertise-1586.png` | `/tmp/27pm-qa/compare-expertise.png` |
| Réalisations | 971 × 1619 | 971 × 1682 section capture | `/tmp/27pm-qa/realisations-971.png` | `/tmp/27pm-qa/compare-realisations.png` |
| Méthode | 1586 × 992 | 1586 × 993 section capture | `/tmp/27pm-qa/methode-1586.png` | `/tmp/27pm-qa/compare-methode.png` |
| Studio, contact, footer | 1374 × 1145 | 1374 × 1144 sequence capture | `/tmp/27pm-qa/studio-contact-footer-1374.png` | `/tmp/27pm-qa/compare-studio-contact-footer.png` |
| Contact intermédiaire | capture utilisateur à ~987 px | 987 × 664 | `/tmp/27pm-qa/contact-responsive-987.png` | inspection directe à la largeur signalée |
| Confidentialité | 1487 × 1058 | 1487 × 1058 | `/tmp/27pm-qa/privacy-desktop-1487x1058.png` | `/tmp/27pm-qa/compare-privacy.png` |

The mobile source was normalized to the same visual panel size in the combined comparison; differences caused only by source density were not filed. Full-page composition was also inspected at `/tmp/27pm-qa/home-fullpage-1440.png`. Focused comparisons were necessary for the logo crop, display typography, service active state, portfolio image crops, contact form, menu state and legal typography; the eight combined files above provide that evidence.

## Findings

No actionable P0, P1 or P2 fidelity issue remains.

- Fonts and typography: Newsreader Variable reproduces the editorial display voice and Instrument Sans Variable keeps interface text legible. Desktop hero size, wrapping and vertical rhythm were corrected against the 1487 px source; mobile wrapping remains stable at 390 and 320 px.
- Spacing and layout: hero boundaries, four-column method, alternating 971 px portfolio, and the 1374 px studio/contact/footer sequence now track the source proportions. No measured horizontal overflow remains in the Playwright viewport matrix.
- Colors and tokens: ivory `#F4F0E7`, carbon `#171714`, cobalt `#2846B8` and light-on-dark cobalt are used consistently, without the rejected orange, purple/lime, gradients or card shadows.
- Image quality and assets: the selected mark loads at 1024 × 1024 with transparency; portfolio captures load at natural width 1440 and use a left/top crop that preserves project branding and primary content. Favicons, manifest icons, Open Graph and social assets form one v4 set.
- Copy and content: the trust-led French proposition, two real projects, method, studio and contact path are coherent. Legal copy intentionally remains fuller than the visual mock because the repository policy is the authoritative content.
- Behavior and accessibility: the compact menu is absent from the tab order while closed, traps focus while open, closes on Escape, restores focus, and makes main/footer inert. Project radio selection updates both the live status and contextual `mailto:`. Axe reports no automatic violations on the three public pages or the open mobile menu.

## Comparison history

1. The hero mark originally participated in grid sizing and pushed the copy. It was made an absolute decorative image, recaptured, then the desktop display scale and vertical rhythm were aligned with the 1487 px reference.
2. The mobile hero copy, CTA, mark and section rule were adjusted until their vertical positions matched the 390 × 844 target without overflow.
3. The first mobile menu pass hid the brand behind the panel, oversized the email and differed from visual keyboard order. Z-index, typography, DOM order, inert state, focus loop and CTA height were corrected and recaptured.
4. Portfolio cards stacked at the 971 px reference and center crops obscured project branding. The alternating grid was restored, media tracks were widened, and crops were aligned left/top; both 1440 px sources now remain legible.
5. Method and studio/contact/footer heights drifted from their sources. The final captures measure 993 px versus 992 px and 1144 px versus 1145 px respectively.
6. The privacy title overflowed at 320 px and used forced word breaking. Responsive type sizing removed the break and the three-route mobile matrix now has zero measured overflow.
7. The contact title wrapped to three lines and the selected service row lacked the concept’s inset treatment. The title is now two lines and the active state uses the cobalt/ivory/carbon treatment.
8. The 320 px “Applications sur mesure” heading collided with its arrow, and a generic contact wrapper carried an invalid ARIA name. The narrow service grid now preserves an 8 px gap and the redundant ARIA attribute was removed.
9. À la largeur intermédiaire montrée dans la capture utilisateur, le titre du contact empiétait sur les choix. La section passe maintenant en une colonne jusqu’à 1100 px, revient à deux colonnes à 1101 px avec un écart mesuré, et un test de régression couvre 987, 1100, 1101 et 1374 px.

## Interaction and runtime proof

- In-app Browser: page identity and meaningful DOM confirmed at `http://10.0.2.15:4175/`; no framework overlay and no console warning/error.
- In-app Browser mobile: Menu → `aria-expanded=true` → opaque navigation → main/footer inert; Escape restored the closed state. Selecting “Une application” produced `Choix sélectionné : Une application.` and a matching encoded mail subject.
- Automated suite: `npm run check` passed; Playwright finished with 29 passed and 3 expected desktop skips across 32 scenarios. The intermediate-width contact regression runs alongside Axe, desktop/mobile navigation, 320 px routes, assets, metadata and both portfolio layouts.
- Capture evidence: `/tmp/27pm-qa/evidence.json` records zero console issues and zero overflow for the normalized Playwright captures.

## Intentional deviations and follow-up polish

- The concepts sometimes show a standalone section header; the implementation preserves one continuous semantic page and its existing section order.
- The selected emblem is currently a carefully matted raster master. It is sharp for the web set, but a manual SVG reconstruction and dedicated sub-24 px vector micro-master remain appropriate for print, signage and unlimited scaling.
- The Réalisations section is approximately 4% taller than the concept because it preserves the complete real project copy and readable link targets; hierarchy and composition remain equivalent.

final result: passed
