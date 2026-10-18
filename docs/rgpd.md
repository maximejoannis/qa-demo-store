# RGPD dans QA Demo Store

L'application est un **terrain d'entraînement QA** : le responsable de traitement est fictif et toutes les données le sont aussi. Les dispositifs RGPD ci-dessous existent pour être **testés** (fonctionnellement et automatiquement), à partir des règles `ENG-PRIV-*`, `API-ACC-*`, `API-ADM-04` et `WEB-RGPD-*` de [`specs/regles-metier.md`](specs/regles-metier.md).

## Ce qui est testable

| Dispositif                    | Où                                     | Ce qu'on peut vérifier                                                                                     |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Bandeau de consentement       | Première visite                        | « Tout refuser » aussi visible que « Tout accepter », aucune case pré-cochée, choix redemandé après 6 mois |
| Preuve de consentement        | `POST /api/v1/consents`                | Horodatage, version de la politique, choix enregistrés                                                     |
| Produits consultés récemment  | Fiche produit, accueil                 | Mémorisés seulement avec le consentement « Personnalisation » ; effacés au retrait                         |
| Politique de confidentialité  | Pied de page → Confidentialité         | Finalités, bases légales, durées, droits                                                                   |
| Mentions sous les formulaires | Inscription, commande                  | Information au moment de la collecte                                                                       |
| Droit d'accès et portabilité  | Compte → Mes données, `GET /me/export` | Export JSON complet, sans hachage de mot de passe                                                          |
| Rectification                 | Compte → Profil                        | Mise à jour des données                                                                                    |
| Droit à l'effacement          | `DELETE /me` (mot de passe requis)     | Compte, favoris, points, alertes et sessions supprimés ; commandes conservées mais détachées (pseudonyme)  |
| Newsletter                    | Inscription, Mes données               | Case non cochée par défaut, retrait possible                                                               |
| Purge selon les durées        | Admin → Purge, scénario `rgpd-expired` | Suppression ou anonymisation des données échues ; une deuxième purge ne supprime rien de plus              |
| Minimisation                  | Paiement                               | Seuls les 4 derniers chiffres de la carte sont conservés                                                   |
| Journaux pseudonymisés        | API Node (sortie console)              | Ni mot de passe, ni jeton, ni identifiant en clair                                                         |

## Durées de conservation appliquées par le moteur (`ENG-PRIV-01`)

| Donnée                    | Durée                            |
| ------------------------- | -------------------------------- |
| Compte inactif            | 3 ans après la dernière activité |
| Factures et commandes     | 10 ans                           |
| Choix de cookies          | 6 mois (182 jours)               |
| Preuve de consentement    | durée du consentement + 5 ans    |
| Journaux techniques       | 1 an                             |
| Panier invité             | 30 jours                         |
| Alerte de retour en stock | 1 an                             |

## Rappel

Aucune donnée réelle ne doit être saisie. En mode « dans la page », tout reste dans le navigateur (localStorage) ; aucun service externe, aucun CDN, aucun outil d'analyse n'est utilisé (polices auto-hébergées).
