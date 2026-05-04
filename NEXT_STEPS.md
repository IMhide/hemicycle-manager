# Roadmap & Backlog — Hémicycle Manager

Liste vivante des évolutions envisagées. Coche au fur et à mesure, ajoute librement.

## ✅ Fait (session inaugurale 2026-05-04)

- Hémicycle SVG avec positions officielles (582 sièges)
- Pipeline data Open Data AN → JSON optimisé
- Fiches Député (carte FIFA + radar + badges + historique)
- Fiches Groupe (mini-hémicycle, top loyalistes / frondeurs / présence)
- Fiches Scrutin avec liste des frondeurs
- Pages liste filtrables (députés, groupes, scrutins)
- Page Classements (5 leaderboards, vue globale ou par groupe)
- Système de rangs avec médailles 🥇🥈🥉
- Recherche globale multi-catégorie dans le header (style Facebook)
- InfoTip pédagogique sur toutes les métriques
- Mode "Gauche–Droite" sourcé CHES 2024
- Banc des Non-Inscrits séparé de l'hémicycle
- Déploiement Coolify avec domaine custom + HTTPS
- Système d'ADR (decisions/) + script d'indexation
- CLAUDE.md pour mémoire entre sessions

## 🎯 Prochaines pistes prioritaires

### Animations (impact visuel fort, effort modéré)

- [ ] **Sièges qui s'allument un par un** lors du changement de scrutin (cascade vert/rouge)
- [ ] Animation d'apparition des cartes en stagger
- [ ] Transition fluide entre les modes hémicycle (groupe ↔ scrutin ↔ gradient)
- [ ] **Compteurs animés** (count-up sur les stats avec [svelte-motion](https://svelte.dev/docs#run-time-svelte-motion))

### Comparateur 1v1 (potentiel viral, effort élevé)

- [ ] Page `/comparer/` où on choisit 2 députés
- [ ] Cartes FIFA côte-à-côte + **radar overlap** (deux polygones superposés)
- [ ] Liste des votes où ils ont **divergé** vs **convergé** + ratio %
- [ ] Mode **"swipe"** : présenter 2 députés au hasard, l'utilisateur devine qui est plus loyal/présent/etc. avant de révéler

### Mode "Devine le vote" (gamification)

- [ ] Cacher le résultat d'un scrutin
- [ ] L'utilisateur prédit : adopté ou rejeté ? Combien de pour ?
- [ ] **Révéler l'hémicycle progressivement** (sièges qui s'allument un par un) avec une animation dramatique
- [ ] **Score cumulé** persistant en localStorage
- [ ] Variante : "Devine le député" — montrer une carte FIFA sans nom + groupe masqué, deviner

### Autres idées en vrac (à prioriser)

- [ ] **Heatmap de cohésion** : matrice 12×12 montrant la proximité de vote entre tous les groupes
- [ ] **Timeline interactive** : scrubber pour voir l'évolution des votes au fil de la législature
- [ ] **Story mode** : présenter un scrutin marquant comme un récit (contexte, débat, vote, conséquence)
- [ ] **Profil utilisateur** : "à quel député ressemblez-vous le plus ?" (questionnaire sur 10 lois clés → matching)
- [ ] **Image carte FIFA partageable** sur Twitter (canvas → PNG, og:image)
- [ ] **Hall of fame** : les frondes les plus célèbres / votes les plus serrés
- [ ] **Notifications RSS / Atom** : nouveau scrutin, fronde dans tel groupe, etc.
- [ ] **Recherche fuzzy** plus permissive (matches partiels, typos) avec [Fuse.js](https://fusejs.io/) ou index pré-construit

## 🔧 Polish technique en attente

- [ ] **Page d'erreur 404 custom** (actuellement le 404 par défaut SvelteKit)
- [ ] **SEO / Open Graph** : meta tags par page, og:image dynamique
- [ ] **Mobile responsive deep check** : vérifier toutes les pages sur 375px et corriger
- [ ] **Auto-deploy GitHub → Coolify** : configurer une GitHub App ou un webhook manuel (cf ADR 0002)
- [ ] **Cron de rebuild quotidien** sur Coolify (pour les données fraîches sans intervention)
- [ ] **Lazy-load** le composant Hemicycle et la photo dans MiniDeputeCard pour le boot
- [ ] **Préfetch** des données fréquentes (groupes, deputes-lite) dans `+layout.ts`

## 🧪 Idées exploratoires

- [ ] **Comparateur député ↔ vous** : quiz "votre vote" sur 10 scrutins → matching avec les 577 députés
- [ ] **Visualisation des coalitions** émergeant des votes (clustering basé sur proximité de vote)
- [ ] **Détection des "alliances de circonstance"** : groupes qui votent ensemble malgré des positions opposées sur un sujet
- [ ] **API publique** (`/api/v1/...`) pour permettre à d'autres d'utiliser nos JSON pré-traités
- [ ] **Multilingue** : version anglaise pour exposer le système politique français à l'international
- [ ] **Étendre aux 16ᵉ et 15ᵉ législatures** (historique sur ~10 ans de votes)

---

**Comment utiliser ce fichier** :

1. Ajouter une idée → push direct sur `main`, pas de PR nécessaire (c'est une roadmap, pas du code)
2. Quand on commence une feature → cocher `[ ]` → `[x]` quand c'est fini, ou la déplacer dans la section "Fait"
3. Si une idée donne lieu à une décision structurante → créer une ADR (cf [`decisions/`](decisions/README.md))
