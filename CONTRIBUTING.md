# Contribuer à Hémicycle Manager

Merci de l'intérêt que tu portes à ce projet ! 🏛️

Ce document décrit **comment contribuer**, **ce qui est attendu**, et **comment ce projet est gouverné**.

## 🎯 Philosophie du projet

- **Football Manager pour la politique** : on cherche à rendre la politique parlementaire ludique et compréhensible. Toute proposition doit privilégier le côté visuel, social, et engageant.
- **Sourçage rigoureux** : aucune affirmation chiffrée n'est ajoutée sans source documentée (académique, open data officielle, datasets reconnus).
- **Transparence** : les choix structurants sont consignés dans [`decisions/`](decisions/) au format ADR.
- **Domaine public** : le projet est sous [Unlicense](LICENSE). Toutes les contributions sont également placées dans le domaine public.

## 🧭 Gouvernance

**Direction technique centralisée**. Le projet est piloté par [@IMhide](https://github.com/IMhide), qui :

- décide des évolutions structurantes,
- review et merge toutes les pull requests,
- valide ou refuse les propositions de feature,
- maintient la cohérence éditoriale ("Football Manager pour la politique").

**Toutes les contributions sont les bienvenues**, mais pas garanties d'être acceptées. Le mainteneur peut refuser ou demander des modifications.

## 🔐 Workflow obligatoire

- **Personne ne push directement sur `main`**, y compris le mainteneur.
- Toute modification passe par une **Pull Request**.
- Une PR doit :
  1. Avoir l'**approbation du mainteneur** ([@IMhide](https://github.com/IMhide))
  2. Faire passer la **CI** (build + type-check)
- Pas de force-push, pas de suppression de branche.

## 🐛 Signaler un bug

Utilise le template [Bug](https://github.com/IMhide/hemicycle-manager/issues/new?template=bug_report.yml). Mentionne :

- l'URL exacte concernée,
- les étapes pour reproduire,
- le comportement attendu vs observé,
- les éventuelles erreurs console (DevTools → onglet Console).

## 💡 Proposer une feature

Avant d'ouvrir une issue, **lis [`NEXT_STEPS.md`](NEXT_STEPS.md)** — c'est peut-être déjà dans la roadmap.

Sinon, ouvre une issue avec le template [Feature](https://github.com/IMhide/hemicycle-manager/issues/new?template=feature_request.yml). Décris :

- le **besoin utilisateur** (avant la solution technique),
- ta **proposition concrète** (UI, données, comportement),
- les **alternatives** envisagées.

Le mainteneur répondra avec :
- ✅ "Je suis pour, va-y" → tu peux ouvrir une PR
- 🟡 "Discutons des détails" → on échange dans l'issue avant que tu codes
- ❌ "Pas dans la direction du projet" → la proposition est refusée avec une explication

**Ne commence pas à coder une feature non-validée**, ce serait du temps perdu.

## 📊 Signaler une erreur de données / calcul

Utilise le template [Data correction](https://github.com/IMhide/hemicycle-manager/issues/new?template=data_correction.yml).

⚠️ **Sources acceptées** comme preuves canoniques :

- Open Data Assemblée nationale ([data.assemblee-nationale.fr](https://data.assemblee-nationale.fr))
- Datasets académiques (Chapel Hill Expert Survey, Manifesto Project, ParlGov…)
- Institutions de recherche (Sciences Po CEVIPOF, Cairn, Fondation Jean-Jaurès…)
- Projets open data établis (Regards Citoyens, NosDéputés, Datan)

**NON acceptées** comme sources canoniques : presse généraliste, déclarations politiques, blogs personnels, réseaux sociaux. Elles peuvent contextualiser mais ne sont pas des références.

## 🛠️ Setup local

```bash
git clone https://github.com/IMhide/hemicycle-manager.git
cd hemicycle-manager

# 1. Installer les dépendances
npm install

# 2. Télécharger et préparer les données (~30s, ~25 MB downloads)
npm run data:fetch

# 3. Lancer le serveur de dev
npm run dev
```

L'app tourne sur http://localhost:5173.

### Commandes utiles

```bash
npm run dev              # serveur de dev
npm run build            # build production statique
npm run preview          # vérifier le build local
npm run check            # type-check Svelte/TS (obligatoire avant PR)
npm run data:fetch       # rafraîchir les data
npm run decisions:index  # regen decisions/README.md
```

### Prérequis

- **Node.js ≥ 22.6** (le pipeline data utilise `--experimental-strip-types`, voir [ADR 0010](decisions/0010-node-22-pour-experimental-strip-types.md))
- **npm 10+**

## 📥 Workflow PR

1. **Fork** le repo (si tu n'es pas membre)
2. **Crée une branche** descriptive : `git checkout -b feature/comparateur-1v1` ou `fix/photo-404`
3. **Code** ta modification
4. **Vérifie en local** :
   ```bash
   npm run check  # type-check
   npm run build  # build prod
   npm run dev    # vérification visuelle
   ```
5. **Commit** avec un message clair :
   ```
   feat: ajoute le comparateur 1v1 entre députés
   
   - Page /comparer/?a=X&b=Y
   - Cartes FIFA côte à côte avec radar overlap
   - Liste des votes divergents
   
   Closes #42
   ```
6. **Push et ouvre une PR** sur `main`
7. **Remplis le template** (description, captures, checklist)
8. **Attends la review** du mainteneur. Sois ouvert·e aux retours, c'est une collaboration.
9. Une fois approuvée et CI verte → le mainteneur merge.

## 🏛️ Conventions de code

- **Svelte 5 runes** (`$state`, `$derived`, `$effect`) — pas l'ancienne syntaxe `$:` ou `export let`
- **TypeScript strict** — pas de `any` sauvage
- **Tailwind** pour le style — pas de CSS custom sauf cas particuliers (`app.css`)
- **Pas de commentaires** redondants qui paraphrasent le code. Garde un commentaire seulement pour expliquer un *pourquoi* non-évident.
- **Identifiants en français** acceptables pour le domaine métier (`depute`, `groupe`, `scrutin`, `frondeur`, `loyaute`) — on s'adresse à un public francophone et c'est plus précis. Le code générique reste en anglais.
- **Format compact JSON** privilégié (cf. [ADR 0012](decisions/0012-historiques-format-tuple-compact.md))

## 📜 Décisions structurantes (ADR)

Si ta PR introduit un choix structurant — sémantique d'une métrique, source de données, contrainte technique, choix d'architecture — **propose un ADR** :

1. Copie [`decisions/TEMPLATE.md`](decisions/TEMPLATE.md) en `decisions/NNNN-slug.md`
2. Remplis : Contexte, Décision, Pourquoi, Conséquences, Liens
3. Lance `npm run decisions:index`
4. Inclus l'ADR dans ta PR

Voir [`decisions/README.md`](decisions/README.md) pour les ADR existantes.

## ✅ Checklist avant de soumettre

- [ ] Mon code passe `npm run build` et `npm run check`
- [ ] J'ai testé visuellement la modification en local
- [ ] J'ai mis à jour la doc concernée (`README.md`, `NEXT_STEPS.md`, ADR…)
- [ ] J'ai rempli le template de PR avec captures avant/après si UI
- [ ] J'accepte que ma contribution soit publiée sous [Unlicense](LICENSE) (domaine public, pas d'attribution requise)

## 🙏 Code de conduite

Ce projet adhère au [Code de conduite Contributor Covenant](CODE_OF_CONDUCT.md). En participant, tu t'engages à respecter ses termes.

## 💬 Questions ?

- Pour les questions techniques ouvertes : [GitHub Discussions](https://github.com/IMhide/hemicycle-manager/discussions)
- Pour signaler un problème de sécurité : voir [SECURITY.md](SECURITY.md)
- Pour tout le reste : ouvre une issue avec le template approprié

**Merci de contribuer !** 🏛️
