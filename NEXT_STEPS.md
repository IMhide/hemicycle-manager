# Roadmap & Backlog — PolitiDex

Liste vivante des évolutions envisagées. Coche au fur et à mesure, ajoute librement.

> **Pivot 2026-05-05** : "Hémicycle Manager" → **PolitiDex** (cf ADR 0014). Scope élargi aux élus nationaux, roadmap en 3 phases. Le repo et le domaine restent inchangés pour l'instant.

## ✅ Fait (session inaugurale 2026-05-04 — base 17e législature)

- Hémicycle SVG avec positions officielles (582 sièges)
- Pipeline data Open Data AN → JSON optimisé
- Fiches Député (carte FIFA + radar + badges + historique)
- Fiches Groupe (mini-hémicycle, top loyalistes / frondeurs / présence)
- Fiches Scrutin avec liste des frondeurs
- Pages liste filtrables (députés, groupes, scrutins)
- Page Classements (5 leaderboards, vue globale ou par groupe)
- Système de rangs avec médailles 🥇🥈🥉
- Recherche globale multi-catégorie dans le header (style Facebook)
- InfoTip pédagogique sur toutes les métriques
- Mode "Gauche–Droite" sourcé CHES 2024
- Banc des Non-Inscrits séparé de l'hémicycle
- Déploiement Coolify avec domaine custom + HTTPS
- Système d'ADR (decisions/) + script d'indexation
- CLAUDE.md pour mémoire entre sessions

## ✅ Cadrage du pivot PolitiDex (2026-05-05)

- ADR 0014 — Pivot vers PolitiDex (élus nationaux, roadmap 3 phases)
- ADR 0015 — Personne unique cross-législature (modèle Pokédex)
- ADR 0016 — Multi-appartenances de groupe + badges Recomposition / Transfuge
- ADR 0017 — Stats par mandat, cumul carrière sans rang, tabs `[Carrière] [16e] [17e]`
- ADR 0018 — Identifiant stable cross-législature (PA-id, AMO30 historique)
- ADR 0019 — Priorité de sources AMO Etalab (AMO10/AMO20 > AMO30)
- ADR 0020 — Phase 2 : ajout 15ᵉ législature

## ✅ Phase 1 + 2 — Ère Macron complète AN (mergée 2026-05-05, PR #3)

Mergée en une seule PR cumulant Phase 1 (16ᵉ+17ᵉ) et Phase 2 (15ᵉ).

### Pipeline data ✅

- [x] Identifiant stable PA-id validé empiriquement sur 432 réélus 16→17 et 50+ vétérans 15+16+17 (cf ADR 0018)
- [x] `scripts/fetch-data.ts` paramétré par législature, `LEGISLATURES = [15, 16, 17]`
- [x] Sources AMO30 (identité) + AMO10 17ᵉ + AMO20 16ᵉ/15ᵉ pour enrichissement (cf ADR 0019)
- [x] Fusion 15+16+17 → `personnes.json` (1196 personnes, 1925 mandats)
- [x] Stats `MandatStats` num/denom/rate + rangs **par législature**
- [x] `CarriereAggregee` (cumul pondéré, sans rang)
- [x] `appartenancesGroupe[]` chronologiques + flag `isTransitoireNI` (seuil 21 jours, cf bug fix transfuge 17ᵉ)
- [x] Badges carrière (Recomposition, Transfuge, Vétéran, Réélu) + badges mandat
- [x] Coordonnées sièges 15+16+17 (Serrulien `seats.json` 1-650 + enrichissement places via AMO20)

### Modèle & types ✅

- [x] `src/lib/types.ts` : `Personne`, `Mandat`, `AppartenanceGroupe`, `MandatStats`, `MandatRangs`, `CarriereAggregee`, `BadgeMandat`, `BadgeCarriere`
- [x] `src/lib/data.ts` : `loadPersonne(id)`, `loadHistorique(paId)`, `loadGroupes(leg)`, `loadLegislatures()`
- [x] `political-order.ts` : 17 groupes 15ᵉ + 12 groupes 16ᵉ + 14 groupes 17ᵉ mappés CHES 2024

### Routes & UI ✅

- [x] **Sélecteur de législature** en haut de la fiche (sous le header) avec 3 boutons 15/16/17
- [x] `/legislatures/[num]/` route SPA paramétrée
- [x] `/deputes/[id]/?leg=N` querystring pour les tabs `[Carrière] [15e] [16e] [17e]`
- [x] `/groupes/[legislature]/[id]/` scopé par législature
- [x] **Timeline des appartenances** : par législature en vue carrière, du mandat actif en vue mandat
- [x] `DeputeCard` : prop `mandat: Mandat | null` (carrière vs mandat)
- [x] Composant `<MandatTabs>` chronologique avec querystring
- [x] InfoTip systématique sur badges via `Badge.svelte`
- [x] Recherche globale `searchAll` indexant la personne + libellés de groupes historiques
- [x] Page scrutin : groupe **au moment du vote** affiché pour chaque frondeur
- [x] **Toggle GCHES/OFFI** pour la coloration hémicycle (gradient CHES vs couleurs officielles Etalab)
- [x] Layout : `.depute-card-col` sticky avec scroll interne (vétérans 15+16+17 affichent une grosse carrière)
- [x] Rebrand layout vers PolitiDex (logo P, header)

### Validation ✅

- [x] Smoke-test 40/40 (3 legs, vétérans 15+16+17)
- [x] CI vert (TS check 0 erreur, build avec placeholders multi-leg)
- [x] Cas concrets : Habib (PA1592, vétéran 15+16+17), Vallaud (PA719930, transfuge 16ᵉ), Le Pen (PA720614, réélue)
- [x] Build local validé en mode placeholders (CI) et en mode données réelles (prod)

### Polish post-merge à envisager

- [ ] Cohésion par groupe (Rice index) à recalculer côté pipeline — actuellement les pages `/groupes/[leg]/[id]/` n'affichent plus la cohésion globale
- [ ] Récupérer les ~98 placeHemicycle 15ᵉ/17ᵉ encore manquants (suppléants, ministres) — investiguer AMO40 ou AMO50 ?
- [ ] Auto-refresh quotidien des données 17ᵉ via cron Coolify (relancer le build à heure fixe pour avoir les nouveaux scrutins même sans push)
- [ ] Page d'erreur 404 custom pour `/legislatures/{num}` invalides

## ✅ Cache build + auto-deploy (mergé 2026-05-05, PR #4)

- [x] Cache HTTP conditionnel (Last-Modified/ETag) dans `downloadZip` — ADR 0021
- [x] Cache mount BuildKit (`--mount=type=cache`) dans le Dockerfile pour persister `/tmp/politidex-cache` entre builds
- [x] Extraction des ZIP idempotente via marqueur `size+mtime` du ZIP source
- [x] **Auto-deploy GitHub → Coolify** activé via webhook (cf ADR 0002) — tout push sur `main` déclenche un build automatique. Plus besoin de redéploiement manuel pour les changements committés
- [x] Builds chauds : ~15 min → ~30 s quand rien ne bouge côté data (validé localement, validation prod = deploy id 78 du merge PR #4)

## ✅ Overall + Le Championnat + FAQ (mergé 2026-05-06, PR #6)

- [x] **ADR 0022** — Score Overall figé : `0.55·Participation + 0.35·Volume(centile95) + 0.10·Présence × 99`
  - Postulat : "député = employé du peuple, payé pour voter des lois"
  - Loyauté **retirée** du score (reste sur radar + alimente badges)
  - Volume normalisé sur centile 95 cohorte (par leg pour mandats, tous-temps pour carrière)
  - Magic number 3000 supprimé
- [x] Calcul **dans le pipeline** (`stats.overall`, `carriere.overall`), lu par les cartes (alignement DeputeCard ↔ MiniDeputeCard)
- [x] `Groupe.overallMoyen` + `overallEffectif` pré-calculés (rattachement = groupe principal, cf ADR 0016)
- [x] Helpers `BLOCS` / `blocOf` / `blocMeta` ajoutés à `political-order.ts` (5 blocs CHES)
- [x] `/classements/` restructurée en mode football :
  - 🏆 **Le Championnat** : Top députés (par leg ou Carrière) · Top groupes · Top blocs (5 blocs CHES)
  - ⚽ **Les Coupes** : Présence / Participation / Loyauté / Frondes (par leg uniquement, cf ADR 0017)
- [x] Bloc dépliable "Comment se calcule l'Overall ?" inline sur `/classements/` (pédagogie sans clic)
- [x] **Page `/faq/`** ludique avec 7 sections (Le projet · Overall · Championnat & Coupes · Métriques · Badges · Modèle · Méta), accordéons, ancres directes, liens vers ADR
- [x] Header enrichi avec bouton 📚 → FAQ
- [x] Footer enrichi : lien FAQ + lien GitHub repo + invitation explicite à contribuer + Unlicense
- [x] InfoTip explicatif sur DeputeCard avec lien `/faq#overall` + ADR 0022
- [x] Axe radar `Activité (/3000)` → `Volume (centile 95 cohorte)`
- [x] Smoke-test 40/40 ✅, type-check 0 erreur, distribution overalls saine

## ✅ Polish UX (mergé 2026-05-06, PR #7)

- [x] **Menu** : 🏆 Classements déplacé en avant-dernier (juste avant 📚 FAQ) — l'ordre suit la logique « contenu → outils de navigation/aide »
- [x] **Menu** : tooltip natif `title=""` ajouté sur chaque entrée pour révéler le nom de la route au survol des icônes (🏆, 📚)
- [x] **Classements → Championnat → Top députés (vue Carrière)** : un badge groupe coloré par législature au lieu d'une simple liste numérique (`15ᵉ • LFI · 16ᵉ • LFI-NUPES · 17ᵉ • LFI-NFP`). Helper `groupesCarriere(personne)` aligné sur ADR 0016 (groupe principal = premier non-NI)
- [x] **`/deputes/[id]`** : historique de vote dans une box à hauteur **fixe** (~10 votes visibles, plafonnée à `min(700px, 70vh)`), scroll **interne**. Bouton « Charger 10 de plus » désormais **à l'intérieur** du scroll (on découvre les nouveaux votes en continuant à scroller). PAGE_SIZE constant = 10 (anciennement 50/+100). Compteur `X / N affichés` sous la box. Reset du `scrollTop` + `visibleCount` au changement de filtre ou de législature
- [x] Classe utilitaire `.vote-scroll` ajoutée dans `app.css` (max-height + scrollbar-gutter stable)

## 🌐 Phase 3 — Au-delà de l'AN (Sénat, ministres, président)

Phase 3a+3b démarre 2026-05-06 par le **pipeline Sénat** (PR A `feat/senat-pipeline`). 4 PR successives planifiées (cf plan d'implémentation interne). Décisions cadrées dans ADR 0023..0027 :
- ADR 0023 — scope, granularité (session annuelle), pas de fusion bicamérale en v1 (différée à Phase 3c)
- ADR 0024 — identifiant matricule (≠ PA-id AN, espaces disjoints)
- ADR 0025 — sources : api-senat live > ODSEN_*.csv > dosleg.zip
- ADR 0026 — hémicycle 348 sièges adapté de Kurea/visu_senat (MIT)
- ADR 0027 — délégations de vote ignorées en v1 (`senmatdel`)

### ✅ PR A — Pipeline + types + smoke-test (en cours, branche `feat/senat-pipeline`)

- [x] 5 ADR Sénat (0023-0027) écrites + indexées
- [x] Refactor `scripts/lib/cache.ts` (utilitaires partagés AN/Sénat) + 19 tests unitaires
- [x] Types `Senateur`, `MandatSenat`, `SessionStats`, `GroupeSenat`, `SessionMeta`, `ScrutinSenatDetail`… ajoutés à `src/lib/types.ts` (append-only, AN intact)
- [x] Loaders `loadSenateurs`, `loadGroupesSenat(sesann)`, etc. dans `src/lib/data.ts`
- [x] Codes groupes Sénat dans `political-order.ts` : CRC, GEST, RDSE, UC, RTLI, UMP, AUCUN + variantes historiques RI, GD, ECO, UMP-A, UMP-R, RDSE-A
- [x] `scripts/lib/dosleg-parser.ts` (TDD strict) : streamCopyBlocks SQL + parseOdsenCsv ISO-8859-1 + decodePostgresLiteral + splitCsvLine
- [x] `scripts/lib/senat-layout.ts` (TDD strict) : extracteur layout 348 sièges Kurea avec correction de l'anomalie (siège 16 manquant) + trigonométrie reproduite
- [x] `scripts/extract-senat-seats.ts` + `src/lib/generated/senat-seats.json` commité (28 KB, 348 sièges)
- [x] `scripts/lib/senat-transform.ts` (TDD strict) : sessionsCovering + groupeAuVote
- [x] `scripts/fetch-data-senat.ts` (pipeline central, ~970 lignes)
- [x] `scripts/smoke-test-senat.ts` : **47/47 ✅** (Patriat 08061X siège 1 LREM, Larcher 86034E siège 9 UMP, vétérans, transfuges, distribution, garde anti-fusion)
- [x] **Tests unitaires totaux : 102/102 ✅**
- [x] Output `static/data/senat/` : 1935 sénateurs, 3 348 mandats, 4 662 scrutins, 1.61M votes, 20 sessions, 348 places hémicycle, ~97 MB JSON
- [x] `package.json` : 6 scripts npm (`data:fetch:an`, `data:fetch:senat`, etc.) + `test:unit`
- [x] Dockerfile : 2ᵉ cache mount BuildKit `politidex-senat`
- [x] Pipeline cold ~2 min / warm ~3 s (parsing SQL streaming 124 MB en 0.9s — 70× plus rapide que la cible)

### ✅ Refacto Triennat (2026-05-07, branche `feat/senat-pipeline`)

**ADR 0028 implémentée** : le **triennat** (3 ans entre 2 renouvellements) remplace la session annuelle comme unité de regroupement principale Sénat. Pas de double niveau triennat/session (trop d'impact UX). 7 triennats figés depuis 2006.

- [x] Types `TriennatId`, `Triennat`, `TriennatStats`, `TriennatMeta` + table figée 7 triennats (`src/lib/triennats.ts`)
- [x] 26 tests unitaires triennats (128/128 ✅ au total)
- [x] Pipeline `fetch-data-senat.ts` calcule les **deux niveaux** (`sessionsStats` data-only + `triennatStats` exposé UI) : output `triennats.json` + `groupes/{periode}.json`
- [x] Smoke-test étendu : assertions ADR 0028 § "Garde anti-régression" (62/62 ✅)
- [x] Loaders `loadTriennats`, `loadGroupesSenat(periode)` + `search-index.ts` adapté
- [x] Composant `TriennatTabs.svelte` (remplace `SessionTabs`) — ordre antichrono, `⚡` sur en cours, InfoTip vers FAQ
- [x] Routes : `/senat/triennats/`, `/senat/triennats/[periode]/`, `/senat/groupes/[periode]/[code]/`
- [x] Fiche détail sénateur : default tab = Carrière si pas de mandat sur triennat en cours, sinon triennat en cours ⚡
- [x] Classements (Championnat + Coupes) par triennat
- [x] FAQ : ancre `#senat-triennat` (renommée depuis `#senat-cohorte`)
- [x] Pipeline run : 1935 sénateurs, 4662 scrutins, **7 triennats**, 348 places hémicycle
- [x] Type-check : 0 erreurs, 3 warnings préexistants (côté AN)

### 🔮 Suite (différée — UX first, score plus tard)

- [ ] **Recalibrer le score Overall pour les sénateurs** — la formule ADR 0022 reste applicable mais à valider empiriquement. Points à instruire si recalibration nécessaire :
  - Volume : centile 95 **par triennat** — vérifier la distribution empiriquement
  - Présence : sémantique différente côté Sénat (délégations de vote ignorées en v1, cf ADR 0027) — impact sur le dénominateur ?
  - Participation : transposable telle quelle, mais à valider sur les scrutins sénatoriaux (publics solennels vs ordinaires ?)
  - Décider si on garde la même pondération `0.55 / 0.35 / 0.10` ou si le Sénat justifie une recalibration (et écrire une ADR si oui)
- [ ] Tests UI manuels : `npm run dev` puis vérifier les routes Sénat (home, triennats, sénateurs, scrutins, groupes, classements, FAQ)

### 🚧 Phase 3c — fusion bicamérale (différée)

- [ ] Politique de matching `(nom normalisé + dateNaissance)` cross-chambre AN↔Sénat (~50 cas attendus)
- [ ] ADR de cadrage à écrire au démarrage
- [ ] Refacto `Personne` pour porter `mandats: (MandatAN | MandatSenat)[]` ou structure équivalente

### À venir (au-delà du Sénat)

- [ ] **Ministres** : sources data.gouv.fr / annuaire-service-public — gérer les changements de gouvernement (mandats datés)
- [ ] **Président de la République** : Élysée + Wikidata — fiches synthétiques, peu de "stats" comparables, plutôt narratives
- [ ] Recherche globale unifiée sur les 4 types d'élus
- [ ] Comparateur cross-chambre (un député peut être comparé à un sénateur sur des indicateurs communs)

## 🎯 Polish & features ludiques (en parallèle des phases)

### Animations (impact visuel fort, effort modéré)

- [ ] **Sièges qui s'allument un par un** lors du changement de scrutin (cascade vert/rouge)
- [ ] Animation d'apparition des cartes en stagger
- [ ] Transition fluide entre les modes hémicycle (groupe ↔ scrutin ↔ gradient)
- [ ] **Compteurs animés** (count-up sur les stats avec [svelte-motion](https://svelte.dev/docs#run-time-svelte-motion))

### Comparateur 1v1 (potentiel viral, effort élevé)

- [ ] Page `/comparer/` où on choisit 2 députés
- [ ] Cartes FIFA côte-à-côte + **radar overlap** (deux polygones superposés)
- [ ] Liste des votes où ils ont **divergé** vs **convergé** + ratio %
- [ ] Mode **"swipe"** : présenter 2 députés au hasard, l'utilisateur devine qui est plus loyal/présent/etc. avant de révéler

### Mode "Devine le vote" (gamification)

- [ ] Cacher le résultat d'un scrutin
- [ ] L'utilisateur prédit : adopté ou rejeté ? Combien de pour ?
- [ ] **Révéler l'hémicycle progressivement** (sièges qui s'allument un par un) avec une animation dramatique
- [ ] **Score cumulé** persistant en localStorage
- [ ] Variante : "Devine le député" — montrer une carte FIFA sans nom + groupe masqué, deviner

### Autres idées en vrac (à prioriser)

- [ ] **Heatmap de cohésion** : matrice 12×12 montrant la proximité de vote entre tous les groupes
- [ ] **Timeline interactive** : scrubber pour voir l'évolution des votes au fil de la législature
- [ ] **Story mode** : présenter un scrutin marquant comme un récit (contexte, débat, vote, conséquence)
- [ ] **Profil utilisateur** : "à quel député ressemblez-vous le plus ?" (questionnaire sur 10 lois clés → matching)
- [ ] **Image carte FIFA partageable** sur Twitter (canvas → PNG, og:image)
- [ ] **Hall of fame** : les frondes les plus célèbres / votes les plus serrés
- [ ] **Notifications RSS / Atom** : nouveau scrutin, fronde dans tel groupe, etc.
- [ ] **Recherche fuzzy** plus permissive (matches partiels, typos) avec [Fuse.js](https://fusejs.io/) ou index pré-construit

## 🔧 Polish technique en attente

- [ ] **Page d'erreur 404 custom** (actuellement le 404 par défaut SvelteKit)
- [ ] **SEO / Open Graph** : meta tags par page, og:image dynamique
- [ ] **Mobile responsive deep check** : vérifier toutes les pages sur 375px et corriger
- [x] ~~**Auto-deploy GitHub → Coolify**~~ ✅ activé 2026-05-05 via webhook (PR #4)
- [ ] **Cron de rebuild quotidien** sur Coolify (pour les données fraîches sans intervention) — moins urgent maintenant que les builds chauds sont à ~30s
- [ ] **Lazy-load** le composant Hemicycle et la photo dans MiniDeputeCard pour le boot
- [ ] **Préfetch** des données fréquentes (groupes, deputes-lite) dans `+layout.ts`
- [ ] **CI : déprécation Node 20 GitHub Actions** — `actions/checkout@v4` et `actions/setup-node@v4` tournent encore sur Node 20 (forcé sur 24 par défaut à partir du 2026-06-02, retrait runner 2026-09-16). Bumper les actions ou setter `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` quand une version compatible Node 24 sortira.

## 🧪 Idées exploratoires

- [ ] **Comparateur député ↔ vous** : quiz "votre vote" sur 10 scrutins → matching avec les 577 députés
- [ ] **Visualisation des coalitions** émergeant des votes (clustering basé sur proximité de vote)
- [ ] **Détection des "alliances de circonstance"** : groupes qui votent ensemble malgré des positions opposées sur un sujet
- [ ] **API publique** (`/api/v1/...`) pour permettre à d'autres d'utiliser nos JSON pré-traités
- [ ] **Multilingue** : version anglaise pour exposer le système politique français à l'international
- [ ] **Étendre aux législatures antérieures à la 15ᵉ** (14e, 13e, etc. — au-delà du scope Phase 2 actuel, cf ADR 0014)

---

**Comment utiliser ce fichier** :

1. Ajouter une idée → push direct sur `main`, pas de PR nécessaire (c'est une roadmap, pas du code)
2. Quand on commence une feature → cocher `[ ]` → `[x]` quand c'est fini, ou la déplacer dans la section "Fait"
3. Si une idée donne lieu à une décision structurante → créer une ADR (cf [`decisions/`](decisions/README.md))
