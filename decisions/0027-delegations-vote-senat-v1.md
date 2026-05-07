# 0027 — Délégations de vote au Sénat : ignorées en v1

**Date** : 2026-05-06
**Statut** : accepté
**Tags** : sémantique, métriques, senat, v1, à-revisiter

## Contexte

Le Sénat dispose d'un mécanisme institutionnel de **délégation de vote** : un sénateur qui ne peut être présent peut donner sa délégation à un collègue, qui votera "au nom de" l'absent. Le système est codifié dans le règlement du Sénat et n'a pas d'équivalent direct côté AN (où un député absent est juste absent).

Côté donnée, la table `votsen` du dump dosleg expose ce mécanisme via deux colonnes :

- `senmat` : matricule du sénateur **enregistré comme votant**
- `senmatdel` : matricule du **délégant** si le vote est par procuration ; null sinon

Quand un sénateur A vote au nom de B (B a délégué à A), la ligne typique de `votsen` est :

```
sesann | scrnum | senmat | posvotcod | senmatdel
2024   | 58     | A      | 1 (pour)  | B
```

Cela signifie : "le sénateur A a porté le vote 'pour' au nom du délégant B". Selon l'interprétation, ce vote peut être attribué :

- **À A seul** : B est juste "absent qui a délégué", on ne lui crédite rien
- **À A et B** : tous les deux sont "présents par effet" du vote, A gagne en activité, B aussi
- **À B seul** : la délégation traduit la volonté politique de B, A n'est qu'un porteur
- **Ni à A ni à B** : on exclut le vote du calcul (pas d'expression "propre")

Chaque interprétation a un sens politique différent et mène à des scores Overall, des taux de présence et des badges (frondeur, présence-or) **substantiellement différents**.

Sondage rapide : sur la session 2024-2025, environ 15-25 % des votes nominatifs ont un `senmatdel` non null (chiffre à confirmer empiriquement au moment du build). Le choix interprétatif aurait donc un impact non négligeable sur les classements.

> Question : quelle interprétation adopter pour la v1 ?

## Décision

Pour la **v1 de Phase 3 Sénat**, le champ `senmatdel` est **ignoré** :

- Tous les votes sont attribués au `senmat` enregistré sur la ligne, comme s'il s'agissait d'un vote propre du sénateur A
- Le délégant B ne reçoit **aucun crédit** pour ce vote
- Le délégant B est compté comme **non-votant** sur ce scrutin (s'il n'a pas d'autre ligne `votsen` propre)
- Le statut "vote par délégation" n'est ni affiché sur la fiche scrutin, ni mentionné sur la fiche sénateur en v1

Cette simplification est **explicitement temporaire** et documentée dans la FAQ section Sénat (PR D), avec un lien vers cette ADR.

## Pourquoi

- **Pas d'équivalent côté AN** : le système de délégation est une particularité institutionnelle du Sénat. Le pousser nativement dans le scoring Overall demanderait une discussion éditoriale (compter pour A ? pour B ? pour les deux ? avec décote ?), et aucune interprétation n'est neutre.
- **Viser un livrable simple d'abord** : la v1 doit shipper les sénateurs et les classements de base. Trancher la sémantique des délégations en v1 ralentirait la sortie.
- **Aucune perte de donnée** : le pipeline lit et stocke `senmatdel` dans la structure interne (peut-être pas dans le JSON final pour économiser le poids), donc une v2 pourra revisiter sans relancer l'extraction.
- **Simplicité d'audit** : "le vote affiché est strictement celui enregistré dans dosleg" est facile à expliquer à un utilisateur qui questionne un score.
- **La distorsion est lisible** : un sénateur qui délègue souvent verra son taux de présence/participation **baisser** (puisqu'il est compté non-votant). Cela reflète une réalité légitime — il **est** physiquement absent. Le système v1 sous-estime probablement la "présence politique" de tels sénateurs, mais cette sous-estimation va dans le sens d'une lecture stricte ("présence = présence physique").

## Conséquences

### Pipeline

- Dans `streamCopyBlocks`, on ne lit que `senmat` et `posvotcod` pour calculer présence/participation/loyauté. Le champ `senmatdel` est lu mais ignoré pour les stats v1.
- Aucun champ "vote par délégation" exposé dans `ScrutinSenatDetail.votes` (qui reste `Record<matricule, VotePosition>`)
- Pas de "badge délégant" en v1

### Communication utilisateur

- **FAQ Sénat** (`/faq#senat-delegations`) doit expliciter clairement la simplification, citer cette ADR, et inviter à proposer des améliorations via le repo GitHub
- **InfoTip Overall** sur les fiches sénateur doit mentionner que la v1 ignore les délégations
- La page `/senat/scrutins/[uid]` ne montre pas qui a délégué à qui (information disponible dans dosleg mais non exposée en v1)

### Distorsion attendue sur les stats

- Sénateurs qui délèguent fréquemment (ex. présidents/vice-présidents souvent occupés en séance) → **taux présence/participation sous-estimé**
- Sénateurs qui sont délégataires fréquents (ex. présidents de groupe portant la voix de leur groupe) → **taux présence inchangé** (ils étaient déjà en séance)
- Donc en moyenne le score Overall des déléguants baisse, celui des délégataires reste stable

### Voie d'évolution future (Phase 3.1 ou ADR ultérieure)

Options à explorer si le mainteneur souhaite revisiter :

- **Option A** : compter le vote pour A et B (les deux gagnent en présence). Score Overall plus haut pour tous, mais lit le système de délégation comme "présence politique".
- **Option B** : badge "Délégant fréquent" / "Délégataire fréquent" pour exposer la pratique sans changer le score.
- **Option C** : score "présence physique pure" (v1 actuelle) + score "présence politique délégations incluses" (v2), affichés côte à côte.
- **Option D** : compter le vote pour B seul (la volonté politique appartient au délégant). Inverse la v1.

Aucune option ne sera tranchée sans nouvelle ADR explicite.

## Liens

- ADR `#0023` (Phase 3 Sénat scope — la v1 ne traite pas les délégations)
- ADR `#0022` (formule Overall — appliquée telle quelle, donc impactée par la v1 sur les déléguants)
- ADR `#0005` (présence vs participation — la sémantique présence reste "vote enregistré au matricule")
- `scripts/fetch-data-senat.ts` (où `senmatdel` est ignoré)
- `src/routes/faq/+page.svelte` (section `#senat-delegations` à rédiger en PR D)
- [Règlement du Sénat — délégation de vote](https://www.senat.fr/role/role_des_senateurs.html)
