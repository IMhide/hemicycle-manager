# 0035 — Agrégation des scrutins en « textes législatifs »

**Date** : 2026-05-12
**Statut** : accepté
**Tags** : data, agrégation, AN, scrutins, textes

## Contexte

Sur la 17ᵉ législature, l'ensemble d'un projet ou d'une proposition de loi
peut générer plusieurs centaines de scrutins (le PLF 2026 en a 925, la PPL
"droit à l'aide à mourir" 542, la PPL "renforcer la sécurité…" 99). Chacun
de ces scrutins porte un titre individuel ("l'amendement n°X de M. Y à
l'article Z **du projet de loi de finances pour 2026**…").

Sans regroupement, l'historique de vote d'un député affiche autant de
lignes que de scrutins, ce qui rend la lecture journalistique impossible
("comment ce député s'est-il positionné sur le PLF 2026 ?" devient noyé
dans 925 amendements).

Etalab fournit deux flux qui auraient pu nous aider :

1. Le champ `objet.dossierLegislatif.dossierRef` sur chaque scrutin —
   mesuré à **10,8 % de couverture** sur la 17ᵉ (703 / 6 530 scrutins).
2. Le dump `Dossiers_Legislatifs.json.zip` — mesuré : il ne référence en
   pratique que **les votes solennels** d'un texte (PLF 2026 : 7 scrutins
   listés sur 925 ; loi sécurité : 1 sur 101). Inutilisable pour rattacher
   les amendements.

## Décision

On définit un nouvel objet de données `Texte` (cf `src/lib/types.ts`) qui
agrège tous les scrutins relatifs à un même texte législatif. Le rattachement
des scrutins suit une **cascade à trois niveaux** :

1. **Source d'autorité — `seanceRef` ↔ `reunionRef`** (méthode inspirée de
   [Poligraph](https://github.com/ironlam/poligraph)) : on indexe tous les
   `reunionRef` trouvés dans l'arbre `actesLegislatifs` de chaque dossier
   législatif, puis pour chaque scrutin on lit son `seanceRef` (toujours
   présent) et on regarde quel(s) dossier(s) référencent cette séance.
   - Si 1 seul dossier candidat : match direct → id DLR officiel.
   - Si plusieurs dossiers candidats (séance traitant plusieurs textes) :
     désambiguïsation par comparaison du titre du scrutin avec le titre des
     dossiers candidats (mots significatifs en commun, ≥ 2 mots > 4 caractères,
     gagnant unique).
2. **Fallback 1 — `dossierRef` côté scrutin** : utilisé si la cascade `seanceRef`
   ne tranche pas (rare).
3. **Fallback 2 — signature parser titre** : extraction par regex sur la
   séquence `<type de texte> <nom du texte>` du titre du scrutin (cf
   `scripts/lib/texte-parser.ts`). Couvre les motions, séances orphelines.

L'id final d'un `Texte` est :
- soit un `dossierRef` Etalab (ex. `DLR5L17N53284`) — pour les textes rattachés
  via niveau 1 ou 2 ;
- soit une signature synthétique préfixée `sig-<legislature>|<type>|<nom>` —
  pour les textes du niveau 3.

Les motions de censure, suspensions de séance et déclarations gouvernementales
ne sont **pas** des textes législatifs au sens strict et ont `texteId: null`
côté scrutin. Sur 15 052 scrutins (15ᵉ+16ᵉ+17ᵉ) : 99,3 % rattachés à un
texte, 99 scrutins légitimement orphelins.

Le dump `Dossiers_Legislatifs.json.zip` est utilisé à deux fins :
1. fournir l'index `reunionRef → dossierUid` (niveau 1 de la cascade) ;
2. enrichir les textes (titre officiel propre, code procédure, PA-ids
   initiateurs, dates de timeline) pour les textes dont l'id est un DLR.

## Pourquoi

- **`seanceRef↔reunionRef` est la source la plus fiable.** Mesuré sur 6 530
  scrutins 17ᵉ : 59,3 % match unique, 24,3 % désambiguïsés par titre = **83,7 %
  des scrutins rattachés à un DLR officiel**, contre 11 % avec le seul
  `dossierRef` côté scrutin. Étant donné que le champ `seanceRef` est rempli
  sur 100 % des scrutins Etalab, c'est une vraie clé structurée.
- **La désambiguïsation par titre est nécessaire** car la même séance peut
  traiter plusieurs textes (PLF + loi organique de report, par exemple). On
  combine type+titre du scrutin et titre du dossier, comptage des mots
  significatifs (≥ 4 caractères) communs. Seuil ≥ 2 mots, gagnant unique.
- **Le `dossierRef` côté scrutin reste un fallback utile** quand `seanceRef`
  ne suffit pas et que `dossierRef` est rempli (rare, mais possible).
- **Le parser titre signature** sert de dernier filet pour les motions, séances
  orphelines, scrutins de procédure. Sans lui, on perdrait 16 % des scrutins.
- **La signature inclut la législature** dans la clé pour éviter de fusionner
  un texte 16ᵉ et un texte 17ᵉ portant un nom similaire.
- **Une `Loi` n'est pas un `Texte`** : un texte peut être adopté, rejeté,
  retiré, jamais voté. Le vocabulaire "Loi" est trompeur. On utilise
  systématiquement **`Texte`** dans le code et dans l'UI.

## Conséquences

- **Pipeline** : étape supplémentaire de download/parse du dump dossiers (+9 MB,
  cache HTTP conditionnel, ~2 s ajoutés en cold start, 0 en warm). Construction
  de l'index `reunionRef → Set<dossierUid>` lors du parse (1 511 réunions 17ᵉ).
- **Stockage** : nouveau fichier `static/data/textes.json` (~ 1 MB), un champ
  `texteId: string | null` ajouté à chaque `ScrutinIndex` et `ScrutinDetail`.
- **Couverture mesurée** :
  - 99,3 % des scrutins ont un `texteId`
  - **48,6 % des scrutins** rattachés à un DLR officiel (vs ~11 % avec
    `dossierRef` seul = × 4,4)
  - **23,4 % des textes (225/961)** enrichis par le dump dossiers (titre
    officiel, procédure, initiateurs, date de promulgation) — vs 3 % avant le
    matching `seanceRef`
  - **92 textes promulgués** identifiés sur 15+16+17
- **UI à venir** : permettre le regroupement de l'historique de vote d'un
  député par texte, et créer une route `/assemblee/textes/[id]/`.
- **Pas de symétrie Sénat dans cette ADR** — le pipeline Sénat utilise une
  source différente (`dosleg.zip`) et la sémantique des scrutins diffère
  (titres en "sur l'amendement n°X…"). Une ADR séparée traitera le Sénat.

## Liens

- Code : `scripts/lib/texte-parser.ts`, `scripts/lib/dossiers-an.ts`,
  `scripts/lib/dossiers-reunions.ts`, `scripts/lib/textes-an.ts`,
  `scripts/fetch-data.ts`
- Type : `Texte` dans `src/lib/types.ts`
- Tests : `scripts/lib/texte-parser.test.ts` (22), `dossiers-an.test.ts`
  (25), `dossiers-reunions.test.ts` (8), `textes-an.test.ts` (18),
  `scripts/smoke-test.ts` (17 cas canoniques sur les textes)
- Inspiration : [Poligraph](https://github.com/ironlam/poligraph) pour la
  méthode `seanceRef↔reunionRef`
- ADR liées : #0015 (modèle Personne unique), #0017 (stats cumul), #0021
  (cache HTTP conditionnel)
- Source : https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip
