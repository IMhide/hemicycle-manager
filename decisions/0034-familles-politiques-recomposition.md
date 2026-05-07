# 0034 — Familles politiques : table d'équivalences pour le badge Recomposition

**Date** : 2026-05-08
**Statut** : accepté
**Tags** : data, badges, sémantique, groupes, an, senat

## Contexte

Le badge `recomposition` (cf ADR 0016) signale qu'une personne a "changé de groupe entre deux législatures, indiquant une trajectoire évolutive". L'implémentation initiale comparait les `groupeId` (côté AN) ou `groupeCode` (côté Sénat) bruts entre mandats successifs.

**Problème observé sur Manuel Bompard** (2026-05-08) :
- 16ᵉ législature : groupe `PO800490` libellé "**LFI - NUPES**"
- 17ᵉ législature : groupe `PO845413` libellé "**LFI-NFP**"

C'est le **même parti** (La France insoumise), juste sous une bannière de coalition différente (NUPES dissoute, NFP créée). Mais Etalab attribue des `groupeId` **distincts** par législature → notre code voyait un changement → faux positif badge.

**Ampleur du problème** : 539 députés sur 1196 (45 %) avaient le badge `recomposition`, dont **la grande majorité étaient des faux positifs** liés à des renommages de bannière entre législatures. Familles concernées :

| Famille | 15ᵉ | 16ᵉ | 17ᵉ |
|---|---|---|---|
| LFI | FI (`PO730958`) | LFI-NUPES (`PO800490`) | LFI-NFP (`PO845413`) |
| Macronie | LaREM (`PO730964`) | RE (`PO800538`) | EPR (`PO845407`) |
| LR / Droite | LR (`PO730934`) | LR (`PO800508`) | DR (`PO845425`) |
| PS | NG/SOC | SOC (`PO800496` puis `PO830170`) | SOC (`PO845419`) |
| Écolo | EDS partiel | Ecolo-NUPES (`PO800526`) | EcoS (`PO845439`) |
| MoDem | MODEM (`PO730970`/`PO774834`) | Dem (`PO800484`) | Dem (`PO845454`) |
| GDR | GDR (`PO730940`) | GDR-NUPES (`PO800502`) | GDR (`PO845514`) |
| Horizons | Agir ens (`PO771923`) | HOR (`PO800514`) | HOR (`PO845470`) |
| LIOT | LT (`PO759900`) | LIOT (`PO800532`) | LIOT (`PO845485`) |
| RN | (-) | RN (`PO800520`) | RN (`PO845401`) |

Côté Sénat, les `groupeCode` sont structurellement plus stables (SOC/CRC/UC/UMP) et le badge donnait déjà des résultats corrects (24 / 672, tous spot-checkés comme vraies recompositions). Mais on partage la mécanique pour uniformité et robustesse aux futurs renommages.

## Décision

Une **table d'équivalences manuelle** `static/data/groupes-familles.json` (commitée, exception au `.gitignore` comme `elus-overrides.json`) regroupe les `groupeId` AN et `groupeCode` Sénat par **famille politique** :

```json
{
  "familles": {
    "FAMILLE_LFI": {
      "label": "La France insoumise",
      "groupes": [
        { "chambre": "AN", "id": "PO730958", "libelle": "FI (15ᵉ)" },
        { "chambre": "AN", "id": "PO800490", "libelle": "LFI-NUPES (16ᵉ)" },
        { "chambre": "AN", "id": "PO845413", "libelle": "LFI-NFP (17ᵉ)" },
        { "chambre": "SENAT", "code": "CRC", "libelle": "PCF/LFI Sénat" }
      ]
    },
    ...
  }
}
```

Le badge `recomposition` se déclenche si la **famille** (et non plus l'ID/code brut) du groupe principal change entre deux mandats successifs.

**Politique sur les groupes absents de la table** : un groupe non listé est traité comme **sa propre famille**, identifié par son ID/code brut. Pas de fusion implicite — seules les équivalences explicitement documentées sont reconnues. Cohérent avec la rigueur sourçage de PolitiDex (un faux positif dû à un nouveau groupe est moins grave qu'une fusion silencieuse opaque).

**Workflow de mise à jour** : à chaque nouvelle législature ou triennat, il faut compléter la table (revue PR). Le pipeline log au build le nombre de groupes mappés ; un nouveau groupe non mappé apparaîtra avec son ID brut, ce qui force une revue.

## Pourquoi

- **Fidélité éditoriale** : le badge "Recomposition" doit signaler une **vraie trajectoire politique évolutive**, pas un simple renommage de bannière. 45 % de faux positifs vidaient le badge de son sens narratif.
- **Curated > automated** : les options alternatives écartées :
  - **Match par libellé** (LFI vs LFI-NUPES vs LFI-NFP) : fragile, dépend du formatting Etalab. Aurait raté Macronie (LaREM/RE/EPR — préfixes complètement différents).
  - **Match par couleur** (`gradientColor` dans `political-order.ts`) : trop grossier. Deux familles peuvent avoir des couleurs proches (LFI rouge / Écolo vert clair).
  - **Heuristique hybride** : trop opaque. Une table manuelle est auditable.
- **Format JSON commité** : modification = audit/PR explicite, pas de drift silencieux. Chaque entrée cite son libellé Etalab pour traçabilité (`"libelle"`).
- **Source de vérité unique** : un seul fichier alimente AN + Sénat (deux helpers `familleAN` / `familleSenat`). Les futures évolutions (régions, mandats européens, etc.) peuvent étendre la même table.
- **Échappatoire pragmatique** : un groupe absent reste sa propre famille — pas de blocage si on oublie de mettre à jour la table. Le pire cas est de réintroduire un faux positif sur un nouveau groupe non mappé, détectable au prochain audit.

## Conséquences

### Pipeline

- Nouveau module `scripts/lib/groupes-familles.ts` :
  - `buildFamillesIndex(manifest)` : construit deux Maps `groupeId → familleId` (AN, Sénat). Détecte les doublons (un groupe ne peut pas appartenir à deux familles) et lève une erreur.
  - `familleAN(idx, groupeId)` : lookup avec fallback sur l'ID brut.
  - `familleSenat(idx, groupeCode)` : symétrique.
- `scripts/lib/groupes-familles.test.ts` : 17 tests TDD couvrant cas normaux, cas inconnus, doublons, intégrité du JSON commité, cas canoniques (Bompard, Macronie, LR/DR).
- `scripts/fetch-data.ts:computeCarriere` : la comparaison passe par `familleAN(famillesIdx, groupeId)`.
- `scripts/fetch-data-senat.ts:computeCarriere` : symétrique avec `familleSenat`.
- Le manifest est chargé une fois en début de pipeline et passé en paramètre.

### Données

- **AN** : badges `recomposition` passent de **539 → 94** (45 % → 8 %). Spot-check valide :
  - Manuel Bompard : badge **retiré** ✅ (LFI-NUPES → LFI-NFP)
  - Damien Abad : badge **conservé** ✅ (LR → RE = vraie recomp)
  - Clémentine Autain : badge **conservé** ✅ (LFI → EcoS = vraie recomp)
  - Éric Woerth : badge **conservé** ✅ (LR → RE)
- **Sénat** : 24 badges, **inchangés** (les `groupeCode` étaient déjà stables).
- 56 députés LFI cohorte 16ᵉ+17ᵉ : 55 sans badge ✅, 1 avec badge (Jean-Philippe Nilor, ex-GDR → LFI = vraie recomp).
- 96 députés Macronie RE→EPR : 90 sans badge ✅, 6 avec badge (tous ex-LR/LC/UDI = vraies recomp).

### Schéma `groupes-familles.json`

```ts
type FamillesManifest = {
  $schema?: string;
  familles: Record<string, {
    label: string;
    groupes: Array<
      | { chambre: 'AN'; id: string; libelle: string }
      | { chambre: 'SENAT'; code: string; libelle: string }
    >;
  }>;
};
```

### Workflow de maintenance

- Nouveau groupe Etalab (créé en cours de législature, scission, fusion) : ajouter une entrée dans la famille appropriée (ou créer une nouvelle famille). PR commitée, ADR référencée.
- Renommage Etalab pur (label change, ID stable) : aucun changement nécessaire.
- Renommage Etalab avec nouvel ID (cas Bompard/NUPES→NFP) : ajouter le nouvel ID dans la famille existante.
- À chaque nouveau triennat Sénat ou nouvelle législature AN : revue systématique de la table.

### Limites assumées

- **Pas de date d'effet** sur les équivalences : on suppose que LFI = LFI-NUPES = LFI-NFP **pour toute l'histoire**. Si demain LFI-NFP scinde et qu'une faction se renomme, il faudra introduire une notion de période. Hors scope v1.
- **Pas de hiérarchie de familles** : NUPES, intergroupe transversal, n'est pas modélisé. La famille LFI ne contient pas Écolo-NUPES (qui est dans `FAMILLE_ECOLO`). Cohérent avec la lecture éditoriale (un député LFI-NUPES qui rejoint Écolo-NUPES change bien de famille politique réelle).
- **Cas frontière** : un député qui rejoint un groupe NI (Non-Inscrit) ne déclenche pas le badge si son mandat précédent était aussi NI. Cohérent avec la sémantique actuelle.
- **Manifest commité** : 12 familles, ~50 groupes mappés au moment de l'écriture. Maintenance manuelle au fil des législatures. Acceptable vu la rareté des évolutions (1-2 PR par législature).

## Liens

- ADR `#0016` (multi-appartenances groupe — sémantique des badges Recomposition / Transfuge)
- ADR `#0017` (cumul carrière + badges carrière)
- ADR `#0019` (priorité sources AMO Etalab AN — origine des `groupeId`)
- ADR `#0020` (15ᵉ législature et mapping CHES)
- ADR `#0025` (sources Sénat — origine des `groupeCode`)
- ADR `#0031` (manifest bicaméral `elus.json` — pattern similaire de table commitée)
- `scripts/lib/groupes-familles.ts` (helpers + types)
- `scripts/lib/groupes-familles.test.ts` (17 tests TDD)
- `scripts/fetch-data.ts:computeCarriere` (intégration AN)
- `scripts/fetch-data-senat.ts:computeCarriere` (intégration Sénat)
- `static/data/groupes-familles.json` (table commitée, source de vérité)
