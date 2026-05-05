# 0021 — Cache HTTP conditionnel + cache mount BuildKit pour les sources Etalab

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : data, déploiement, build, performance, etalab

## Contexte

Avec la couverture multi-législature (15ᵉ + 16ᵉ + 17ᵉ, cf ADR 0020), chaque `docker build` re-télécharge **toutes** les sources Open Data Etalab depuis zéro :

| Source | Taille | Évolutivité |
|---|---|---|
| AMO30 historique (acteurs cross-leg) | ~50 MB | bouge à la marge (nouveaux mandats, fusions) |
| AMO20 15ᵉ + 16ᵉ | ~3 MB chacune | **figées** (législatures terminées) |
| AMO10 17ᵉ | ~5 MB | bouge en continu (légis. en cours) |
| Scrutins 15ᵉ | ~10 MB | **figés** |
| Scrutins 16ᵉ | ~10 MB | **figés** |
| Scrutins 17ᵉ | ~20 MB | bouge à chaque vote |

Le CDN Etalab plafonne **les Scrutins 17ᵉ à ~25 KB/s** (cf mémoire `project_etalab_throttle`), soit **10–12 minutes** par fresh download. Le cache `tmpdir/politidex-cache/` du script existait déjà, mais Docker rebuild ces couches dans un FS éphémère → cache jamais réutilisé entre deux déploiements Coolify.

> Question : comment éviter de re-télécharger ce qui n'a pas bougé, surtout les législatures figées et les Scrutins 17ᵉ entre deux déploiements rapprochés ?

## Décision

**Cache HTTP conditionnel côté script** + **cache mount BuildKit côté Dockerfile**, deux mécanismes complémentaires :

1. **`scripts/fetch-data.ts`** — `downloadZip` interroge le CDN en `HEAD`, lit `Last-Modified` / `ETag` / `Content-Length`, et compare à un fichier `<target>.meta.json` du run précédent. Si tout matche **et** que le fichier local existe avec la bonne taille → skip total (~50 ms). Sinon : purge complète du fichier local + meta, **fresh download from scratch** (sans `curl -C -`). Les métadonnées sont ré-écrites après chaque fetch réussi.
2. **`Dockerfile`** — `RUN --mount=type=cache,target=/tmp/politidex-cache,id=politidex-data` persiste le dossier de cache entre builds Docker (BuildKit). Combiné avec (1), un build sans nouveau scrutin 17ᵉ termine le stage `data:fetch` en quelques secondes.

L'extraction des ZIP est aussi rendue **idempotente** : un marqueur `<dest>.zip-meta` stocke `size+mtime` du ZIP source, et l'extraction est rejouée seulement si l'empreinte change.

### Pourquoi pas de reprise (`curl -C -`) ?

Une première version utilisait `curl -C -` pour reprendre un download interrompu. Ça a produit un bug subtil : le CDN AN re-publie parfois le même ZIP (notamment Scrutins 17ᵉ) avec **la même `Content-Length` et le même `Last-Modified` mais des bytes différents** au sein du fichier. Si on raccroche un range request sur la queue d'un fichier local incohérent avec la nouvelle version serveur, on obtient une archive corrompue qui passe les vérifications de taille mais explose à l'extraction (`bsdtar: Damaged Zip archive`). Solution : **toujours re-télécharger from scratch** quand le cache HTTP ne valide pas. Coût : un peu plus de bande passante en cas de coupure réseau ; bénéfice : zéro cas de corruption silencieuse.

## Pourquoi

- **Le goulot identifié est Scrutins 17ᵉ** : 12 min sur 15 min de build total. Skipper son re-download quand rien n'a bougé fait passer le build de ~15 min à ~30 s.
- **Les législatures figées (15ᵉ, 16ᵉ) ne bougent jamais** : leur `Last-Modified` est stable à la date de fin de législature. Cache hit garanti à vie.
- **AMO30 et AMO10 17ᵉ bougent souvent** mais sont petits (~50 MB / ~5 MB) et rapides à fetch — le cache miss y est peu coûteux.
- **`Last-Modified` est exposé** par le CDN AN sur tous les ZIP statiques (vérifié via `curl -I`). On utilise aussi `ETag` en backup, et `Content-Length` comme garde-fou de cohérence.
- **BuildKit cache mount** est natif Docker, supporté par Coolify (qui utilise Docker BuildKit par défaut depuis longtemps), et son scope `id=politidex-data` permet de le partager entre tous les rebuilds de l'app.
- **Pas de surcoût pour les builds froids** : la première fois (ou si le cache est purgé), le pipeline retombe exactement sur le comportement précédent.
- **Robustesse** : si le HEAD échoue (CDN down momentané), on retombe sur le fresh download — pas de panne silencieuse.

## Conséquences

### Pipeline (`scripts/fetch-data.ts`)

- `downloadZip` écrit `<target>.meta.json` à côté de chaque ZIP. Format :
  ```json
  { "url": "...", "contentLength": 1234, "lastModified": "...", "etag": "...", "fetchedAt": "..." }
  ```
- Nouveau helper `extractIfNeeded(zipPath, destDir, sentinelRelPath, minEntries, label)` qui invalide l'extraction quand `size+mtime` du ZIP source change. Marqueur stocké en `<destDir>.zip-meta`.
- `FORCE_CACHE=1` reste valable (court-circuit total) pour les sessions de dev où on touche au code de transform et qu'on ne veut surtout pas refetch.

### Dockerfile

- Directive `# syntax=docker/dockerfile:1.7` ajoutée pour activer BuildKit explicitement (Coolify utilise BuildKit par défaut, mais la directive rend l'intention explicite et autorise les versions futures).
- `apk add` passe à `libarchive-tools` (qui fournit `bsdtar`) + `curl`. `bsdtar` gère mieux les ZIP64 que le `unzip` busybox d'Alpine.
- `RUN --mount=type=cache,target=/tmp/politidex-cache,id=politidex-data` autour du `npm run data:fetch`.

### Performances attendues sur Coolify

| Scénario | Avant | Après |
|---|---|---|
| Premier build (cold cache) | ~15 min | ~15 min |
| Rebuild sans nouveau scrutin 17ᵉ | ~15 min | **~30 s** (HEADs + transform JSON) |
| Rebuild avec nouveau scrutin 17ᵉ | ~15 min | **~12 min** (refetch 17ᵉ uniquement) |
| Rebuild avec changement code (data inchangée) | ~15 min | **~30 s** |

### Limites assumées

- Si Coolify migre vers une nouvelle machine de build, le cache disparaît (one-shot cold rebuild). Pas un problème en pratique.
- Si le CDN AN cesse d'exposer `Last-Modified` un jour, on retombe sur l'égalité de `Content-Length` seule, ce qui reste plus rapide que rien (juste un peu moins safe). Si même ça disparaît, tout fonctionne encore — on refetch systématiquement comme avant.
- Le cache mount BuildKit est local à la machine Docker hôte ; il n'est pas partagé entre instances Coolify multi-host. Pour PolitiDex c'est non-pertinent (un seul host).

### Compatibilité ADR existantes

- **ADR 0003** : `static/data/` reste gitignored. La fraîcheur des données au build est préservée — on accélère, on ne freeze pas.
- **ADR 0019** : la stratégie deux-passes AMO30 + AMO10/AMO20 est inchangée. Chaque source a maintenant son propre cycle de cache.
- **ADR 0002** : le timeout build Coolify reste à ≥15 min (pour les cold rebuilds et les jours où Scrutins 17ᵉ a un nouveau drop). Le commentaire dans `fetch-data.ts` reste valide.

## Liens

- `scripts/fetch-data.ts` — `downloadZip`, `readCacheMeta`/`writeCacheMeta`/`remoteHead`, `extractIfNeeded`
- `Dockerfile` — `# syntax=docker/dockerfile:1.7` + `RUN --mount=type=cache`
- ADR `#0003` (data fetched au build, gitignored)
- ADR `#0019` (priorité AMO10/AMO20 sur AMO30)
- ADR `#0020` (Phase 2, ajout 15ᵉ législature)
- [BuildKit cache mounts](https://docs.docker.com/build/cache/optimize/#use-cache-mounts)
- [HTTP If-Modified-Since (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Modified-Since)
