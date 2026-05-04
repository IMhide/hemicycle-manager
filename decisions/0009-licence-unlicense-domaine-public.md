# 0009 — Licence Unlicense (domaine public) plutôt que CC0 ou MIT

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : licence, gouvernance

## Contexte

Quel cadre juridique pour le code ? L'utilisateur souhaite que **"la politique appartienne à tout le monde"** et refuse la propriété intellectuelle sur ce projet.

## Décision

**[Unlicense](https://unlicense.org)** — code dans le domaine public.

Pas d'attribution requise, aucune restriction d'utilisation, aucune garantie. Tout le monde peut copier, modifier, vendre, distribuer.

## Pourquoi

- L'utilisateur a d'abord demandé **CC0**, mais CC0 est **conçu pour des données et créations artistiques**, pas du code. La FAQ de Creative Commons elle-même recommande Unlicense ou MIT-0 pour le logiciel.
- **CC0 ne mentionne pas explicitement les brevets logiciels** → si quelqu'un détecte un brevet dans le code, l'auteur reste théoriquement attaquable. Unlicense est conçu pour le code et couvre ce cas.
- **Unlicense est nativement reconnu par GitHub** (apparaît dans le dropdown de licence, badge auto sur le repo)
- **Esprit identique à CC0** côté utilisateur : domaine public, aucune contrainte
- Refus explicite de **MIT** (oblige à conserver l'attribution) car contraire à la philosophie "appartient à tout le monde"

## Conséquences

- Repo public sur GitHub avec `LICENSE` à la racine reconnu comme "The Unlicense" par GitHub
- Le README mentionne explicitement "domaine public, pas d'attribution requise (mais appréciée)"
- Les **données** restent sous leurs licences d'origine :
  - Open Data AN → Licence Ouverte (Etalab)
  - Coordonnées SVG Serrulien → MIT
- Quiconque peut fork, déployer, vendre une version commerciale, etc.

## Liens

- `LICENSE` à la racine du repo
- README section "Licence"
- https://unlicense.org
