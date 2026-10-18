# Changelog

## 2.0.1 — 2026-10-18

### Corrigé

- Démarrage impossible (« Invalid ISO date: undefined ») dans un navigateur qui avait déjà ouvert la v1 sur la même adresse : la v1 stockait `qads:cart` sous une autre forme. Les clés v2 utilisent désormais le préfixe `qads2:` et chaque valeur lue est vérifiée (une valeur invalide est ignorée et supprimée). Test `WEB-CART-04`, reproduit dans Chromium avec de vraies données v1.
- L'écran d'erreur de démarrage propose un bouton « Effacer les données locales et recharger » (`data-testid="boot-reset"`).

## 2.0.0 — 2026-10-18

Réécriture complète, toujours en HTML, CSS et JavaScript vanilla (modules ES, Vite), un seul `package.json`.

### Ajouté

- Moteur de calcul côté back-end (`src/engine`) : TVA par taux, remises réparties au prorata, livraison par zone et poids, jours ouvrés et fériés, fidélité, paiement en plusieurs fois, rétractation, KPI, réapprovisionnement, durées de conservation.
- Back-end partagé (`src/backend`, routes `/api/v1/*`) exécuté dans la page (localStorage, repli en mémoire) et par une API Node optionnelle (`npm run server`).
- RGPD : bandeau de consentement, politique de confidentialité, export et suppression du compte, purge.
- Outils QA : barre d'outils, scénarios de données, horloge pilotable, identifiants déterministes, injection de latence et de pannes, six comptes à problème, contrat de `data-testid`, OpenAPI.
- Français et anglais, thème sombre, accessibilité WCAG 2.2 AA, couleurs d'`instructions.txt`, police Poppins auto-hébergée.
- 220 tests unitaires, couverture par fichier ≥ 80 % (moteur ≥ 95 %), matrice de traçabilité, tests de mutation facultatifs, Dependabot.

### Modifié

- Les prix affichés sont TTC (la v1 ajoutait la TVA à l'affichage) ; tous les montants sont recalculés par le back-end.
- Dates calculées en heure de Paris (la v1 utilisait UTC).
- Mots de passe hachés (PBKDF2) au lieu d'être stockés en clair.
- Rendu HTML échappé par défaut.
- CI : une file de concurrence par branche, Node lu dans `.nvmrc`, contrôle de traçabilité.

### Conservé

- Les 25 `data-testid` de la v1, les comptes et mots de passe de démonstration, les cartes de test, les codes promo, l'URL GitHub Pages.

### Supprimé

- Les modules v1 (`src/admin`, `auth`, `cart`, `catalog`, …) et leurs tests, remplacés par le moteur, le back-end et l'interface v2 (correspondance dans `docs/rapport-v2.md`).
