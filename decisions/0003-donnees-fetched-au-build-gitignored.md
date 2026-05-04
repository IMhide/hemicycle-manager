# 0003 — Données fetchées au build, dossier `static/data/` gitignored

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : data, déploiement, repo

## Contexte

Le pipeline génère ~75 Mo de JSON dans `static/data/` (6287 fichiers de scrutins + 577 historiques + indexes). Faut-il les commiter ou les gitignorer ?

## Décision

**`static/data/` est gitignored**. Les données sont **fetchées au moment du `docker build`** via `RUN npm run data:fetch` dans le Dockerfile.

## Pourquoi

- Repo **léger** (~5 Mo vs ~70 Mo) → clone rapide, pull request lisible
- Données **toujours fraîches au déploiement** : chaque rebuild prend les derniers votes
- Pas de pollution du `git log` avec 6287 diffs JSON inutiles à chaque mise à jour
- L'open data AN est déjà la source canonique, dupliquer ne sert à rien
- Les fichiers générés ne se prêtent pas au versionnement humain

## Conséquences

- Le **build prend ~30 secondes de plus** (téléchargement + parsing)
- Si l'open data AN tombe au moment d'un déploiement, le build échoue → on relance plus tard, pas grave
- **Première install locale** : l'utilisateur doit lancer `npm run data:fetch` une fois avant `npm run dev`, sinon les pages affichent des erreurs
- **Coolify ne peut pas builder offline** (acceptable, on a Internet sur la machine de build)

## Alternative refusée

Commit des données dans le repo (option A initiale) : trop lourd, polluant, et de toute façon obsolète après 24h. Une variante "branche `data` séparée" envisagée mais pas valable car ne résout pas la fraîcheur.

## Liens

- `.gitignore` ligne `static/data/`
- `Dockerfile` ligne `RUN npm run data:fetch`
- `scripts/fetch-data.ts` — pipeline complet
- README section "Mise à jour des données"
