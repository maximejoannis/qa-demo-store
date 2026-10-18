# QA Demo Store v2

[![CI](https://github.com/maximejoannis/qa-demo-store/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/maximejoannis/qa-demo-store/actions/workflows/ci.yml)

Boutique en ligne **fictive** écrite en **HTML, CSS et JavaScript vanilla** (modules ES, Vite). C'est un **terrain d'entraînement QA** : tests fonctionnels, tests automatisés (Playwright dans un projet séparé), tests d'API, d'accessibilité et exercices de détection de défauts. Tous les comptes, produits et paiements sont fictifs : n'y saisissez aucune donnée réelle.

**En ligne :** [maximejoannis.github.io/qa-demo-store](https://maximejoannis.github.io/qa-demo-store/) — gratuit, sans service externe.

## Démarrer (Windows PowerShell)

Prérequis : [Node.js](https://nodejs.org/) 22 ou 24 (LTS).

```powershell
npm ci
npm run dev
```

Ouvrez ensuite **http://localhost:5173/qa-demo-store/** (ajoutez `?qa=1` pour la barre d'outils QA).
Les mêmes commandes fonctionnent sous macOS et Linux.

## Commandes

| Commande                            | Rôle                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                       | Application + back-end **dans la page** (données dans le localStorage)      |
| `npm run server`                    | API Node optionnelle sur le port 3000 (données dans `data/db.json`)         |
| `npm run dev:server`                | Application qui appelle l'API Node (lancer `npm run server` à côté)         |
| `npm run build` / `npm run preview` | Site statique dans `dist/` / prévisualisation sur le port 4173              |
| `npm test`                          | Tests unitaires (Vitest)                                                    |
| `npm run test:coverage`             | Tests + couverture (rapport HTML dans `coverage/index.html`)                |
| `npm run test:mutation`             | Tests de mutation du moteur de calcul (Stryker, facultatif, quelques min)   |
| `npm run lint` / `npm run format`   | ESLint / Prettier                                                           |
| `npm run docs`                      | Régénère `docs/qa/testids.md`, `docs/tracabilite.md`, `public/openapi.json` |
| `npm run quality`                   | Tout ce que vérifie la CI : format, lint, couverture, traçabilité, build    |

Pour tester avec l'API Node, ouvrez **deux** terminaux PowerShell :

```powershell
# Terminal 1
npm run server
# Terminal 2
npm run dev:server
```

## Fonctionnalités

- Catalogue de 18 produits : recherche, filtres, tris, pagination, fiches, avis, comparateur (3 produits), favoris, alertes de retour en stock.
- Panier et commande en 4 étapes ; tous les montants viennent du **moteur de calcul** côté back-end : TVA par taux (20 % / 5,5 % pour les livres), codes promo, livraison par zone et par poids, jours ouvrés et fériés français, fidélité (Bronze / Argent / Or), paiement en 3 ou 4 fois, droit de rétractation de 14 jours, factures.
- Compte : profil, commandes, retours, points de fidélité, « Mes données » (export, suppression).
- Administration : produits, statuts de commande, indicateurs (KPI), réapprovisionnement, purge RGPD.
- **RGPD** : bandeau de consentement, politique de confidentialité, droits d'accès / effacement / portabilité, durées de conservation (voir [`docs/rgpd.md`](docs/rgpd.md)).
- Français et anglais, thème clair / sombre, accessibilité WCAG 2.2 AA, couleurs imposées par `instructions.txt` ([`docs/design-tokens.md`](docs/design-tokens.md)).

## Pour les testeurs

- [Guide du testeur](docs/qa/guide-testeur.md) : modes, comptes, cartes, codes promo, scénarios, horloge pilotable, barre QA, API.
- [Contrat des `data-testid`](docs/qa/testids.md) : sélecteurs stables (ceux de la v1 sont conservés).
- [Règles métier](docs/specs/regles-metier.md) : l'oracle de test, avec des exemples chiffrés au centime.
- [Comptes à problème](docs/qa/comptes-de-test.md) : six comptes avec des défauts volontaires à trouver.
- [OpenAPI](public/openapi.json) : 40 opérations, erreurs au format RFC 9457.

| Compte          | Mot de passe | Rôle                 |
| --------------- | ------------ | -------------------- |
| `standard_user` | `demo123`    | Client               |
| `premium_user`  | `demo123`    | Client niveau Argent |
| `admin_user`    | `admin123`   | Administrateur       |
| `locked_user`   | `demo123`    | Compte verrouillé    |

Carte acceptée : `4242 4242 4242 4242`. Paramètres d'URL utiles : `?qa=1`, `?now=2026-12-31T23:59:30%2B01:00`, `?seed=42`, `?lang=en`, `?latency=2000`, `?fail=quotes:503`.

## Architecture

```
src/
  engine/     moteur de calcul : fonctions pures, montants en centimes entiers, dates de Paris
  backend/    routes /api/v1/*, validation stricte, données de démo, défauts volontaires
  client/     client HTTP de la page (une seule porte d'entrée vers le back-end)
  ui/         vues, rendu échappé par défaut, routeur, data-testid
  i18n/       textes FR / EN
  styles/     CSS (variables de couleur imposées)
server/       API Node optionnelle (node:http, aucun framework) qui réutilise src/backend
tests/        tests unitaires : engine, backend, contract, server, ui
scripts/      génération de la documentation
```

Le même code `src/backend` tourne **dans la page** (GitHub Pages, `npm run dev`) et **dans l'API Node** : mêmes routes, mêmes réponses, vérifié par les tests `PARITY-*`. Si le navigateur bloque le stockage, l'application fonctionne en mémoire au lieu d'afficher une page blanche.

## Qualité

- **222 tests unitaires**, couverture vérifiée **fichier par fichier** : ≥ 80 % partout, ≥ 95 % pour le moteur (mesuré : 99,9 % des lignes, 96 % des branches). L'interface est incluse dans la mesure.
- Tests de propriétés (fast-check), contrat d'API rejoué sur les trois adaptateurs, contrôle axe-core, sécurité de l'API Node (cookies, CSRF, CORS, débit, IDOR, taille du corps).
- Chaque règle métier documentée est couverte par au moins un test (`npm run traceability:check`, vérifié en CI).
- Les tests E2E Playwright vivent dans le projet QA séparé.

## Licence

Projet pédagogique sans licence déclarée. Police Poppins sous licence SIL OFL (`public/fonts/OFL.txt`).
