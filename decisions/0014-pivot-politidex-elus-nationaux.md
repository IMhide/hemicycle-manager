# 0014 — Pivot vers PolitiDex (élus nationaux multi-périodes)

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : produit, scope, roadmap, branding

## Contexte

L'app a été lancée sous le nom **"Hémicycle Manager"** avec un focus très étroit : visualisation des votes de la 17ᵉ législature de l'Assemblée nationale. Le code, les données, les routes et les ADR existantes (0001-0013) reflètent ce périmètre.

Après quelques semaines d'usage, le mainteneur souhaite **élargir le périmètre** pour devenir une référence ludique sur la politique nationale française dans son ensemble, et plus seulement sur les votes d'une seule législature.

L'inspiration produit double :

- **Football Manager** (déjà acté) : cartes type FIFA, classements, badges, radar, rangs, médailles
- **Pokédex** (nouveau) : chaque "personnage politique" est une **entrée unique** dans une collection, qu'on consulte, compare, collectionne mentalement

L'enjeu est de **cadrer le pivot** sans casser l'existant : garder la base solide (pipeline AN, hémicycle SVG, métriques) et ouvrir progressivement vers d'autres législatures et d'autres types d'élus.

Trois choix de cadrage ont été considérés :

| Option | Pour | Contre |
|---|---|---|
| Rester focalisé 17e AN | Simple, code stable, pas de refacto | Sature vite, risque de redondance avec NosDéputés/Datan |
| Pivot "élus nationaux" (députés + sénateurs + ministres + président, multi-législatures) | Périmètre maîtrisable, sources Etalab cohérentes | Refacto multi-législature nécessaire |
| Pivot "tous les élus français" (incluant les 600 000+ élus locaux REU/RNE) | Énorme valeur, différenciant fort | Sortie du modèle 100 % statique, infra à repenser, maintenance lourde |

## Décision

**Le projet est rebrandé "PolitiDex"** et adopte un **scope élargi mais borné** :

- **Périmètre** : élus **nationaux** uniquement → députés (AN), sénateurs (Sénat), ministres (gouvernement), président de la République
- **Profondeur temporelle** : présent + passé récent, dans la limite des données ouvertes disponibles
- **Posture éditoriale** : "Football Manager + Pokédex pour la politique française" — chaque personnalité politique est une **fiche unique** consultable, indépendamment du mandat dans lequel on la rencontre
- **Stack** : reste **100 % statique** (SvelteKit + adapter-static), confirmé par le scope "élus nationaux" qui reste de l'ordre de quelques milliers d'entités max
- **Roadmap en 3 phases séquentielles** :
  1. **Phase 1 — Multi-législature AN** : intégration de la **16ᵉ législature** (2022-2024) en plus de la 17ᵉ. Refonte du modèle de données pour supporter "une personne, plusieurs mandats" (cf ADR 0015, 0016, 0017).
  2. **Phase 2 — Ère Macron complète** : intégration de la **15ᵉ législature** (2017-2022) → couvre toute l'ère Macron à l'AN (15e + 16e + 17e).
  3. **Phase 3 — Au-delà de l'AN** : sénateurs (open data Sénat), ministres (sources gouvernement / data.gouv.fr), présidents (sources Élysée / Wikidata).

Le **nom de produit** devient **PolitiDex**. Le **nom de repo GitHub** (`hemicycle-manager`) et le **domaine** (`hemicycle.baijobu.net`) restent inchangés pour l'instant — un renommage sera décidé séparément quand le pivot sera consolidé sur Phase 1+2.

L'**hémicycle SVG** reste une vue centrale du produit (d'où l'idée de garder le domaine "hemicycle" pour l'instant), mais devient **une vue parmi d'autres** plutôt que le squelette du produit.

## Pourquoi

- **Élus nationaux est le bon scope** parce que :
  - Les sources Etalab (AN, Sénat, gouvernement) sont **cohérentes en format et en qualité**
  - Le volume reste compatible avec une stack 100 % statique (≈ 925 députés cumulés sur 15e+16e+17e + 348 sénateurs + ~30 ministres + 1 président → quelques milliers de fiches max)
  - Les **élus locaux** (REU/RNE, 600 000+ entités) sortiraient du modèle statique et casseraient la simplicité opérationnelle (cf ADR 0001, 0003)
- **PolitiDex comme nom** capture mieux la posture "collection ludique" que "Hémicycle Manager", qui sous-entendait un focus AN uniquement
- **Roadmap séquentielle plutôt que big-bang** :
  - Phase 1 (16e) débloque tout le reste : c'est elle qui force le refacto multi-législature
  - Une fois le refacto fait, ajouter 15e (Phase 2) puis Sénat (Phase 3) devient incrémental
  - Permet de garder l'app utilisable et déployée à chaque étape
- **Garder le repo et le domaine actuels** : le coût de renommer (redirections, liens externes, mémoire utilisateurs) est plus élevé que le gain de cohérence tant que le pivot n'est pas consolidé. Décision réversible.

## Conséquences

### Refactor structurel inévitable (Phase 1)

- Le pipeline `scripts/fetch-data.ts` doit être **paramétré par législature** (la 16e a son propre export Etalab)
- Le modèle "député" plat doit devenir **"Personne + mandats[]"** (cf ADR 0015)
- Les routes doivent supporter le multi-législature (cf ADR 0015 et 0016)
- Le système de stats/rangs doit être **par mandat**, avec une vue cumul carrière (cf ADR 0017)
- L'hémicycle home doit avoir un **sélecteur de législature** (par défaut la plus récente)
- Le système de **badges** s'étend (badges carrière vs badges mandat, cf ADR 0017)
- Tous les **InfoTips** s'étendent aux badges (cohérent avec le pattern existant)

### ADR existantes : statut

Toutes les ADR 0001-0013 **restent actives**. Elles s'appliquent **par législature** :

- ADR 0004 (frondeur exclut abstentions) → s'applique à chaque législature indépendamment
- ADR 0005 (présence vs participation) → idem
- ADR 0006 (scrutins éligibles post-prise de fonction) → idem, par mandat
- ADR 0007 (CHES 2024 pour gauche-droite) → s'applique aux groupes 17e ; il faudra **étendre le mapping** aux groupes 16e et 15e (Phase 1 et 2)
- ADR 0008 (positions sièges officielles) → s'applique par législature, il faudra **vérifier** que Serrulien fournit les coordonnées 16e (sinon scraping à refaire)
- ADR 0012 (format tuple historique) → s'applique tel quel par mandat

### Limitations acceptées

- **Pas de comparaison de rangs entre législatures** : un rang n'a de sens qu'au sein d'une cohorte (cf ADR 0017). On affiche les rangs par mandat, pas un rang carrière.
- **Pas d'élus locaux** : c'est explicitement hors scope. Si un user demande un maire ou un conseiller régional, on dit non (et on documente).
- **Pas de plateforme stateful** : pas de comptes utilisateurs, pas de favoris persistés serveur-side. Le localStorage suffit pour les éventuelles préférences (mode "Devine le vote" cumul de score, etc.).

### Points d'attention

- **Identifiant stable AN cross-législature** : à confirmer techniquement en début de Phase 1. Si l'AN ne fournit pas un identifiant universel, on tombera sur une fusion `(nom normalisé + date de naissance)` (cf ADR 0015).
- **Composition des groupes change beaucoup entre législatures** : RE → EPR, NUPES → NFP éclaté, etc. → le mapping CHES doit être enrichi.
- **Les hémicycles changent** entre législatures (compositions, sièges modifiés) — vérifier la disponibilité des SVGs officiels pour 16e et 15e.

## Liens

- ADR `#0001` (stack SvelteKit statique — confirmée par ce pivot)
- ADR `#0003` (données fetched au build — confirmée, étendue à 16e/15e)
- ADR `#0007` (CHES 2024 — à étendre aux groupes 16e/15e)
- ADR `#0008` (positions sièges — vérifier Serrulien pour 16e/15e)
- ADR `#0015` (personne unique cross-législature)
- ADR `#0016` (multi-appartenances de groupe)
- ADR `#0017` (stats par mandat, cumul carrière)
- [`CLAUDE.md`](../CLAUDE.md) — mémoire de session
- [`NEXT_STEPS.md`](../NEXT_STEPS.md) — roadmap détaillée
- [Open Data AN — 16e législature](https://data.assemblee-nationale.fr/travaux-parlementaires/votes)
- [Open Data Sénat](https://data.senat.fr/)
- [data.gouv.fr](https://www.data.gouv.fr/) — sources élargies pour Phase 3
