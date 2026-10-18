# Audit de la version 1.0.0

Audit réalisé avant toute modification, sur le commit `3aeea37` (branche `main`), identique à l'archive `qa-demo-store-main.zip`.

## État initial vérifié

| Vérification                                     | Résultat                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `npm ci` (Node 22.22, npm 10.9 fourni avec Node) | OK, 221 paquets, 0 vulnérabilité                                                                  |
| `npm test`                                       | 9 fichiers, 84 tests, tous verts                                                                  |
| `npm run dev` puis Chromium                      | Catalogue affiché en 0,3 s, 8 cartes, ajout au panier OK, aucune erreur console                   |
| Couverture déclarée (`main.js` exclu)            | 100 % instructions, 96 % branches                                                                 |
| Couverture réelle (`main.js` inclus)             | 88,8 % instructions, 88,4 % branches, 79,2 % fonctions, 88,8 % lignes : les seuils 90/85 échouent |

## Défauts constatés

| #   | Constat                                                                                                                                                                               | Preuve                                                                             | Gravité  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| 1   | L'interface est exclue de la couverture : 100 % affiché, 79,2 % des fonctions en réalité                                                                                              | `vitest.config.js:13`                                                              | Majeure  |
| 2   | Totaux calculés par l'interface et enregistrés tels quels                                                                                                                             | `src/orders/orders.js:13,25`, `src/main.js:441`                                    | Critique |
| 3   | Mots de passe en clair dans le localStorage                                                                                                                                           | `src/auth/account.js:23`                                                           | Critique |
| 4   | TVA ajoutée aux prix affichés (prix HT au lieu de TTC), taux unique                                                                                                                   | `src/pricing/pricing.js:1,13-15`                                                   | Majeure  |
| 5   | Dates comparées en UTC (décalage autour de minuit à Paris)                                                                                                                            | `src/promotions/promotions.js:3`, `src/coupons/coupons.js:15`                      | Mineure  |
| 6   | `innerHTML` avec interpolations non échappées                                                                                                                                         | `src/main.js:112-113,119,276`                                                      | Majeure  |
| 7   | Identifiants de commande prévisibles                                                                                                                                                  | `src/orders/orders.js:21`                                                          | Majeure  |
| 8   | Aucun dispositif RGPD                                                                                                                                                                 | absent                                                                             | Majeure  |
| 9   | Interface en anglais uniquement                                                                                                                                                       | `src/main.js`                                                                      | Mineure  |
| 10  | `main.js` monolithique (504 lignes, état global mutable), `import` en fin de `cart.js`, prix admin convertis par flottant, `concurrency: pages` qui annule les exécutions CI entre PR | `src/main.js:87`, `src/cart/cart.js:25`, `src/admin/products.js:5`, `ci.yml:10-12` | Mineure  |

## Points forts à conserver

Logique métier déjà découpée en modules purs testés, montants en centimes, données déterministes, routage par `#` compatible GitHub Pages, 25 `data-testid` sur les parcours clés, CI avec format, lint, couverture et build.

## Plan

Évolution **progressive** de la v1, en JavaScript vanilla, un seul `package.json`, Vite conservé. Chaque lot se termine par `npm run quality` et une vérification dans Chromium (`npm run dev`, catalogue affiché, parcours principal, console sans erreur).

| Lot | Contenu                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Outillage et garde-fous : seuils de couverture par fichier (interface incluse), ESLint sécurité, `.gitattributes`, scripts Node multiplateformes, démarrage sûr (message de chargement, page d'erreur, repli mémoire si `localStorage` est bloqué) |
| 2   | Moteur de calcul `src/engine/` (prix TTC et TVA par taux, remises réparties, livraison et jours fériés, fidélité, échéancier, retours, stocks, indicateurs, RGPD), en TDD avec tests de propriétés et de mutation                                  |
| 3   | Back-end partagé `src/backend/` et adaptateur local (localStorage) ; l'interface passe par `src/client/api-client.js`                                                                                                                              |
| 4   | Interface découpée en vues, rendu échappé, charte de `instructions.txt`, français et anglais                                                                                                                                                       |
| 5   | RGPD : consentement, « Mes données », purge, documentation                                                                                                                                                                                         |
| 6   | Nouvelles fonctionnalités et outils de testabilité (scénarios, horloge, comptes à problème, barre QA)                                                                                                                                              |
| 7   | API HTTP facultative `server/` (Node natif) et suite de contrat partagée                                                                                                                                                                           |
| 8   | Documentation, rapport, archive                                                                                                                                                                                                                    |

Limite de l'environnement de travail : seul Chromium est disponible pour les vérifications dans un navigateur (Edge partage son moteur) ; Firefox et un vrai poste Windows ne peuvent pas être testés ici. Pour réduire ce risque, aucune API récente ou propre à Chromium ne sera utilisée et tous les scripts npm seront des commandes Node multiplateformes.
