# 0036 — Objet `TexteUnifie` cross-chambre + fiche `/textes/[id]`

**Date** : 2026-05-13
**Statut** : accepté
**Tags** : data, cross-chambre, navette, routes, sémantique

## Contexte

Les jalons N3.a, N3.b et N3.c (cf handoff
`2026-05-12_23-27-35_navette-cross-chambre-an-senat`) ont mis en place :

1. **N3.a** — exposition du `senatUrl` côté `Texte` AN
2. **N3.b** — agrégation des scrutins Sénat en `TexteSenat` (id = `loicod`)
3. **N3.c** — matching bidirectionnel `Texte.versionAutreChambre` ↔
   `TexteSenat.versionAutreChambre` (86 paires identifiées sur l'ère Macron)

Reste l'étape N3.d : permettre à un utilisateur de **lire l'intégralité du
parcours d'un texte** (parcours navette AN ↔ Sénat) **depuis une seule URL**
sans avoir à naviguer entre `/assemblee/textes/[id]` et `/senat/textes/[id]`.

C'est aussi la cohérence de l'architecture cross-chambre figée par ADR 0030
(routes par chambre + hub) : les élus ont déjà `/elus/[id]` comme fiche
canonique cross-chambre, les textes méritent la même chose.

## Décision

On introduit un objet **`TexteUnifie`** (cf `src/lib/types.ts`) et une route
racine **`/textes/[id]`** qui présente la fiche unifiée d'un texte législatif
en agrégeant les données AN et Sénat dans une seule page (wireframe deux
colonnes côte à côte AN | Sénat, validé 2026-05-13).

**Source d'autorité par champ** (résolution déterministe pour un texte
bicaméral) :

| Champ | Source prioritaire | Fallback |
|---|---|---|
| `id` canonique | id AN (`DLR…`/`sig-…`) si présent | id Sénat (`loicod`) |
| `titre` | `Texte.titre` AN (libellé canonique court Etalab) | `TexteSenat.titre` Sénat |
| `type` éditorial | `Texte.type` AN (`TexteType` plus expressif) | projection depuis `TexteSenat.type` |
| `initiateurs` | `Texte.initiateurs` AN (PA-ids exposés) | vide (Sénat ne fournit pas) |
| `procedureLibelle` | `Texte.procedureLibelle` AN | null |
| `numeroLoi` | `TexteSenat.numeroLoi` (dosleg dispose) | null si AN seul |
| `datePromulgation` | `TexteSenat.datePromulgation` | `Texte.datePromulgation` |
| `urlJO` | `TexteSenat.urlJO` (Légifrance via dosleg) | null |
| `senatUrl` | `Texte.senatUrl` (extrait dump dossiers AN) | null |
| `dateDebut` | min(`Texte.dateDebut`, `TexteSenat.dateDebut`) | celui de la chambre présente |
| `dateFin` | max(`Texte.dateFin`, `TexteSenat.dateFin`) | celui de la chambre présente |
| `etatGlobal` | dérivé par cascade (cf ci-dessous) | — |

**Cascade `etatGlobal`** (du plus avancé au moins avancé) :
1. `promulgue` si `datePromulgation` non-null OU `TexteSenat.etat === 'promulgue'`
2. `rejete` si l'une des chambres a `etat === 'rejete'` OU
   `sortFinal === 'rejeté'` côté AN (Sénat n'utilise pas le champ équivalent)
3. `retire` ou `caduc` si le Sénat en témoigne et l'AN ne contredit pas
4. `en-cours` sinon

L'**id canonique** est conçu pour être stable : un texte bicaméral est
toujours servi via son id AN, ce qui permet de réutiliser les liens existants
(les routes chambre `/assemblee/textes/[id]` et `/senat/textes/[id]` restent
en place comme vues spécifiques).

**Routes** :
- `/textes/` (liste cross-chambre) — symétrique de `/elus/`
- `/textes/[id]` (fiche unifiée) — accepte l'id AN ou Sénat, résout vers l'id
  canonique en interne pour le rendu

Les routes `/assemblee/textes/` et `/senat/textes/` restent inchangées
(vues chambre-spécifiques, conformément à ADR 0030).

## Pourquoi

- **Une seule URL canonique par texte** : un dossier législatif n'est qu'une
  entité dans la réalité parlementaire (même si elle traverse deux chambres).
  La séparation AN/Sénat est un détail d'implémentation lié à nos sources.
- **AN prioritaire sur le titre** car les `Texte.titre` viennent du dump
  `Dossiers_Legislatifs.json` Etalab (canoniques courts type "Démocratiser
  le sport en France"), alors que `loi.loitit` Sénat insère du bruit navette
  ("proposition de loi, adoptée par l'Assemblée nationale après engagement
  de la procédure accélérée, visant à démocratiser le sport en France").
- **Sénat prioritaire sur la promulgation** car le dump dosleg expose
  `loi.loidatjo` (date JO) et `loi.url_jo` (Légifrance), tandis que l'AN ne
  les exporte pas directement dans `Dossiers_Legislatifs.json`. La signature
  de la loi se fait par le Président de la République mais le Sénat la
  consigne plus fidèlement dans ses tables.
- **Manifest pré-calculé `textes-unifies.json`** plutôt que fusion à la volée
  côté frontend : ~1500 entrées, calcul UNE FOIS au build, frontend léger.
  Pattern symétrique au manifest `elus.json` (ADR 0031).
- **Wireframe deux colonnes** plutôt que tabs/onglets : narration directe de
  la navette, comparaison AN vs Sénat lisible en un coup d'œil. Pour les
  ~90% de textes mono-chambre, encart explicite "Pas examiné au Sénat" (ou
  inverse) sur la colonne vide.

## Conséquences

- **Pipeline** : nouvel output `static/data/textes-unifies.json`
  (~1500 entrées, ~800 KB). Construit par `scripts/build-cross-chambre.ts`
  étendu (utilise déjà la cascade de matching N3.c).
- **Type public** : nouvelle interface `TexteUnifie` dans `src/lib/types.ts`,
  avec un sous-objet `{ an: { texteId, ... } | null, senat: { texteId, ... } | null }`
  pour préserver l'accès aux deux côtés.
- **Routes** :
  - `/textes/` et `/textes/[id]` ajoutées
  - Carte "Textes législatifs" sur la home (`/+page.svelte`)
  - Routes chambre `/assemblee/textes/*` et `/senat/textes/*` inchangées
- **Mono-chambre** : ~90% des `TexteUnifie` n'ont qu'un seul côté rempli
  (AN-seul ou Sénat-seul). Pour ces cas, la colonne vide affiche un encart
  explicite type "Pas examiné au Sénat" / "Pas encore examiné à l'AN".
- **Limitations connues** :
  - Le matching reste à 86 paires bicamérales (couverture des datasets
    actuels, cf N3.c). Le total `TexteUnifie` est donc ~ `961 + 571 - 86 = 1446`.
  - La timeline navette ne reconstruit pas automatiquement toutes les étapes
    intermédiaires (1ère lect / 2ᵉ / nouvelle lect / CMP) ; le composant
    `TimelineNavette.svelte` affiche les 5 jalons principaux : Dépôt → 1ère
    lect AN → 1ère lect Sénat → CMP/lect.défin. → Promulgation, basés sur
    les dates des votes solennels présents dans chaque chambre.
- **Mot "Loi" vs "Texte"** : on garde **"Texte"** comme terme canonique
  (routes `/textes/`, libellés UI), aligné sur ADR 0035. "Loi" est réservé
  aux textes effectivement promulgués (`numeroLoi`, `datePromulgation`).

## Liens

- Type : `TexteUnifie` dans `src/lib/types.ts`
- Code :
  - `scripts/lib/textes-unifies.ts` (fusion AN+Sénat, tests TDD)
  - `scripts/build-cross-chambre.ts` (étendu pour produire le manifest)
  - `src/routes/textes/+page.svelte` (liste cross-chambre)
  - `src/routes/textes/[id]/+page.svelte` (fiche unifiée 2 colonnes)
  - `src/lib/components/TimelineNavette.svelte` (bandeau chronologique)
- Données : `static/data/textes-unifies.json`
- ADR liées : #0030 (routes hub), #0031 (manifest élus, pattern symétrique),
  #0035 (sémantique Texte AN), N3.a/b/c (jalons précédents navette)
- Handoff : `thoughts/shared/handoffs/general/2026-05-12_23-27-35_navette-cross-chambre-an-senat.md`
