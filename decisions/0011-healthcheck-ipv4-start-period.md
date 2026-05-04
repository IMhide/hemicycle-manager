# 0011 — Healthcheck Docker sur `127.0.0.1` avec `start-period: 30s`

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : déploiement, docker, debug

## Contexte

Deuxième échec de déploiement Coolify : le build passait, mais le conteneur restait `exited:unhealthy`.

```
Healthcheck logs: wget: can't connect to remote host: Connection refused
```

Nginx démarrait correctement (workers logués), mais le `HEALTHCHECK` Docker ne passait pas.

## Décision

Le `HEALTHCHECK` du Dockerfile utilise :
- **`127.0.0.1` au lieu de `localhost`**
- **`--start-period=30s`** au lieu de 10s
- **`--retries=5`** sur intervalle 10s

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
```

## Pourquoi

Diagnostic en 2 étapes :

1. **`localhost` vs `127.0.0.1`** : nginx Alpine fait `listen 80;` qui ne bind que sur **IPv4**. BusyBox `wget` (présent dans `nginx:alpine`) résolvait `localhost` → `::1` (IPv6) en premier → `Connection refused`. Avec `127.0.0.1` on force IPv4.

2. **`start-period`** : avec 10s, le probe Coolify (rolling update) démarre avant que nginx ait fini de bind sur le port 80, surtout sur des hosts un peu chargés. 30s couvre confortablement.

## Conséquences

- Healthcheck **fiable**, l'app est marquée `running:healthy` à chaque déploiement
- Tentative intermédiaire : suppression du HEALTHCHECK → catastrophe car Coolify avait mis en cache un flag interne `custom_healthcheck_found: true` (depuis le 1ᵉʳ build) et plantait sur `docker inspect` d'un conteneur sans état Health. Le PATCH pour désactiver ce flag est refusé par l'API. **Ne jamais retirer un HEALTHCHECK une fois ajouté sur Coolify.**

## Liens

- `Dockerfile` lignes 37-43
- Découvert lors du déploiement initial 2026-05-04 (rapport agent Coolify, 3 échecs corrigés)
- ADR 0010 (Node 22 — autre fix du même déploiement)
