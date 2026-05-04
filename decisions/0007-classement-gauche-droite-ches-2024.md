# 0007 — Classement gauche-droite des groupes sourcé sur Chapel Hill Expert Survey 2024

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : sourcing, gradient politique, méthodologie

## Contexte

Pour le mode "Gauche–Droite" et le gradient de couleurs, il faut classer les 12 groupes politiques de l'Assemblée sur un axe gauche-droite. Comment décider de l'ordre **de manière sourcée et défendable**, sans biais éditorial ?

## Décision

L'ordre est sourcé sur le **Chapel Hill Expert Survey 2024 (CHES 2024)**, dataset académique (Rovny et al. 2025) qui score les partis européens sur l'axe gauche-droite (`lrgen`, 0 = far-left, 10 = far-right).

| Rang | Groupe | Score | Source |
|---|---|---|---|
| 1 | GDR | ~1.73 (proxy PCF) | CHES party_id 601 |
| 2 | LFI-NFP | 0.82 | CHES party_id 627 (direct) |
| 3 | EcoS | 2.30 (proxy EELV) | CHES party_id 605 |
| 4 | SOC | 3.45 | CHES party_id 602 (direct) |
| 5 | LIOT | ~5.0 (estimé) | groupe technique hétérogène |
| 6 | Dem | 5.36 | CHES party_id 613 (direct) |
| 7 | EPR | 6.27 | CHES party_id 626 (direct) |
| 8 | HOR | 6.60 | CHES party_id 631 (direct) |
| 9 | DR | 7.73 (proxy LR) | CHES party_id 609 |
| 10 | UDR | ~8.5 (estimé) | trop récent pour CHES, classé extrême droite par Conseil d'État |
| 11 | RN | 8.82 | CHES party_id 610 (direct) |
| 12 | NI | non positionnable | hétérogène, banc séparé |

## Pourquoi

- **CHES est la source académique de référence** pour le positionnement européen
- Refus explicite des sources de presse (qualifiées de non-canoniques) et des sources de l'État français (l'État ne publie pas de classement officiel gauche-droite)
- Les cas "estimés" (LIOT, UDR) sont **explicitement marqués** comme tels dans `political-order.ts` avec leur `confidence: 'estimated'` et un `rationale`

## Conséquences

- Le classement est **défendable face à un reproche de biais** : "voici la source académique X qui place LFI à 0.82 et RN à 8.82"
- GDR avant LFI : choix conscient. CHES place LFI à 0.82 (plus à gauche que PCF à 1.73), mais l'analyse empirique des coalitions de vote (Delemazure) place GDR en 1ᵉʳ. Les deux ordres sont défendables ; on retient l'ordre traditionnel.
- Les **non-inscrits (NI)** sont hors du gradient politique, affichés sur un **banc séparé** (métaphore football)
- Le placement des sièges dans l'hémicycle utilise les **positions officielles** (cf ADR 0008), donc le classement gauche-droite n'affecte que :
  - Le mode "Gauche–Droite" (gradient de couleurs)
  - L'ordre de tri des cards groupes sur la home et la liste `/groupes/`

## Liens

- `src/lib/political-order.ts` (mapping complet avec scores CHES + rationale)
- [CHES 2024 dataset](https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches)
- [Rovny et al. 2025, Electoral Studies](https://www.sciencedirect.com/science/article/pii/S0261379425000873)
- ADR 0008 (positions de sièges officielles)
