# 0042 — URLs lisibles (slugs) pour élus, groupes et textes

**Date** : 2026-06-08
**Statut** : proposé
**Tags** : seo, urls, slugs, routing, sveltekit, recherche-nom

## Contexte

Aujourd'hui les fiches détail sont adressées par un identifiant **opaque** :
`/elus/elu_9409de12` (hash sha256-8, cf ADR 0031), `/textes/DLR5L17N51175`,
groupes par id Etalab `/assemblee/groupes/16/PO800538`. Le nom de la personne,
le titre de la loi, le nom du groupe **n'apparaissent pas dans l'URL**.

L'objectif explicite (demandé par l'utilisateur) est de **placer les fiches en
page 1 de Google sur les requêtes nom/entité** — pas la position #1 ni le
knowledge panel des têtes d'affiche (Wikipédia/officiel, imprenables), mais le
**top 10** sur `nom + a voté / vote / loyauté`, surtout pour la longue traîne
des élus peu médiatisés et les profils cross-chambre.

Vérification sur le SERP réel (2026-06-08) :

- `Jean-Yves Bony député vote` (élu obscur du Cantal) → **8 résultats sur 8 en
  page 1 sont des pages data** : Datan ×4, NosDéputés ×2, Assemblée nationale
  ×2. **Preuve que Google classe volontiers une fiche data sur le nom d'un élu**
  dès qu'elle est bien faite et **indexable**.
- `Marine Tondelier comment a voté` → page 1 = Wikipédia + presse + bios
  génériques + réseaux, **zéro site data** → trou exploitable.

Or **Datan met le nom dans l'URL** (`/deputes/cantal-15/depute_jeanyves-bony`),
PolitiDex non (hash `elu_xxxx`). Le nom dans l'URL est un signal de pertinence
classique (et un gain de CTR / lisibilité au partage). C'est l'un des leviers
qui sépare une fiche qui range sur le nom d'une fiche qui ne range pas.

**Fenêtre idéale, maintenant.** Comme le site est actuellement invisible (SPA,
cf ADR 0041), **aucune URL n'est indexée** → migrer le hash vers un slug
**ne casse aucune URL référencée** et **n'exige aucune redirection**. Faire ce
changement *après* indexation imposerait au contraire un parc de 301. Le coût
marginal est donc minimal **si on le fait dans la même PR que le prerender**.

Contrainte mesurée sur la donnée réelle (déterminante pour les règles) :

| Type | Slug naïf | Mesure sur le dataset |
|---|---|---|
| Élus (1856) | `prenom-nom` | **1 seule collision** : `jean-louis-masson` (un sénateur né 1947, un ex-député né 1954 — deux personnes distinctes). 1855 slugs uniques. |
| Textes (1225) | titre slugifié | **35 collisions de titres** + titres très longs (jusqu'à 80+ car., moyenne 67). Un slug de titre pur serait long **et** ambigu. |
| Groupes (~12/leg) | `libelle` | Déjà **scopés par législature/triennat** dans l'URL → aucune collision cross-leg. `libelle`/`libelleAbrege` propres. |

Les trois types n'ont donc **pas** la même contrainte d'unicité → il leur faut
**trois règles distinctes**.

## Décision

**On adresse les fiches par un slug lisible plutôt que par un id opaque, avec
une règle par type :**

- **Élus** : `prenom-nom` (slugifié). En cas de collision — uniquement les 2
  élus `jean-louis-masson` aujourd'hui — désambiguïsation par **suffixe stable**
  `paId`/`matricule` (`jean-louis-masson-pa346218`).
- **Textes** : **préfixe de titre tronqué (~50 car., sur frontière de mot) +
  id canonique** (`...-DLR5L17N51175`) — l'id garantit l'unicité, le préfixe
  apporte les mots-clés et la lisibilité.
- **Groupes** : `libelle` slugifié (`/assemblee/groupes/16/renaissance/`),
  déjà désambiguïsé par la législature/triennat présente dans l'URL.

**Le slug est calculé au pipeline et stocké dans le manifest** (champ `slug`
dans `elus.json` / `textes-unifies.json`), source unique, déterministe et
versionnée. Le paramètre de route passe de `[id]` à `[slug]`.

## Pourquoi

- **Levier direct pour ranker sur le nom** (objectif §0bis du plan) : le nom
  dans l'URL est un signal de pertinence ; Datan le fait et range sur des élus
  obscurs, PolitiDex ne le fait pas. Combiné au prerender (ADR 0041), au résumé
  en langage naturel + `<h1>` (PR C) et au schema `Person.sameAs` (ADR 0045),
  c'est ce qui rend la page 1 atteignable sur la longue traîne.
- **Risque quasi nul, mesuré** : 1 collision sur 1856 élus. On n'invente pas un
  schéma de désambiguïsation lourd « au cas où » — on traite le cas réel
  (2 fiches) avec un suffixe stable, et tout le reste garde un slug propre.
- **Fenêtre zéro-redirection** : rien n'étant indexé, c'est le **seul** moment
  où migrer les URLs ne coûte pas un parc de 301. D'où l'inclusion dans PR A
  (ADR 0041), pas plus tard.
- **Slug au pipeline, pas au runtime** : déterministe, testable, versionné, et
  cohérent avec l'architecture (le manifest est déjà la source de vérité
  cross-chambre, ADR 0031). Un `slug` calculé à la volée côté client risquerait
  des divergences entre `entries()`, les liens internes et le `load()`.
- **Stabilité du suffixe de désambiguïsation** : `paId`/`matricule` est immuable
  (≠ circonscription, qui change si l'élu est réélu ailleurs). On préfère une
  URL un peu moins jolie mais **stable dans le temps** pour les 2 cas concernés.
- **Pourquoi pas un slug de titre pur pour les textes** : 35 collisions + titres
  de 80+ caractères → URLs interminables et non uniques. Le préfixe court + id
  donne lisibilité **et** unicité garantie.

## Conséquences

- **Pipeline** : `scripts/build-elus-manifest.ts` ajoute `slug` à chaque élu ;
  `scripts/build-cross-chambre.ts` ajoute `slug` à chaque texte unifié. Helper
  `slugify` partagé (`scripts/lib/slug.ts`) : minuscules, NFD sans accents,
  `[^a-z0-9]→-`, trim, troncature sur frontière de mot pour les titres.
- **Routage** : dossiers `elus/[id]` → `elus/[slug]`, `textes/[id]` →
  `textes/[slug]`, groupes idem. `entries()` (ADR 0041) retourne les `slug`. Le
  `load()` résout `slug → entité` via une `Map` construite au module-load
  (même pattern que `$lib/elus.ts` pour `paId→eluId`, pas de scan O(n)).
- **Liens internes** : **tous** les helpers/composants qui pointent vers une
  fiche doivent émettre le slug — `lookupEluUrlForPaIdLeg` /
  `lookupEluUrlForMatriculeTriennat` (`$lib/elus.ts`), `MemberRow`,
  `MiniDeputeCard`/`MiniSenateurCard`, `GlobalSearch`, hémicycles, scrutins,
  classements, groupes. **Point de vigilance** : un consommateur oublié = lien
  cassé → `grep` exhaustif des `/elus/`, `/textes/`, `/groupes/` hardcodés
  avant merge.
- **Redirections hash→slug** : optionnelles (rien n'est indexé). Filet de
  sécurité possible via un map `elu_xxxx → slug` servant une 301 ; à défaut,
  l'ancien hash renvoie un 404 propre (acceptable).
- **TDD** (cf feedback TDD mesuré) : `scripts/lib/slug.test.ts` — déterminisme
  (même entrée → même slug), **unicité sur le dataset complet** (0 collision non
  gérée, y compris le cas `jean-louis-masson`), gestion accents / caractères
  spéciaux / troncature des titres longs.
- **Lien avec GlobalSearch** (ADR 0039) : la recherche navigue déjà vers
  `item.href` ; il suffit que les `href` indexés portent le slug. Aucune
  refonte de la recherche.

## Liens

- `scripts/build-elus-manifest.ts`, `scripts/build-cross-chambre.ts` (calcul du
  `slug`), `scripts/lib/slug.ts` (+ `slug.test.ts`)
- `src/lib/elus.ts` (helpers `lookupEluUrl*` → émettre le slug ; résolution
  `slug→id`)
- `src/routes/elus/[slug]/`, `src/routes/textes/[slug]/`,
  `src/routes/assemblee/groupes/[legislature]/[slug]/`,
  `src/routes/senat/groupes/[periode]/[slug]/`
- `static/data/elus.json`, `static/data/textes-unifies.json` (champ `slug`)
- Plan : `thoughts/shared/plans/2026-06-07_seo-remediation.md` (§0bis, §3bis,
  PR A)
- Sources SERP : datan.fr (`/deputes/cantal-15/depute_jeanyves-bony`),
  nosdeputes.fr, assemblee-nationale.fr (fiches « positions de vote »)
- ADR liées : `#0041` (prerender, même PR), `#0045` (JSON-LD `Person.sameAs`,
  lever nom), `#0031` (manifest `elus.json`, id opaque actuel), `#0039`
  (recherche globale), `#0030` (architecture des routes)
