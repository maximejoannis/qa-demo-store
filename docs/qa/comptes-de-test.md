# Comptes à problème (exercices de détection de défauts)

Ces comptes contiennent des **défauts volontaires**. Ils ne touchent que le compte concerné ; les comptes normaux se comportent toujours correctement : comparez avec `standard_user`. Les défauts sont actifs dans la page et sur l'API Node (désactivables sur l'API Node avec la variable d'environnement `QADS_FAULTS=0`).

Mot de passe de tous ces comptes : `demo123`. Le corrigé est dans `corrige-defauts.md` (à retirer du dépôt pour un usage en formation).

| Compte          | Où chercher                                          | Type de test ciblé                             |
| --------------- | ---------------------------------------------------- | ---------------------------------------------- |
| `problem_user`  | Catalogue (tri, images), tunnel de commande          | Fonctionnel, visuel                            |
| `glitch_user`   | Connexion, panier, validation de commande            | Synchronisation, robustesse, double soumission |
| `error_user`    | Validation de commande, messages d'erreur            | Gestion des erreurs, qualité des messages      |
| `rounding_user` | Totaux du panier avec code promo, ventilation de TVA | Calculs, valeurs limites, cohérence HT/TVA/TTC |
| `a11y_user`     | Formulaires, navigation au clavier, prix             | Accessibilité (WCAG 2.2 AA)                    |
| `i18n_user`     | Panier, dates                                        | Internationalisation                           |

Conseils : comparez avec la spécification (`docs/specs/regles-metier.md`), utilisez la barre QA pour fixer l'horloge et le scénario, et rédigez vos fiches d'anomalie avec le modèle « Anomalie » des issues GitHub (`.github/ISSUE_TEMPLATE/anomalie.md`).
