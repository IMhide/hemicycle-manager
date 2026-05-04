# 0013 — Gouvernance ouverte avec direction technique centralisée

**Date** : 2026-05-04
**Statut** : accepté
**Tags** : gouvernance, open-source, processus

## Contexte

Le projet est open-source et accessible à tous. Il faut un cadre clair qui permet à n'importe qui de contribuer (issues, PRs) tout en préservant la cohérence éditoriale du projet ("Football Manager pour la politique") et la qualité du code.

Deux extrêmes à éviter :

- **Anarchie** : tout le monde peut push, dérive éditoriale rapide, qualité variable
- **Forteresse** : repo public mais en pratique fermé, contributions découragées

## Décision

**Gouvernance ouverte avec direction technique centralisée**, calibrée pour un mainteneur solo.

- **Personne ne push directement sur `main`**, y compris le mainteneur. Tout passe par Pull Request.
- **Toute PR doit faire passer la CI** (build + type-check Node 22).
- **Asymétrie volontaire sur les approvals** :
  - **Contributeurs externes** : PR + **review du Code Owner** (`@IMhide`) obligatoire avant merge.
  - **Mainteneur** : PR obligatoire + CI verte. GitHub interdit qu'un auteur approuve sa propre PR ; un mainteneur solo n'a personne d'autre pour approuver. Le mainteneur peut donc merger ses propres PR sans approval, mais a quand même fait la PR (pour la traçabilité et la CI).
  - Implémentation : `required_approving_review_count: 0` + `require_code_owner_reviews: true`. La review du Code Owner reste forcée pour les PR externes (l'auteur ne peut pas se compter lui-même), tandis qu'elle est implicitement satisfaite pour les PR du mainteneur.
- Branch protection rules GitHub configurées en **strict** (`enforce_admins: true`), pas d'override admin sur les autres règles (force-push, suppression, linear history, status checks).
- **Les issues passent par des templates** (bug, feature, data correction) pour cadrer la qualité des remontées.
- **Le mainteneur est seul juge** des features acceptées : ouverture aux propositions oui, garantie d'acceptation non.
- **CODEOWNERS** : `* @IMhide` → toute PR auto-assigne le mainteneur en reviewer.

## Pourquoi

- **Cohérence éditoriale** préservée : un seul juge final évite la dérive ("on accepte tout").
- **Qualité** : la review systématique force la documentation, les tests, les ADR pour les choix structurants.
- **Discipline** : forcer le mainteneur lui-même à passer par PR (strict mode) montre que les règles s'appliquent à tous et améliore la traçabilité.
- **Accueil** : les templates rendent le projet accessible aux nouveaux contributeurs (ils savent quoi remplir, ne se demandent pas si leur idée a sa place).
- **Sécurité** : pas de force-push, pas de suppression de branche, historique préservé.

## Conséquences

- **Le mainteneur ne peut plus push directement même pour une typo** → léger surcoût mais bénéfice de discipline + traçabilité de chaque change via PR.
- **Les PR du mainteneur ne sont pas auto-reviewées** : seule la CI les valide. C'est un compromis assumé pour un mainteneur solo. Si un co-mainteneur rejoint le projet plus tard, on basculera à `required_approving_review_count: 1` pour avoir du peer review systématique.
- Les contributions externes seront probablement filtrées (la plupart refusées), il faut être prêt à expliquer pourquoi de manière constructive.
- La CI doit rester **rapide** (sous 5 min) pour ne pas bloquer le flux de PR.
- Les **droits d'admin** restent uniquement sur le mainteneur ; pas de co-mainteneur pour l'instant.
- Si le projet grossit beaucoup, on pourra :
  - Ajouter des **mainteneurs secondaires** par domaine (ex: data quality, UI, infra) → bascule à `required_approving_review_count: 1`
  - Activer un **stale bot** pour gérer le volume d'issues
  - Mettre en place **Dependabot** pour les MAJ de dépendances
- Adopter le **Contributor Covenant 2.1** comme code de conduite (standard universel).

## Liens

- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — workflow détaillé
- [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) — code de conduite
- [`SECURITY.md`](../SECURITY.md) — politique de sécurité
- [`.github/CODEOWNERS`](../.github/CODEOWNERS)
- [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/)
- [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- [Branch protection — GitHub docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
