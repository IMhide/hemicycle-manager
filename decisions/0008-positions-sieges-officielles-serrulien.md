# 0008 — Positions de sièges issues du SVG officiel via Serrulien/hemicycle-france

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : sourcing, hémicycle, layout

## Contexte

Pour rendre l'hémicycle, il faut placer 577 députés sur les sièges de la salle des séances. Chaque député a un `placeHemicycle` (1..650 dans l'open data, avec ~68 numéros non utilisés → 582 sièges effectifs). Comment traduire ces numéros en coordonnées (x, y) visuellement fidèles au vrai hémicycle français ?

## Décision

On **n'invente pas la géométrie**. On utilise les **coordonnées SVG officielles extraites du site assemblee-nationale.fr** via le projet open-source **[Serrulien/hemicycle-france](https://github.com/Serrulien/Serrulien/hemicycle-france)** (MIT).

Pipeline : `scripts/extract-seats.ts` parse les paths Raphael de `core.js`, calcule le centroïde de chaque siège, et stocke le résultat dans `src/lib/generated/seats.json` (582 entrées, ~30 KB).

## Pourquoi

- Une **première tentative** avec un layout calculé (arcs concentriques croissants 1..577) donnait un placement **politiquement incohérent** : les groupes n'étaient pas correctement répartis gauche-droite parce que la numérotation officielle est sectorielle (par colonne angulaire) et **n'est PAS rang par rang**.
- Vérifications empiriques sur des députés connus :
  - Marine Le Pen (RN, extrême droite) → siège **36** → x élevé (à droite vu du perchoir) ✅
  - Manuel Bompard (LFI, extrême gauche) → siège **539** → x faible (à gauche) ✅
- Le projet Serrulien a déjà fait le travail d'extraction, sous **licence MIT**, et les paths sont **identiques à ceux du site officiel** (cité dans leur code).
- Faire confiance à la source officielle plutôt que de réinventer un layout approximatif est plus honnête et plus fidèle.

## Conséquences

- L'hémicycle rendu est **fidèle au vrai layout** de la salle des séances
- Les 68 numéros non utilisés sont gérés (pas de siège affiché à ces positions)
- Le fichier `seats.json` est **commité** (~30 KB, change rarement, pas un produit de l'open data quotidien)
- Si l'AN refait son hémicycle (peu probable mais possible), on relance `node scripts/extract-seats.ts` après avoir regénéré le repo Serrulien

## Liens

- `scripts/extract-seats.ts` (pipeline d'extraction)
- `src/lib/generated/seats.json` (données générées)
- `src/lib/hemicycle.ts` (lookup runtime)
- [Serrulien/hemicycle-france](https://github.com/Serrulien/hemicycle-france)
- [Page officielle de référence](https://www2.assemblee-nationale.fr/deputes/hemicycle)
