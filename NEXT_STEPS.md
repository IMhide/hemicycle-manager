# Roadmap & Backlog — PolitiDex

Liste vivante des évolutions. Coche au fur et à mesure, ajoute librement.

> **Pivot 2026-05-05** : "Hémicycle Manager" → **PolitiDex** (cf ADR 0014). Scope élargi aux élus nationaux, roadmap en 3 phases. Le repo et le domaine restent inchangés pour l'instant.

## ✅ Fait

- **PR #23** (2026-05-13) — Refonte topbar : périmètre élus + textes (retire ~17k scrutins, ajoute 1 446 textes unifiés)
- **PR #22** (2026-05-13) — Textes législatifs + navette parlementaire (ADR 0035-0037, 1 446 textes unifiés, 177 bicaméraux, timeline 1 191 actes)
- **Stack 7 PR** (2026-05-08) — Refonte routes + hub Élu cross-chambre (ADR 0030-0032, manifest `elus.json`, `/elus/[id]` unique point d'entrée)
- **PR #8** (2026-05-07) — Phase 3 Sénat : 672 sénateurs, 2 029 scrutins, 3 triennats ère Macron (ADR 0023-0029)
- **PR #7** (2026-05-06) — Polish UX : menu réordonné, badges groupe carrière, historique vote scrollable
- **PR #6** (2026-05-06) — Score Overall figé (ADR 0022) + Le Championnat + Les Coupes + FAQ
- **PR #4** (2026-05-05) — Cache HTTP conditionnel + BuildKit + auto-deploy Coolify (ADR 0021)
- **PR #3** (2026-05-05) — Phase 1+2 AN ère Macron complète : 1 196 personnes, 1 925 mandats (ADR 0014-0020)
- **Session inaugurale** (2026-05-04) — Base 17ᵉ législature : hémicycle SVG, fiches Député/Groupe/Scrutin, classements, recherche, déploiement Coolify, ADR

## 🔮 À faire — priorisé

### 🥇 Court terme — petites tâches actionables

- [ ] **"Main levée" dans la timeline navette** : afficher "Adopté/Rejeté à main levée" plutôt que juste la date quand `scrutinUid === null` sur un acte de vote. Critère succès : sur la fiche PJL Mayotte (ou autre texte promulgué), un acte sans `scrutinUid` affiche le sort déduit du libellé Etalab. Fichier : `src/lib/components/TimelineNavette.svelte`.
- [ ] **404 custom `/elus/[id]`** invalide : remplacer le `throw error(404)` SvelteKit par dégradé (page 404 maison + suggestions). Fichier : `src/routes/+error.svelte` (à créer) + tests d'un id bidon.
- [ ] **Doublons résiduels Sénat** (`sig-*` multiples pour un même texte en plusieurs lectures) : étendre la signature pour fusionner les lectures. Critère succès : `npm run data:smoke:senat` + nouvelle garde anti-doublons ≥ 95% de réduction sur l'échantillon connu. Fichiers : `scripts/lib/textes-senat.ts` + tests.
- [ ] **Supprimer garde anti-fusion ADR 0023** dans le smoke-test une fois confirmé que la fusion via manifest tient (cf `scripts/smoke-test-senat.ts`).
- [ ] **CI : bump Node 24 GitHub Actions** — `actions/checkout@v4` et `actions/setup-node@v4` tournent encore sur Node 20 (Node 24 forcé par défaut au 2026-06-02, runner Node 20 retiré au 2026-09-16). À faire avant juin.

### 🥈 Moyen terme — features mûres

- [ ] **Timeline navette Sénat-only** : reconstruire la timeline depuis les `etaloi.*` du dump dosleg pour les ~485 textes Sénat-seul (parité avec côté AN). Critère succès : ≥ 50% des Sénat-only ont une timeline ≥ 3 actes.
- [ ] **Cohésion par groupe (Rice index)** à recalculer côté pipeline AN : `/assemblee/groupes/[leg]/[id]/` ne l'affiche plus depuis le refactor. Fichier : `scripts/fetch-data.ts` + composant fiche groupe.
- [ ] **Recalibrer Overall pour les sénateurs** — validation empirique de la formule ADR 0022 :
  - Volume : centile 95 **par triennat** — distribution à vérifier
  - Présence : délégations ignorées (ADR 0027) → impact dénominateur ?
  - Décider si même pondération `0.55 / 0.35 / 0.10` ou recalibration (et ADR si oui)
- [ ] **Cron rebuild quotidien Coolify** : pas urgent (builds chauds ~30s), mais utile pour avoir les scrutins récents même sans push.
- [ ] **Placement hémicycle 15ᵉ/17ᵉ manquant** : ~98 sièges fantômes (suppléants, ministres). Investiguer sources AMO40/AMO50 ?

### 🥉 Long terme — nouvelles phases

- [ ] **Ministres** : sources data.gouv.fr / annuaire-service-public. Gérer les changements de gouvernement (mandats datés). Modèle `Personne` étendu avec mandat ministériel ?
- [ ] **Président de la République** : Élysée + Wikidata. Fiches synthétiques narratives (peu de stats comparables).
- [ ] **Comparateur cross-chambre** : un député vs un sénateur sur indicateurs communs (Overall, présence, loyauté). Page `/comparer/`.
- [ ] **Étendre aux législatures < 15ᵉ** : 14ᵉ, 13ᵉ... (au-delà du scope ère Macron actuel, cf ADR 0014).

## 🎮 Polish ludique — gamification

- [ ] **Sièges qui s'allument un par un** au changement de scrutin (cascade vert/rouge timée). Critère succès : transition <1s, pas de jank perçu.
- [ ] **Compteurs animés** (count-up) sur stats cartes/classements via `svelte-motion`. Cible : DeputeCard, ChampionnatRow.
- [ ] **Mode "Devine le vote"** : cacher le résultat d'un scrutin, l'utilisateur prédit adopté/rejeté + nb pour, on révèle l'hémicycle progressivement. Score localStorage.
- [ ] **Mode "Devine le député"** : carte FIFA sans nom ni groupe, deviner via les stats. Variante du mode précédent.
- [ ] **Comparateur 1v1** (`/comparer/`) : choisir 2 députés → cartes côte-à-côte + radar overlap + ratio votes convergent/divergent. Mode "swipe" possible en bonus.
- [ ] **Story mode** : présenter 5-10 scrutins marquants comme des récits (contexte / débat / vote / conséquence). Sélection éditoriale.
- [ ] **Hall of Fame** : les frondes les plus célèbres, les votes les plus serrés, les transfuges. Page éditoriale alimentée par requêtes pré-calculées.
- [ ] **Image carte FIFA partageable** (canvas → PNG, og:image dynamique) pour Twitter/social.
- [ ] **Profil utilisateur** : quiz 10 votes clés → "à quel député ressemblez-vous ?" Matching cosinus simple sur positions.

## 📊 Visualisations

- [ ] **Heatmap de cohésion** : matrice 12×12 (ou 14×14) montrant la proximité de vote entre groupes. Cible : `/assemblee/classements/` ou page dédiée.
- [ ] **Timeline interactive** avec scrubber : voir l'évolution des votes au fil de la législature, hémicycle animé.
- [ ] **Visualisation des coalitions** émergentes (clustering basé sur proximité de vote). Algorithme : k-means ou louvain sur matrice de similarité.
- [ ] **Détection alliances de circonstance** : groupes qui votent ensemble malgré des positions CHES opposées. Filtre par sujet.

## 🔧 Polish technique

- [ ] **SEO / Open Graph** : meta tags par page (title/description/og:image). Cible prioritaire : `/elus/[id]`, `/textes/[id]`. Tester avec opengraph.xyz.
- [ ] **Mobile responsive deep check** : audit toutes pages en 375px, fix overflows et CTA non atteignables. Cible : 100% des pages utilisables.
- [ ] **Lazy-load Hemicycle + photo MiniDeputeCard** pour boot perf. Cible : LCP < 2.5s sur 3G simulé.
- [ ] **Préfetch** données fréquentes (groupes, deputes-lite) dans `+layout.ts`. Bénéfice : navigation instantanée entre routes principales.
- [ ] **Recherche fuzzy permissive** (matches partiels, typos) via Fuse.js ou index pré-construit. Cible : tolérer 1-2 typos sur noms d'élus.
- [ ] **Transition fluide entre modes hémicycle** (groupe ↔ scrutin ↔ gradient). Cible : crossfade 200ms sans flash.
- [ ] **Notifications RSS / Atom** : flux des nouveaux scrutins, frondes, transfuges. URL `/feeds/scrutins.atom`.

## 🧪 Exploratoire — à instruire avant chiffrage

- [ ] **API publique `/api/v1/...`** : exposer les JSON pré-traités. Critères à définir : auth ? rate-limit ? versioning ? OpenAPI ?
- [ ] **Multilingue** : version anglaise. Stratégie : i18n SvelteKit ou clone statique ? Quel sous-domaine ?
- [ ] **Comparateur député ↔ vous** : quiz 10 scrutins clés → matching avec les 577 députés. Question préalable : quel barème de matching (cosinus ? Hamming ?).

---

**Comment utiliser ce fichier** :

1. Ajouter une idée → push direct sur `main`, pas de PR nécessaire
2. Cocher `[ ]` → `[x]` quand fini, ou déplacer dans "Fait"
3. Décision structurante → créer une ADR (cf [`decisions/`](decisions/README.md))
