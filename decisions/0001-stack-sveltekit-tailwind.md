# 0001 — Stack SvelteKit + TypeScript + Tailwind + adapter-static

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : stack, frontend

## Contexte

Choix de la stack technique pour bâtir une app web qui visualise les votes de l'Assemblée nationale française façon Football Manager — hémicycle interactif, fiches FIFA, classements, recherches.

## Décision

**SvelteKit 5 + TypeScript + TailwindCSS + adapter-static**, déployé en site 100 % statique.

## Pourquoi

- **Svelte** : animations natives plus naturelles que React/Vue pour ce type de visu (transitions, stagger), bundle plus compact
- **adapter-static** : pas de backend à maintenir, déploiement n'importe où (Coolify + Nginx)
- **TypeScript** : sécurité sur les modèles de données complexes (députés, scrutins, stats)
- **Tailwind** : itération UI rapide, pas de fichiers CSS à maintenir
- L'app est **read-only** sur des données figées au build → un site statique suffit, pas besoin d'API runtime

Refusé : Next.js / SvelteKit avec adapter-node (overkill pour un site statique, plus de surface d'attaque, plus cher à héberger).

## Conséquences

- Toutes les données sont **chargées en JSON statiques** servis par Nginx (cache HTTP gratuit)
- Pas d'auth, pas de DB, pas de runtime à patcher
- Mise à jour des données = rebuild du site
- Limite : pas de personnalisation utilisateur côté serveur (acceptable pour le scope actuel)

## Liens

- `package.json`, `svelte.config.js`, `tailwind.config.js`
- Si on veut un jour ajouter un backend (notifications, comptes utilisateurs, comparateurs sauvegardés), on swap pour `adapter-node` sans réécrire le front
