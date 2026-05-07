# 0028 — Sénat : triennat comme unité de regroupement (remplace session annuelle)

**Date** : 2026-05-06
**Statut** : accepté
**Tags** : data, scope, senat, ux, granularite-temporelle, classements

## Contexte

ADR 0023 a figé en début de Phase 3 Sénat la **session parlementaire annuelle** (sept→sept, identifiée par `sesann`) comme analogue de la législature AN — c'est-à-dire l'unité de regroupement servant à la fois pour les **fiches** (tabs sur la fiche du sénateur), la **navigation** (routes `/senat/sessions/[sesann]/`) et les **classements** (Le Championnat / Les Coupes par session).

À l'épreuve du design des fiches Sénat (PR B en cours), trois problèmes ont émergé :

1. **Trop d'onglets côté UI** : 20 sessions depuis 2006-2007 → fiche `[Carrière] [2024-2025] [2023-2024] [2022-2023] … [2006-2007]` illisible. Côté AN on avait 3 onglets de mandat (15ᵉ, 16ᵉ, 17ᵉ) — l'asymétrie est forte.
2. **Cohorte instable session par session** : un sénateur élu en septembre N siège sur la session N → N+1 ; ses stats annuelles sont fragiles vs un sénateur en milieu de mandat. Lissage par triennat plus représentatif.
3. **Pas d'unité de récit politique naturelle** : une session parlementaire annuelle n'a pas la densité narrative d'une législature. Un triennat (entre 2 renouvellements) correspond, lui, à une **vraie ère** du Sénat (composition figée sauf décès/démissions).

Le **triennat** — période de 3 ans entre deux renouvellements sénatoriaux consécutifs — apparaît comme un meilleur candidat. Il est l'unité **naturelle** du Sénat : entre deux renouvellements, la moitié des sièges qui vient d'être renouvelée siège tout du long, et l'autre moitié (renouvelée 3 ans plus tôt) aussi. La cohorte est strictement stable (sauf décès/démissions/vacances suppléées).

Une option **double niveau triennat/session** (tabs imbriqués) a été envisagée puis explicitement rejetée : trop d'impact UX pour peu d'intérêt utilisateur. La session reste une **brique data** sous-jacente (le pipeline parse par session) mais n'est plus exposée comme unité de regroupement.

Cohérent avec la posture éditoriale PolitiDex (cf `feedback_ux_avant_classement.md`) : on simplifie la navigation et la lecture des fiches au détriment de la granularité fine.

## Décision

**Le triennat sénatorial** est l'unité de regroupement principale Sénat. Il joue côté Sénat le rôle de la **législature côté AN** : navigation, fiches, classements, cohortes. La session annuelle demeure brique data interne, plus exposée en UI.

### Définition du triennat

Un triennat est la période s'écoulant entre **deux renouvellements sénatoriaux consécutifs** (séries 1 et 2 alternant tous les 3 ans). Bornes calées sur la **date du renouvellement** (généralement dernier dimanche de septembre).

### Libellé et identifiant technique

- **Libellé humain** : `2023-2026` (année de début → année de fin du triennat).
- **Identifiant technique** : `triennat: "2023-2026"` (string utilisée comme clé JSON, slug d'URL et id stable). Format : `${anneeDebut}-${anneeFin}`.

### Liste figée des 7 triennats couverts par PolitiDex (depuis 2006)

| Triennat | Renouvellement initial | Renouvellement de fin | Statut |
|---|---|---|---|
| `2006-2008` | (avant scope) | sept. 2008 (série 1) | Triennat tronqué, 2 ans seulement (point de départ data Sénat = oct. 2006) |
| `2008-2011` | sept. 2008 (série 1) | sept. 2011 (série 2) | Complet |
| `2011-2014` | sept. 2011 (série 2) | sept. 2014 (série 1) | Complet |
| `2014-2017` | sept. 2014 (série 1) | sept. 2017 (série 2) | Complet |
| `2017-2020` | sept. 2017 (série 2) | sept. 2020 (série 1) | Complet |
| `2020-2023` | sept. 2020 (série 1) | sept. 2023 (série 2) | Complet |
| `2023-2026` | sept. 2023 (série 2) | sept. 2026 (série 1) prévu | **En cours** (date de fin théorique 28 sept. 2026) |

Le triennat `2006-2008` est conservé en tant que **triennat tronqué historique** — il n'est pas renommé ni exclu, mais sa fenêtre effective (~2 ans) est documentée dans la FAQ et l'InfoTip.

### Rattachement des objets data

- **Scrutin → triennat** : par **date du scrutin**. Un scrutin appartient au triennat dont la fenêtre `[debut, fin)` contient sa date.
- **Mandat sénatorial → triennat(s)** : un mandat **chevauche** systématiquement 1 à 3 triennats. Le pipeline génère, pour chaque mandat, autant d'entrées de stats que de triennats sur lesquels il s'étend.
- **Session annuelle (`sesann`) → triennat** : 1 session ↔ 1 triennat parent (les sessions ne chevauchent pas les triennats puisque les renouvellements ont lieu en septembre, donc entre deux sessions).

### Stats sénateur par triennat

Les stats sénateur sont calculées **par triennat**, sur la **portion effective** du sénateur dans ce triennat (scrutins éligibles depuis prise de fonction jusqu'à fin de mandat ou fin de triennat, transposition directe d'ADR 0006). Un mandat complet (6 ans) génère 2 entrées triennales ; un mandat fragmenté (suppléant prenant la suite d'un démissionnaire) ou partiel (élu en cours, démissionnaire avant terme) peut en générer 1, 2 ou 3.

### Souplesse data : on garde aussi le grain session

Pour préserver la souplesse pour des évolutions futures (ex. trophée annuel, vue détaillée historique), le pipeline calcule **les deux niveaux** de stats :

- `triennatStats: Record<TriennatId, MandatStats>` — exposé en UI
- `sessionsStats: Record<sesann, MandatStats>` — calculé, présent dans la data, **pas exposé** en UI v1

Coût pipeline marginal (les deux dérivent du même flux de votes), bénéfice : on peut activer plus tard une vue session sans retoucher le pipeline.

### Routes et composants UI

- Composant `TriennatTabs.svelte` (et non `SessionTabs`) — pattern aligné sur `MandatTabs` AN.
- Ordre **antichronologique** dans les tabs : `[Carrière] [2023-2026 ⚡] [2020-2023] [2017-2020] …` — le triennat en cours porte un indicateur visuel (`⚡`).
- Routes : `/senat/triennats/[periode]/`, `/senat/groupes/[periode]/[code]/`. La forme du paramètre `[periode]` matche `^\d{4}-\d{4}$`.
- Le triennat **2023-2026** est marqué "en cours" dans les tabs et la FAQ.

## Pourquoi

- **Lisibilité fiche** : 7 onglets vs 20 — comparable au `[Carrière] [15e] [16e] [17e]` côté AN. Adopter le triennat ramène le grain de navigation Sénat à parité avec celui de l'AN.
- **Cohorte stable** : entre 2 renouvellements, la composition du Sénat est figée (sauf décès/démissions/suppléances). C'est la définition technique d'une cohorte. Une session annuelle, elle, peut commencer dans une composition et finir dans une autre (très rare mais possible avec démissions massives).
- **Récit politique naturel** : un triennat correspond à une "ère" du Sénat (ex. 2020-2023 = "Sénat sous Macron 1 finissant et Macron 2 débutant"). Aligné sur la posture éditoriale Football Manager + Pokédex.
- **Non-régression data** : le pipeline existant (sessions sept→sept) n'est pas réécrit, il est **agrégé** par triennat. La brique data session reste utilisable pour des features futures.
- **Refus du double niveau** : tabs imbriqués Triennat→Session augmentent la profondeur sans apporter de valeur — un utilisateur qui veut comparer 2024-2025 à 2023-2024 isolément n'est pas la cible Pokédex+FM. Cohérent avec `feedback_ux_avant_classement.md` (UX > sophistication).
- **Triennat tronqué 2006-2008 conservé** : exclure ou renommer aurait introduit une exception spécifique. Le garder comme tel, en l'expliquant via FAQ/InfoTip, préserve la régularité du modèle.

## Conséquences

### Architecture data

- Nouveau type `TriennatId = string` (format `"YYYY-YYYY"`) — ajouté à `src/lib/types.ts`.
- Nouveau type `Triennat` (métadonnées : `id`, `dateDebut`, `dateFin`, `serieRenouveleeDebut`, `serieRenouveleeFin`, `enCours: boolean`, `tronque: boolean`).
- Nouvelle table de référence figée `TRIENNATS: Triennat[]` dans `src/lib/political-order.ts` ou nouveau `src/lib/triennats.ts` (à trancher à l'implémentation).
- `Senateur.triennatStats: Record<TriennatId, MandatStats>` et `Senateur.sessionsStats: Record<sesann, MandatStats>` (les deux présents).
- `MandatSenat.triennats: TriennatId[]` (1 à 3 entrées).
- Helpers pipeline : `triennatOfDate(date)`, `triennatOfSesann(sesann)`, `sessionsOfTriennat(triennatId)`.
- Smoke-test étendu : assertion qu'un mandat complet 2017-2023 a bien 2 entrées `triennatStats` (`2017-2020` + `2020-2023`).

### Routes UI (mise à jour de NEXT_STEPS.md PR B/C/D)

- `/senat/triennats/[periode]/` (remplace `/senat/sessions/[sesann]/`)
- `/senat/groupes/[periode]/[code]/`
- Composant `TriennatTabs.svelte` (remplace l'idée de `SessionTabs.svelte`)

### Classements

- Le Championnat / Les Coupes Sénat sont **par triennat** (pas par session).
- Volume centile 95 pour Overall Sénat : calculé **par triennat** (cohérent ADR 0022). La calibration précise du score Overall pour le Sénat est **différée** (cf `NEXT_STEPS.md` § PR D — UX first, score plus tard).

### FAQ

- Section `📍 Sénat` enrichie avec ancres `#senat-triennat`, expliquant la définition, la durée, le cas du triennat tronqué `2006-2008`, et le rattachement des stats.

### ADR liées

- **ADR 0023 partiellement remplacée** sur le volet "granularité temporelle" (le reste — scope exhaustif depuis 2006, pas de fusion bicamérale en v1, pipeline séparé — reste en vigueur). Le bandeau "à réviser" d'ADR 0023 est remplacé par un renvoi vers l'ADR 0028 dans son statut.
- **ADR 0006** (scrutins éligibles post-prise de fonction) : transposée naturellement, un sénateur n'est compté que sur les scrutins de sa portion effective dans chaque triennat.
- **ADR 0017** (stats par mandat / cumul carrière sans rang) : le triennat occupe la place du mandat dans cette ADR pour le Sénat. Carrière = cumul des triennats, sans rang carrière.
- **ADR 0022** (formule Overall) : applicable, mais la **recalibration éventuelle** des pondérations pour le Sénat est différée à PR D ou plus tard.

### Limitations acceptées

- Triennat `2006-2008` n'a que ~2 ans de scrutins effectifs (point de départ data Sénat = octobre 2006). Documenté en FAQ.
- Une réforme constitutionnelle qui changerait la durée du mandat sénatorial ou le rythme de renouvellement invaliderait le modèle. Risque accepté : on adaptera l'ADR le moment venu, ce n'est pas à l'agenda.
- Le triennat est **calé sur la France métropolitaine + outre-mer + Français de l'étranger** (rythme constitutionnel commun). Pas d'enjeu spécifique connu.

### Garde anti-régression

Smoke-test étendu (PR A doit être complétée ou la PR B doit ajouter ces assertions) :

- Liste des 7 triennats trouvée et figée
- Un sénateur élu en 2017 et finissant en 2023 a `triennatStats` sur `2017-2020` et `2020-2023` (et seulement sur ces deux-là)
- Un scrutin daté du 15 septembre 2023 (avant renouv.) appartient à `2020-2023` ; un scrutin du 30 septembre 2023 appartient à `2023-2026`
- `Object.keys(senateur.triennatStats)` ⊆ liste des 7 triennats
- Un sénateur dont le mandat a été fragmenté (titulaire + suppléant) totalise les bonnes portions de scrutins éligibles cumulés sur ses triennats

## Liens

- ADR `#0023` (scope Phase 3 Sénat — granularité temporelle remplacée par #0028, reste en vigueur sur scope/sources/pipeline séparé)
- ADR `#0006` (scrutins éligibles post-prise de fonction — transposée par triennat)
- ADR `#0017` (stats par mandat / cumul carrière sans rang — triennat = mandat côté Sénat)
- ADR `#0022` (formule Overall — applicable, recalibration Sénat différée)
- ADR `#0027` (délégations de vote ignorées — sémantique présence côté Sénat)
- `src/lib/types.ts` (nouveaux types `TriennatId`, `Triennat`)
- `src/lib/political-order.ts` ou `src/lib/triennats.ts` (table figée des 7 triennats)
- `scripts/fetch-data-senat.ts` (agrégation par triennat à ajouter)
- `scripts/smoke-test-senat.ts` (assertions de garde à étendre)
- `NEXT_STEPS.md` § Phase 3 Sénat (PR B/C/D mises à jour)
- [Constitution française, art. 24](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000019241069) (composition du Sénat, mandat 6 ans)
- [Code électoral, L. 290 et suivants](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070239/LEGISCTA000006148443/) (séries de renouvellement)
