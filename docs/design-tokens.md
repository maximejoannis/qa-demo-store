# Design tokens

Les six couleurs du fichier `instructions.txt` sont **imposées** et définies telles quelles dans `src/styles/main.css` (`:root`). Le test `DESIGN-01` échoue si l'une d'elles change ; `DESIGN-02` vérifie que chaque couple texte/fond utilisé atteint 4,5:1 (WCAG 2.2 AA) dans les deux thèmes.

## Thème clair (imposé)

| Token               | Valeur    | Usage                                                |
| ------------------- | --------- | ---------------------------------------------------- |
| `--primary-color`   | `#2563eb` | Boutons, liens, élément actif                        |
| `--secondary-color` | `#1e40af` | Survol, focus                                        |
| `--text-color`      | `#1f2937` | Texte principal                                      |
| `--light-text`      | `#6b7280` | Texte secondaire **sur fond blanc uniquement**       |
| `--background`      | `#ffffff` | Fond de page, cartes                                 |
| `--section-bg`      | `#f3f4f6` | Fonds de sections, filtres, tableaux, récapitulatifs |

## Tokens dérivés

| Token                                 | Clair                                 | Sombre                            | Raison                                          |
| ------------------------------------- | ------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `--light-text-on-section`             | `#4b5563`                             | `#d1d5db`                         | `#6b7280` sur `#f3f4f6` ne fait que **4,39:1**  |
| `--on-primary`                        | `#ffffff`                             | `#111827`                         | Texte des boutons                               |
| `--border`                            | `#d1d5db`                             | `#374151`                         | Bordures                                        |
| `--hero-gradient`                     | `135deg, #f0f9ff → #e0f2fe`           | `#172554 → #1e3a8a`               | Bandeau d'accueil (repris d'`instructions.txt`) |
| `--nav-bg`                            | `rgba(255,255,255,0.95)` + flou 10 px | `rgba(17,24,39,0.95)`             | Barre de navigation fixe                        |
| `--success` / `--warning` / `--error` | `#047857` / `#92400e` / `#b91c1c`     | `#34d399` / `#fbbf24` / `#fca5a5` | États                                           |

## Thème sombre

| Token               | Valeur    |
| ------------------- | --------- |
| `--primary-color`   | `#60a5fa` |
| `--secondary-color` | `#93c5fd` |
| `--text-color`      | `#f3f4f6` |
| `--light-text`      | `#9ca3af` |
| `--background`      | `#111827` |
| `--section-bg`      | `#1f2937` |

## Contrastes mesurés (thème clair)

| Couple                  | Ratio                 |
| ----------------------- | --------------------- |
| `#1f2937` sur `#ffffff` | 14,7:1                |
| `#1f2937` sur `#f3f4f6` | 13,3:1                |
| `#6b7280` sur `#ffffff` | 4,83:1                |
| `#6b7280` sur `#f3f4f6` | 4,39:1 (**interdit**) |
| `#4b5563` sur `#f3f4f6` | 6,87:1                |
| `#ffffff` sur `#2563eb` | 5,17:1                |
| `#ffffff` sur `#1e40af` | 8,72:1                |
| `#2563eb` sur `#f3f4f6` | 4,70:1                |

## Typographie et effets

Poppins 300 à 700 **auto-hébergée** (fichiers `public/fonts/*.woff2`, licence OFL, aucun appel à Google Fonts), tailles fluides avec `clamp()`, rayons de 1rem, ombres et soulèvement au survol, points de rupture 768 px et 480 px, animations neutralisées avec `prefers-reduced-motion`.
