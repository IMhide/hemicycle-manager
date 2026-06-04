# PolitiDex — Design System v2 (Néo-Brutalisme)

> **Source de vérité visuelle.** Toute page lit ce fichier. Une page peut surcharger via
> `design-system/pages/<page>.md` (les règles de la page priment alors sur le Master).
>
> DA validée 2026-06-01. Voir aussi l'ADR design (à créer) et CLAUDE.md.

---

## 0. La thèse

> **PolitiDex est un Pokédex brutaliste de la vie politique française.**
> Les **personnes** sont des **cartes FIFA**. Tout le reste est de la **donnée brute, assumée, sans fard.**

Le néo-brutalisme est idéologiquement aligné : open data, donnée brute, posture « on n'est pas
Sciences Po, on assume nos choix ». Bordures franches, aplats, zéro manipulation visuelle = honnête.
Bonus : excellent contraste (WCAG AAA atteignable), supporte Light + Dark nativement.

---

## 1. Les deux registres

| Registre | Périmètre | Traitement |
|---|---|---|
| **🗂️ Pokédex (massif / informatif)** | Listes (élus, textes, scrutins), fiches détail, hémicycles, classements, FAQ, navette | Brutalisme franc : bordures épaisses, ombres dures décalées, `radius 0`, titres uppercase, aplats, grille visible |
| **🃏 Carte personne (collectionnable)** | `EluCard`, `DeputeCard`, `SenateurCard`, MiniCards | FIFA réinterprétée en brutaliste — version **la plus dense et colorée** du même langage. Rating Overall énorme, bandeau famille CHES, tier de rareté, flood couleur au hover |

La carte n'est pas une exception au style : c'est son expression maximale. Cohérence garantie.

---

## 2. Tokens couleur (sémantiques, Light + Dark)

Implémentés en variables CSS sur `:root` (light) et `[data-theme="dark"]` / `.dark`.
**Jamais de hex brut dans les composants** — toujours via token.

### Neutres (le squelette brutaliste)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#FFFDF5` (crème) | `#09090B` (noir riche) | Fond de page |
| `--surface` | `#FFFFFF` | `#18181B` | Cartes, blocs |
| `--surface-2` | `#F4F2E9` | `#27272A` | Surfaces secondaires, hover |
| `--fg` | `#0A0A0A` | `#FAFAFA` | Texte principal |
| `--fg-muted` | `#52525B` | `#A1A1AA` | Texte secondaire (≥3:1) |
| `--border` | `#0A0A0A` | `#FAFAFA` | **Bordures brutalistes** (contraste max) |
| `--border-soft` | `#27272A` (light: rare) | `#3F3F46` | Séparateurs discrets |
| `--shadow-color` | `#0A0A0A` | `#000000` | Ombre dure (offset, no blur) |

### Marque & sémantique

| Token | Valeur | Usage |
|---|---|---|
| `--accent` | `#FFE600` (jaune acide) | CTA, highlights, focus, badge Or |
| `--accent-fg` | `#0A0A0A` | Texte sur jaune (noir, contraste max) |
| `--vote-pour` | `#16A34A` | Vote « pour » (vert, aplat) |
| `--vote-contre` | `#DC2626` | Vote « contre » (rouge, aplat) |
| `--vote-abstention` | `#A1A1AA` | Abstention |
| `--vote-absent` | `#52525B` | Absent |

> Vert/rouge ne servent **jamais** seuls à porter l'info (cf `color-not-only`) : toujours doublés
> d'un libellé/icône. Le jaune acide ne doit pas entrer en collision avec le vote ni le politique.

### Couleurs politiques (aplats CHES — ADR 0007)

Le gradient gauche-droite CHES 2024 devient des **blocs d'aplat francs** (pas de dégradé mou).
Source unique : `src/lib/political-order.ts`. Ne pas redéfinir ailleurs.

### Tiers de rareté (carte personne)

| Tier | Couleur cadre/badge | Seuil indicatif (Overall) |
|---|---|---|
| `bronze` | `#CD7F32` | bas |
| `argent` | `#C0C0C0` | médian |
| `or` | `#FFC400` | haut |
| `legende` | jaune acide + traitement spécial | top centile |

> Seuils exacts à figer dans une ADR (cohérence avec la formule Overall ADR 0022).

---

## 3. Typographie — Space Grotesk partout

```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
/* Note : Space Grotesk monte à 700. Pour les "Black 900" des ratings, soit on accepte 700,
   soit on self-host la variable font jusqu'à 700 (max du Google Font). 700 suffit pour le punch. */
```

| Rôle | Famille / poids | Réglages |
|---|---|---|
| Display / hero | Space Grotesk 700 | `uppercase`, `letter-spacing -0.02em`, `line-height 0.95` |
| Titre section (h2/h3) | Space Grotesk 700 | `uppercase` |
| Rating FIFA (carte) | Space Grotesk 700 | très grand (48-72px), tabular |
| Corps | Space Grotesk 400-500 | `line-height 1.5`, base 16px (≥16px mobile) |
| Labels / méta | Space Grotesk 500 | `uppercase`, `letter-spacing +0.04em`, 12px |
| Données chiffrées | Space Grotesk + `font-variant-numeric: tabular-nums` | colonnes alignées |

Bebas Neue + Inter **supprimés**. (Échelle type : 12 / 14 / 16 / 18 / 24 / 32 / 48 / 64.)

---

## 4. Effets brutalistes (la signature)

- **Bordures** : `--bw` = 3px (primaire), 2px (secondaire). Couleur `--border`. Partout.
- **Ombres dures** : offset solide **sans flou**.
  `--shadow: 4px 4px 0 0 var(--shadow-color);` (et variante 6px pour éléments saillants).
- **Rayon** : `--radius: 0`. Exception : badges « pill » `9999px` uniquement.
- **Press mécanique** : au `:active`, l'élément se translate de l'offset de l'ombre et l'ombre
  disparaît — il « se pose ». `transform: translate(4px,4px); box-shadow: none;`
  *(layout-shift-avoid : c'est l'élément pressé seul qui bouge, jamais le flux autour.)*
- **Transitions** : 100-150ms, `ease-out`. Pas de fondu mou. Respecte `prefers-reduced-motion`.
- **Inclinaison ludique** : `-1deg / +1deg` sur cartes/badges en option (carte personne surtout).
- **Hover Pokédex** : décalage d'ombre (4px→6px) ou flood d'aplat. **Hover carte** : flood couleur famille / scale 1.0→1.02.

---

## 5. Layout & espacement

- **Grille visible assumée** : séparateurs nets, pas de cartes flottantes sans bord.
- **Espacement** : système 4/8px. Tiers de section : 16 / 24 / 32 / 48.
- **Container** : `max-w-6xl`/`7xl` centré, gutters adaptatifs par breakpoint.
- **Breakpoints** : 375 / 768 / 1024 / 1440. Mobile-first. Pas de scroll horizontal.
- **Mobile** : `min-h-dvh` (pas `100vh`), texte ≥16px, touch targets ≥44px.
- **Listes longues** : box hauteur fixe + scroll interne + load-more dedans (cf règle UX projet).

---

## 6. Composants — règles clés

- **Boutons** : `--bw` bordure + ombre dure + press mécanique. Primaire = fond `--accent` (jaune)
  texte noir. Une seule CTA primaire par écran. Hauteur ≥44px.
- **Cartes Pokédex** : `--surface`, bordure 3px, ombre 4px, radius 0.
- **Carte personne** : voir registre 2 — rating + bandeau CHES + tier + photo.
- **Icônes** : **SVG uniquement** (Lucide ou Heroicons), une seule famille, stroke cohérent.
  **Supprimer tous les emojis-icônes** (🏛️📜🗂️…) — anti-pattern actuel.
- **Formulaires/filtres** : labels visibles, erreurs sous le champ, états focus jaune épais.
- **Focus** : ring jaune `--accent` épais (3px), jamais retiré (a11y clavier).

---

## 7. À NE PAS faire

- ❌ Emojis comme icônes structurelles → SVG.
- ❌ Ombres floues (`blur`) → ombres dures offset only.
- ❌ `border-radius` sur les blocs → 0 (sauf pills).
- ❌ Hex brut dans un composant → token CSS.
- ❌ Couleur seule pour porter l'info (vote, statut) → + libellé/icône.
- ❌ Layout shift au hover/press → transformer l'élément pressé seul.
- ❌ Designer une seule thématique → Light **et** Dark testés séparément.

---

## 8. Ordre de déroulé (chantier)

1. ✅ MASTER.md (ce fichier)
2. ✅ Tokens CSS + tailwind.config (variables, Space Grotesk, suppr `assembly.*`/Bebas)
3. ✅ **Carte-pilote `EluCard`** (le trophée — validé visuellement)
4. ✅ Home `/` (4 portes, ton brutaliste)
5. ✅ Listes (élus, textes) + filtres + mini-cartes
6. ✅ Fiches détail (élu, texte) + composants associés (timelines, radar, vote bars…)
7. 🚧 Hémicycles (AN/Sénat) — intégrer le trait brutaliste sans casser la dataviz
   _(à ce stade : seul `text-assembly-muted`→`text-fg-muted` migré ; le SVG des sièges
   garde son rendu d'origine, reste à brutaliser bordures/contour sans nuire à la lisibilité)_
8. ✅ Classements (podiums pastilles or/argent/bronze), FAQ, footer
9. ⬜ Passe a11y finale (contraste Light+Dark, reduced-motion, focus, 375px)

> **Reste avant merge** (cf prochaines étapes) : étape 7 (hémicycles), étape 9 (a11y),
> tri des emojis résiduels (décoratifs à virer / fonctionnels à garder, cf §7),
> puis `npm run check` + smoke-tests + PR.

Chaque étape : consigner les écarts page-spécifiques dans `design-system/pages/<page>.md`.
