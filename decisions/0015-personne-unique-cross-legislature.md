# 0015 — Personne unique cross-législature, mandats multiples (modèle Pokédex)

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : data, modèle, identité, routes

## Contexte

Conséquence directe d'**ADR 0014** (pivot PolitiDex) : à partir de la Phase 1, le projet doit gérer **plusieurs législatures** (17e + 16e, puis 15e). Une grande partie des députés a siégé dans plusieurs législatures consécutives (e.g. réélus en 2022 et 2024). Le modèle de données et l'expérience utilisateur doivent décider :

> Une personne politique qui a siégé en 16e **et** en 17e, c'est **une fiche** ou **deux fiches** ?

Cette décision a des implications fortes sur :

- la structure des données pré-calculées au build
- les URLs (SEO, partages externes, mémoire des liens)
- l'UX de la "fiche FIFA" (vue par défaut, navigation entre mandats)
- l'agrégation des stats et des badges
- l'unification d'identité technique entre les exports Etalab successifs

Trois options ont été considérées :

| Option | UX | Coût technique | Verdict |
|---|---|---|---|
| Une fiche par mandat (ex. `/legislatures/16/deputes/X` + `/legislatures/17/deputes/X`) | Une personne réélue apparaît 2× en recherche, "doublons" perçus, pas de continuité narrative | Faible (le code 17e existant duplique simplement le namespace) | ❌ casse le côté Pokédex |
| Une fiche personne, vue carrière + sous-vues mandat | Continuité claire, "Pokédex" naturel, narrative de carrière, défaut intelligent | Refacto significatif (modèle, routes, stats, hémicycle) | ✅ retenu |
| Deux fiches mais avec un "lien parent" entre elles | Hybride bâtard | Idem ou pire | ❌ |

## Décision

**Une personne politique = une fiche unique**, peu importe le nombre de mandats successifs. Les apparitions en législature sont des **mandats** rattachés à cette personne.

### Modèle de données

```ts
type Personne = {
  id: string                        // identifiant stable cross-législature (cf section "Identité")
  identite: {
    prenom: string
    nom: string
    sexe: 'F' | 'M'
    dateNaissance: string           // ISO 8601
    photoUrl?: string
    professionDeclaree?: string
  }
  mandats: Mandat[]                 // ordre chronologique croissant, ≥ 1
  carriere: CarriereAggregee        // pré-calculée au build (cf ADR 0017)
}

type Mandat = {
  legislature: 15 | 16 | 17
  datePriseFonction: string         // ISO
  dateFinFonction: string | null    // null = mandat en cours
  circonscription: {
    departement: string
    numero: number
    libelle: string
  }
  appartenancesGroupe: AppartenanceGroupe[]  // cf ADR 0016
  scrutinsEligibles: number
  stats: MandatStats                // cf ADR 0017
  rangs: MandatRangs                // cf ADR 0017
  badges: Badge[]                   // badges spécifiques à ce mandat
  historique: VoteCompact[]         // cf ADR 0012
}
```

### Routes

- `/deputes/[id]/` — **fiche personne** (à la racine, pas de préfixe législature)
- `/groupes/[legislature]/[id]/` — fiche groupe (les groupes sont scopés par législature, cf ADR 0016)
- `/scrutins/[uid]/` — fiche scrutin (les uids de scrutin sont déjà uniques cross-législature, route inchangée)
- `/legislatures/[num]/` — page d'accueil d'une législature (hémicycle, top groupes, scrutins récents) — **nouvelle route** qui généralise l'actuelle home
- `/` — home racine, redirige vers la **législature courante** (la plus récente disponible)

### Identité (clé de fusion)

Le **gros enjeu technique** est de fusionner les exports AN successifs en une seule personne. Trois stratégies possibles, à valider en Phase 1 :

1. **Identifiant stable AN** : si l'open data AN expose un identifiant commun aux mandats d'une même personne (ex. champ `acteurRef` ou `identifiantNational`), on l'utilise directement. → **stratégie privilégiée**
2. **Fallback `(nom normalisé + date de naissance)`** : combinaison très discriminante (collisions exceptionnelles). À utiliser si stratégie 1 indisponible ou partielle.
3. **Table de correspondance manuelle** pour les cas ambigus (changement de nom marital, etc.) — fichier `data-overrides/personne-id-mapping.json` versionné.

La stratégie effective sera **documentée dans une ADR de Phase 1** une fois la donnée explorée.

## Pourquoi

- **L'angle Pokédex impose l'unicité** : un "personnage" est une entité, pas une succession de fiches anonymes
- **Continuité narrative** : on peut raconter une carrière (élu en 2022, réélu en 2024, transfuge en 2025…) au lieu d'une suite de snapshots décorrélés
- **Discoverability et partage** : un lien `/deputes/PA1592` reste valable d'une législature à l'autre, partages Twitter/Discord ne pourrissent pas
- **Pas de doublons en recherche** : un utilisateur qui tape "Borne" voit une seule entrée, pas trois
- **Routes courtes à la racine** : choix utilisateur explicite (privilégier l'humain à la structure technique). Le préfixe `/legislatures/N/` reste utile pour les vues **scopées** (hémicycle d'une législature, groupes d'une législature) mais pas pour les personnes.

## Conséquences

### Refactor immédiat (Phase 1)

- **`scripts/fetch-data.ts`** : transforme deux exports Etalab (16e + 17e) en un seul dataset `personnes.json` avec mandats fusionnés
- **`src/lib/types.ts`** : nouveau type `Personne` + `Mandat`, l'actuel `Depute` est repensé comme alias rétro-compatible si nécessaire pendant la migration
- **`src/lib/data.ts`** : `loadDepute(id)` retourne désormais une `Personne` ; nouveaux helpers `loadMandat(personneId, legislature)` et `loadCarriere(personneId)`
- **Routes** : `/deputes/[id]/+page.svelte` doit gérer la vue carrière par défaut + tabs par mandat (cf ADR 0017)
- **Recherche globale** (`search-index.ts`) : indexer la **personne** (avec ses noms/prénoms et la liste de ses mandats), pas chaque mandat séparément

### Volumétrie

- 17e ≈ 577 députés
- 16e ≈ 577 députés
- ≈ 350-400 personnes ont siégé dans les **deux** (réélus 2024)
- Total estimé Phase 1 : **≈ 750-800 personnes uniques**, ce qui reste très raisonnable pour un site statique

### Limites assumées

- Les **mandats antérieurs à la 15e législature** ne sont pas affichés. Une personne qui a aussi siégé en 14e/13e ne montrera "que" ses mandats Phase 1+2. C'est une limitation du scope, à expliciter dans un InfoTip "Carrière (visible)" si pertinent.
- Si une personne change de **nom légal** (mariage, divorce) entre deux mandats sans que l'AN ne propage l'identifiant, la fusion peut échouer → fallback manuel (cas attendus rares, < 5)
- Les **homonymes parfaits** (même prénom + nom + date de naissance) sont théoriquement possibles mais empiriquement quasi-inexistants à l'échelle de 800 députés

### Points d'attention pour Phase 2 et 3

- L'extension à la **15e législature** réutilisera ce modèle tel quel — pas de refacto supplémentaire attendu
- L'extension aux **sénateurs** (Phase 3) introduira une nouvelle dimension : une même personne peut avoir été **députée puis sénatrice** (ou inverse). Le type `Mandat` devra être généralisé : `chambre: 'AN' | 'Senat'` ou un type discriminant. À acter en début de Phase 3.
- Idem pour **ministres** : un ministre est aussi souvent député ou sénateur en parallèle (ou dans le passé) → la `Personne` accumule des mandats parlementaires + des mandats ministériels

## Liens

- ADR `#0014` (pivot PolitiDex)
- ADR `#0016` (multi-appartenances de groupe — détail du sous-modèle)
- ADR `#0017` (stats par mandat + cumul carrière)
- ADR `#0006` (scrutins éligibles — s'applique par mandat)
- ADR `#0012` (format historique tuple — réutilisé tel quel par mandat)
- `src/lib/types.ts` (à refactorer Phase 1)
- `src/lib/data.ts` (à refactorer Phase 1)
- `scripts/fetch-data.ts` (à refactorer Phase 1)
- [Open Data AN — schéma Acteurs](https://data.assemblee-nationale.fr/openpages/schemas)
