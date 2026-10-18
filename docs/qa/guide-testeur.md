# Guide du testeur

Point d'entrée pour tester **QA Demo Store v2**, à la main ou avec Playwright. Toutes les données sont fictives.

## 1. Où tester

| Mode         | Commande / URL                                                       | Back-end                                   | Usage conseillé                                   |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------- |
| **En ligne** | `https://maximejoannis.github.io/qa-demo-store/`                     | Dans la page (localStorage)                | Tests fonctionnels, exploratoires, E2E Playwright |
| **Local**    | `npm run dev` puis `http://localhost:5173/qa-demo-store/`            | Dans la page (localStorage)                | Même chose, hors ligne                            |
| **API Node** | `npm run server` (port 3000) **et** `npm run dev:server` (port 5173) | Serveur Node local, fichier `data/db.json` | Tests d'API, cookies, CSRF, limitation de débit   |

Les deux back-ends partagent **le même code** (`src/backend`) : mêmes routes, mêmes règles, mêmes réponses (tests `PARITY-*`). Le bandeau « Mode démo » rappelle que, dans la page, la sécurité est simulée (tout s'exécute chez l'utilisateur) ; les garanties serveur se testent avec l'API Node.

Si le navigateur bloque le stockage (navigation privée stricte), l'application fonctionne quand même, en mémoire : la barre QA affiche alors `local (mémoire)` et un rechargement remet les données à zéro.

## 2. Comptes, cartes et codes

| Compte             | Mot de passe | Particularité                                   |
| ------------------ | ------------ | ----------------------------------------------- |
| `standard_user`    | `demo123`    | Client, adresse par défaut à Lyon               |
| `premium_user`     | `demo123`    | Client niveau Argent (620 points)               |
| `admin_user`       | `admin123`   | Administrateur                                  |
| `locked_user`      | `demo123`    | Verrouillé en permanence (403)                  |
| comptes à problème | `demo123`    | Défauts volontaires : voir `comptes-de-test.md` |

Cartes de test : `4242 4242 4242 4242` acceptée ; `4000 0000 0000 0002` refusée ; `4000 0000 0000 0069` expirée ; `4000 0000 0000 0119` erreur technique (502). Tout autre numéro est refusé. Le paiement à la livraison est disponible.

Codes promo : `WELCOME10` (−10 %), `SAVE20` (−20 € dès 100 €), `FREESHIP` (port offert), `OLD5` (expiré).

## 3. Maîtriser l'état

### Scénarios de données

Bouton **Réinitialiser les données de démo**, barre QA ou `POST /api/v1/demo/reset {"scenario": "…"}` :

| Scénario        | Contenu                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `default`       | 18 produits, comptes de démo, aucune commande                                                                                |
| `empty-catalog` | Aucun produit (états vides)                                                                                                  |
| `low-stock`     | Stocks de 0 à 3 (alertes, réapprovisionnement)                                                                               |
| `order-history` | Commandes de `standard_user` dans tous les statuts, dont une livrée il y a 13 jours (retour possible) et une il y a 15 jours |
| `loyalty-gold`  | `standard_user` au niveau Or (1 600 points)                                                                                  |
| `rgpd-expired`  | Compte inactif depuis plus de 3 ans, vieilles commandes et preuves (pour tester la purge)                                    |

Un reset supprime les sessions : reconnectez-vous ensuite.

### Horloge pilotable

- URL : `?now=2026-12-31T23:59:30%2B01:00` (encodez le `+` en `%2B`).
- API : `POST /api/v1/demo/clock {"now": "2026-12-31T23:59:30+01:00"}`, puis `DELETE /api/v1/demo/clock` pour revenir à l'heure réelle.
- L'horloge pilote promotions, coupons, rétractation, livraison, fidélité, purge, validité des devis et des sessions.

### Identifiants déterministes

`?seed=42` (ou `POST /api/v1/demo/ids {"seed": 42}`) rend les numéros de commande prévisibles ; `?seed=off` revient à l'aléatoire.

### Barre d'outils QA

`?qa=1` (ou Préférences → « Afficher la barre d'outils QA »). Elle affiche le transport (`local`, `local (mémoire)` ou `server`), le scénario, le compte connecté et son profil de défaut, et permet de changer de scénario, de figer l'horloge et d'injecter :

- une **latence** : `?latency=2000` ;
- des **pannes** : `?fail=quotes:503,products:500` (format `route:code`, la route est le premier segment après `/api/v1/`).

Ces injections sont faites par le client de la page : la requête n'est pas envoyée.

## 4. Sélecteurs et synchronisation

- Contrat des `data-testid` : [`testids.md`](testids.md) (généré). Les identifiants de la v1 sont conservés.
- Attendre un état plutôt qu'un délai : `[data-testid="view"][data-state="ready"]` (valeurs `loading`, `ready`, `error`, `empty`) et `data-view="<vue>"`.
- Messages : `[data-testid="message"]` (`role="status"` ou `role="alert"`).

Exemple Playwright (projet QA séparé) :

```js
import { test, expect } from '@playwright/test';

test('ajout au panier', async ({ page }) => {
  await page.goto('/qa-demo-store/?seed=42&now=2026-10-12T10:00:00%2B02:00#/products');
  await expect(page.getByTestId('view')).toHaveAttribute('data-state', 'ready');
  await page.getByTestId('product-add-cart-3').click();
  await expect(page.getByTestId('cart-badge')).toHaveText('1');
});
```

## 5. API

- Spécification OpenAPI 3 : `public/openapi.json`, publiée sur `…/qa-demo-store/openapi.json`.
- Erreurs au format `application/problem+json` (RFC 9457) avec un `code` stable (ex. `COUPON_MINIMUM_NOT_MET`).
- Les champs inconnus sont refusés (400) : impossible d'envoyer un prix.
- `POST /orders` exige l'en-tête `Idempotency-Key`.
- API Node : session par cookie `qads_session` (HttpOnly, SameSite=Strict) ; toute requête modifiante doit porter `X-Requested-With: qads` ; origines autorisées par défaut `http://localhost:5173` et `http://localhost:4173`.

Exemple PowerShell contre l'API Node :

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post http://localhost:3000/api/v1/auth/login -WebSession $s `
  -Headers @{ 'X-Requested-With' = 'qads' } -ContentType 'application/json' `
  -Body '{"username":"standard_user","password":"demo123"}'
Invoke-RestMethod http://localhost:3000/api/v1/auth/me -WebSession $s
```

## 6. Oracle

Les résultats attendus (règles et exemples chiffrés au centime) sont dans [`../specs/regles-metier.md`](../specs/regles-metier.md). La matrice [`../tracabilite.md`](../tracabilite.md) indique quels tests unitaires couvrent chaque règle.

## 7. Limites connues

- Dans la page, la sécurité est simulée et les données sont propres à chaque navigateur.
- L'API Node n'est pas déployée publiquement : elle tourne en local (et dans les tests).
- La TVA française est appliquée quelle que soit la destination (simplification volontaire).
