# 0017 — Stats par mandat, cumul carrière sans rang, tabs sur fiche député

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : métriques, ux, sémantique, badges

## Contexte

Conséquence d'**ADR 0014** (pivot PolitiDex), **ADR 0015** (personne unique) et **ADR 0016** (multi-groupes). Une fois qu'une personne agrège **plusieurs mandats**, il faut décider :

> Comment afficher ses **stats** (présence, participation, loyauté, frondes) et ses **rangs** (1er en présence, 12e en loyauté…) quand elle a siégé dans plusieurs législatures ?

Trois questions liées :

1. Quelle est la **vue par défaut** de la fiche député ? Cumul carrière ? Mandat le plus récent ? Tabs explicites ?
2. Le **rang** (5e en présence) a-t-il un sens **carrière** ou seulement **par mandat** ?
3. Les **badges** (Top loyaliste, Présence parfaite, etc.) sont-ils des badges **mandat** ou **carrière** ? Les deux ?

Réponses utilisateur (déjà actées dans la conversation) :

- Vue par défaut = **cumul carrière** + sélecteur de mandat
- Sélecteur via **tabs** : `[Carrière] [16e (2022-2024)] [17e (2024-)]` avec `Carrière` actif par défaut
- **InfoTip** sur tous les badges (cohérent avec ADR 0016)

Reste à formaliser comment cumuler proprement, et la sémantique des rangs et badges.

## Décision

### Vue par défaut : Carrière

La fiche `/deputes/[id]/` affiche par défaut une **vue carrière** : les stats sont **cumulées** sur tous les mandats de la personne, **sans rang**.

#### Stats cumulées (vue carrière)

| Stat | Formule de cumul |
|---|---|
| **Présence** | `Σ (présents tous mandats) / Σ (scrutinsEligibles tous mandats)` |
| **Participation** | `Σ (votes exprimés tous mandats) / Σ (scrutinsEligibles tous mandats)` |
| **Loyauté** | `Σ (votes alignés tous mandats) / Σ (votes exprimés tous mandats)` — l'alignement est calculé contextuellement (groupe au moment du vote, cf ADR 0004 + ADR 0016), donc agrégeable même si la personne a changé de groupe |
| **Frondes** (nombre absolu) | `Σ (frondes tous mandats)` |
| **Frondes** (taux) | `Σ (frondes tous mandats) / Σ (votes exprimés tous mandats)` |
| **Scrutins éligibles** | `Σ (scrutinsEligibles tous mandats)` |

Les formules sont des **moyennes pondérées par les scrutins éligibles**, pas des moyennes simples des taux par mandat — c'est mathématiquement plus correct et c'est ce qu'attend l'utilisateur intuitivement ("sur sa carrière, il a été présent X% du temps").

#### Pas de rang en vue carrière

**Aucun rang n'est affiché en vue carrière.** Un rang ("3e en présence sur 577") n'a de sens qu'au sein d'une **cohorte comparable**, et la cohorte change d'une législature à l'autre :

- Les députés de la 16e et 17e ne sont **pas comparables directement** (compositions politiques différentes, contextes différents, scrutins différents)
- Un "rang carrière" demanderait de définir une cohorte arbitraire ("députés ayant siégé dans au moins l'une des législatures couvertes") qui n'a pas de sens en théorie politique

À la place, la vue carrière affiche les **valeurs absolues** des stats avec une indication contextuelle (e.g. "Présence 92.3% (sur 1842 scrutins éligibles, 2 mandats)").

### Vue par mandat : tabs

Sous le titre de la fiche, un **bandeau de tabs** :

```
[ Carrière ]  [ 16e (2022-2024) ]  [ 17e (2024- ) ]
```

- **Carrière** est actif par défaut
- L'ordre des tabs après "Carrière" est **chronologique croissant** (le plus récent à droite, ce qui matche la convention "actuel à droite" de la timeline)
- Cliquer sur un tab change le contenu de la carte FIFA :
  - Stats du **mandat sélectionné** uniquement
  - **Rangs** dans cette législature (e.g. "5e en présence sur 577 députés de la 16e")
  - **Badges** spécifiques au mandat
  - **Groupe** politique au sein de ce mandat (avec timeline si plusieurs appartenances, cf ADR 0016)
  - **Historique de votes** filtré sur cette législature
- L'URL **change** pour permettre le partage (`/deputes/[id]/?leg=16` ou `/deputes/[id]/16/` — choix précis à acter en implémentation Phase 1)

### Distinction badges carrière vs badges mandat

| Type | Calcul | Affichage |
|---|---|---|
| **Badges carrière** | Calculés sur la **carrière entière** | Visibles dans **toutes** les vues (Carrière + chaque mandat) |
| **Badges mandat** | Calculés sur **un mandat** | Visibles **uniquement** dans la vue de ce mandat |

#### Badges carrière (visibles partout)

- **Recomposition** (cf ADR 0016)
- **Transfuge** (cf ADR 0016)
- **Vétéran** : 3+ législatures (sera pertinent à partir de Phase 2 quand on aura la 15e)
- **Réélu·e** : a au moins 2 mandats consécutifs
- (à enrichir au fil du projet)

#### Badges mandat (visibles dans la tab du mandat)

Réutilisent la liste actuelle des 7 badges automatiques :

- Top loyaliste (top 10% loyauté du mandat)
- Frondeur·euse (top 10% frondes du mandat)
- Présence en or (top 10% présence du mandat)
- Absent·e remarquable (bottom 10% présence du mandat)
- (etc. — cf `src/lib/badges.ts` actuel)

### InfoTip sur tous les badges

**Tous les badges** (carrière + mandat, anciens + nouveaux) doivent avoir un **InfoTip ⓘ** au hover qui explique :

- ce que mesure le badge
- le seuil d'attribution (e.g. "top 10% des députés de la 16e en taux de présence")
- la période / cohorte concernée

Cohérent avec ADR 0016 (qui posait déjà le principe pour Recomposition + Transfuge) et avec la **posture éditoriale Transparence** du projet (cf `CLAUDE.md`).

### Type côté code

```ts
type Personne = {
  // …
  mandats: Mandat[]
  carriere: CarriereAggregee
}

type Mandat = {
  // …
  stats: MandatStats
  rangs: MandatRangs
  badges: BadgeMandat[]
}

type MandatStats = {
  presence: { numerator: number; denominator: number; rate: number }
  participation: { numerator: number; denominator: number; rate: number }
  loyaute: { numerator: number; denominator: number; rate: number }
  frondes: { count: number; rate: number }
}

type MandatRangs = {
  presence: { rank: number; total: number }
  participation: { rank: number; total: number }
  loyaute: { rank: number; total: number }
  frondes: { rank: number; total: number }
}

type CarriereAggregee = {
  // mêmes champs que MandatStats, calculés sur la carrière
  // PAS de champ rangs (cf décision)
  badges: BadgeCarriere[]
}
```

Les `MandatStats` exposent **numerator + denominator + rate** plutôt que juste le taux, pour permettre le cumul carrière (qui repondère par les scrutins éligibles).

## Pourquoi

- **Vue carrière par défaut** : le côté Pokédex impose qu'on voit la **personne dans sa globalité** quand on arrive sur sa fiche. Les détails par mandat sont accessibles en un clic, pas masqués.
- **Cumul par moyenne pondérée et pas moyenne des moyennes** : si une personne a 100% présence sur 50 scrutins en 16e et 80% présence sur 1000 scrutins en 17e, sa présence carrière n'est pas `(100+80)/2 = 90%` mais bien `(50+800)/1050 ≈ 81%`. Plus juste, plus défendable.
- **Pas de rang carrière** : protection contre la fausse précision. Un rang implique une cohorte, et la cohorte multi-législature n'a pas de sens politique. Mieux vaut ne pas afficher que d'afficher quelque chose de mensonger.
- **Tabs `[Carrière] [16e] [17e]`** : pattern standard, lisible, ne nécessite pas d'apprentissage. L'ordre chronologique (carrière en premier puis ancien → récent) suit la convention timeline.
- **Distinction badges carrière vs badges mandat** : un badge "Top loyaliste 17e" est une info de cohorte 17e, le sortir de la vue mandat l'a déjà vu trop nuancé pour rester partout. Inversement, "Vétéran 3 législatures" est une info de carrière qui doit rester visible même quand on regarde un mandat spécifique.
- **InfoTip systématique** : le projet revendique la transparence (cf CLAUDE.md "InfoTips expliquent chaque métrique en français clair"). Étendre aux badges est cohérent.

## Conséquences

### Pipeline (Phase 1)

- `scripts/fetch-data.ts` calcule désormais :
  - Pour chaque mandat : `MandatStats` + `MandatRangs` + `BadgeMandat[]`
  - Pour chaque personne : `CarriereAggregee` (cumul des stats, calcul des badges carrière)
- Les rangs sont **strictement par législature** (la cohorte = tous les députés de cette législature)
- Le format compact des historiques (ADR 0012) reste tel quel, **par mandat**

### Frontend (Phase 1)

- `src/lib/components/DeputeCard.svelte` : nouveau prop `vue: 'carriere' | 'mandat'` + `mandat: Mandat | null`
  - En vue 'carriere' : pas de rang, pas de badges mandat
  - En vue 'mandat' : tout
- Nouveau composant `<MandatTabs>` (ou utiliser un pattern Svelte simple) : reçoit la `Personne` et émet le mandat sélectionné
- `<RankBadge>` (composant existant) : conditionné sur la vue
- `<InfoTip>` à généraliser pour wrapper les badges

### URL et état

- L'état "tab actif" est encodé dans l'URL (`/deputes/[id]/?leg=16` ou similaire) pour permettre le partage social (e.g. partager "regardez son mandat 16e")
- Le **par défaut** (sans paramètre) = vue carrière

### Limites assumées

- Les **rangs cumulés** ne sont jamais affichés. Un utilisateur curieux ("qui a la meilleure présence sur la carrière entière ?") n'aura pas la réponse directement — c'est volontaire (cf section Pourquoi).
- La **moyenne pondérée** peut être contre-intuitive si une personne a fait 1 mandat très court + 1 mandat plein : son cumul sera quasi égal au mandat plein. C'est le bon comportement (le mandat plein pèse plus parce qu'il a plus de scrutins) mais peut surprendre. L'InfoTip de la vue carrière doit l'expliquer.

### Compatibilité ADR existantes

- **ADR 0004** (frondeur exclut abstentions) : confirmé, s'applique par mandat
- **ADR 0005** (présence vs participation) : confirmé, s'applique par mandat ET en cumul (les deux sont affichés)
- **ADR 0006** (scrutins éligibles post-prise de fonction) : confirmé, le `denominator` de chaque `MandatStats` est `scrutinsEligibles` calculé selon ADR 0006
- **ADR 0012** (format tuple historique) : confirmé, par mandat

## Liens

- ADR `#0014` (pivot PolitiDex)
- ADR `#0015` (personne unique cross-législature)
- ADR `#0016` (multi-groupes — alignement contextuel pour le cumul loyauté)
- ADR `#0004` (frondeur exclut abstentions)
- ADR `#0005` (présence vs participation)
- ADR `#0006` (scrutins éligibles)
- `src/lib/components/DeputeCard.svelte` (à refactorer Phase 1)
- `src/lib/components/InfoTip.svelte` (à généraliser sur badges)
- `src/lib/badges.ts` (à étendre Phase 1)
- `src/lib/types.ts` (nouveaux types `MandatStats`, `MandatRangs`, `CarriereAggregee`)
