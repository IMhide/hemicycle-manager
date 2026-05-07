# Guide du reviewer — Refonte routes + hub Élu cross-chambre

## TL;DR

**7 PR empilées, à merger dans l'ordre A → G.** Chacune mergeable indépendamment, mais conçues pour s'enchaîner. Aucun merge ne doit être forcé : chaque PR a son propre `Test plan` à valider.

| # | PR | Branche | Base | URL |
|---|---|---|---|---|
| A | docs(adr): accepter ADR 0030-0032 | `refonte/01-adr-accepted` | `main` | [#12](https://github.com/IMhide/hemicycle-manager/pull/12) |
| B | feat(data): manifest bicaméral | `refonte/02-elus-manifest` | `refonte/01-...` | [#13](https://github.com/IMhide/hemicycle-manager/pull/13) |
| C | feat(routes): AN sous /assemblee/* | `refonte/03-routes-assemblee` | `refonte/02-...` | [#14](https://github.com/IMhide/hemicycle-manager/pull/14) |
| D | feat(elus): /elus/ liste + fiche hub | `refonte/04-route-elus` | `refonte/03-...` | [#15](https://github.com/IMhide/hemicycle-manager/pull/15) |
| E | feat(classement): /classement | `refonte/05-classement` | `refonte/04-...` | [#16](https://github.com/IMhide/hemicycle-manager/pull/16) |
| F | feat(routes): suppression + relinking | `refonte/06-suppression-show-relinking` | `refonte/05-...` | [#17](https://github.com/IMhide/hemicycle-manager/pull/17) |
| G | feat(ux): header + home + FAQ + docs | `refonte/07-header-home-faq-docs` | `refonte/06-...` | (cette PR) |

## Ordre de relecture conseillé

1. **PR #A** (10 min) — c'est juste les ADR à passer en `accepté`. Mergée, elle débloque la lecture stratégique des ADR pour le reste.
2. **PR #B** (30 min) — manifest bicaméral. Lis l'ADR 0031 d'abord. Vérifie `scripts/lib/elus-manifest.test.ts` — les cas couvrent-ils les pièges (homonymes, dates manquantes) ? Lance `npm run test:unit` localement (166/166 attendus).
3. **PR #C** (15 min) — déplacement mécanique. Audit grep simple : aucun lien `/deputes/`, `/groupes/`, `/scrutins/`, `/classements/`, `/legislatures/` ne doit subsister hors de `/assemblee/`. La racine `/` doit être neutre.
4. **PR #D** (45 min — la plus dense UX) — fiche Élu. Lis l'ADR 0032 d'abord. Teste manuellement le sélecteur de mandat, le bouton retour, la vue Carrière sur Pilato/Larcher/un bicaméral.
5. **PR #E** (15 min) — `/classement`. Vérifie l'ordre desc, médailles, filtres, lazy load.
6. **PR #F** (45 min — la plus risquée) — suppression et réécriture des liens. Audit grep exhaustif obligatoire :
   - `grep -rn '"/assemblee/deputes/[A-Z]' src/` doit retourner 0 résultat
   - `grep -rn '"/senat/senateurs/[A-Z0-9a-z]' src/` doit retourner 0 résultat
   - Clic-test exhaustif sur la liste fournie dans la PR.
7. **PR #G** (20 min) — header, home, FAQ section `#elu-carriere`, docs. Vérifier `CLAUDE.md` à jour (ADR 0030-0032 mentionnés), `NEXT_STEPS.md` à jour.

## Points sensibles à valider

### ADR

- [ ] Les 3 ADR (0030, 0031, 0032) sont en statut `accepté` après PR #A
- [ ] `decisions/README.md` régénéré, **32 ADR** au total

### Data

- [ ] `static/data/elus.json` produit : **1856 élus** dont **10 bicaméraux**, taille ~1.1 MB
- [ ] `static/data/elus-overrides.json` commité, vide initialement
- [ ] `.gitignore` a une exception pour `elus-overrides.json` (sinon le fichier ne suit pas le repo)
- [ ] Pipeline cold/warm : ajouter `data:build:elus` ne casse pas l'enchaînement, le coût est négligeable (~80ms)
- [ ] Smoke-test étendu : `npm run data:smoke:elus` passe **20/20**
- [ ] Tests unitaires : `npm run test:unit` passe **166/166** (dont 35 nouveaux pour le manifest)
- [ ] Warning de matching ambigu attendu : Jean-Louis Masson (AN PA346218 né 1954 ↔ Sénat 01060R né 1947, 2 personnes différentes — séparation correcte)

### Routes

- [ ] `/deputes/...` (sans préfixe) → 404
- [ ] `/groupes/...`, `/scrutins/...`, `/classements/...`, `/legislatures/...` (sans préfixe) → 404
- [ ] `/assemblee/deputes/PA817211` → **404** (route détail supprimée en PR #F)
- [ ] `/senat/senateurs/86034E` → **404** (route détail supprimée en PR #F)
- [ ] `/elus/elu_4bc02b42` (eluId valide) → 200, fiche complète
- [ ] `/elus/elu_invalide` → erreur propre (pas de crash)
- [ ] `/classement` → 200, liste triée
- [ ] Racine `/` → présentation neutre (titre, 4 cartes, bloc À propos)

### UX critiques (à tester en `npm run dev`)

- [ ] Bouton « ← Retour » sur `/elus/[id]` fonctionne et est masqué sur arrivée directe (URL collée)
- [ ] Sélecteur de mandat écrit l'URL `?tab=carriere|an-{leg}|senat-{periode}`
- [ ] Recherche globale (header) renvoie vers `/elus/[eluId]?tab=carriere`
- [ ] Cliquer un siège dans `Hemicycle` AN ou Sénat → fiche Élu avec bon onglet
- [ ] Cliquer un frondeur dans une page scrutin → fiche Élu avec bon onglet (`?tab=an-{leg}` ou `?tab=senat-{periode}`)
- [ ] Mobile 375px : header reste lisible, fiche Élu lit verticalement

### Cas concrets

- [ ] **René Pilato** (`PA817211`) → `/elus/elu_4bc02b42` : 2 mandats AN (16ᵉ + 17ᵉ), pas de mandat Sénat, pas de badge `Bicameral`
- [ ] **Gérard Larcher** (`86034E`) → `/elus/elu_ad19025b` : 3 mandats Sénat dans le scope ère Macron, pas de mandat AN, pas de badge `Bicameral`
- [ ] **Philippe Bonnecarrère** (bicaméral) → `/elus/elu_bb167f1f` : 4 mandats AN+Sénat, badge `Bicameral` (tier legend, gradient fuchsia → amber), vue Carrière agrège AN+Sénat dans l'historique trié chrono

### Régressions à vérifier (rien ne doit casser)

- [ ] Listes existantes `/assemblee/deputes/` et `/senat/senateurs/` : filtres et recherche fonctionnent, items linkent vers `/elus/[eluId]?tab=...`
- [ ] Hémicycles AN et Sénat : couleurs, tooltips, modes (gradient/groupe côté AN)
- [ ] Pages scrutin : groupes au moment du vote affichés correctement
- [ ] Pages groupe : top loyalistes/frondeurs/présence
- [ ] Pages classement par chambre `/assemblee/classements/` et `/senat/classements/` : Championnat + Coupes inchangés (items relinkés vers `/elus/`)
- [ ] FAQ existante `/faq/` : sections AN + Sénat toujours là, nouvelle section `#elu-carriere` ajoutée
- [ ] Recherche globale : indexe les `Personne` ET `Senateur` (nouvelles cibles `/elus/[eluId]?tab=carriere`)

### CI

- [ ] CI verte sur les 7 PR
- [ ] Placeholder `static/data/elus.json` ajouté dans `.github/workflows/ci.yml` (PR #B)

## Si tu veux merger

Ordre obligatoire (chaque branche est basée sur la précédente) :
1. PR #A → squash merge dans `main` (ou rebase, selon ta préf)
2. PR #B (la base est maintenant à jour, GitHub propose le merge)
3. PR #C, #D, #E, #F, #G dans l'ordre

⚠️ **Auto-deploy Coolify** : chaque merge sur `main` déclenche un déploiement. Si tu veux grouper, fais les 7 merges d'affilée et surveille la prod après le dernier. Sinon merge un par un et vérifie la prod entre chaque (plus prudent mais 7× plus long).

## Si tu veux retoucher

- Pour modifier une ADR avant merge : édite directement, regen index, push sur la branche `refonte/01-...`. Les PR suivantes héritent automatiquement.
- Pour annuler un changement code dans une PR intermédiaire : commit de revert dans la branche concernée, ou demande à Claude (nouvelle session) de retoucher.
- Pour redécouper la stack : `git rebase -i` à éviter sans préparer (la stack est fragile). Préférer "abandonner la stack et repartir d'une nouvelle session avec le delta voulu".

## Métriques de la mission

- **7 PR ouvertes**, **0 mergée**
- **35 nouveaux tests unitaires** (TDD strict pour le manifest, 166/166 verts au total)
- **20 nouvelles assertions smoke-test** (couvrant manifest + cas concrets)
- **3 ADR** acceptées (0030, 0031, 0032)
- **3 nouveaux composants** créés (`EluCard.svelte`, `MandatSelecteur.svelte`, `RetourButton.svelte`)
- **9 composants modifiés** pour la réécriture des liens (MemberRow, MiniDeputeCard, MiniSenateurCard, SenateurRow, FrondeurCard + legislature en prop, FrondeurSenatCard + triennat en prop, GlobalSearch, Badge, etc.)
- **2 routes supprimées** (`/assemblee/deputes/[id]/`, `/senat/senateurs/[matricule]/`)
- **3 routes créées** (`/elus/`, `/elus/[id]/`, `/classement/`)
- **5 sous-arborescences** déplacées sous `/assemblee/*` (deputes, groupes, scrutins, classements, legislatures)
- **Manifest bicaméral** : 1856 élus, 10 bicaméraux, ~1.1 MB, build en 80 ms

## Données chiffrées

- **1196 personnes AN** (15ᵉ + 16ᵉ + 17ᵉ législatures)
- **672 sénateurs Sénat** (ère Macron, 3 triennats 2017-2020, 2020-2023, 2023-2026)
- **1856 élus dédupliqués** dans `elus.json` (10 bicaméraux, 2 sénateurs hors scope filtrés)
- **10 bicaméraux détectés** (matching strict prénom + nom + dateNaissance) :
  Bonnecarrère, Bourguignon, Boyer, Cazebonne, Demilly, Florennes, Folliot, Girardin, Létard, Taillé-Polian
- **1 warning de matching** loggué (Jean-Louis Masson — 2 personnes différentes, séparation correcte par défaut)
