# 0012 — Format compact en tuple pour les historiques de vote

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : data, perf, format

## Contexte

Premier essai du pipeline d'historiques individuels (un fichier par député) : **267 Mo total** pour 577 députés. Inacceptable côté repo (même gitignored, c'est lent à fetch et à servir).

Cause : chaque entrée d'historique répétait le titre du scrutin (en moyenne ~150 caractères), la date, le numéro, le sort, etc. Or ces infos sont **déjà dans `scrutins-index.json`**.

## Décision

Format **tuple compact** : `[scrutinUid, position, isFronde]` avec `position` ∈ `'pour' | 'contre' | 'abstention' | 'nonVotant'` et `isFronde` ∈ `0 | 1`.

```typescript
export type VoteHistoryItem = [string, VotePosition, 0 | 1];
```

Le front fait le **join** avec `scrutins-index.json` côté client pour récupérer titre/date/sort.

## Pourquoi

- **267 Mo → 28 Mo** (×10 plus léger)
- L'index des scrutins est déjà chargé par d'autres pages (cache HTTP gratuit côté navigateur), donc le join est gratuit en bandwidth
- Format auto-documenté : tuple à 3 éléments, peu d'ambiguïté possible
- Lisible en cas de debug (vs binaire ou base64)

## Conséquences

- Le composant `VoteHistoryItem.svelte` reçoit le tuple décompacté + un objet `scrutin` venant du store front
- Si on ajoute un champ par vote individuel (commentaire, timestamp précis…), il faudra étendre le tuple ou repasser à un objet — facile à faire
- Bonus : les fichiers JSON minifiés (sans clés répétées) sont aussi plus rapides à parser

## Liens

- `scripts/fetch-data.ts` — interface `VoteHistoryItem` et boucle d'écriture
- `src/lib/types.ts` — type partagé front/back
- `src/routes/deputes/[id]/+page.svelte` — décodage et join avec l'index
- `static/data/historique/PA*.json` — fichiers générés
