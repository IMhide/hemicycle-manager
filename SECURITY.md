# Politique de sécurité

## Versions supportées

Ce projet est un site statique sans backend ni authentification. La surface d'attaque est minimale (HTML/JS/CSS servis par Nginx).

Seule la **branche `main`** est activement maintenue.

## Signaler une vulnérabilité

Si tu découvres une faille de sécurité, **ne l'ouvre pas en issue publique**. Contacte le mainteneur en privé :

- En ouvrant une [Security Advisory privée](https://github.com/IMhide/hemicycle-manager/security/advisories/new) sur GitHub (recommandé)
- Ou en contactant directement [@IMhide](https://github.com/IMhide)

Indique :

- La nature de la vulnérabilité (XSS, injection, fuite de données…)
- L'URL ou le chemin concerné
- Les étapes pour reproduire
- L'impact potentiel

Le mainteneur s'engage à :

- Accuser réception sous 7 jours
- Évaluer la criticité et planifier un correctif
- Te tenir informé·e de la résolution
- Te créditer publiquement si tu le souhaites, après le déploiement du fix

## Périmètre

Les vulnérabilités potentielles dans le périmètre :

- XSS via les données de l'open data AN (titres de scrutins, noms…)
- Fuite d'informations privées (clés API, configuration interne)
- Vulnérabilités dans les dépendances npm

**Hors périmètre** :

- Dépendances tierces déjà connues (CVE publiques) — préfère mettre à jour via npm audit
- Configuration de serveur tierce (le déploiement Coolify est de la responsabilité du mainteneur)
- Issues de qualité de données (utiliser le template [Data correction](https://github.com/IMhide/hemicycle-manager/issues/new?template=data_correction.yml))

Merci de contribuer à la sécurité du projet ! 🛡️
