# Spécification des règles métier (oracle de test)

Ce document est la **référence des testeurs** : chaque règle porte un identifiant stable, un énoncé et, quand c'est utile, des exemples chiffrés au centime près. Les exemples `EX-xx` sont **aussi** des tests unitaires du moteur portant le même identifiant de règle : la spécification et le code ne peuvent pas diverger sans faire échouer la CI (`npm run traceability:check`).

Conventions : montants en euros TTC, calculés en **centimes entiers** ; dates interprétées dans le fuseau **Europe/Paris** ; version des règles `2026.10.1` (renvoyée par chaque devis dans `rulesVersion`).

## 1. Moteur de calcul (`src/engine`)

### Arithmétique et dates

| Règle          | Énoncé                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-MONEY-01` | Les montants sont des entiers de centimes positifs ; toute division utilise l'arrondi commercial (demi supérieur) en arithmétique entière.                          |
| `ENG-MONEY-02` | Une répartition au prorata se fait par troncature puis le reliquat va à la ligne de poids le plus élevé (première en cas d'égalité) ; la somme est toujours exacte. |
| `ENG-TIME-01`  | Toutes les dates métier sont des dates calendaires de Paris (le 30 juin 2026 à 22 h 30 UTC est le 1er juillet à Paris).                                             |
| `ENG-TIME-02`  | Ajouter des mois conserve le jour, ramené au dernier jour du mois si nécessaire (31 janvier + 1 mois = 28 ou 29 février).                                           |

### Catalogue

| Règle        | Énoncé                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-CAT-01` | Le prix promotionnel s'applique du `promoStart` au `promoEnd` inclus (dates de Paris) ; sinon le prix de référence (`oldPrice`) s'applique.                |
| `ENG-CAT-02` | Le pourcentage de remise affiché est arrondi à l'entier : 49,99 € au lieu de 59,99 € → −17 %.                                                              |
| `ENG-CAT-03` | Recherche (nom, description, catégorie, SKU, insensible à la casse), filtres sur le **prix effectif**, six tris avec départage par nom, pagination bornée. |
| `ENG-CAT-04` | Dès qu'un avis client existe, la note affichée est la moyenne des avis (arrondie au dixième), sinon la note initiale.                                      |
| `ENG-CAT-05` | Niveau de stock : 0 ou moins = rupture, 1 à 5 = stock faible, au-delà = en stock.                                                                          |

### TVA et devis

| Règle          | Énoncé                                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-VAT-01`   | Les prix sont **TTC**. Taux : 20 % par défaut, **5,5 %** pour la catégorie Livres.                                                                                           |
| `ENG-VAT-02`   | Par taux : HT = arrondi(TTC / (1 + taux)), TVA = TTC − HT. Donc HT + TVA = TTC exactement.                                                                                   |
| `ENG-VAT-03`   | Les frais de port suivent les taux des marchandises, répartis au prorata des montants nets par taux.                                                                         |
| `ENG-QUOTE-01` | Un devis refuse : panier vide ou de plus de 50 lignes, ligne en double, quantité hors 1-20 ou décimale, produit inactif, stock insuffisant, prix invalide, horloge invalide. |

### Remises

| Règle         | Énoncé                                                                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-DISC-01` | Un code promo est valable jusqu'au jour d'expiration inclus, 23:59:59 heure de Paris. Codes : `WELCOME10` (−10 %), `SAVE20` (−20 € dès 100 €), `FREESHIP` (livraison standard offerte), `OLD5` (expiré). |
| `ENG-DISC-02` | Le minimum d'achat s'apprécie sur les articles **après promotions**.                                                                                                                                     |
| `ENG-DISC-03` | La remise en pourcentage porte sur les articles TTC après promotions, arrondie au centime (demi supérieur). Un seul code par commande.                                                                   |
| `ENG-DISC-04` | La remise fixe est plafonnée au montant des articles ; les frais de port restent dus.                                                                                                                    |
| `ENG-DISC-05` | `FREESHIP` déduit les frais de port dans la limite du **tarif standard** du colis (en express, la différence reste due).                                                                                 |
| `ENG-DISC-06` | Les remises de commande (code + points) sont réparties sur les lignes au prorata (règle `ENG-MONEY-02`) pour une ventilation de TVA exacte.                                                              |

### Livraison

| Règle         | Énoncé                                                                                                                                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-SHIP-01` | Zones : FR (France, Monaco), UE (26 autres États), Monde. Tarif = base de la zone + supplément par kilogramme **entamé** au-delà de 1 kg. Standard : 4,90 € / 9,90 € / 19,90 € (+1 / +2 / +4 € par kg). Express : 12,90 € / 24,90 € / 39,90 € (+2 / +3 / +6 €). Retrait : gratuit, France uniquement. |
| `ENG-SHIP-02` | La livraison standard est offerte en France dès **50 € d'articles nets** (après remises).                                                                                                                                                                                                             |
| `ENG-SHIP-03` | La fenêtre de livraison est calculée en **jours ouvrés** français à partir de la date de commande : standard FR 3-5, UE 5-8, Monde 8-15 ; express 1-2 / 2-3 / 4-6 ; retrait le jour même (ou le jour ouvré suivant).                                                                                  |
| `ENG-SHIP-04` | Jours fériés : 1er janvier, 1er et 8 mai, 14 juillet, 15 août, 1er et 11 novembre, 25 décembre, lundi de Pâques, Ascension (Pâques + 39 j), lundi de Pentecôte (Pâques + 50 j). Pâques est calculé (algorithme grégorien anonyme).                                                                    |

### Fidélité

| Règle        | Énoncé                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ENG-LOY-01` | 1 point par euro entier payé sur les articles (hors port), multiplié selon le niveau : Bronze ×1, Argent ×1,25, Or ×1,5 (arrondi inférieur). Crédités au passage à « Livrée ». |
| `ENG-LOY-02` | Niveau calculé sur les points gagnés nets des retraits sur 365 jours glissants : Bronze 0-499, Argent 500-1 499, Or ≥ 1 500.                                                   |
| `ENG-LOY-03` | Échange : 100 points = 5 €, par multiples de 100, dans la limite du solde et de 30 % des articles après code promo.                                                            |
| `ENG-LOY-04` | Le solde est la somme des mouvements (gains et restitutions moins utilisations et retraits), jamais négatif.                                                                   |

### Paiement en plusieurs fois

| Règle         | Énoncé                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ENG-INST-01` | 3 ou 4 échéances sans frais, pour un total de 100 € à 2 000 € inclus, par carte uniquement.                                 |
| `ENG-INST-02` | Échéances égales arrondies à l'inférieur, reliquat ajouté à la **première**. La somme des échéances vaut toujours le total. |
| `ENG-INST-03` | Échéances mensuelles au même jour que la commande, ramenées au dernier jour du mois si nécessaire.                          |

### Retours et rétractation

| Règle        | Énoncé                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-RET-01` | Droit de rétractation de **14 jours** à compter de la livraison (Code de la consommation, art. L221-18) : le 14e jour est accepté, le 15e refusé. Une commande non livrée ne peut pas être retournée. |
| `ENG-RET-02` | Le remboursement d'une ligne est le montant réellement payé (net de la remise répartie), au prorata de la quantité retournée.                                                                         |
| `ENG-RET-03` | En cas de retour **total**, les frais de livraison initiaux sont remboursés dans la limite du tarif standard (art. L221-24).                                                                          |
| `ENG-RET-04` | Les points gagnés sont retirés au prorata du montant remboursé (arrondi supérieur, plafonné aux points gagnés).                                                                                       |

### Commandes, stocks, indicateurs, RGPD

| Règle         | Énoncé                                                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENG-ORD-01`  | Statuts : En préparation → Expédiée ou Annulée ; Expédiée → Livrée ; Livrée → Retour demandé → Remboursée. Toute autre transition est refusée. Annuler restitue le stock et les points utilisés.                           |
| `ENG-ORD-02`  | Les factures sont numérotées sans trou par année : `FA-2026-000001`, `FA-2026-000002`… (distinctes de l'identifiant de commande, aléatoire).                                                                               |
| `ENG-INV-01`  | Point de commande = arrondi supérieur(ventes moyennes par jour sur 30 jours × (délai 7 j + sécurité 3 j)). Les commandes annulées sont exclues.                                                                            |
| `ENG-INV-02`  | Quantité suggérée = couverture délai + sécurité + 30 jours − stock ; 5 unités minimum pour un produit en rupture sans ventes.                                                                                              |
| `ENG-KPI-01`  | Chiffre d'affaires TTC et HT hors commandes annulées, remboursements déduits (HT au prorata). Panier moyen = CA TTC / commandes non annulées.                                                                              |
| `ENG-KPI-02`  | Taux d'annulation = annulées / commandes de la période ; taux de retour = commandes retournées / commandes livrées ou retournées (en points de base).                                                                      |
| `ENG-KPI-03`  | Classements déterministes : quantité, puis CA, puis identifiant ; catégories par CA puis nom.                                                                                                                              |
| `ENG-PRIV-01` | Échéances de conservation : compte inactif 3 ans → anonymisation ; commande/facture 10 ans → suppression ; preuve de consentement 6 mois + 5 ans ; journal technique 1 an ; panier invité 30 jours ; alerte de stock 1 an. |
| `ENG-PRIV-02` | Un enregistrement est échu à partir du jour d'échéance (inclus). La purge est idempotente.                                                                                                                                 |
| `ENG-PRIV-03` | Le choix de cookies est redemandé 182 jours (6 mois) après avoir été donné.                                                                                                                                                |

### Exemples chiffrés obligatoires

| Exemple | Données                                                                                                                            | Résultat attendu                                                                                                                                                                         | Règles          |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `EX-01` | 2 × « Practical QA Handbook » (24,90 €, Livres) + 1 × « Wireless Headphones » (79,99 € en promotion), livraison standard en France | Articles 129,79 € ; port offert ; TVA 20 % : base 79,99 €, HT 66,66 €, TVA 13,33 € ; TVA 5,5 % : base 49,80 €, HT 47,20 €, TVA 2,60 € ; **total HT 113,86 €, TVA 15,93 €, TTC 129,79 €** | ENG-VAT-01, 02  |
| `EX-02` | 1 casque + 1 livre livrés en Allemagne (standard UE 9,90 €, 700 g)                                                                 | Port réparti 7,55 € (20 %) / 2,35 € (5,5 %) ; TVA 20 % : 87,54 € dont TVA 14,59 € ; TVA 5,5 % : 27,25 € dont TVA 1,42 € ; total 114,79 €                                                 | ENG-VAT-03      |
| `EX-03` | `EX-01` avec `WELCOME10`                                                                                                           | Remise 12,98 € (12,979 → arrondi) répartie 4,98 € (livres) + 8,00 € (casque, reliquat) ; total 116,81 €                                                                                  | ENG-DISC-03, 06 |
| `EX-04` | `SAVE20` sur un panier de 99,99 € puis de 100,00 €                                                                                 | 99,99 € : refusé (`COUPON_MINIMUM_NOT_MET`) ; 100,00 € : remise 20,00 €, total 80,00 €                                                                                                   | ENG-DISC-02     |
| `EX-05` | Paiement en 3 fois de 100,01 € à partir du 31 janvier 2026                                                                         | 33,35 € le 31/01, 33,33 € le 28/02, 33,33 € le 31/03                                                                                                                                     | ENG-INST-02, 03 |
| `EX-06` | Commande livrée le 1er octobre 2026                                                                                                | Retour accepté le 15 octobre (14e jour, même à 23 h), refusé le 16 octobre (`DEADLINE_PASSED`)                                                                                           | ENG-RET-01      |
| `EX-07` | Commande standard en France passée le vendredi 22 mai 2026 (lundi de Pentecôte le 25 mai)                                          | Livraison entre le jeudi 28 mai et le lundi 1er juin 2026                                                                                                                                | ENG-SHIP-03, 04 |

## 2. API (`src/backend`, servie dans la page et par l'API Node optionnelle)

| Règle         | Énoncé                                                                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API-AUTH-01` | L'inscription valide les champs (mot de passe ≥ 8 caractères avec lettre et chiffre, confirmation identique, conditions acceptées) et hache le mot de passe ; le consentement newsletter facultatif est prouvé. |
| `API-AUTH-02` | Identifiant et e-mail sont uniques (insensibles à la casse).                                                                                                                                                    |
| `API-AUTH-03` | Après 5 échecs de connexion, le compte est verrouillé 15 minutes (HTTP 423). `locked_user` est verrouillé en permanence (HTTP 403).                                                                             |
| `API-AUTH-04` | Une session expire après 8 heures ; la déconnexion la supprime.                                                                                                                                                 |
| `API-CAT-01`  | `GET /products` filtre, trie et pagine côté serveur (48 produits par page au maximum).                                                                                                                          |
| `API-CAT-03`  | Un client ne peut publier qu'un avis par produit (1 à 5 étoiles, 3 à 500 caractères).                                                                                                                           |
| `API-CAT-04`  | L'alerte de retour en stock exige un consentement explicite et un produit en rupture ; elle est marquée « notifiée » au réassort.                                                                               |
| `API-CHK-01`  | Les devis sont calculés par le serveur à partir des identifiants et quantités : **aucun prix n'est accepté du client** ; un visiteur ne peut pas utiliser de points.                                            |
| `API-CHK-03`  | Une commande exige un en-tête `Idempotency-Key` ; rejouer la même clé renvoie la même commande. Un devis expire après 15 minutes, ne sert qu'une fois et n'est utilisable que par son auteur.                   |
| `API-CHK-04`  | À la commande, le devis est recalculé : si le total a changé, la commande est refusée (`PRICE_CHANGED`).                                                                                                        |
| `API-CHK-05`  | Paiement simulé : seules les cartes de test documentées existent ; seuls les 4 derniers chiffres sont conservés.                                                                                                |
| `API-ORD-01`  | Un client ne voit que ses commandes ; la commande d'un autre est signalée comme inexistante (404).                                                                                                              |
| `API-ACC-03`  | `GET /me/export` renvoie toutes les données personnelles du compte au format JSON (sans hachage de mot de passe).                                                                                               |
| `API-ACC-04`  | `DELETE /me` (mot de passe requis) supprime le compte, les favoris, les points, les alertes et les sessions ; les commandes sont conservées détachées du compte (pseudonyme `deleted-xxxxxxxx`).                |
| `API-ADM-04`  | `POST /admin/privacy/purge` applique `ENG-PRIV-01` et supprime devis et sessions expirés ; deux exécutions successives ne suppriment rien de plus.                                                              |
| `API-SYS-01`  | Les routes `/demo/*` n'existent qu'en mode démo ; hors mode démo, l'horloge réelle est utilisée.                                                                                                                |
| `API-SYS-02`  | `/demo/reset` recharge un scénario, `/demo/clock` fige l'horloge, `/demo/ids` rend les identifiants déterministes.                                                                                              |

## 3. Sécurité

| Règle    | Énoncé                                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| `SEC-01` | API Node : cookie de session `HttpOnly`, `SameSite=Strict` (`Secure` en HTTPS), jeton jamais exposé dans une réponse. |
| `SEC-03` | API Node : toute requête modifiante doit porter l'en-tête `X-Requested-With: qads` (anti-CSRF).                       |
| `SEC-05` | API Node : limitation de débit à 600 requêtes par minute et par IP, 10 tentatives de connexion par minute.            |
| `SEC-07` | Pas d'IDOR : lecture, annulation, facture et retour d'une commande vérifient le propriétaire.                         |
| `SEC-08` | Les champs inconnus sont refusés (schémas stricts) : un prix envoyé par le client provoque une erreur 400.            |
| `SEC-09` | Les journaux ne contiennent ni mot de passe, ni jeton, ni identifiant en clair (pseudonymes SHA-256 tronqués).        |

## 4. Interface (`src/ui`)

| Règle             | Énoncé                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEB-SEC-01`      | Toute donnée affichée est échappée par défaut (gabarit `html`) ; aucun `innerHTML` en dehors de `mount`.                                                            |
| `WEB-I18N-01`     | Interface en français par défaut, anglais disponible ; langue détectée (`?lang`, préférence, navigateur) ; dates et montants formatés par `Intl` en heure de Paris. |
| `WEB-CART-01`     | Le panier n'affiche que des montants calculés par le serveur (devis), avec ventilation de TVA et estimation de livraison.                                           |
| `WEB-CART-03`     | Le panier (identifiants et quantités uniquement) est conservé localement 30 jours au plus.                                                                          |
| `WEB-CHK-01`      | Commande en 4 étapes : adresse, livraison et avantages (points), paiement (échéancier si éligible), vérification.                                                   |
| `WEB-CAT-03`      | Comparateur de 3 produits au maximum.                                                                                                                               |
| `WEB-RGPD-01`     | Bandeau de consentement : « Tout refuser » aussi visible que « Tout accepter », aucune case pré-cochée, preuve horodatée envoyée au back-end.                       |
| `WEB-RGPD-02`     | Les produits consultés récemment ne sont mémorisés qu'avec le consentement « Personnalisation » ; le retrait les efface.                                            |
| `WEB-RGPD-03`     | Le choix est redemandé après 6 mois (`ENG-PRIV-03`) ou au changement de version de la politique.                                                                    |
| `WEB-QA-01`       | Paramètres d'URL : `?qa=1`, `?now=<ISO>`, `?seed=<n>` (ou `off`), `?lang=fr` ou `en`, `?latency=<ms>`, `?fail=<route>:<code>`.                                      |
| `WEB-QA-02`       | La barre d'outils QA change de scénario, fige ou libère l'horloge et injecte latence et pannes.                                                                     |
| `WEB-CONTRACT-01` | Chaque `data-testid` déclaré est affiché par au moins une vue ; aucune violation d'accessibilité sérieuse (axe-core).                                               |

## 5. Défauts volontaires

Les règles `FAULT-*` (comptes à problème) sont décrites, sans leur solution, dans `docs/qa/comptes-de-test.md`, et en détail dans `docs/qa/corrige-defauts.md`.

| Règle           | Énoncé                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| `FAULT-PRB-01`  | Défaut actif uniquement pour son compte et si les défauts sont activés. |
| `FAULT-GLT-01`  | Idem.                                                                   |
| `FAULT-ERR-01`  | Idem.                                                                   |
| `FAULT-RND-01`  | Idem ; le moteur de calcul ne contient aucun défaut.                    |
| `FAULT-A11Y-01` | Idem ; le contrôle axe-core détecte bien ce défaut.                     |
| `FAULT-I18N-01` | Idem.                                                                   |
