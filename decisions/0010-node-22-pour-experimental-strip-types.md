# 0010 — Node 22 obligatoire (`--experimental-strip-types` requis par le pipeline data)

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : runtime, build, dépendances

## Contexte

Premier déploiement Coolify échoué avec :
```
node: bad option: --experimental-strip-types
ERROR: failed to solve: process "/bin/sh -c npm run data:fetch" did not complete successfully: exit code: 9
```

## Décision

Le **Dockerfile utilise `node:22-alpine`** comme base image (pas Node 20).

Le script `data:fetch` dans `package.json` lance `node --experimental-strip-types scripts/fetch-data.ts` pour exécuter du TypeScript sans compilation explicite. Cette option a été introduite dans **Node 22.6**.

## Pourquoi

- **Évite la dépendance à `tsx`/`ts-node`/un build step** : on lance le pipeline TS directement sans étape de compilation
- Code plus lisible (TypeScript partout, même dans les scripts)
- Node 22 est LTS et largement supporté

## Conséquences

- Image Docker légèrement plus grosse (négligeable, ~5 Mo de différence)
- Si quelqu'un build avec Node ≤ 22.5 → erreur `bad option: --experimental-strip-types`
- Si on supprime un jour cette option (Node intégrera nativement TS plus tard sans flag), on peut revenir à 20
- Toute dépendance future qui requiert Node ≥ 22 se branchera naturellement

## Alternative envisagée

Compiler les scripts TS via `tsx` ou similaire avant de les lancer. Refusé car :
- Étape supplémentaire dans le build
- Dépendance dev en plus
- Le flag natif Node fait exactement ce qu'on veut

## Liens

- `Dockerfile` ligne `FROM node:22-alpine AS builder`
- `package.json` script `data:fetch`
- Découvert lors du premier déploiement Coolify (cf rapport agent Coolify session 2026-05-04)
