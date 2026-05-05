# 0016 — Multi-appartenances de groupe (intra et inter-législature)

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : data, modèle, groupes, badges

## Contexte

Conséquence d'**ADR 0014** (pivot PolitiDex) et **ADR 0015** (personne unique). Une fois qu'on suit une personne sur plusieurs législatures et qu'on autorise les changements en cours de mandat, il faut décider :

> Comment représenter le fait qu'**un même député a appartenu à plusieurs groupes politiques** au cours de sa carrière ?

Deux niveaux de complexité :

1. **Inter-législature** : un député réélu peut changer de groupe d'une législature à l'autre (e.g. RE en 16e → Indépendant en 17e, ou LR → DR au gré des recompositions)
2. **Intra-mandat** : un député peut **claquer la porte** ou être **exclu** de son groupe en cours de mandat (cas réguliers : démissions de groupe, scissions, etc.)

L'open data AN modélise déjà cela : chaque député a une liste de **mandats de groupe** datés, avec `dateDebut` et `dateFin`. Le projet actuel n'exploite que le **groupe en cours** (le dernier non-fermé), ce qui marche pour la 17e mais perdra de l'information dès qu'on intègrera la 16e (où certains députés ont changé de groupe en cours de législature).

Question secondaire : **quel groupe afficher par défaut sur la fiche personne** quand elle a appartenu à plusieurs ?

| Option d'affichage | Pour | Contre |
|---|---|---|
| Premier groupe historique | Cohérent avec le "point d'entrée politique" | Trompeur si la personne a beaucoup évolué |
| Groupe le plus fréquent (durée totale) | Statistiquement représentatif | Calcul coûteux, peu lisible |
| **Groupe le plus récent enregistré** | Reflète la **position actuelle** de la personne | Peut occulter une trajectoire (badges compensent) |

## Décision

### Modèle de données

Chaque mandat (cf ADR 0015) contient une **liste chronologique** d'appartenances de groupe :

```ts
type Mandat = {
  legislature: 15 | 16 | 17
  // …
  appartenancesGroupe: AppartenanceGroupe[]  // chronologique croissante, ≥ 1
  // …
}

type AppartenanceGroupe = {
  groupeId: string                  // ID du groupe (ex. "PO845454")
  groupeLibelle: string             // libellé court ("EPR", "RN", "GDR")
  groupeLibelleLong: string         // libellé complet
  dateDebut: string                 // ISO 8601
  dateFin: string | null            // null = appartenance en cours
  motif?: 'inscription'             // raison du changement (best effort, peut être absent)
        | 'demission'
        | 'exclusion'
        | 'dissolution-groupe'
        | 'fin-mandat'
}
```

Les **groupes** restent scopés par législature (cf ADR 0015) — un même groupeId peut ne pas exister d'une législature à l'autre.

### Règles d'affichage

| Contexte | Quel groupe afficher ? |
|---|---|
| **Fiche personne, vue carrière (par défaut)** | Le groupe **le plus récent enregistré** tous mandats confondus (dernier élément de la dernière `appartenancesGroupe` du dernier mandat) |
| **Fiche personne, vue mandat spécifique** | Liste chronologique des appartenances **de ce mandat**, avec timeline visuelle si plusieurs |
| **Hémicycle d'une législature** | Le groupe **actif au moment du rendu** (= dernier élément non-fermé sur la période de la législature). Si la législature est passée, le groupe **à la fin** du mandat. |
| **Fiche scrutin (frondeurs, alignement)** | Le groupe **au moment du vote** (= appartenance qui couvre la `dateScrutin`). Cohérent avec ADR 0004 (frondeur calculé contextuellement). |
| **Recherche globale** | Index sur **toutes les appartenances** de la personne (pour qu'une recherche "RE" ou "EPR" fasse remonter une personne qui y a appartenu, même si elle n'y est plus) |
| **Classements / leaderboards par groupe** | Le député est compté dans chaque groupe **au prorata de son appartenance** sur la période concernée (à défaut, on compte son groupe "majoritaire en durée" sur le mandat) |

### Nouveaux badges (avec InfoTip ⓘ)

Deux badges automatiques sont introduits, chacun avec son **InfoTip** explicatif au hover (cohérent avec le pattern existant des InfoTips métriques) :

| Badge | Critère technique | InfoTip (libellé) |
|---|---|---|
| **Recomposition** | Au moins **deux mandats** dont les groupes diffèrent (groupe `m[i]` ≠ groupe `m[i+1]` au sens libellé groupe principal du mandat) | "A changé de groupe entre deux législatures. Indique une trajectoire politique évolutive (réélection avec un autre étiquette, recomposition partisane)." |
| **Transfuge** | Au moins **un mandat** qui contient ≥ 2 `appartenancesGroupe` distinctes (changement de groupe **en cours** de mandat) | "A changé de groupe pendant le même mandat. Souvent suite à une démission ou une exclusion. Plus rare, plus marquant qu'une simple recomposition." |

Les deux badges peuvent **co-exister** sur une même personne. Ils s'affichent dans la section badges de la carte FIFA, comme les autres badges automatiques.

**Règle InfoTip étendue** : tous les badges (anciens + nouveaux) doivent désormais avoir un **InfoTip** explicatif au hover. C'est une généralisation du pattern InfoTip déjà appliqué aux métriques (cf posture éditoriale "Transparence" dans `CLAUDE.md`).

## Pourquoi

- **Modéliser fidèlement la donnée AN** : ne pas écraser l'historique en gardant uniquement le dernier groupe serait un appauvrissement de la donnée publique
- **Le groupe au moment du vote est essentiel pour la loyauté** : la définition de "fronde" (ADR 0004) repose sur le vote majoritaire **du groupe d'appartenance au moment du vote**. Si on aplatit en "groupe le plus récent", on calculerait des frondes contre un groupe que la personne avait déjà quitté → faux positifs
- **Groupe le plus récent comme défaut** est :
  - le plus **lisible** (un seul groupe affiché, comme aujourd'hui)
  - le plus **utile** pour situer la personne aujourd'hui
  - le plus **honnête** narrativement (si quelqu'un a quitté son groupe, c'est l'info qui compte)
- **Badges Recomposition + Transfuge** : c'est exactement la **différence de force narrative** entre une trajectoire politique normale (recomposition entre élections) et un acte de rupture (claquage de porte intra-mandat). Mériter deux badges distincts respecte cette gradation.
- **InfoTip systématique sur les badges** : la transparence est un principe éditorial du projet. Un badge sans explication est un jugement opaque. Avec InfoTip, c'est un fait sourcé et expliqué.

## Conséquences

### Pipeline (Phase 1)

- `scripts/fetch-data.ts` doit **conserver toute la liste** `mandatsRef[].uid` du XML AN avec leurs dates, plus la transformer en `appartenancesGroupe[]`
- Le calcul de **fronde** doit utiliser le groupe **au moment du scrutin** (à vérifier sur le code actuel — l'ADR 0004 implique cette logique mais le code peut avoir un raccourci si la 17e n'a pas eu de transfuges en pratique)
- La fonction de calcul des **stats de groupe** (ADR 0017) doit gérer le prorata d'appartenance pour ne pas double-compter

### Frontend (Phase 1)

- `MiniDeputeCard` et `DeputeCard` : prop `contexteGroupe` (défaut: 'recent', sinon `legislature: number` ou `dateScrutin: string`)
- Page `/deputes/[id]/` : **timeline des groupes** dans la vue mandat si > 1 appartenance ; sinon affichage simple
- Composant `<BadgeWithInfoTip>` à généraliser ou créer (un seul composant qui prend le badge + son texte InfoTip)
- Page scrutin (`/scrutins/[uid]/`) : afficher le groupe d'appartenance **au moment du vote** pour chaque député listé (frondeurs, votants), pas son groupe actuel

### Volumétrie

- Sur la 17e, **~5-10 députés** ont changé de groupe en cours de mandat (cas notable : exclusions du RN, démissions LR vers UDR, etc.)
- Sur la 16e, le nombre est plus élevé (NUPES → recompositions multiples)
- Le surcoût en taille de données est **négligeable** (quelques objets par personne)

### Limites assumées

- Le motif (`demission`, `exclusion`, etc.) est **best effort** : l'open data AN ne le donne pas toujours explicitement. Si absent, on n'affiche pas de motif sur la timeline.
- Le badge **"Transfuge"** ne distingue pas démission volontaire d'exclusion. Ces deux situations ont des connotations différentes mais on n'a pas la donnée fiable pour distinguer → un seul badge unifié, et l'InfoTip mentionne les deux cas.

### Points d'attention

- Sur les pages classements / leaderboards par groupe (`/groupes/[id]/` et `/classements/`), la **convention de comptage** (groupe majoritaire en durée vs prorata) doit être tranchée précisément en Phase 1 — peut faire l'objet d'une mini-ADR dédiée si les calculs deviennent ambigus
- Si l'AN modifie son schéma de mandats de groupe (peu probable mais possible), la pipeline doit lever une exception explicite plutôt que produire des données silencieusement fausses

## Liens

- ADR `#0014` (pivot PolitiDex)
- ADR `#0015` (personne unique cross-législature)
- ADR `#0017` (stats par mandat, badges carrière vs mandat)
- ADR `#0004` (frondeur exclut abstentions — confirme le calcul contextuel par groupe)
- ADR `#0005` (présence vs participation — métriques par mandat, indépendantes du groupe)
- `src/lib/badges.ts` (à étendre Phase 1)
- `src/lib/components/InfoTip.svelte` (existant, à généraliser sur badges)
- `scripts/fetch-data.ts` (extraction des `appartenancesGroupe[]`)
- [Open Data AN — schéma mandats](https://data.assemblee-nationale.fr/travaux-parlementaires/votes)
