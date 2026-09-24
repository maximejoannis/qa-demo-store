# QA Demo Store

Application e-commerce statique de démonstration, développée en HTML, CSS et JavaScript vanilla avec les modules ES et Vite. Elle sert de support aux tests logiciels et à l'automatisation QA : données de démonstration déterministes, règles métier testables, tests unitaires, couverture de code et déploiement continu sur GitHub Pages. Tous les comptes, produits et paiements sont fictifs.

**Application en ligne :** [maximejoannis.github.io/qa-demo-store](https://maximejoannis.github.io/qa-demo-store/)

## Fonctionnalités

- Inscription, connexion et déconnexion simulées, compte verrouillé, rôles client et administrateur, profil modifiable et adresse de livraison par défaut.
- Catalogue de 16 produits répartis en six catégories, illustrations SVG locales, fiches détaillées, recherche, filtres combinables, six tris et pagination.
- Promotions limitées dans le temps, liste de souhaits avec transfert vers le panier, avis, gestion des stocks et panier persistant.
- Coupons `WELCOME10`, `SAVE20` et `FREESHIP`, trois modes de livraison, calculs en centimes avec taxe, commande en quatre étapes et paiement fictif déterministe.
- Confirmation, historique et détails des commandes ; annulation avec restitution du stock ; gestion des produits et statuts des commandes par l'administrateur.
- Modes clair et sombre, préférences de tri et de pagination persistantes, messages accessibles, états vides et bouton **Reset Demo Data**.

## Installation et commandes

**Prérequis : Node.js 24** pour exécuter les tests d'interface avec la version de jsdom utilisée par le projet. Depuis la racine du dépôt :

| Commande                                  | Rôle                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| `npm install` / `npm ci`                  | Installer les dépendances ; la CI utilise `npm ci`            |
| `npm run dev`                             | Démarrer le serveur de développement Vite                     |
| `npm run build`                           | Générer le site statique dans `dist/`                         |
| `npm run preview`                         | Prévisualiser localement le build de production               |
| `npm test` / `npm run test:watch`         | Exécuter les tests une fois / en continu                      |
| `npm run test:coverage`                   | Produire les rapports V8 texte, HTML et LCOV dans `coverage/` |
| `npm run lint` / `npm run lint:fix`       | Vérifier / corriger avec ESLint                               |
| `npm run format` / `npm run format:check` | Formater / vérifier avec Prettier                             |
| `npm run quality`                         | Vérifier format, lint, tests, couverture et build             |

Ouvrir l'URL fournie par Vite, sous `/qa-demo-store/`. Ouvrir directement le fichier source `index.html` avec `file://` ne lance pas l'application Vite.

## Comptes et paiements de démonstration

| Identifiant     | Mot de passe | Rôle              |
| --------------- | ------------ | ----------------- |
| `standard_user` | `demo123`    | Client            |
| `premium_user`  | `demo123`    | Client            |
| `admin_user`    | `admin123`   | Administrateur    |
| `locked_user`   | `demo123`    | Compte verrouillé |

La carte fictive `4242424242424242` est acceptée ; `4000000000000002` est refusée, `4000000000000069` simule une carte expirée et `4000000000000119` une erreur technique. Le paiement à la livraison est également disponible. **Ne saisir aucune vraie carte ni aucun mot de passe personnel.** Les données sont enregistrées dans le `localStorage` du navigateur. **Reset Demo Data** restaure les comptes, produits, commandes, avis et préférences initiaux.

Lorsqu'une version plus ancienne a déjà été utilisée dans le navigateur, une migration complète les chemins des illustrations et les dates des promotions sans effacer les stocks, prix et commandes modifiés.

## Architecture et tests

`src/main.js` gère l'affichage, la navigation et les événements du DOM. Les règles métier testables sont réparties dans `src/auth`, `catalog`, `cart`, `inventory`, `promotions`, `coupons`, `shipping`, `payment`, `pricing`, `orders`, `admin` et `storage`. Les produits sont définis dans `src/data`, les illustrations se trouvent dans `public/products`, les styles adaptatifs dans `src/styles` et les tests dans `tests/`.

Vitest avec V8 impose les seuils suivants : **instructions ≥ 90 %, lignes ≥ 90 %, fonctions ≥ 90 % et branches ≥ 85 %**. Le rapport de couverture exclut `src/main.js`, qui contient l'interface. Deux tests jsdom exercent certains parcours de l'interface, dont la commande complète. Ces pourcentages mesurent la **couverture de code** ; la **couverture fonctionnelle** des exigences et scénarios sera suivie séparément dans le futur projet Playwright.

## CI et GitHub Pages

Le workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) lance `npm ci`, Prettier, ESLint, les tests et le seuil de couverture, puis le build Vite sur les pushs et pull requests vers `main`. Seul un push sur `main` dont les contrôles réussissent publie `dist/` sur GitHub Pages ; les pull requests ne publient pas l'application.

Dans les paramètres du dépôt, la source Pages doit être **GitHub Actions**. Vite utilise `base: '/qa-demo-store/'` : `dist/index.html`, les scripts, les styles et les SVG sont ainsi servis sous le bon chemin. La navigation utilise des URL avec `#` (`#/products/1`, `#/orders`, `#/admin`), compatibles avec l'actualisation et l'accès direct sur un hébergement statique.

## Limites et suite du projet

Cette application publique fonctionne uniquement dans le navigateur. **L'authentification est simulée et n'assure aucune sécurité réelle** : les mots de passe créés à l'inscription sont conservés en clair dans le `localStorage`. Il faut donc utiliser exclusivement des identifiants inventés. Aucun paiement bancaire ni partage de données entre navigateurs n'est effectué. Les SVG sont des illustrations, pas des photos produits. Les tests E2E Playwright, les audits d'accessibilité et le suivi de couverture fonctionnelle sont prévus dans un projet QA distinct.

Le code est consultable dans ce dépôt public. **Aucune licence de réutilisation n'est accordée.**
