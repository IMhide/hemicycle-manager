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

**État actuel** : côté AN, 1196 personnes uniques, 1925 mandats, 15 052 scrutins agrégés en 961 textes législatifs (cf ADR 0035, dont 225 enrichis par le dump dossiers via matching seanceRef↔reunionRef méthode Poligraph), 50+ vétérans 15+16+17. Smoke-test AN 57/57 ✅. Score **Overall** v2 + **Le Championnat / Les Coupes** + **FAQ** mergés 2026-05-06 (PR #6, ADR 0022). Polish UX mergé 2026-05-06 (PR #7).

**Sénat (mergé 2026-05-07, PR #8)** : 672 sénateurs (cohorte cumulée 3 triennats), 2 029 scrutins, 705k votes nominatifs, 9 sessions, 3 triennats ère Macron (`2017-2020`, `2020-2023`, `2023-2026`), 348 places hémicycle. Smoke-test Sénat 67/67 ✅. Tests unitaires 131/131 ✅. ADR 0023-0029 figées. Hémicycle "vivant" pour les triennats anciens (sénateurs sans `place` réelle placés selon le gradient gauche-droite).

> ⚠️ **Le repo s'appelle encore `hemicycle-manager`** (rebrand pas encore fait, cf ADR 0014). Le **nom de produit** est désormais **PolitiDex**.

- **Stack** : SvelteKit 5 + TypeScript + Tailwind + adapter-static, déployé via Docker + Nginx sur Coolify
- **URL prod** : https://hemicycle.baijobu.net (domaine inchangé pour l'instant)
- **Repo** : https://github.com/IMhide/hemicycle-manager (public, [Unlicense](LICENSE))
- **Données** : Open Data Etalab → fetched au `docker build`, jamais commitées

## ⚠️ Avant tout changement, consulte les décisions

**Toutes les décisions structurantes** (sémantique des métriques, choix techniques, sources, contraintes infra) sont consignées dans **[`decisions/`](decisions/README.md)** au format ADR (Architecture Decision Records).

**À chaque ouverture de session sur ce repo**, lis l'index : [`decisions/README.md`](decisions/README.md). Il liste les 34 décisions actives avec leur statut et leurs tags. Tu peux ouvrir n'importe quelle ADR pour les détails.

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
- la **résilience pipeline Sénat** quand `api-senat/senateurs.json` est cassé (200 OK + 0 octet, JSON invalide) → vérifie ADR 0033 (fallback ODSEN+dosleg, garde anti-payload-vide dans `cache.ts`)
- les **familles politiques** (badge Recomposition fidèle, neutralisation des renommages LFI-NUPES/LFI-NFP, LaREM/RE/EPR, MODEM/Dem, etc.) → vérifie ADR 0034 et `static/data/groupes-familles.json`
- l'**hémicycle Sénat 348 sièges** (layout adapté de Kurea/visu_senat) → vérifie ADR 0026
- la **sémantique des délégations de vote** Sénat → vérifie ADR 0027 (ignorées en v1)
- la **granularité temporelle Sénat** (triennat = analogue de la législature AN, session = brique data sous-jacente) → vérifie ADR 0028
- le **scope ère Macron Sénat** (3 triennats `2017-2020`, `2020-2023`, `2023-2026`, à parité avec 15ᵉ/16ᵉ/17ᵉ AN) → vérifie ADR 0029
- l'**architecture des routes** (`/assemblee/*`, `/senat/*`, `/elus/*`, `/classement` cross-chambre, racine neutre) → vérifie ADR 0030
- le **manifest bicaméral** `elus.json` (eluId hash sha256-8, matching `prénom + nom + dateNaissance`, overrides) → vérifie ADR 0031
- la **sémantique de la carrière cross-chambre** (moyenne simple, sélecteur de mandat unique, badge `Bicameral`) → vérifie ADR 0032
- l'**agrégation des scrutins en `Texte`s législatifs** (dossierRef Etalab prioritaire, signature titre fallback, dump Dossiers_Legislatifs.json.zip pour enrichissement métadonnées, motions de censure exclues) → vérifie ADR 0035
- l'**agrégation des scrutins Sénat en `TexteSenat`** (matching titre `scr.scrint` ↔ `loi.loitit` du dump dosleg, première dans l'écosystème open source FR — Poligraph avait abandonné la liaison) → vérifie `scripts/lib/textes-senat.ts`
- le **matching cross-chambre AN↔Sénat** et la **fiche unifiée `/textes/[id]`** (slug `senatUrl` AN → `loicod` Sénat via texte/lecass/lecture, fallback titre fuzzy, source d'autorité par champ : titre = AN, promul/JO = Sénat) → vérifie ADR 0036
- la **timeline navette** (parsing récursif `actesLegislatifs`, 30 codes retenus sur 167, croisement avec scrutins nominaux pour `scrutinUid`, détection bicaméralité refondue via présence d'un acte SEN dans la timeline) → vérifie ADR 0037

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
npm run test:unit          # tests unitaires Node:test (264 tests : parser dosleg, layout, triennats, manifest élus, sources Sénat, familles politiques, parser textes AN + matching seanceRef…)
npm run data:fetch         # télécharge + transforme AN, Sénat, puis build manifest élus
npm run data:fetch:an      #   AN seul (~30s warm cache)
npm run data:fetch:senat   #   Sénat seul (~3s warm, ~2 min cold)
npm run data:build:elus    #   manifest bicaméral elus.json (croise AN + Sénat, ADR 0031)
npm run data:smoke         # smoke-test AN + Sénat + Élus (57+67+20=144 assertions)
npm run data:smoke:an      #   AN seul
npm run data:smoke:senat   #   Sénat seul
npm run data:smoke:elus    #   Élus seul
npm run decisions:index    # regen decisions/README.md
```

## 🚀 Mise à jour des données / redéploiement

**Auto-deploy activé** depuis 2026-05-05 (PR #4) : tout push sur `main` déclenche un build automatique chez l'hébergeur via webhook. Pas besoin d'invoquer la plateforme à la main pour les changements committés.

Pour un redéploiement manuel (par ex. sans changement de code), passer par le sous-agent dans `~/Agents/coolify_control/`.

**Pipeline data accéléré** (cf ADR 0021 + 0025) : `npm run data:fetch` est en ~30s quand les caches `tmpdir/politidex-cache/` et `tmpdir/politidex-cache-senat/` sont chauds (cache HTTP conditionnel via Last-Modified/ETag). Premier run cold ≈ ~12-15 min côté AN (Scrutins 17ᵉ throttle CDN) + ~2 min côté Sénat (download + parsing dump dosleg 124 MB).

## 🧭 Architecture rapide

Architecture symétrique AN/Sénat avec hub cross-chambre (cf ADR 0030-0032). Routes `/assemblee/*` (15ᵉ + 16ᵉ + 17ᵉ AN), `/senat/*` (3 triennats ère Macron), `/elus/*` (hub bicaméral, **seule fiche détail** d'une personne), `/classement` (classement global cross-chambre). Modèle `Personne + Mandat[]` (AN) et `Senateur + MandatSenat[]` (Sénat) **non touchés** — le manifest `elus.json` les croise sans fusion data lourde.

```
src/
  lib/
    components/                # AN : Hemicycle, DeputeCard, MiniDeputeCard, MandatTabs, Badge,
                               #      HemicycleColorToggle, GlobalSearch, Rank, InfoTip, …
                               # Sénat : HemicycleSenat, SenateurCard, MiniSenateurCard,
                               #         SenateurRow, TriennatTabs, VoteHistoryItemSenat,
                               #         FrondeurSenatCard, GroupVoteBarSenat
                               # Cross-chambre (ADR 0030-0032) : EluCard, MandatSelecteur,
                               #         RetourButton (history.back générique)
    data.ts                    # loaders AN (loadPersonnes, loadHistorique, loadGroupes, loadLegislatures)
                               # + loaders Sénat (loadSenateurs, loadGroupesSenat, loadTriennats…)
    elus.ts                    # ── HUB CROSS-CHAMBRE (ADR 0031) ──
                               # Types Elu, EluManifest. Loaders loadElusManifest, loadElu.
                               # Cache module + lookups synchrones :
                               #   lookupEluByPaId(paId) / lookupEluByMatricule(matricule)
                               #   lookupEluUrlForPaIdLeg(paId, leg) → /elus/[id]?tab=an-N
                               #   lookupEluUrlForMatriculeTriennat(mat, p) → /elus/[id]?tab=senat-P
                               # Alimenté une fois via +layout.ts, utilisé partout.
    hemicycle.ts               # géométrie SVG AN (seats.json — voir ADR 0008)
    hemicycle-senat.ts         # géométrie SVG Sénat 348 sièges (Kurea, ADR 0026)
    political-order.ts         # ordre gauche-droite + scores CHES 2024 (cf ADR 0007 + ADR 0020)
    triennats.ts               # table figée 3 triennats ère Macron + helpers (ADR 0028 + 0029)
    badges.ts                  # mapping pur badge id → display (label/emoji/tier/desc)
                               # + badgeCarriereCrossDisplay (Bicameral tier legend, ADR 0032)
    color-mode.svelte.ts       # store mode coloration hémicycle AN (gradient / groupe)
    search-index.ts            # recherche globale lazy-loaded (Personne + Senateur)
    types.ts                   # AN : Personne, Mandat, … / Sénat : Senateur, MandatSenat,
                               # TriennatStats, GroupeSenat, TriennatMeta…
  routes/
    +layout.ts                 # charge elus.json UNE FOIS (ADR 0031, ADR 0030)
    +page.svelte               # racine NEUTRE — présentation produit + 4 cartes + À propos
    assemblee/                 # ── AN ──
      +page.svelte             #   home AN (anciennement /)
      deputes/                 #   /assemblee/deputes/ liste cross-leg (PAS de [id], ADR 0030)
      groupes/[leg]/[id]/      #   fiche groupe AN scopée par leg
      scrutins/                #   /assemblee/scrutins/ + [uid] (groupe au moment du vote)
      classements/             #   Championnat + Coupes par leg
      legislatures/[num]/      #   (SPA) home par législature
    senat/                     # ── SÉNAT ── (PAS de [matricule], ADR 0030)
      +page.svelte, triennats/, senateurs/, scrutins/, groupes/, classements/
    elus/                      # ── HUB CROSS-CHAMBRE (ADR 0030-0032) ──
      +page.svelte             #   liste cross-chambre dédupliquée
      [id]/+page.svelte        #   FICHE UNIQUE (sélecteur Carrière/AN/Sénat, bouton retour)
    classement/                #   /classement (singulier) — Top élus par overallCarriere
    faq/                       # /faq/ — FAQ ludique avec ancres (#elu-carriere ajouté)
scripts/
  fetch-data.ts                # pipeline AN
  fetch-data-senat.ts          # pipeline Sénat
  build-elus-manifest.ts       # ── PIPELINE CROSS-CHAMBRE (ADR 0031) ──
                               # Croise personnes.json + senateurs.json → elus.json
                               # Lit static/data/elus-overrides.json (commité)
  smoke-test.ts                # AN 57/57 (dont 17 cas canoniques Texte)
  smoke-test-senat.ts          # Sénat 67/67
  smoke-test-elus.ts           # Élus 20/20 (manifest, eluId, Pilato/Larcher, bicaméraux)
  decisions-index.ts           # regen decisions/README.md
  lib/
    cache.ts                   # cache HTTP conditionnel (ADR 0021)
                               # + gardes anti-payload-vide (ADR 0033)
    dosleg-parser.ts           # parser SQL/CSV Sénat — TDD strict
    senat-layout.ts            # layout 348 sièges Kurea — TDD strict
    senat-transform.ts         # sessionsCovering, groupeAuVote
    senat-sources.ts           # readApiSenateursOrEmpty — fallback gracieux
                               # api-senat → ODSEN+dosleg (ADR 0033)
    groupes-familles.ts        # familleAN/familleSenat — table d'équivalences
                               # AN+Sénat pour neutraliser renommages (ADR 0034)
    elus-manifest.ts           # ── builder manifest cross-chambre (ADR 0031) ──
                               # normaliseKey, eluId hash, buildElusManifest, overrides
                               # TDD strict (35 tests dans elus-manifest.test.ts)
    texte-parser.ts            # ── parser titres scrutin AN → signature texte (ADR 0035) ──
                               # extractTexteSignature, 99,5% couverture (22 tests TDD)
    dossiers-an.ts             # parser dump Dossiers_Legislatifs.json.zip Etalab AN
                               # + index reunionRef → Set<dossierUid> pour matching seanceRef
                               # (titre officiel, procédure, initiateurs, timeline)
                               # 25 tests TDD
    dossiers-reunions.ts       # extractReunionRefs : walk récursif actesLegislatifs
                               # pour collecter les reunionRef (méthode Poligraph)
                               # 8 tests TDD
    textes-an.ts               # agrégation scrutins → Texte[] (ADR 0035)
                               # cascade : seanceRef↔reunionRef > dossierRef > signature
                               # 18 tests TDD, 99,3% couverture, 48,6% DLR officiels
    dosleg-textes.ts           # extraction dossiers loi du dump dosleg Sénat
                               # mapping typloicod/etaloicod, signature pour matching
                               # 13 tests TDD
    textes-senat.ts            # agrégation scrutins Sénat → TexteSenat[] (PR #22, N3.b)
                               # matching titre scr.scrint ↔ loi.loitit (Poligraph N/A)
                               # 12 tests TDD, 571 textes (378 enrichis)
    textes-cross-chambre.ts    # matching AN↔Sénat (PR #22, ADR 0036)
                               # slug senatUrl → loicod via texte/lecass/lecture
                               # + fallback titre fuzzy avec strip bruit navette
                               # 19 tests TDD, 86 paires bicamérales
    textes-unifies.ts          # fusion AN+Sénat → TexteUnifie[] (PR #22, ADR 0036)
                               # source d'autorité par champ : titre=AN, promul=Sénat,
                               # dates = min/max, bicaméral via timeline (ADR 0037)
                               # 23 tests TDD, 1446 textes unifiés (177 bicaméraux)
    timeline-navette.ts        # parsing récursif actesLegislatifs (PR #22, ADR 0037)
                               # 30 codes "remarquables" retenus sur 167
                               # croisement avec scrutins nominaux pour scrutinUid
                               # 42 tests TDD, 1191 actes (29,9% cliquables)
    *.test.ts                  # 353+ tests unitaires (npm run test:unit)
scripts/
  fetch-data.ts                # pipeline AN (textes + timelineNavette intégrées)
  fetch-data-senat.ts          # pipeline Sénat (textes-senat intégré)
  build-elus-manifest.ts       # manifest cross-chambre élus (ADR 0031)
  build-cross-chambre.ts       # PR #22 — matching + manifest unifié + croisement timeline↔scrutins
static/data/
  elus-overrides.json          # COMMITÉ (exception au gitignore static/data/)
                               # forceFusion / forceSeparation pour cas exotiques (ADR 0031)
  groupes-familles.json        # COMMITÉ (exception au gitignore static/data/)
                               # Table familles politiques pour badge Recomposition (ADR 0034)
  textes.json                  # 961 textes AN (gitignore, généré au build)
  textes-unifies.json          # 1446 textes cross-chambre (gitignore, généré par build:cross)
  senat/textes.json            # 571 textes Sénat (gitignore, généré au build)
decisions/
  README.md                    # index auto-généré (37 ADR)
  NNNN-slug.md                 # ADR 0001-0037
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
