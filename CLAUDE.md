# PolitiDex — Guide pour Claude

> Ce fichier est **lu automatiquement** par Claude Code à chaque session ouverte dans ce projet. Il sert de mémoire continue entre les conversations. **Toute décision structurante doit y être référencée**, jamais oubliée.

> 🚨 **Repo OPEN SOURCE.** Ne jamais committer de détails d'infra privée : UUID Coolify, secrets/tokens, URL d'admin (`control.*`, `coolify.*`), hostnames internes, chemins absolus `/Users/...`. Utiliser des placeholders (`<APP_UUID>`, `~/Agents/...`). Les détails d'infra vivent dans la mémoire auto Claude (locale, gitignored) et chez le sous-agent `coolify_control`.

## TL;DR du projet

**PolitiDex** : un Pokédex ludique des **élus nationaux français**, avec UX de type **Football Manager**.

L'app collecte les données ouvertes (Open Data Etalab : AN, Sénat, gouvernement) sur les députés, sénateurs, ministres et présidents pour offrir une expérience de "fiches collectionnables" : carte FIFA par personne, hémicycle interactif, classements, badges, comparateurs.

**Roadmap en 3 phases** (cf ADR 0014) :
1. ✅ **Phase 1** (mergée 2026-05-05) — 16ᵉ + 17ᵉ législatures AN avec modèle "personne unique cross-législature"
2. ✅ **Phase 2** (mergée 2026-05-05) — 15ᵉ législature AN ajoutée (toute l'ère Macron à l'AN couverte)
3. ✅ **Phase 3 — Sénat** (mergée 2026-05-07, PR #8) — pipeline + UI + scope ère Macron, à parité avec les 3 législatures AN. Ministres et président à venir (Phase 3 suite).

**État actuel** : côté AN, 1196 personnes uniques, 1925 mandats, 14 840 scrutins, 50+ vétérans 15+16+17. Smoke-test AN 40/40 ✅. Score **Overall** v2 + **Le Championnat / Les Coupes** + **FAQ** mergés 2026-05-06 (PR #6, ADR 0022). Polish UX mergé 2026-05-06 (PR #7).

**Sénat (mergé 2026-05-07, PR #8)** : 672 sénateurs (cohorte cumulée 3 triennats), 2 029 scrutins, 705k votes nominatifs, 9 sessions, 3 triennats ère Macron (`2017-2020`, `2020-2023`, `2023-2026`), 348 places hémicycle. Smoke-test Sénat 67/67 ✅. Tests unitaires 131/131 ✅. ADR 0023-0029 figées. Hémicycle "vivant" pour les triennats anciens (sénateurs sans `place` réelle placés selon le gradient gauche-droite).

> ⚠️ **Le repo s'appelle encore `hemicycle-manager`** (rebrand pas encore fait, cf ADR 0014). Le **nom de produit** est désormais **PolitiDex**.

- **Stack** : SvelteKit 5 + TypeScript + Tailwind + adapter-static, déployé via Docker + Nginx sur Coolify
- **URL prod** : https://hemicycle.baijobu.net (domaine inchangé pour l'instant)
- **Repo** : https://github.com/IMhide/hemicycle-manager (public, [Unlicense](LICENSE))
- **Données** : Open Data Etalab → fetched au `docker build`, jamais commitées

## ⚠️ Avant tout changement, consulte les décisions

**Toutes les décisions structurantes** (sémantique des métriques, choix techniques, sources, contraintes infra) sont consignées dans **[`decisions/`](decisions/README.md)** au format ADR (Architecture Decision Records).

**À chaque ouverture de session sur ce repo**, lis l'index : [`decisions/README.md`](decisions/README.md). Il liste les 29 décisions actives avec leur statut et leurs tags. Tu peux ouvrir n'importe quelle ADR pour les détails.

**Avant de proposer un changement** qui touche à :

- le **scope** ou le **branding** (PolitiDex vs Hémicycle Manager, élus nationaux, roadmap) → vérifie ADR 0014
- le **modèle "personne unique cross-législature"** (fusion d'identité, mandats, routes `/deputes/[id]/`) → vérifie ADR 0015
- les **groupes politiques** (multi-appartenances, badges Recomposition / Transfuge, groupe au moment du vote) → vérifie ADR 0016
- les **stats par mandat ou en cumul carrière** (formules de cumul, rangs, tabs `[Carrière] [15e] [16e] [17e]`, distinction badges carrière vs mandat) → vérifie ADR 0017
- l'**identité PA-id stable cross-leg** (fusion AMO30) → vérifie ADR 0018
- les **sources de données AMO Etalab** (priorité AMO10/AMO20 > AMO30 pour `placeHemicycle` notamment) → vérifie ADR 0019
- l'ajout de la **15ᵉ législature** ou du **mapping CHES** (groupes, libellés Etalab exacts, suffixe `_XV`) → vérifie ADR 0020
- la **sémantique d'une métrique** (présence, participation, loyauté, frondes, cohésion) → vérifie les ADR `métriques` et `sémantique` (0004, 0005, 0006, 0017)
- le **score Overall** (formule, pondération, ajout/retrait d'un axe, magic numbers) → vérifie ADR 0022 (figé : 0.55 Participation + 0.35 Volume centile-95 + 0.10 Présence ; loyauté **exclue** ; calcul **pipeline only**, lu par les cartes)
- la **stack** (Node, Svelte, Tailwind…) → vérifie ADR 0001 et 0010
- le **déploiement** (Dockerfile, healthcheck, Coolify) → vérifie ADR 0002 et 0011
- les **données** (fetch, format, gitignore) → vérifie ADR 0003 et 0012
- le **cache du pipeline data** (HEAD conditionnel, BuildKit cache mount, no-resume) → vérifie ADR 0021
- l'**ordonnancement gauche-droite** des groupes → vérifie ADR 0007 (sourcé CHES 2024)
- la **licence** ou la **gouvernance** → vérifie ADR 0009 et 0013
- le **scope ou la granularité Sénat** (sessions vs mandats individuels, fusion bicamérale différée) → vérifie ADR 0023 (partiellement remplacée par 0028 sur la granularité et 0029 sur le scope temporel)
- l'**identifiant matricule Sénat** (vs PA-id AN) → vérifie ADR 0024
- les **sources Sénat** (api-senat live > ODSEN_*.csv > dosleg.zip) → vérifie ADR 0025
- l'**hémicycle Sénat 348 sièges** (layout adapté de Kurea/visu_senat) → vérifie ADR 0026
- la **sémantique des délégations de vote** Sénat → vérifie ADR 0027 (ignorées en v1)
- la **granularité temporelle Sénat** (triennat = analogue de la législature AN, session = brique data sous-jacente) → vérifie ADR 0028
- le **scope ère Macron Sénat** (3 triennats `2017-2020`, `2020-2023`, `2023-2026`, à parité avec 15ᵉ/16ᵉ/17ᵉ AN) → vérifie ADR 0029

Si la décision te semble obsolète ou si tu veux la changer : **propose explicitement à l'utilisateur** de la marquer "déprécié" ou "remplacée par #NNNN", ne la contourne pas en silence.

### Comment ajouter une nouvelle décision

1. Copie [`decisions/TEMPLATE.md`](decisions/TEMPLATE.md) en `decisions/NNNN-slug.md` (NNNN = prochain numéro libre)
2. Remplis les sections : Contexte, Décision, Pourquoi, Conséquences, Liens
3. Lance `npm run decisions:index` (le `README.md` est régénéré automatiquement)
4. Commit le tout

## 📋 Roadmap et prochaines étapes

Voir **[NEXT_STEPS.md](NEXT_STEPS.md)** pour les idées en backlog (animations, comparateur 1v1, mode "Devine le vote", etc.). À mettre à jour quand on coche/ajoute.

## 🛠️ Commandes utiles

```bash
npm run dev                # serveur de dev sur localhost:5173
npm run build              # build statique dans build/
npm run preview            # vérifier le build en local
npm run check              # type-check Svelte/TS
npm run test:unit          # tests unitaires Node:test (131 tests : parser dosleg, layout, triennats, …)
npm run data:fetch         # télécharge + transforme AN puis Sénat
npm run data:fetch:an      #   AN seul (~30s warm cache)
npm run data:fetch:senat   #   Sénat seul (~3s warm, ~2 min cold)
npm run data:smoke         # smoke-test AN + Sénat (40+67=107 assertions)
npm run data:smoke:an      #   AN seul
npm run data:smoke:senat   #   Sénat seul
npm run decisions:index    # regen decisions/README.md
```

## 🚀 Mise à jour des données / redéploiement

**Auto-deploy activé** depuis 2026-05-05 (PR #4) : tout push sur `main` déclenche un build automatique chez l'hébergeur via webhook. Pas besoin d'invoquer la plateforme à la main pour les changements committés.

Pour un redéploiement manuel (par ex. sans changement de code), passer par le sous-agent dans `~/Agents/coolify_control/`.

**Pipeline data accéléré** (cf ADR 0021 + 0025) : `npm run data:fetch` est en ~30s quand les caches `tmpdir/politidex-cache/` et `tmpdir/politidex-cache-senat/` sont chauds (cache HTTP conditionnel via Last-Modified/ETag). Premier run cold ≈ ~12-15 min côté AN (Scrutins 17ᵉ throttle CDN) + ~2 min côté Sénat (download + parsing dump dosleg 124 MB).

## 🧭 Architecture rapide

Architecture multi-législature (15ᵉ + 16ᵉ + 17ᵉ AN) + 3 triennats Sénat (2017-2020, 2020-2023, 2023-2026) à parité. Modèle `Personne + Mandat[]` (AN) et `Senateur + MandatSenat[]` (Sénat). Datasets disjoints (cf ADR 0015 / 0023-0029).

```
src/
  lib/
    components/                # AN : Hemicycle, DeputeCard, MiniDeputeCard, MandatTabs, Badge,
                               #      HemicycleColorToggle, GlobalSearch, Rank, InfoTip, …
                               # Sénat : HemicycleSenat, SenateurCard, MiniSenateurCard,
                               #         SenateurRow, TriennatTabs, VoteHistoryItemSenat,
                               #         FrondeurSenatCard, GroupVoteBarSenat
    data.ts                    # loaders AN (loadPersonnes, loadHistorique, loadGroupes, loadLegislatures)
                               # + loaders Sénat (loadSenateurs, loadGroupesSenat, loadTriennats…)
    hemicycle.ts               # géométrie SVG AN (seats.json — voir ADR 0008)
    hemicycle-senat.ts         # géométrie SVG Sénat 348 sièges (Kurea, ADR 0026)
    political-order.ts         # ordre gauche-droite + scores CHES 2024 (cf ADR 0007 + ADR 0020)
                               # AN : 17 groupes 15ᵉ + 12 groupes 16ᵉ + 14 groupes 17ᵉ
                               # Sénat : CRC, GEST, RDSE, UC, RTLI, UMP, LREM, AUCUN…
    triennats.ts               # table figée 3 triennats ère Macron + helpers (ADR 0028 + 0029)
    badges.ts                  # mapping pur badge id → display (label/emoji/tier/desc)
                               # calcul délégué au pipeline (cf ADR 0017)
    color-mode.svelte.ts       # store mode coloration hémicycle AN (gradient / groupe), localStorage
                               # Sénat : mode `gradient` figé, pas de toggle
    search-index.ts            # recherche globale lazy-loaded (indexe Personne + Senateur)
    types.ts                   # AN : Personne, Mandat, … / Sénat : Senateur, MandatSenat,
                               # TriennatStats, GroupeSenat, TriennatMeta…
                               # DOIT rester en phase avec scripts/fetch-data.ts et fetch-data-senat.ts
  routes/
    +page.svelte               # home AN — hémicycle leg courante + scrutins récents
    +page.ts                   # charge la leg courante (= max num)
    deputes/                   # /deputes/ liste filtrable cross-leg + /deputes/[id]/?leg=N
    groupes/[legislature]/[id]/ # fiche groupe AN scopée par leg
    scrutins/                  # /scrutins/ + /scrutins/[uid]/ (groupe au moment du vote)
    classements/               # /classements/ AN — Championnat + Coupes
    faq/                       # /faq/ — FAQ ludique (préredue) avec ancres
    legislatures/[num]/        # (SPA) home par législature AN
    senat/                     # ── PHASE 3 SÉNAT (mergée 2026-05-07) ──
      +page.svelte             #   home Sénat (= triennat en cours)
      triennats/               #   /senat/triennats/ index 3 triennats
        [periode]/             #   home par triennat ; sélecteur [Carrière][2023-2026][2020-2023][2017-2020]
      senateurs/               #   liste filtrable + /senat/senateurs/[matricule]/
      scrutins/                #   liste paginée + /senat/scrutins/[uid]/
      groupes/[periode]/[code]/ #  fiche groupe Sénat scopée par triennat
      classements/             #   /senat/classements/ — Championnat + Coupes par triennat
scripts/
  fetch-data.ts                # pipeline AN — AMO30 + AMO10/AMO20 (ADR 0018, 0019)
                               # LEGISLATURES = [15, 16, 17]
  fetch-data-senat.ts          # pipeline Sénat — api-senat + ODSEN_*.csv + dosleg.zip
                               # cf ADR 0023..0029. SCOPE_DATE_DEBUT = 2017-09-24 (ère Macron).
                               # Output sous static/data/senat/
  smoke-test.ts                # validation AN 40/40
  smoke-test-senat.ts          # validation Sénat 67/67 (incl. garde scope ADR 0029)
  extract-seats.ts             # extrait seats.json AN (Serrulien/hemicycle-france)
  extract-senat-seats.ts       # extrait senat-seats.json (Kurea/visu_senat MIT, ADR 0026)
  decisions-index.ts           # regen decisions/README.md
  lib/
    cache.ts                   # downloadFile/Zip + cache HTTP conditionnel (ADR 0021)
                               # mutualisé AN + Sénat
    dosleg-parser.ts           # parser SQL streaming + CSV ISO-8859-1 (Sénat) — TDD strict
    senat-layout.ts            # layout 348 sièges adapté Kurea — TDD strict
    senat-transform.ts         # sessionsCovering, groupeAuVote
    *.test.ts                  # 131 tests unitaires Node:test (npm run test:unit)
decisions/
  README.md                    # index auto-généré (NE PAS éditer à la main)
  TEMPLATE.md                  # trame pour nouvelles décisions
  NNNN-slug.md                 # 29 ADR actuelles
deploy/
  nginx.conf                   # config Nginx du container
Dockerfile                     # multi-stage node:22-alpine + nginx:1.27-alpine
```

## 🎯 Posture éditoriale

- **Football Manager + Pokédex pour la politique française** : chaque feature doit privilégier le côté ludique et social-first (cartes FIFA collectionnables, badges, médailles, classements, comparateurs, fiches personne).
- **Une personne = une fiche** : le côté Pokédex impose qu'une personne politique ait **une seule entrée** dans le projet, peu importe le nombre de mandats successifs (cf ADR 0015).
- **Sourçage rigoureux** : toute affirmation chiffrée a une source documentée (ADR ou InfoTip dans l'app).
- **Transparence** : les InfoTips expliquent chaque **métrique ET chaque badge** en français clair, jamais d'opacité (cf ADR 0016, 0017).
- **Domaine public** : code Unlicense, données sous Etalab. Pas de propriété intellectuelle.

## 🤝 Conventions de travail avec l'utilisateur

- Réponses **concises** et structurées
- **Tableaux markdown** pour les options/comparaisons
- **Demande avant d'agir** sur du destructif (push force, suppression de fichiers commités, change de licence…)
- Pour les actions Coolify : **toujours déléguer** au sous-agent dans `/Users/hide/Agents/coolify_control/` avec consigne explicite de ne pas exposer le `.env`
- Quand une décision est prise dans la conversation, **proposer de la consigner en ADR** si elle a une valeur durable
