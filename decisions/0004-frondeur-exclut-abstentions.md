# 0004 — Frondeur = vote exprimé opposé à la majorité (les abstentions ne comptent pas)

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : pipeline-data, métriques, sémantique

## Contexte

Quand un député s'abstient alors que son groupe vote majoritairement "pour", est-ce qu'on le compte comme **frondeur** ?

## Décision

**Non**. Seuls les **votes *exprimés*** (pour OU contre) **opposés à la position majoritaire du groupe** comptent comme fronde. Les abstentions individuelles ne sont jamais des frondes.

## Pourquoi

- Une **abstention** est un acte politique distinct de la dissidence active. Elle peut signifier "je n'ai pas d'avis tranché", "je suis en conflit d'intérêt", ou "je veux marquer une nuance" — pas forcément "je suis contre la ligne du parti".
- Cohérent avec l'usage en science politique (l'**indice de Rice** mesure aussi des votes exprimés).
- Évite de gonfler artificiellement les compteurs de fronde pour les députés simplement plus nuancés.
- Simplifie l'interprétation : "X frondes" = X fois où le député a voté **différemment** de son groupe sur un sujet sur lequel les deux camps avaient une position franche.

## Conséquences

- Sur la fiche scrutin, la liste "🔥 Frondeurs" ne contient que des cas francs (ex: SOC vote contre, un député SOC vote pour → frondeur)
- Le compteur "Frondes" sur la carte FIFA est précis mais peut sous-évaluer l'indépendance d'un député qui s'abstient souvent par stratégie
- Si on veut un jour mesurer "indépendance globale" plus large, on créera une métrique séparée (ex: "Écart à la ligne") qui pondèrera abstentions et votes opposés différemment

## Liens

- `scripts/fetch-data.ts` lignes ~310-330 (détection des frondeurs au parsing)
- `src/lib/components/FrondeurCard.svelte`, `src/routes/scrutins/[uid]/+page.svelte`
- ADR 0005 (présence vs participation) pour la séparation des métriques exprimées vs présentes
