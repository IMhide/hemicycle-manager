# 0030 — Architecture des routes : `/assemblee/`, `/senat/`, `/elus/`, racine neutre

**Date** : 2026-05-08
**Statut** : accepté
**Tags** : routes, ux, scope, multi-chambre

## Contexte

À la fin de Phase 3 (Sénat mergé, PR #8, 2026-05-07), l'arborescence des routes héritée des phases AN reste asymétrique :

- L'AN occupe la racine : `/`, `/deputes/`, `/groupes/`, `/scrutins/`, `/classements/`, `/legislatures/[num]/`
- Le Sénat est relégué sous un préfixe : `/senat/`, `/senat/senateurs/`, `/senat/groupes/…`, `/senat/scrutins/…`, `/senat/classements/`, `/senat/triennats/…`
- Le header expose 9 entrées dont plusieurs ne pointent que vers AN (« Groupes », « Scrutins » sans préfixe sénat)
- Aucun nœud cross-chambre : un élu ayant été député **et** sénateur (cas Larcher, Dussopt, ~50 personnes attendues) n'a pas de fiche unifiée

Par ailleurs, le backlog (NEXT_STEPS.md) prévoit la phase 3c "lien fiches Député ↔ Sénateur" et envisage 3 stratégies (A: lien manuel, B: fusion lourde, C: manifest cross-chambre). La présente ADR formalise un choix de routes qui ouvre la voie à C.

## Décision

L'arborescence des routes est restructurée autour de **trois espaces symétriques** plus un **hub cross-chambre** :

```
/                                       → racine neutre (présentation produit, à enrichir plus tard)
/assemblee/                             → home AN (= ex /)
/assemblee/deputes/                     → liste AN (filtrable, scope député)
/assemblee/groupes/[legislature]/[id]
/assemblee/scrutins/
/assemblee/scrutins/[uid]
/assemblee/classements/
/assemblee/legislatures/[num]
/senat/                                 → home Sénat (inchangé)
/senat/senateurs/                       → liste Sénat (filtrable, scope sénateur)
/senat/groupes/[periode]/[code]
/senat/scrutins/
/senat/scrutins/[uid]
/senat/classements/
/senat/triennats/[periode]
/elus/                                  → liste cross-chambre dédupliquée
/elus/[eluId]                           → fiche Élu (SEULE fiche détail — voir #0031, #0032)
/classement                             → classement global cross-chambre par overallCarriere
/faq/                                   → inchangé
```

**Suppression des fiches détail par chambre** : `/assemblee/deputes/[id]` et `/senat/senateurs/[matricule]` **n'existent plus**. La fiche Élu (`/elus/[eluId]`) est l'**unique point d'entrée** pour consulter la fiche détaillée d'une personne, qu'elle soit députée, sénatrice ou les deux. Les listes/index par chambre (`/assemblee/deputes/`, `/senat/senateurs/`) restent : elles offrent un filtrage scopé chambre, mais leurs items pointent vers `/elus/[eluId]?tab=...`.

**Trois listes coexistent**, avec des publics et filtres différents :
- `/assemblee/deputes/` : tous les députés AN (15ᵉ + 16ᵉ + 17ᵉ), filtres scope député
- `/senat/senateurs/` : tous les sénateurs ère Macron, filtres scope sénateur
- `/elus/` : tous les élus dédupliqués cross-chambre, filtres scope cross-chambre (chambre, groupe, bicaméral)

### Header refondu

5 entrées principales + recherche + FAQ : **Élus · 🏛️ AN · 🏛️ Sénat · 🏆 Classement · 📚 FAQ** + barre de recherche unifiée (déjà cross-chambre dans `search-index.ts`). L'asymétrie « Groupes/Scrutins → AN seulement » disparaît : ces sous-pages se rejoignent désormais depuis `/assemblee/` et `/senat/`. Le bouton 🏆 Classement pointe vers `/classement` (singulier — voir section dédiée).

### Classement Élu cross-chambre — `/classement`

Une route racine **`/classement`** (au singulier, par convention) expose **le classement global de tous les élus de PolitiDex** triés par `overallCarriere` décroissant.

- **Périmètre** : AN ∪ Sénat dédupliqués via le manifest `elus.json` (#0031). Toutes périodes confondues. Un élu bicaméral apparaît une seule fois avec son `overallCarriere` (moyenne simple des mandats, #0032).
- **Score** : exclusivement `overallCarriere`. Pas de filtre période, pas de filtre chambre — c'est le classement *global* qui assume la posture ludique cross-chambre.
- **Filtres UI** : recherche par nom, filtre groupe (groupe principal du dernier mandat), filtre chambre (AN seul / Sénat seul / Bicaméral). Le score reste `overallCarriere` peu importe le filtre.
- **Pagination** : Top 50 visible direct, charge paresseuse au scroll (cohérence PR #7 sur les listes longues).
- **Médailles** : 🥇 🥈 🥉 sur les 3 premiers (cohérence Coupes existantes).

Le **singulier** `/classement` marque sémantiquement qu'il y a **un seul** classement à cette adresse (un score, un tri, un univers cross-chambre). Les routes par chambre conservent le pluriel `/assemblee/classements/` et `/senat/classements/` parce qu'elles agrègent **plusieurs** classements (Championnat + Coupes). Cette dissymétrie de nommage est un choix éditorial, pas une faute de cohérence.

### Routes classement existantes — conservées

Les routes `/assemblee/classements/` (anciennement `/classements/`) et `/senat/classements/` sont **conservées sans modification** :

- `/assemblee/classements/` : Championnat AN (Top députés / Top groupes / Top blocs) + Coupes AN (Présence / Participation / Loyauté / Frondes), scopés par législature
- `/senat/classements/` : Championnat Sénat + Coupes Sénat, scopés par triennat

Le nouveau `/classement` cross-chambre **complète** sans remplacer : il offre une vue synthétique pour la curiosité ludique, là où les pages par chambre offrent la rigueur scope-aware.

### Pas de redirection des anciennes URLs

Les anciens permaliens (`/deputes/[id]`, `/groupes/…`, `/scrutins/…`, `/classements/…`, `/legislatures/…`) **ne sont pas redirigés**. Ils renverront un 404. Choix assumé : pas de coût Nginx supplémentaire, pas de stubs Svelte, pas de lourdeur de maintenance. Les liens externes (réseaux sociaux, pages tierces) qui pointent vers ces routes seront cassés.

### Bouton retour générique sur la fiche Élu

Sur `/elus/[eluId]`, un bouton **« ← Retour »** appelle `history.back()` côté client. Pas de logique contextuelle (pas de lecture du `document.referrer`, pas de label dynamique). C'est un raccourci visuel équivalent au back navigateur natif, utile sur mobile et en lecture immersive.

Comportement :
- 1er chargement (utilisateur arrivé via lien direct, pas d'historique) : le bouton est **masqué** (vérification `window.history.length > 1`).
- Sinon : visible, en haut de la fiche, à gauche.

## Pourquoi

- **Symétrie AN/Sénat** : le Sénat n'est plus second-class. `/assemblee/` et `/senat/` sont jumeaux, chacun avec ses 5 sous-routes (home, élus, groupes, scrutins, classements). Les développeurs qui touchent à une chambre savent immédiatement où chercher dans l'autre.
- **Hub bicaméral `/elus/`** : permet de naviguer naturellement entre les deux mandats d'un même élu. Stratégie C du backlog (manifest croisé), formalisée par #0031.
- **Racine `/` neutre** : libère la racine pour devenir un vrai hub produit (présentation, recherche, deux portes AN/Sénat). Choix éditorial cohérent avec ADR 0014 (PolitiDex = élus nationaux, pas seulement députés).
- **Header simplifié** : 4 entrées principales lisibles à tous les breakpoints, vs 9 entrées hétérogènes aujourd'hui.
- **Absence de redirect 301** : on assume la rupture des permaliens dans ce pivot. Le projet est jeune (1 mois), peu de liens externes, pas de SEO établi à protéger. Le coût de maintenance d'une table de redirections (Nginx + tests + documentation) dépasse le bénéfice attendu.

## Conséquences

### Routes

- Tout `src/routes/deputes/*` → `src/routes/assemblee/deputes/*` **sauf** `[id]/` qui est **supprimé**
- Tout `src/routes/groupes/*` → `src/routes/assemblee/groupes/*`
- Tout `src/routes/scrutins/*` → `src/routes/assemblee/scrutins/*`
- Tout `src/routes/classements/*` → `src/routes/assemblee/classements/*`
- Tout `src/routes/legislatures/*` → `src/routes/assemblee/legislatures/*`
- `src/routes/+page.svelte` (racine actuelle = home AN) → devient racine neutre
- Nouveau : `src/routes/assemblee/+page.svelte` reprend la home AN actuelle
- Nouveau : `src/routes/elus/+page.svelte` (liste) et `src/routes/elus/[id]/+page.svelte` (fiche détail unique)
- Nouveau : `src/routes/classement/+page.svelte` (classement global cross-chambre)
- **Supprimé** : `src/routes/senat/senateurs/[matricule]/+page.svelte` et `src/routes/senat/senateurs/[matricule]/+page.ts` (la fiche Sénat seule disparaît)
- Côté Sénat : `src/routes/senat/senateurs/+page.svelte` (liste) reste ; tous ses items linkent vers `/elus/[eluId]?tab=senat-{periode}`

### Liens internes

Tous les `<a href="/deputes/...">`, `/groupes/...`, `/scrutins/...`, `/classements/...`, `/legislatures/...` doivent être réécrits en `/assemblee/...`. Audit grep avant merge.

**Réécriture additionnelle des liens vers fiches détail** : tous les liens qui pointaient sur `/deputes/[id]` ou `/senat/senateurs/[matricule]` doivent désormais pointer sur `/elus/[eluId]?tab=an-{leg}` ou `/elus/[eluId]?tab=senat-{periode}`. Concerne :
- Items des listes `/assemblee/deputes/`, `/senat/senateurs/`, `/elus/`
- Frondeurs des fiches scrutin (`/assemblee/scrutins/[uid]`, `/senat/scrutins/[uid]`)
- Membres des fiches groupe (`/assemblee/groupes/[leg]/[id]`, `/senat/groupes/[periode]/[code]`)
- Items des classements (`/assemblee/classements/`, `/senat/classements/`, `/classement`)
- Hémicycles (tooltips + clic siège, AN et Sénat)
- Recherche globale (`GlobalSearch.svelte`)
- Toute carte/lien quelconque pointant vers une personne

Le mapping `paId → eluId` et `matricule → eluId` est exposé par `src/lib/elus.ts` (helpers `findEluByPaId`, `findEluByMatricule`, voir #0031).

### Header (`src/routes/+layout.svelte`)

```html
<nav>
  <a href="/elus">Élus</a>
  <a href="/assemblee">🏛️ AN</a>
  <a href="/senat">🏛️ Sénat</a>
  <a href="/classement">🏆 Classement</a>
  <a href="/faq">📚</a>
</nav>
<GlobalSearch />
```

Les boutons « Députés », « Sénateurs », « Groupes », « Scrutins », « 🏆 AN », « 🏆 Sénat » disparaissent : ils sont accessibles depuis `/assemblee/` ou `/senat/`. Le bouton « 🏆 Classement » pointe vers le classement global cross-chambre ; les Championnats/Coupes par chambre restent un cran en profondeur (`/assemblee/classements/`, `/senat/classements/`).

### Loaders et helpers

Aucun changement de signature ; seules les routes Svelte se déplacent. `loadPersonne`, `loadSenateur`, etc. restent au même chemin dans `src/lib/data.ts`.

### Smoke-test

`scripts/smoke-test.ts` et `scripts/smoke-test-senat.ts` ne touchent pas aux routes. Mais on ajoute (dans la PR finale) un smoke-test routes : pour chaque route déclarée dans `svelte.config.js` (prerender), s'assurer que le HTML produit existe sous `build/`.

### Limitations acceptées

- Liens externes existants vers `/deputes/[id]` etc. → 404. Acceptable vu la jeunesse du projet.
- Sitemap (s'il est généré un jour) devra refléter la nouvelle structure.
- Tests manuels obligatoires sur tous les liens internes au moment du merge (pas de tests E2E aujourd'hui).

## Liens

- ADR `#0014` (pivot PolitiDex — scope élus nationaux)
- ADR `#0015` (personne unique cross-législature, modèle data côté AN)
- ADR `#0023` (Phase 3 Sénat — pipeline séparé)
- ADR `#0031` (modèle Élu cross-chambre — manifest)
- ADR `#0032` (sémantique de la carrière cross-chambre)
- `src/routes/+layout.svelte` (header refondu)
- `NEXT_STEPS.md` section "Refonte de la navigation" (cadre cette ADR)
