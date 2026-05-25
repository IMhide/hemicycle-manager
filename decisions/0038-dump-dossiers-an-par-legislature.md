# 0038 — Un dump dossiers Etalab par législature (pas seulement le 17ᵉ)

**Date** : 2026-05-25
**Statut** : accepté
**Tags** : data, pipeline, AN, dossiers, navette

## Contexte

Le pipeline AN téléchargeait depuis le début un seul dump de dossiers parlementaires Etalab : `repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`. On supposait que ce dump couvrait l'historique cross-législature.

En réalité, **chaque législature publie son propre dump centré sur sa législature** :

| Dump | Dossiers 15ᵉ | Dossiers 16ᵉ | Dossiers 17ᵉ |
|---|---|---|---|
| `repository/15/.../Dossiers_Legislatifs_XV.json.zip` | **4 263** | 0 | 0 |
| `repository/16/.../Dossiers_Legislatifs.json.zip` | 99 | **2 314** | 0 |
| `repository/17/.../Dossiers_Legislatifs.json.zip` | 64 | 87 | **2 354** |

Le dump 17ᵉ ne contient que ~150 dossiers d'anciennes législatures (ceux ré-examinés en navette), pas les milliers de dossiers propres à la 15ᵉ ou à la 16ᵉ.

Symptôme révélateur : la fiche `/textes/sig-16|proposition-loi|...|ratp` affichait la loi sur l'ouverture à la concurrence du réseau de bus francilien de la RATP comme **« en cours »** alors qu'elle est promulguée depuis le 28 décembre 2023 (loi n° 2023-1269). La cause : le dossier `DLR5L16N48696` est dans le dump 16ᵉ, pas dans le dump 17ᵉ → notre pipeline ne l'avait jamais vu → les 22 scrutins étaient agrégés en bucket signature `sig-` au lieu de DLR officiel → pas de `senatUrl` → pas de matching cross-chambre → état par défaut `en-cours`.

Mesures avant fix :
- 736 / 961 textes AN étaient des `sig-*` non enrichis
- 15ᵉ : 99,2% non enrichis (512 / 516)
- 16ᵉ : 89,8% non enrichis (219 / 244)
- 17ᵉ : 2,5% non enrichis (5 / 201) — la seule législature correctement couverte

## Décision

`scripts/fetch-data.ts` télécharge **un dump dossiers par législature couverte** (15ᵉ + 16ᵉ + 17ᵉ), les extrait dans 3 répertoires distincts du cache, et fusionne les résultats de `parseDossiersDir` en dédupliquant par `dossierUid` et en faisant l'union des `reunionToDossierIds`.

Convention de nom alignée sur `sourceScrutins` : la 15ᵉ utilise le suffixe romain `_XV` (`Dossiers_Legislatifs_XV.json.zip`), les autres législatures utilisent `Dossiers_Legislatifs.json.zip`.

## Pourquoi

- **Couverture data** : le dump 17ᵉ seul rend invisible 731 textes des 15ᵉ et 16ᵉ législatures. Pour un projet "Pokédex des élus nationaux" couvrant toute l'ère Macron, c'est inacceptable.
- **Cascade fiabilisée** : un texte enrichi via le dump dossiers récupère son `dossierRef` DLR officiel, son `senatUrl`, ses initiateurs, sa procédure, ses dates, sa timeline navette. La cascade `seanceRef↔reunionRef` (méthode Poligraph, ADR 0035) ne peut faire son travail que si le dossier est dans l'index `reunionToDossierIds`.
- **Matching cross-chambre** : sans `senatUrl` côté AN, le niveau 1 du matching `matchTextesAnSenat` (ADR 0036) ne peut pas lier le texte AN à son équivalent Sénat. D'où des centaines de textes affichés `bicameral: false` à tort.
- **État unifié** : la cascade `deriveEtatUnifie` (textes-unifies.ts) accorde priorité 1 au `etat=promulgue` côté Sénat. Sans le lien cross-chambre, on retombait sur la priorité 4 par défaut (`en-cours`).
- **Dédup propre** : les 148 dossiers présents dans plusieurs dumps (intersections) sont strictement identiques (même titre, même `senatUrl`, même timeline). Un simple `Map<uid, DossierAN>` suffit, premier ou dernier gagnant sans différence.
- **Coût négligeable** : 2 dumps supplémentaires (~17 MB total), cache HTTP conditionnel ADR 0021 → warm-run ne re-télécharge rien. Cold-run : +5 s sur les ~12-15 min totales.

## Conséquences

**Impact immédiat (mesuré sur datasets 2026-05-25)** :

| Mesure | Avant | Après |
|---|---|---|
| Textes AN totaux | 961 | 842 |
| Textes AN enrichis (DLR) | 225 (23,4%) | 805 (95,6%) |
| Textes AN `sig-*` | 736 | 37 |
| Matches AN↔Sénat | 177 | 191 |
| `TexteUnifie` bicaméraux | 177 | 563 |

La baisse de 961 → 842 vient de la fusion : des `sig-` qui pointaient en réalité vers le même dossier officiel (ratp, etc.) sont désormais regroupés sous leur DLR commun.

**Smoke test acteurs-noms relâché** : le dump AMO30 historique AN ne contient pas les sénateurs jamais devenus députés/ministres (3 114 acteurs vs 15 000+ attendus si on incluait tous les sénateurs). Avec le fix, on rattache désormais des dossiers Sénat-first transmis à l'AN qui listent des sénateurs comme initiateurs. Au total 1 seul PA-id orphelin (PA429842, sénateur initiateur de la PPL Répression des entraves aux libertés, 15ᵉ). Le check passe de "strict 0" à "≤ 5 tolérés" — c'est une limite acceptée du périmètre AMO30, pas du fix.

**Point d'attention futur** : Etalab publiera un dump 18ᵉ à la prochaine législature. Le pipeline boucle déjà sur `LEGISLATURES`, donc il suffira d'ajouter `18` à la constante pour que le nouveau dump soit fetché automatiquement. Si la 18ᵉ revient à la convention romaine `_XVIII`, il faudra étendre `sourceDossiers` (idem `sourceScrutins`).

## Liens

- `scripts/fetch-data.ts` — `sourceDossiers(leg)`, boucle download/extract, fusion `parseDossiersDir`
- `scripts/lib/dossiers-an.ts:261` — `parseDossiersDir` (inchangée)
- `scripts/lib/textes-an.ts:229` — cascade `aggregeTextesAN`
- `scripts/lib/textes-cross-chambre.ts:177` — matching AN↔Sénat dépendant du `senatUrl`
- `scripts/lib/textes-unifies.ts:139` — cascade `deriveEtatUnifie`
- ADR liées : [#0035](0035-agregation-scrutins-en-textes-legislatifs.md), [#0036](0036-texte-unifie-cross-chambre.md), [#0037](0037-timeline-navette-actes-legislatifs.md)
- Sources Etalab : `https://data.assemblee-nationale.fr/static/openData/repository/{15,16,17}/loi/dossiers_legislatifs/`
