# 0031 — Modèle Élu cross-chambre : manifest bicaméral, ID synthétique

**Date** : 2026-05-08
**Statut** : accepté
**Tags** : data, modèle, identité, multi-chambre, senat

## Contexte

ADR 0030 introduit le hub `/elus/[eluId]` qui doit relier les mandats AN et Sénat d'une même personne (~50 cas attendus : Larcher, Dussopt, etc.). Trois stratégies étaient envisagées dans le backlog :

- **A.** Lien manuel UI seulement (badge "aussi sénateur") — pas de matching automatique
- **B.** Fusion lourde au pipeline : modèle `Personne` refondu pour porter `mandats: (MandatAN | MandatSenat)[]` cross-chambre
- **C.** Manifest cross-chambre : `personnes.json` (AN) et `senateurs.json` (Sénat) restent disjoints, un fichier `elus.json` les croise

ADR 0023 a posé le principe d'un **pipeline Sénat séparé** (pas de fusion en v1) pour limiter le risque sur Phase 3. La présente ADR formalise la stratégie **C**, qui ouvre la voie à un hub bicaméral sans toucher aux modèles existants.

L'utilisateur a explicitement validé (2026-05-08) :
- ID synthétique nouveau, généré par hash stable
- Matching sur `(prénom + nom normalisés + dateNaissance)`
- Comportement par défaut sur ambiguïté : pipeline log et continue (pas de fusion erronée), avec table d'overrides manuels pour les cas exotiques

## Décision

### Modèle de données

Un **manifest bicaméral** `static/data/elus.json` est généré au build par un nouveau script `scripts/build-elus-manifest.ts`, exécuté **après** `fetch-data.ts` (AN) et `fetch-data-senat.ts` (Sénat).

Schéma de `elus.json` :

```ts
type EluManifest = {
  generatedAt: string;        // ISO date du build
  count: number;              // total élus dédupliqués
  countBicameral: number;     // élus avec ≥2 mandats AN+Sénat
  elus: Elu[];
};

type Elu = {
  id: string;                 // eluId synthétique, voir ci-dessous
  prenom: string;             // de la source de référence (priorité AN si dispo)
  nom: string;
  dateNaissance: string | null;  // ISO, ou null si manquant
  paId: string | null;        // PA-id AN si l'élu a au moins un mandat AN
  matricule: string | null;   // matricule Sénat si l'élu a au moins un mandat Sénat
  mandats: EluMandatRef[];    // chronologique ascendant
};

type EluMandatRef =
  | { chambre: 'AN'; legislature: 15 | 16 | 17; debut: string; fin: string | null }
  | { chambre: 'SENAT'; triennat: '2017-2020' | '2020-2023' | '2023-2026'; debut: string; fin: string | null };
```

### `eluId` — ID synthétique stable

Format : `elu_<8 hex>` où `<8 hex>` est les 8 premiers caractères d'un `sha256(normalisedKey)`.

`normalisedKey` = `${prenomNormalise}|${nomNormalise}|${dateNaissance ?? 'NA'}`

Normalisation :
- `lowercase`
- Enlever les accents (Unicode NFD + suppression marks)
- Trim, collapse spaces
- Remplacer apostrophes/tirets par espaces
- Remplacer particules (`de`, `du`, `des`, `le`, `la`) par `_` (réversible, déterministe)

Exemple : `Gérard Larcher (1949-09-14)` → `gerard|larcher|1949-09-14` → `sha256("...")[0:8]` → `elu_8b3e4f12`.

Conséquence : l'ID est **déterministe et reproductible** entre builds. Si la date de naissance est inconnue, on emploie `NA` (l'ID reste stable mais peut potentiellement coller deux homonymes — voir politique de matching ci-dessous).

### Politique de matching

Pour chaque `Personne` AN et chaque `Senateur` Sénat, on calcule la `normalisedKey` et on regroupe :

1. **Match strict** : même `normalisedKey` avec `dateNaissance` non null des deux côtés → fusion en un `Elu` unique avec `paId` ET `matricule`.
2. **Match partiel** : même `(prenomNormalise, nomNormalise)` mais `dateNaissance` manquante d'un côté → **pas de fusion**, deux `Elu` distincts (chacun avec son hash basé sur `NA`). Log warning : `"⚠️ matching ambigu Larcher G. (AN PA1234 sans dateNaissance ↔ Sénat 08061X 1949-09-14) — séparés par défaut"`.
3. **Conflit** (deux entrées AN ou Sénat tombent sur la même clé) : log warning + on garde la première seule, on ignore les suivantes. Cas attendu : 0 (PA-id et matricule sont uniques par chambre).
4. **Override manuel** : si `static/data/elus-overrides.json` contient une entrée `{ paId: "PA1234", matricule: "08061X" }`, le pipeline force la fusion **même si la `normalisedKey` diffère** (cas noms d'usage différents, particules retravaillées). Le fichier est commité (gitignore exception sur `static/data/`).

### Schéma `elus-overrides.json`

```ts
type EluOverrides = {
  forceFusion: { paId: string; matricule: string; comment: string }[];
  forceSeparation: { paId: string; matricule: string; comment: string }[];
};
```

`forceSeparation` couvre le cas inverse rare (deux personnes différentes que la clé colle par hasard). Documenté dans la FAQ.

### Tests unitaires

- Cas Larcher (sénateur depuis 2004, donc présent en 3 triennats Sénat ; pas de mandat AN avant 17ᵉ) → 3 mandats SENAT
- Cas Dussopt (député 14ᵉ-16ᵉ AN, ministre, sénateur après 2024 si applicable) → mandats AN + (Sénat si applicable)
- Cas homonyme construit (deux personnes même nom, dates différentes) → 2 `Elu` distincts
- Cas date manquante (date = null d'un côté) → 2 `Elu` distincts + warning log
- Cas override fusion (force) → 1 `Elu` avec paId + matricule

## Pourquoi

- **Manifest = stratégie minimale** : `personnes.json` et `senateurs.json` ne sont pas touchés, les loaders existants restent valides, zéro régression sur AN ou Sénat. Si le manifest a un bug, on retombe sur les fiches AN/Sénat séparées.
- **ID synthétique** plutôt que réutilisation PA-id ou matricule :
  - Évite la confusion (un même `eluId` ne peut pas être confondu avec un identifiant chambre).
  - URLs lisibles : `/elus/elu_8b3e4f12` peut paraître opaque mais reste court et stable. L'utilisateur navigue par le nom, pas par l'ID.
  - Reproductible (hash stable) : pas de drift entre builds, pas de migration data.
- **Date de naissance comme désambiguïsateur** : indispensable en politique (homonymes fréquents — pensez aux familles politiques). Quand elle manque, on **refuse de fusionner** plutôt que de risquer un faux positif. Coût acceptable : on perd ~5 fusions au lieu de coller deux personnes différentes.
- **Overrides manuels** : pragma indispensable pour les cas exotiques (changement de nom, particules variables). Format JSON commité, audit-friendly.
- **Forme `elu_<hash>` plutôt qu'`<incrément>`** : déterministe, immuable d'un build à l'autre. Un build qui ré-ordonne les données ne change pas les URLs.

## Conséquences

### Pipeline

- Nouveau script `scripts/build-elus-manifest.ts` (TDD strict, à l'image de `dosleg-parser.ts`).
- Nouveaux tests `scripts/build-elus-manifest.test.ts` (cas matching, overrides, dates manquantes).
- Output : `static/data/elus.json` (gitignored comme tout `static/data/`).
- Ajout au `package.json` : `"data:fetch": "...; npm run build:elus-manifest"`.
- Ajout au Dockerfile : `RUN npm run data:fetch` couvre déjà l'enchaînement.

### Code applicatif

- Nouveau `src/lib/elus.ts` :
  - Type `Elu` (alignée avec le manifest)
  - `loadElus(fetchFn)` : charge `elus.json`
  - `loadElu(fetchFn, eluId)` : charge un `Elu` par ID
  - `findEluByPaId(elus, paId)` : utilitaire pour réécrire les liens internes (listes, scrutins, groupes, hémicycles AN)
  - `findEluByMatricule(elus, matricule)` : symétrique pour Sénat

### Routes

- `/elus/+page.svelte` : liste cross-chambre dédupliquée (filtres : recherche, chambre, groupe, bicaméral)
- `/elus/[id]/+page.svelte` : **seule fiche détail** d'un élu (cf #0032)
- Tout élu présent dans le manifest a une route `/elus/[eluId]`, qu'il soit mono-chambre ou bicaméral. Un député 16ᵉ uniquement comme René Pilato (PA817211) a `/elus/elu_<hash>`, pas de fiche `/assemblee/deputes/PA817211` (supprimée par #0030).
- Les listes par chambre `/assemblee/deputes/` et `/senat/senateurs/` restent disponibles pour le filtrage scope-chambre, mais leurs items pointent tous vers `/elus/[eluId]?tab=...`.

### Smoke-test

- `scripts/smoke-test.ts` : ajout d'assertions cross-chambre (élu connu bicaméral → présence dans `elus.json` avec ≥2 mandats).
- Nouvelle fonction de garde : `Object.keys(elus).every(id => id.match(/^elu_[0-9a-f]{8}$/))`.

### Coût build

- ~50 ms supplémentaires (manifest sur ~1900 personnes + 672 sénateurs). Négligeable vs le cold pipeline (~12 min).

### Limitations acceptées

- **Pas de matching auto sur noms d'usage** : Marlène Schiappa apparaît sous son nom de naissance dans certaines sources, son nom marital dans d'autres. Si la `normalisedKey` diffère, l'override manuel est obligatoire. Documenté dans la FAQ.
- **Pas de matching fuzzy** : pas de `Levenshtein` ni `Fuse.js`. Cohérent avec ADR sourçage (rigueur) — un faux positif est plus grave qu'un faux négatif.
- **Manifest régénéré à chaque build** : pas de cache. Coût négligeable.
- **Si une personne change de nom officiel** (mariage, décès et veuvage…) entre deux builds : la `normalisedKey` change → l'`eluId` change. Acceptable (cas rarissime). Si besoin un jour, on pourra ajouter un `aliases.json` côté pipeline.

## Liens

- ADR `#0015` (personne unique cross-législature côté AN — pattern qu'on étend cross-chambre)
- ADR `#0018` (PA-id stable, ne change pas)
- ADR `#0023` (Phase 3 Sénat — principe pipeline séparé)
- ADR `#0024` (matricule Sénat stable)
- ADR `#0030` (routes — introduit `/elus/`)
- ADR `#0032` (sémantique carrière cross-chambre — utilise les `Elu`)
- `scripts/build-elus-manifest.ts` (à créer)
- `scripts/build-elus-manifest.test.ts` (à créer, TDD)
- `static/data/elus.json` (output, gitignored)
- `static/data/elus-overrides.json` (commité)
- `src/lib/elus.ts` (loaders)
