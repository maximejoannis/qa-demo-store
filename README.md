# QA Demo Store

A static e-commerce teaching application built with HTML, CSS, vanilla JavaScript ES modules and Vite. It contains deterministic demo data, testable domain rules, unit tests and a GitHub Pages workflow. All accounts, products, addresses and payments are fictional.

**Live demo:** add your actual Pages URL here after publishing. The expected URL for a repository called `qa-demo-store` is `https://<username>.github.io/qa-demo-store/`.

## Features

- Registration, simulated login/logout, locked account, customer/admin permissions, editable profile and default delivery address.
- Six categories, 16 products with local SVG illustrations, detail pages, search, combined filters, six sort modes and pagination.
- Date-bounded promotions, wishlist and transfer to cart, reviews, stock limits, quantity editing and persistent cart.
- Coupons (`WELCOME10`, `SAVE20`, `FREESHIP`), three shipping methods, pricing in cents with tax, four checkout screens, deterministic demo payment, confirmation and order history/details.
- Cancellation with stock restoration, admin product stock/price/availability and order status controls.
- Light/dark mode, persisted sort/page size, accessible status messages, empty states and **Reset Demo Data**.

## Setup and commands

Requires Node.js 20 or later. From the repository root:

| Command                                   | Purpose                                       |
| ----------------------------------------- | --------------------------------------------- |
| `npm install` / `npm ci`                  | Install dependencies; use `npm ci` in CI      |
| `npm run dev`                             | Vite development server                       |
| `npm run build`                           | Produce static `dist/`                        |
| `npm run preview`                         | Serve the production build locally            |
| `npm test` / `npm run test:watch`         | Run unit tests once / continuously            |
| `npm run test:coverage`                   | V8 text, HTML and LCOV reports in `coverage/` |
| `npm run lint` / `npm run lint:fix`       | ESLint check / fix                            |
| `npm run format` / `npm run format:check` | Prettier write / check                        |
| `npm run quality`                         | Format, lint, coverage gate, production build |

Open the Vite URL ending in `/qa-demo-store/`. Opening source `index.html` with `file://` does not run a Vite application.

## Demo data

| Username        | Password   | Role            |
| --------------- | ---------- | --------------- |
| `standard_user` | `demo123`  | Customer        |
| `premium_user`  | `demo123`  | Customer        |
| `admin_user`    | `admin123` | Admin           |
| `locked_user`   | `demo123`  | Locked customer |

Demo Card `4242424242424242` is accepted; `4000000000000002` is declined, `4000000000000069` is expired, `4000000000000119` simulates a technical error. Pay on Delivery is also available. **Never enter a real card or personal password.** All records are stored only in this browser's localStorage; Reset Demo Data restores the original products, accounts, orders, reviews and preferences.

When updating an existing installation, the startup migration adds missing illustration paths and promotion dates to previously saved products while keeping edited stock, prices and orders. If the browser still shows an older deployed version, confirm that Pages publishes the latest successful workflow and reload the page without using the cached copy.

## Architecture and testing

`src/main.js` handles rendering, navigation and DOM events. `src/auth`, `catalog`, `cart`, `inventory`, `promotions`, `coupons`, `shipping`, `payment`, `pricing`, `orders`, `admin` and `storage` contain testable rules. `src/data` defines products; `public/products` holds SVG assets; `src/styles` contains responsive light/dark styles. Tests are in `tests/`.

Vitest and V8 enforce statements ≥ 90%, lines ≥ 90%, functions ≥ 90% and branches ≥ 85%. The V8 report **excludes the DOM shell `src/main.js`**; the two jsdom tests exercise selected UI flows, including checkout. These figures are _code coverage_. Functional coverage against user stories and end-to-end scenarios belongs to the later Playwright project and must be measured separately.

## GitHub Pages and CI

1. Create a public repository named `qa-demo-store` and place the **contents of this folder** at its root; push to `main`.
2. Under **Settings → Pages → Build and deployment**, choose **GitHub Actions** as source.
3. `.github/workflows/ci.yml` runs `npm ci`, Prettier, ESLint, tests with coverage gate and Vite build on pushes and pull requests to `main`. Only a successful push to `main` deploys `dist/`.
4. Vite uses `base: '/qa-demo-store/'`. The published entry point is `dist/index.html`; local SVGs, JS and CSS use the same base. Routes use hashes (`#/products/1`, `#/orders`, `#/admin`), so refresh and direct links do not require a server fallback.

## Limits and next steps

This public, browser-only application **does not provide real authentication or secure password storage**. Registration passwords reside in localStorage in plain text: use invented demo credentials exclusively. Payment never contacts a bank. Dates and order numbers are deterministic or derived from local browser state; no shared server state exists. The SVGs are illustrative drawings rather than product photos. Browser E2E, accessibility audits and functional coverage tracking are planned for the separate Playwright project. Publication and a live URL require the repository owner to perform the steps above.
