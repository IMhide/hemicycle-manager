# 0040 — Accessibilité & contraste : exigence de premier ordre

**Date** : 2026-06-04
**Statut** : accepté
**Tags** : a11y, design, contraste, ux, qualité

## Contexte

PolitiDex est un site public destiné à **être utilisé par tout le monde**.
L'accessibilité — et le contraste en particulier — y est un critère de
**qualité de premier ordre**, pas une finition optionnelle.

Le besoin a été cristallisé par un bug concret : sur l'aplat jaune `--accent`
de la ligne active du dropdown de recherche, le **nom principal restait blanc**
(héritage de `--fg`, blanc en Dark) → blanc sur jaune ≈ **1.1:1**, illisible.
Le piège : on avait stylé le texte secondaire et le terme surligné, mais pas
le texte principal qui n'avait aucune classe de couleur et héritait
silencieusement. Ce motif (un élément qui passe sur un **aplat** au survol /
état actif mais garde sa couleur de texte héritée) est récurrent dans un
design néo-brutaliste fait d'aplats francs.

Le design system (`design-system/MASTER.md` §2, §6, §7) posait déjà des
principes de contraste, mais sans en faire une **exigence vérifiée
systématiquement** ni documenter ce piège précis.

## Décision

**Le contraste et la lisibilité sont une exigence non négociable, vérifiée à
chaque changement visuel, en Light ET en Dark séparément.** Règle pratique
centrale : **la couleur du texte suit toujours son fond** — un élément qui
passe sur un aplat (jaune `--accent`, couleur de groupe CHES, vert/rouge de
vote) doit forcer sa couleur de texte sur **tous** ses sous-éléments (nom
principal **et** méta), jamais en compter sur l'héritage.

Cette exigence est inscrite dans `CLAUDE.md` (section « Posture éditoriale »,
point ♿) pour être relue à chaque session.

## Pourquoi

- **Mission du produit.** Un site d'information citoyenne ouvert à tous doit
  être lisible par tous, y compris en vision basse et en mode sombre.
- **Le néo-brutalisme multiplie les aplats.** Fonds jaunes, blocs de couleur
  politique, états de vote : autant d'occasions de poser du texte hérité sur
  un fond imprévu. Une règle explicite (« la couleur suit le fond ») prévient
  toute une classe de bugs.
- **Le token `--accent` est le même jaune en Light et Dark.** Donc le texte
  sur `--accent` est **toujours** `--accent-fg` (noir `#0A0A0A`) — ratio
  ≈ 18:1, AAA. Raisonner « par thème » sur cet aplat est une erreur : c'est
  invariant.

Seuils retenus (WCAG / Material) : **≥ 4.5:1** pour le texte normal,
**≥ 3:1** pour le gros texte et les glyphes d'UI. La couleur seule ne porte
**jamais** une information (vote, statut, famille politique) — toujours
doublée d'un libellé / icône / motif. Focus clavier visible partout (ring
jaune épais), cibles tactiles ≥ 44px.

## Conséquences

- `CLAUDE.md` contient un point ♿ « Contraste & lisibilité — non
  négociable » détaillant la règle, le piège de l'aplat, les seuils, et la
  consigne « en cas de doute, calculer le ratio avant de committer ».
- Tout changement visuel doit être validé Light **et** Dark (ne jamais
  déduire l'un de l'autre).
- Premier cas d'application : la ligne active du dropdown de recherche force
  `color: var(--accent-fg)` sur toute la rangée (nom + méta + états de vote),
  le terme surligné devient un souligné en couleur d'accent (plus un bloc
  plein illisible), et la navigation clavier a un curseur franc + `aria`
  (cf ADR 0039).
- Toujours passer par les tokens sémantiques du design system, jamais de hex
  brut dans un composant.

## Liens

- `CLAUDE.md` (Posture éditoriale → point ♿ Contraste & lisibilité)
- `design-system/MASTER.md` (§2 tokens, §6 composants, §7 à ne pas faire)
- `src/lib/components/GlobalSearch.svelte` (`.search-row-active`,
  `.search-hl` — premier cas d'application)
- ADR liées : `#0039` (recherche unifiée), `#0007` (couleurs politiques CHES)
- WCAG 2.1 contrast (1.4.3 / 1.4.11), Material Design color system
