<!-- 
Merci pour ta contribution ! Ce template t'aide à structurer ta PR.
Supprime les sections qui ne s'appliquent pas.
-->

## Quoi & pourquoi

<!-- Une phrase qui explique ce que cette PR fait et pourquoi. Exemple :
"Ajoute un mode `comparer/` qui permet d'afficher 2 députés côte à côte 
pour visualiser leurs divergences de vote." -->

Closes #<!-- numéro d'issue -->

## Type de changement

- [ ] 🐛 Bug fix (changement non-cassant qui corrige un problème)
- [ ] ✨ Nouvelle feature (changement non-cassant qui ajoute une fonctionnalité)
- [ ] ♻️ Refactor (pas de changement de comportement utilisateur)
- [ ] 📊 Correction de données / calcul (avec source vérifiable)
- [ ] 📝 Documentation (README, ADR, NEXT_STEPS, CLAUDE.md)
- [ ] 💥 Breaking change (impacte l'API ou le comportement existant)

## Captures d'écran (si UI)

<!-- Avant / Après idéalement. Une image vaut mille mots. -->

| Avant | Après |
|---|---|
|  |  |

## Décision structurante ?

<!-- Si cette PR introduit un choix qui mériterait d'être consigné 
(sémantique d'une métrique, source de données, architecture…), 
coche la case et propose un nom de fichier ADR. -->

- [ ] Cette PR introduit une décision structurante → ADR `decisions/NNNN-mon-slug.md` à créer

## Checklist

- [ ] J'ai testé en local (`npm run dev` puis vérification visuelle)
- [ ] `npm run build` passe sans erreur
- [ ] `npm run check` passe (type-check Svelte/TS)
- [ ] J'ai ajouté/mis à jour la doc si nécessaire (README, NEXT_STEPS, CLAUDE.md)
- [ ] Si j'ai modifié le pipeline data, j'ai vérifié que les types `src/lib/types.ts` restent en phase avec `scripts/fetch-data.ts`
- [ ] Si j'ai introduit une décision structurante, j'ai créé l'ADR correspondante

## Notes pour le mainteneur

<!-- Tout ce qui peut aider à reviewer : décisions à valider, points 
incertains, alternatives envisagées, dépendances entre PR, etc. -->
