# Rapport de livraison v2

## Résumé

QA Demo Store v2 reste une application **HTML, CSS et JavaScript vanilla** (Vite, un seul `package.json`). Elle démarre avec `npm ci` puis `npm run dev`, fonctionne sur GitHub Pages sans aucun service externe, et ne peut plus afficher de page blanche : en cas d'échec au démarrage, un message d'erreur lisible s'affiche ; si le stockage est bloqué, elle fonctionne en mémoire.

## Résultats vérifiés

| Vérification                                                     | Résultat                                                               |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run quality` (format, lint, couverture, traçabilité, build) | Vert                                                                   |
| Tests unitaires                                                  | 27 fichiers, 220 tests, tous verts                                     |
| Couverture globale                                               | 99,9 % lignes, 96 % branches, 99,3 % fonctions (interface incluse)     |
| Couverture par fichier                                           | ≥ 80 % pour chaque fichier, ≥ 95 % (branches ≥ 90 %) pour `src/engine` |
| Traçabilité                                                      | 85 règles documentées, toutes couvertes par au moins un test           |
| Build                                                            | `dist/` : 195 Ko de JS (58 Ko gzip), 12,5 Ko de CSS                    |

Seule exclusion de couverture : `src/engine/types.js`, qui ne contient que des définitions JSDoc (aucun code exécutable).

### Vérifications dans un navigateur (Chromium, Playwright)

| Mode                                      | Écran          | Catalogue prêt | Parcours complet (panier → connexion → commande) | Erreurs console |
| ----------------------------------------- | -------------- | -------------- | ------------------------------------------------ | --------------- |
| `npm run dev` (dans la page)              | Bureau         | ≈ 0,6 s        | OK                                               | 0               |
| `npm run dev` avec stockage bloqué        | Bureau         | OK             | OK, transport « local (mémoire) »                | 0               |
| `npm run build` + `preview` (CSP stricte) | Bureau, mobile | ≈ 0,2 s        | OK                                               | 0               |
| `npm run server` + `npm run dev:server`   | Bureau, mobile | ≈ 0,4 s        | OK, cookie `qads_session` HttpOnly               | 0               |

Aucun débordement horizontal à 390 px de large.

### Non vérifié ici

- Firefox, Safari et un vrai poste Windows : seuls Chromium et Linux étaient disponibles. Le code n'utilise que des API standard (modules ES, `fetch`, Web Crypto, `Intl`) et les commandes du README sont données pour PowerShell.
- Les tests de mutation (`npm run test:mutation`) sont configurés mais n'ont pas été lancés dans la CI (durée).

## Correspondance des tests v1 → v2

Les modules v1 ont été remplacés ; leurs tests ont été supprimés avec eux. Chaque comportement testé en v1 l'est en v2 :

| Fichier v1                                         | Comportements                                         | Tests v2                                                          |
| -------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `tests/cart.test.js`                               | Ajout, quantités, stock, persistance du panier        | `ENG-QUOTE-01`, `API-CHK-*`, `WEB-CART-*`                         |
| `tests/catalog.test.js`                            | Recherche, filtres, tris, pagination, avis, favoris   | `ENG-CAT-*`, `API-CAT-*`, `WEB-CAT-*`, `WEB-PDP-*`                |
| `tests/checkout.test.js`                           | Coupons, livraison, taxe, paiement fictif, validation | `ENG-DISC-*`, `ENG-SHIP-*`, `ENG-VAT-*`, `API-CHK-*`, `WEB-CHK-*` |
| `tests/orders.test.js`                             | Création, historique, annulation, statuts admin       | `ENG-ORD-*`, `API-ORD-*`, `API-ADM-*`, `WEB-ORD-*`, `WEB-ADM-*`   |
| `tests/promotions.test.js`                         | Promotions datées                                     | `ENG-CAT-01`, `ENG-TIME-*`                                        |
| `tests/storage.test.js`                            | Données initiales, reset, migration                   | `API-SYS-*`, `INFRA-*`, `LOCAL-BE-*`                              |
| `tests/extended.test.js`                           | Inscription, profil, favoris, avis, édition produit   | `API-AUTH-*`, `API-ACC-*`, `API-CAT-*`, `API-ADM-*`, `WEB-ACC-*`  |
| `tests/ui-smoke.test.js`, `tests/ui-order.test.js` | Rendu et commande complète dans jsdom                 | `WEB-BOOT-*`, `WEB-CHK-*`, `WEB-CONTRACT-*`                       |

## Points d'attention

- Dans la page, la « sécurité » est simulée (tout s'exécute chez l'utilisateur) ; c'est voulu et signalé par un bandeau. Les protections réelles se testent avec l'API Node.
- L'API Node n'est pas hébergée publiquement : elle tourne en local.
- `docs/qa/corrige-defauts.md` donne les solutions des défauts volontaires : retirez-le du dépôt public si vous l'utilisez en formation.
