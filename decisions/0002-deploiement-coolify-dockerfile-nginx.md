# 0002 — Déploiement Coolify avec Dockerfile multi-stage Node + Nginx

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : déploiement, infrastructure

## Contexte

Choix de l'hébergement et de la stratégie de build pour mettre l'app en production.

## Décision

**Coolify perso** (instance auto-hébergée) avec un **Dockerfile multi-stage** :
- Stage 1 : `node:22-alpine` qui fait `npm ci`, `npm run data:fetch`, `npm run build`
- Stage 2 : `nginx:1.27-alpine` qui sert le `build/` statique

URL canonique : https://politidex.fr (depuis 2026-05-25). Anciens domaines `www.politidex.fr` et `hemicycle.baijobu.net` redirigent en 308 via middleware Traefik. UUID app : `<APP_UUID>`.

## Pourquoi

- **Coolify** : auto-hébergement, contrôle total, gratuit (vs Vercel/Netlify qui pourraient brider sur 6287 fichiers JSON)
- **Multi-stage Docker** : image finale légère (juste nginx + assets), pas de Node en prod
- **Données fetchées au build** plutôt qu'au runtime → site immutable, pas de drift, simple à raisonner
- Le Dockerfile est **générique** : aucune info Coolify-spécifique dedans, marche n'importe où

## Conséquences

- Chaque déploiement re-fetch les données depuis l'open data AN (~25 Mo téléchargés, ~30s de build)
- Le repo reste **léger** (data gitignored, voir 0003)
- Auto-deploy GitHub **non activable via API publique Coolify** → il faut soit configurer une GitHub App via l'UI Coolify, soit poser un webhook GitHub manuel. En attendant, redéploiement manuel via :
  ```bash
  cd /Users/hide/Agents/coolify_control && ./scripts/coolify deploy <APP_UUID>
  ```

## Liens

- `Dockerfile`, `deploy/nginx.conf`
- ADR 0010 (Node 22 obligatoire) et 0011 (Healthcheck IPv4) — bugs corrigés au déploiement
- README section "Déploiement Coolify"
