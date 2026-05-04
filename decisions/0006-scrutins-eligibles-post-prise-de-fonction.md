# 0006 — Scrutins éligibles = scrutins postérieurs à `datePriseFonction`

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : pipeline-data, métriques, équité

## Contexte

Tous les députés n'ont pas le même nombre de scrutins potentiels :
- Députés en place depuis le début de la 17e législature (juillet 2024) → 6287 scrutins potentiels
- Députés élus en partielle (ex: mars 2026) → quelques centaines de scrutins potentiels seulement

Si on calcule la présence sur les 6287 scrutins de la législature pour tous, les députés élus en partielle apparaissent artificiellement à <5 % alors qu'ils sont peut-être très assidus depuis leur arrivée.

## Décision

Pour chaque député, on ne compte que les **scrutins dont la date est ≥ à sa `datePriseFonction`** (champ disponible dans l'open data AN sur le mandat parlementaire). Cette valeur est stockée dans `scrutinsEligibles` et sert de dénominateur pour tous les taux.

## Pourquoi

- **Équité** : on ne pénalise pas les députés élus en cours de législature
- C'est l'approche standard utilisée par les sites de référence comme **NosDéputés.fr**
- Permet une comparaison juste entre tous les députés actifs

## Conséquences

- Les taux de présence/participation sont **comparables entre tous les députés**, peu importe leur date d'arrivée
- Calcul un peu plus complexe : on filtre les scrutins date par date pour chaque député dans la boucle de stats
- Le compteur de **frondes (raw count, non-normalisé)** reste sensible à l'ancienneté → un député arrivé tard aura mécaniquement moins de frondes en valeur absolue, mais comme on l'utilise surtout pour des classements, c'est OK

## Alternative refusée

Compter sur tous les 6287 scrutins (option A initiale) : injuste pour les députés en partielle, contredit l'usage des sites sérieux.

## Liens

- `scripts/fetch-data.ts` fonction `computeStats` — la condition `if (d.datePriseFonction && idx.date < d.datePriseFonction) continue;`
- ADR 0005 (présence vs participation)
