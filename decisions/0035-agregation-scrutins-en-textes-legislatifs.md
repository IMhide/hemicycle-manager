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
des scrutins suit deux niveaux :

1. **Clé primaire** = `dossierRef` Etalab côté scrutin quand connu
   (couverture ~11 %)
2. **Clé secondaire** = signature stable extraite du **titre du scrutin** par
   regex sur la séquence `<type de texte> <nom du texte>` (cf
   `scripts/lib/texte-parser.ts`) — couvre 99,5 % des scrutins.

Quand un scrutin avec `dossierRef` partage la même signature qu'un scrutin
sans `dossierRef`, ils sont regroupés sous l'id `dossierRef` (le scrutin avec
ref prime). L'id final d'un `Texte` est :

- soit un `dossierRef` Etalab (ex. `DLR5L17N53284`)
- soit une signature synthétique préfixée `sig-<legislature>|<type>|<nom>`

Les motions de censure, suspensions de séance et déclarations gouvernementales
ne sont **pas** des textes législatifs au sens strict et ont `texteId: null`
côté scrutin. Sur 15 052 scrutins (15ᵉ+16ᵉ+17ᵉ) : 99,3 % rattachés à un
texte, 99 scrutins légitimement orphelins.

Le dump `Dossiers_Legislatifs.json.zip` reste téléchargé pour **enrichir** les
textes dont l'id correspond à un `dossierRef` (titre officiel propre, code
procédure, PA-ids initiateurs, date de promulgation). Les textes dont l'id
est une signature gardent le titre extrait du parser.

## Pourquoi

- **Le parser titre suffit comme clé d'agrégation.** Mesuré sur 6 530
  scrutins 17ᵉ : 99,5 % de couverture, 0 collision quand on croise avec les
  32 `dossierRef` officiels disponibles. C'est la stratégie la moins chère
  et la plus complète.
- **Le `dossierRef` reste prioritaire** quand il existe parce qu'il garantit
  un identifiant stable cross-build et permet l'enrichissement par le dump
  dossiers.
- **Pas d'heuristique de matching titre↔dossier en v1.** Sur les 449 dossiers
  17ᵉ dont le titre est juste l'objet ("Renforcer la sécurité"), une seconde
  passe de matching pourrait élargir l'enrichissement, mais introduit du bruit
  et des faux positifs. On reporte cette feature à une PR ultérieure.
- **La signature inclut la législature** dans la clé pour éviter de fusionner
  un texte 16ᵉ et un texte 17ᵉ portant un nom similaire.
- **Une `Loi` n'est pas un `Texte`** : un texte peut être adopté, rejeté,
  retiré, jamais voté. Le vocabulaire "Loi" est trompeur. On utilise
  systématiquement **`Texte`** dans le code et dans l'UI.

## Conséquences

- **Pipeline** : nouvelle étape de download/parse du dump dossiers (+9 MB,
  cache HTTP conditionnel, ~2 s ajoutés en cold start, 0 en warm)
- **Stockage** : nouveau fichier `static/data/textes.json` (~ 1 MB), un champ
  `texteId: string | null` ajouté à chaque `ScrutinIndex` et `ScrutinDetail`
- **Couverture** : 99,3 % des scrutins ont un texteId ; 3 % des textes sont
  enrichis par le dump dossiers (les ~30 dossiers ayant été correctement
  référencés côté scrutin par Etalab). À élargir si nécessaire pour l'UI.
- **UI à venir** : permettre le regroupement de l'historique de vote d'un
  député par texte, et créer une route `/assemblee/textes/[id]/` plus tard.
- **Pas de symétrie Sénat dans cette ADR** — le pipeline Sénat utilise une
  source différente (`dosleg.zip`) et la sémantique des scrutins diffère
  (titres en "sur l'amendement n°X…"). Une ADR séparée traitera le Sénat.

## Liens

- Code : `scripts/lib/texte-parser.ts`, `scripts/lib/dossiers-an.ts`,
  `scripts/lib/textes-an.ts`, `scripts/fetch-data.ts`
- Type : `Texte` dans `src/lib/types.ts`
- Tests : `scripts/lib/texte-parser.test.ts` (22), `dossiers-an.test.ts`
  (25), `textes-an.test.ts` (13), `scripts/smoke-test.ts` (17 cas canoniques
  sur les textes)
- ADR liées : #0015 (modèle Personne unique), #0017 (stats cumul), #0021
  (cache HTTP conditionnel)
- Source : https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip
