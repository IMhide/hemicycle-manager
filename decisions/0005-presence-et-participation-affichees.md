# 0005 — Présence ET participation affichées séparément

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : métriques, ux, sémantique

## Contexte

Dans l'open data AN, un député peut avoir 5 statuts pour un scrutin :
- `pour`, `contre`, `abstention` → a voté
- `nonVotant` → présent mais ne vote pas (ex: président de séance)
- absent (n'apparaît dans aucune liste)

Faut-il afficher une seule métrique "présence" ou plusieurs ?

## Décision

**Afficher les deux** :
- **Taux de présence** = `(pour + contre + abstention + nonVotant) / scrutins éligibles`
  → mesure si le député était physiquement dans l'hémicycle au moment du vote
- **Taux de participation** = `(pour + contre + abstention) / scrutins éligibles`
  → mesure s'il a réellement exprimé un vote (plus exigeant)

## Pourquoi

- Les deux métriques disent **des choses différentes** :
  - *Présence faible* = absentéisme physique pur
  - *Présence haute mais participation faible* = présent mais s'abstient ou ne vote pas (cas typique du président de séance)
- Donner une seule métrique aplatit l'information
- L'utilisateur peut comprendre le profil réel d'un député en croisant les deux

## Conséquences

- Sur la **carte FIFA** : Présence et Participation listées comme 2 stats séparées avec InfoTip
- Sur le **radar chart** : 2 axes distincts
- Dans les **classements** : 2 leaderboards distincts (top présence ET top participation)
- Sur la **fiche groupe** : on n'affiche que la présence moyenne par défaut (la participation s'en déduit)
- ⚠️ Le maximum théorique observé est ~80 % car beaucoup de scrutins ne mobilisent pas tous les députés (la majorité des votes à l'Assemblée se font à main levée et ne sont pas tracés). Documenté dans l'InfoTip pour éviter la confusion.

## Liens

- `scripts/fetch-data.ts` (calcul `tauxPresence` et `tauxParticipation`)
- `src/lib/components/DeputeCard.svelte`, `src/lib/components/StatRadar.svelte`
- `src/routes/classements/+page.svelte`
- ADR 0006 (scrutins éligibles)
