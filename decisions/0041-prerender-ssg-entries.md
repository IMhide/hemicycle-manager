# 0041 — Prerender SPA → SSG : pages détail en HTML statique via `entries()`

**Date** : 2026-06-08
**Statut** : proposé
**Tags** : seo, geo, rendu, ssg, prerender, sveltekit, performance

## Contexte

Un audit SEO complet (2026-06-07) a donné à PolitiDex un **score santé de 27/100**.
La cause est unique, pas multiple : le site est servi comme une **SPA pur
client**. Le HTML renvoyé à tout crawler — premier passage de Googlebot et
**100 % des crawlers IA** (GPTBot, ClaudeBot, PerplexityBot, CCBot/Common Crawl,
Google-Extended) qui **n'exécutent pas JavaScript** — est une **coquille vide de
3,6 Ko** : aucun `<h1>`, aucun nom d'élu, aucun vote, aucun `<title>` sur les
pages détail. Tout le contenu (≈ 1196 élus, 1225 textes, 15 421 scrutins)
n'existe qu'après hydratation côté navigateur.

Deux mécanismes précis, vérifiés dans le code, produisent cette invisibilité :

1. **`svelte.config.js` → `fallback: 'index.html'`.** Avec un fallback,
   adapter-static écrit la **coquille SPA dans `build/index.html`** — le chemin
   qu'occuperait la home prérendue. Le fallback gagne ; le build logue
   *« Overwriting build/index.html with fallback page »*. Conséquence
   secondaire : **toute URL inconnue** (`/n-importe-quoi-12345`) renvoie
   **HTTP 200** + cette coquille (nginx `try_files $uri $uri/index.html
   /index.html`) → **soft-404 à l'infini**, espace d'URL non borné renvoyant un
   contenu identique.
2. **13 modules de route** posent `export const ssr = false`
   (+ `prerender = false`) : `elus/[id]`, `textes/[id]`, `elus`, `textes`,
   `classement`, scrutins AN/Sénat, `legislatures/[num]`, `triennats/[periode]`,
   et les pages groupes. Ces pages n'émettent **jamais** de HTML statique. Le
   commentaire de `elus/[id]/+page.ts` justifie ce choix par « Trop volumineux
   pour prerender chaque eluId ».

Le `+layout.ts` déclare pourtant déjà `prerender = true` et
`trailingSlash = 'always'`, et `+layout.svelte` / `+page.svelte` contiennent
déjà titres par page, canonical et balises OG `website` — **tout cela est piégé
côté client** et n'atteint jamais le HTML servi.

**Contrainte de séquencement découverte en lisant les `load()`** : `elus/[id]`
et `textes/[id]` chargent `loadScrutinsIndex` (**6,1 Mo**) + `loadTextes` /
`loadPersonnes`. SvelteKit **sérialise les données de `load()` dans le HTML**
prérendu (blocs `data-sveltekit-fetched`, pour l'hydratation). Prérendre **sans
alléger d'abord** inlinerait ces 6+ Mo **dans chacune des ~2421 pages**. Le même
mécanisme explique que les pages déjà prérendues `/assemblee` et `/senat` pèsent
respectivement **12,0 Mo** et **6,1 Mo** de HTML (le dataset entier est inliné
pour n'afficher que ~8 scrutins récents et deux compteurs).

Options considérées pour rendre le contenu crawlable :

- **(A) Prerender (SSG) via `entries()`** — énumérer les ids au build et émettre
  un fichier HTML statique par page. Adapté à un site de données **statiques**
  (régénérées au `docker build`).
- **(B) SSR au runtime** — impossible sous adapter-static (pas de serveur en
  prod) ; imposerait de changer d'adaptateur (Node/edge) et d'infra Coolify.
- **(C) Statu quo SPA** — Google *peut* rendre le JS en seconde vague (lent,
  budget-limité, peu fiable à ~18k URLs) ; les crawlers IA, eux, ne verront
  **jamais** rien.

## Décision

**On prérend en HTML statique (SSG) toutes les pages à cardinalité finie —
home, listes, et surtout les ~1196 fiches élu et ~1225 fiches texte — via
`export const prerender = true` + `export const ssr = true` + une fonction
`entries()` qui énumère les ids depuis les manifests ; et on libère
`build/index.html` du fallback SPA en passant `fallback: '200.html'`.** Les
pages détail à très haute cardinalité et faible valeur (scrutins, ~17,5k)
restent en SPA et seront désindexées (cf ADR 0043).

**Corollaire non négociable : le prerender des fiches et l'allègement des
payloads sont livrés ensemble.** Une fiche prérendue ne doit jamais inliner
l'index global des scrutins ; les données par-page sont **dénormalisées** au
pipeline (historique de vote portant déjà `{titre, date, sort, texteId}`), et
les pages liste/home chargent des **projections « lite »** (`personnes-lite`,
`scrutins-recent`) au lieu des datasets complets.

## Pourquoi

- **C'est la cause racine de tout l'audit.** Prérendre allume d'un coup ce qui
  était piégé côté client : `<title>` par page, `<h1>`, canonical, OG, données
  structurées (cf ADR 0045), citabilité IA et crawlabilité. Les autres
  correctifs SEO n'ont aucune valeur tant que le HTML servi est vide.
- **Les données sont statiques.** Elles sont fetchées et figées au
  `docker build` (ADR 0003, 0021, 0025) ; le SSG est exactement l'outil adapté.
  L'objection « trop volumineux » visait le **payload**, pas le **nombre de
  pages** : ~2421 pages est tout à fait dans la zone du prerender statique (des
  sites en prérendent 10k+). Le vrai problème (payload) est traité séparément
  par l'allègement, ce qui lève l'objection.
- **(B) SSR runtime** changerait la stack et l'infra (adaptateur + serveur
  Coolify) pour un bénéfice nul ici : rien n'est dynamique au runtime.
- **(C) statu quo** sacrifie 100 % du canal IA (les crawlers IA ne rendent pas
  le JS — comportement documenté) et l'indexabilité fiable des ~18k pages.
- **`fallback: '200.html'`** est le pattern standard pour qu'une SPA garde une
  coquille de boot **sans** squatter `index.html` : la home reprend son HTML
  prérendu, et la coquille reste disponible pour les rares routes laissées en
  SPA (servie de façon **scopée**, pas en catch-all — cf ADR 0043 / nginx).

## Conséquences

- **`svelte.config.js`** : `fallback: 'index.html'` → `'200.html'`. nginx
  (`deploy/nginx.conf`) doit servir `/200.html` en fallback **scopé** aux
  préfixes SPA légitimes (`/assemblee/scrutins/`, `/senat/scrutins/`, …) et
  renvoyer un **vrai 404** (`error_page 404 /404.html`) ailleurs — fin du
  soft-404.
- **Routes** : retrait des overrides `ssr=false; prerender=false` sur `elus/[id]`,
  `textes/[id]`, `elus`, `textes`, `classement` ; ajout de `prerender = true`,
  `ssr = true` et d'une `entries()` sur les routes paramétrées. `entries()` lit
  `static/data/elus.json` / `textes-unifies.json` et **tolère un manifest vide**
  (`try/catch → []`) : en CI, sans `data:fetch`, le manifest peut être un
  placeholder `count:0` (déjà toléré par `+layout.ts`) → 0 page détail, **build
  vert**.
- **Pipeline (allègement, indispensable)** : `scripts/fetch-data.ts` et
  `fetch-data-senat.ts` émettent `personnes-lite.json`, `senateurs-lite.json`,
  `scrutins-recent.json`, `scrutins-senat-recent.json`, et **dénormalisent**
  `historique/{paId}.json` (titre/date/sort/texteId par vote). `src/lib/data.ts`
  gagne les loaders correspondants. Les `load()` de `/assemblee`, `/senat`,
  `/elus/[id]`, `/textes/[id]` cessent de tirer les index globaux.
- **Limitations acceptées** :
  - Les **scrutins (~17,5k) restent en SPA** en v1 (volume × faible valeur) et
    seront désindexés (ADR 0043). Les prérendre plus tard reste possible.
  - Le **temps de build augmente** (prerender de ~2421 pages). À mesurer ; le
    throttle CDN Etalab ne concerne que le *fetch* (caché, ADR 0021), pas le
    prerender qui lit du JSON local. Repli documenté si dépassement des limites
    Coolify : prérendre élus+textes seulement, le reste en SPA.
  - Un `throw error()` dans un `load()` prérendu (fallback alias loicod Sénat de
    `textes/[id]`) doit être pré-résolu au pipeline (ne pas générer d'entrée
    pour les alias) plutôt que de produire une page d'erreur prérendue.
- **Composants** : tout consommateur des données « lite » / de l'historique
  dénormalisé doit être adapté (sinon hydratation cassée) ; `npm run check`,
  `npm run data:smoke` (190/190) et un test manuel des 3 types de page valident.
- **TDD** (cf feedback TDD mesuré) : les projections lite et la dénormalisation
  sont des transformations de données critiques → tests unitaires vérifiant que
  la projection conserve les champs requis et qu'aucun champ lourd (historique
  complet, radar, votes) ne fuit.

## Liens

- `svelte.config.js` (adapter-static `fallback`)
- `src/routes/+layout.ts` (`prerender=true`, `trailingSlash='always'` — déjà là)
- `src/routes/elus/[id]/+page.ts`, `src/routes/textes/[id]/+page.ts`
  (overrides `ssr=false` à retirer + `entries()` à ajouter)
- `src/routes/assemblee/+page.ts`, `src/routes/senat/+page.ts` (allègement
  payload 12 Mo / 6 Mo)
- `scripts/fetch-data.ts`, `scripts/fetch-data-senat.ts` (projections lite +
  dénormalisation historique), `src/lib/data.ts` (nouveaux loaders)
- `deploy/nginx.conf` (fallback `200.html` scopé + `error_page 404`)
- Plan : `thoughts/shared/plans/2026-06-07_seo-remediation.md` (PR A)
- ADR liées : `#0042` (slugs lisibles, même PR), `#0043` (indexation /
  scrutins noindex), `#0003` `#0021` `#0025` (données fetchées au build),
  `#0031` (manifest `elus.json`), `#0015` (modèle Personne unique)
