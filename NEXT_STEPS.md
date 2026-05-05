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

## 🚧 Phase 1 — Multi-législature AN (16e + 17e)

Refacto structurel pour passer du modèle "député 17e plat" au modèle "personne + mandats[]".

### Pipeline data

- [ ] **Confirmer la stratégie d'identifiant cross-législature** (champ stable AN ? fallback `(nom + dateNaissance)` ?) → mini-ADR Phase 1 quand tranché
- [ ] **Paramétrer `scripts/fetch-data.ts`** par législature (URL + format Etalab 16e à valider)
- [ ] Fusion 16e+17e en un seul dataset `personnes.json` avec `mandats[]`
- [ ] Calcul stats `MandatStats` (numerator/denominator/rate) + rangs **par législature**
- [ ] Calcul `CarriereAggregee` (cumul pondéré, sans rang)
- [ ] Extraction `appartenancesGroupe[]` complètes (chronologiques, avec dates) — cf ADR 0016
- [ ] Calcul des **badges carrière** (Recomposition, Transfuge, Vétéran, Réélu·e) + badges mandat
- [ ] **Vérifier que Serrulien fournit les coordonnées 16e** (sinon scraping à refaire) — cf ADR 0008

### Modèle & types

- [ ] Refactorer `src/lib/types.ts` : nouveaux types `Personne`, `Mandat`, `AppartenanceGroupe`, `MandatStats`, `MandatRangs`, `CarriereAggregee`, `BadgeMandat`, `BadgeCarriere`
- [ ] Refactorer `src/lib/data.ts` : `loadPersonne(id)`, `loadMandat(id, leg)`, `loadCarriere(id)`
- [ ] Étendre `political-order.ts` au mapping CHES des groupes 16e (cf ADR 0007)

### Routes & UI

- [ ] **Sélecteur de législature** dans le header (par défaut = la plus récente)
- [ ] `/legislatures/[num]/` (nouvelle home par législature) — l'actuelle home `/` redirige vers la législature courante
- [ ] `/deputes/[id]/` reste à la racine, gère **vue carrière par défaut + tabs `[Carrière] [16e] [17e]`** (cf ADR 0017)
- [ ] `/groupes/[legislature]/[id]/` (les groupes deviennent scopés)
- [ ] **Timeline des appartenances de groupe** dans la vue mandat si > 1 appartenance (cf ADR 0016)
- [ ] Refactorer `DeputeCard` : prop `vue: 'carriere' | 'mandat'` + `mandat: Mandat | null`
- [ ] Composant `<MandatTabs>`
- [ ] **Étendre InfoTip à tous les badges** (cf ADR 0016, 0017) — création `<BadgeWithInfoTip>`
- [ ] Mettre à jour la **recherche globale** : indexer la personne (avec ses prénoms/noms et toutes ses appartenances de groupe pour matching)
- [ ] Page scrutin : afficher le groupe **au moment du vote** pour chaque député listé

### Validation

- [ ] **Cas test** : vérifier qu'une personne ayant siégé en 16e et 17e affiche bien une seule fiche avec les deux mandats
- [ ] **Cas test** : vérifier les badges Recomposition (changement entre 16e et 17e) et Transfuge (changement intra-mandat 16e ou 17e) sur des cas réels documentés
- [ ] **Vérifier le calcul de fronde** sur la 16e (groupe au moment du vote, pas groupe actuel)

## 🚀 Phase 2 — Ère Macron complète (15e législature)

À démarrer une fois Phase 1 stabilisée. Le refacto Phase 1 doit rendre cette extension principalement incrémentale.

- [ ] Ajouter le pipeline 15e (URLs Etalab, format)
- [ ] Étendre le mapping CHES aux groupes 15e (LREM, MoDem, LR, PS, FI, GDR, etc.)
- [ ] Vérifier disponibilité des positions de sièges 15e
- [ ] Tester la fusion d'identité sur 3 législatures (15e + 16e + 17e)
- [ ] Activer le badge **Vétéran** (3+ législatures) qui devient pertinent à partir de Phase 2
- [ ] Mettre à jour les InfoTips de scope (e.g. "Carrière (toutes législatures couvertes)")

## 🌐 Phase 3 — Au-delà de l'AN (Sénat, ministres, président)

À démarrer une fois Phases 1+2 stabilisées. Implique probablement de **généraliser le type `Mandat`** (ajout d'un champ `chambre: 'AN' | 'Senat'` ou similaire) et d'introduire un type `MandatGouvernemental` pour les ministres. Mini-ADR de cadrage à prévoir au démarrage.

- [ ] **Sénat** : pipeline data.senat.fr (348 sénateurs, mandats de 6 ans renouvelés par moitié — modèle temporel différent de l'AN)
- [ ] **Ministres** : sources data.gouv.fr / annuaire-service-public — gérer les changements de gouvernement (mandats datés)
- [ ] **Président de la République** : Élysée + Wikidata — fiches synthétiques, peu de "stats" comparables, plutôt narratives
- [ ] Hémicycle Sénat (palais du Luxembourg) — vérifier disponibilité du SVG
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
- [ ] **Auto-deploy GitHub → Coolify** : configurer une GitHub App ou un webhook manuel (cf ADR 0002)
- [ ] **Cron de rebuild quotidien** sur Coolify (pour les données fraîches sans intervention)
- [ ] **Lazy-load** le composant Hemicycle et la photo dans MiniDeputeCard pour le boot
- [ ] **Préfetch** des données fréquentes (groupes, deputes-lite) dans `+layout.ts`

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
