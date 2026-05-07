# 0024 — Identifiant stable Sénat = `Matricule`

**Date** : 2026-05-06
**Statut** : accepté
**Tags** : data, identité, pipeline, senat

## Contexte

Symétrique à ADR 0018 côté AN. Pour pouvoir réconcilier identité et votes côté Sénat, il faut une clé stable cross-source. Trois sources Sénat exposent une clé candidate :

| Source | Champ candidat | Format observé |
|---|---|---|
| `senat.fr/api-senat/senateurs.json` | `matricule` | `08061X` (6 chars) |
| `data.senat.fr/data/senateurs/ODSEN_GENERAL.json` | `Matricule` | `08061X` (6 chars), `83008P`, `000346` (5 chars padded) |
| `data.senat.fr/data/senateurs/ODSEN_HISTOGROUPES.csv` | `Matricule` | idem |
| `data.senat.fr/data/senateurs/ODSEN_ELUSEN.csv` | `Matricule` | idem |
| `dosleg.zip` table `auteur` | `autmat` | idem |
| `dosleg.zip` table `votsen` (1.62M votes) | `senmat` | idem |

Sondage empirique au début de Phase 3 : tous les champs ci-dessus emploient **strictement le même format** pour un sénateur donné (vérifié sur Patriat `08061X`, Larcher `86034E`, anciens `83008P`/`000346`). Aucune table de correspondance à maintenir.

> Question : adopter le matricule tel quel comme clé d'identité, ou normaliser (zero-padding, suppression suffixe lettre) ?

## Décision

La clé d'identité cross-source côté Sénat est le **matricule** tel que publié, **sans normalisation** :

- Format brut, longueur 5-6 caractères, alphanumérique (ex. `08061X`, `83008P`, `000346`)
- `Senateur.id = matricule`
- Route : `/senat/senateurs/[matricule]/`
- Fichier historique : `static/data/senat/historique/{matricule}.json`

## Pourquoi

- **Identité interne pérenne du Sénat** : le matricule est l'identifiant administratif unique d'un sénateur, attribué à vie (ne change pas s'il quitte puis revient au Sénat). Équivalent fonctionnel du PA-id de l'AN (cf ADR 0018).
- **Strictement identique entre toutes les sources Sénat** : aucune normalisation requise — le pipeline lit le matricule comme une string opaque, ce qui élimine les bugs de matching liés à des conventions divergentes.
- **Le champ `senmat` de `votsen` (1.62M votes) utilise la même clé** : pas de table de correspondance à maintenir, le rapprochement vote ↔ identité est trivial.
- **Conserver le format brut** (sans zero-padding ni suppression de suffixe) garantit que toute requête future vers `data.senat.fr` ou `senat.fr` réussira sans transformation, et que les liens de retour vers les sources publiques (`senat.fr/senateur/{nom}_{prenom}{matricule}.html`) restent valides — la route officielle utilise le matricule en suffixe (ex. `https://www.senat.fr/senateur/patriat_francois08061x.html`).

## Conséquences

### Architecture

- `Senateur.id: string` (typé string brut, pas number ni format imposé)
- Loader : `loadSenateur(fetchFn, matricule)` accepte la string brute
- Pas de `normalizeMatricule` côté pipeline — on lit, on indexe, on stocke

### Espace d'IDs disjoint avec l'AN

- AN PA-id : format `PA{n}` (ex. `PA719930`)
- Sénat matricule : 5-6 chars alphanumériques
- **Aucun chevauchement possible** entre les deux espaces
- Le smoke-test (assertion 33 du `smoke-test-senat.ts`) vérifie explicitement que les id sets sont disjoints — garde-fou anti-fusion accidentelle tant que Phase 3c n'a pas posé sa propre politique de matching cross-chambre

### Limites assumées

- Si une personne est à la fois députée et sénatrice (ex. Habib, ex-député AN PA1592 puis sénateur si jamais c'était le cas), elle apparaît **deux fois** dans PolitiDex tant que Phase 3c n'a pas implémenté la fusion. C'est documenté dans la FAQ Sénat.
- Les anciens matricules à 5 chars padded (`000346`) doivent être préservés tels quels — pas de strip des zéros leadings, pas de uppercase forcé.

## Liens

- ADR `#0018` (identifiant stable AN — PA-id, schéma symétrique)
- ADR `#0023` (Phase 3 Sénat scope — la fusion bicamérale est différée à Phase 3c)
- ADR `#0025` (priorité de sources Sénat — les trois sources partagent la même clé `matricule`)
- `src/lib/types.ts` (type `Senateur.id: string`)
- [data.senat.fr — Notice ODSEN_GENERAL](https://data.senat.fr/les-senateurs/)
