# 0033 — `api-senat/senateurs.json` est une source optionnelle (fallback ODSEN+dosleg)

**Date** : 2026-05-08
**Statut** : accepté
**Tags** : data, pipeline, sources, senat, robustesse, build

## Contexte

L'ADR 0025 décrit la cascade de sources Sénat :

1. `senat.fr/api-senat/senateurs.json` — live, 348 sénateurs en exercice, expose `siege`/`serie`/photo/groupe courant
2. `data.senat.fr/data/senateurs/ODSEN_*` — identité historique exhaustive (5 935 sénateurs), appartenances groupe, mandats datés
3. `data.senat.fr/data/dosleg/dosleg.zip` — scrutins (`scr` + `votsen` + `ses`) + fallback identité (`auteur`)

Le 2026-05-07 vers 20:00 UTC, **deux déploiements Coolify consécutifs ont échoué** parce que le CDN `senat.fr` répondait `HTTP 200 OK` avec **0 octet** (`Content-Length: 0`, ETag `"0-..."`) sur l'endpoint `api-senat/senateurs.json` pendant ~1 h. Le pipeline crashait à `JSON.parse('')` avec `SyntaxError: Unexpected end of JSON input`.

Mode de panne identifié :

- Côté CDN parlementaire : régénération transitoire qui publie un fichier vide (sans 5xx ni 404 — le CDN ment).
- Côté pipeline : `await readFile(apiPath, 'utf8')` lit 0 octet, `JSON.parse` plante, le build Docker s'arrête.
- Conséquence : **toute la prod est bloquée** parce que le CDN d'une **source optionnelle** (siege/serie/photo) tousse, alors qu'ODSEN+dosleg sont parfaitement disponibles et suffisent à reconstruire l'essentiel du modèle Sénat.

L'ADR 0025 énonçait déjà que api-senat n'est canonique que pour `siege`/`serie`/photo/groupe live des sénateurs en exercice — données utiles mais **non-bloquantes**. Cette régression a révélé que cette intention n'était pas codée.

## Décision

`senat.fr/api-senat/senateurs.json` est une **source d'enrichissement optionnelle**. Si elle est inutilisable au moment du build (vide, JSON invalide, non-tableau), le pipeline :

1. Émet un warning `⚠ api-senat/senateurs.json … — fallback ODSEN+dosleg` dans la sortie de build.
2. Continue avec un `apiByMat` vide.
3. Construit `Senateur[]` sur la seule base d'ODSEN+dosleg (cascade ADR 0025 préservée).
4. Les champs `place` (siege) et `serie` des mandats actifs deviennent `null` ce build, et la photo retombe sur le fallback `senat.fr/senimg/<slug>_carre.jpg`.
5. Le mandat synthétique pour les sénateurs réélus au dernier renouvellement (cf `fetch-data-senat.ts:566+`) n'est pas créé pour les matricules absents d'ELUSEN — la cohorte effective baisse à ~584 vs ~672 en mode nominal.

En complément, le helper `downloadFile` de `scripts/lib/cache.ts` est durci avec deux gardes :

- **Avant le download** : si le HEAD distant signale `Content-Length: 0` et qu'un cache local valide existe (`taille > 0`), le cache est conservé. Pas d'écrasement par un payload vide.
- **Après le download** : si le fichier rapatrié pèse 0 octet, le `meta.json` n'est pas écrit. Le cache reste marqué invalide pour le run suivant.

## Pourquoi

- **Symétrie avec l'ADR 0025** : la hiérarchie y est explicite — api-senat n'est canonique que pour les champs *live* des actifs, ODSEN+dosleg portent le reste. Le fallback formalise ce qui était déjà conceptuel.
- **Pas de fix amont possible** : `senat.fr` est tiers, son CDN renvoyer `200 OK + 0 octet` est un comportement qu'on subit. L'incident peut se reproduire à tout moment (sur api-senat ou sur n'importe quelle ressource Etalab).
- **L'alternative "attendre + retry"** était envisageable (option A du diagnostic) mais ne couvre pas le cas où l'incident dure assez longtemps pour bloquer un déploiement urgent (fix critique). La cascade gracieuse couvre ce cas.
- **Coût du mode dégradé acceptable** :
  - 88 sénateurs synthétiques perdus → seul le smoke-test local le voit (la prod conserve l'ancienne build via Coolify tant que le nouveau build aboutit).
  - `siege`/`serie` `null` → l'hémicycle reste affiché en mode "vivant" (gradient gauche-droite, cf ADR 0026), aucune régression UX bloquante.
  - photo fallback `senat.fr/senimg/...` → fonctionne pour la majorité des matricules.
- **Garde cache séparée** : le pipeline pourrait être robuste *sans* la garde cache, mais celle-ci protège **toutes** les ressources Etalab (AN comme Sénat) contre la même classe de panne. C'est de la défense en profondeur générique, alignée avec ADR 0021.
- **Pas de fuzzy parsing** : on ne tente pas de "réparer" un JSON tronqué — soit il est valide et tableau, soit on tombe en cascade. Cohérent avec la rigueur sourçage de PolitiDex.

## Conséquences

### Pipeline

- Nouveau module `scripts/lib/senat-sources.ts` : helper pur `readApiSenateursOrEmpty(raw, log?)` testable, exporté + 8 tests TDD dans `senat-sources.test.ts`.
- `scripts/fetch-data-senat.ts:154` utilise désormais ce helper (au lieu de `JSON.parse` direct) et continue avec `apiByMat = Map vide` si nécessaire.
- `scripts/lib/cache.ts:downloadFile` ajoute deux gardes anti-payload-vide. Pas de breaking change pour les autres pipelines (AN reste inchangé).

### Smoke-test

- En **mode nominal** (api-senat OK) : 67/67 ✅ inchangé.
- En **mode dégradé** (api-senat vide) : 4 échecs attendus — 348 actifs sans `place`/`serie`, cohorte session 2024 ~174 vs ~348. **C'est l'effet recherché** : le smoke-test signale visuellement qu'on est en mode dégradé, pour qu'on relance un build dès qu'`api-senat` est rétabli.
- La CI GitHub Actions n'exécute pas `data:smoke` (elle utilise des placeholders). Le déploiement Coolify n'est donc pas bloqué par les fails smoke-test.

### Build / Déploiement

- Coolify build : ~30 s warm en mode nominal, identique en mode dégradé (1 source en moins à parser).
- Si l'incident upstream dure > 1 build : le déploiement aboutit avec données partiellement dégradées plutôt que d'échouer. **Le service utilisateur est priorisé sur la complétude**.
- Pour relancer en mode nominal : suffit de redéclencher un build (auto-deploy au prochain push, ou manuel via le sous-agent `coolify_control`).

### Documentation

- ADR 0025 reste vraie mais ce nouveau mode de panne est désormais explicitement géré.
- Mémoire auto Claude (`project_etalab_throttle.md`) à compléter avec ce mode de panne CDN spécifique au Sénat.
- COOKBOOK Coolify à compléter (incident type "200 OK + 0 octet").

### Limites assumées

- **Pas de retry HTTP applicatif** : le `curl --retry 5` interne suffit pour les pannes réseau, mais ne résout pas un `200 OK + 0 octet` (curl considère ça comme un succès). Le fallback est la bonne couche pour gérer ce mode.
- **Pas d'alerte automatique** : si api-senat est cassé pendant des semaines, on s'en rend compte uniquement via le warning de build et le smoke-test local. Un check de fraîcheur dans `meta.json` serait possible mais hors scope.
- **Pas de cache croisé entre pipelines** : la garde cache opère par-fichier, pas globalement. Un payload vide sur AN ne protège pas le Sénat (et inversement).

## Liens

- ADR `#0021` (cache HTTP conditionnel — étendu par les gardes anti-payload-vide)
- ADR `#0025` (cascade sources Sénat — formalise désormais le caractère optionnel d'api-senat)
- ADR `#0026` (hémicycle Sénat — gère déjà gracieusement les `place` null en mode "vivant")
- `scripts/lib/senat-sources.ts` (helper + types)
- `scripts/lib/senat-sources.test.ts` (8 tests TDD)
- `scripts/lib/cache.ts:downloadFile` (gardes anti-payload-vide)
- `scripts/fetch-data-senat.ts:150-160` (intégration cascade)
- Incident 2026-05-07 : régression CDN `senat.fr/api-senat/senateurs.json` (200 OK + 0 octet)
