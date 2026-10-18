# Contrat des `data-testid`

> Fichier généré par `npm run docs` à partir de `src/ui/testids.js`. Ne pas modifier à la main.

Convention : `kebab-case`, `<zone>-<élément>[-<id>]`. `{id}` désigne la partie dynamique (identifiant de produit, de commande, code…).
Les 25 identifiants de la v1 sont conservés à l'identique (colonne « Depuis »). Le test `WEB-CONTRACT-01` vérifie que chaque identifiant déclaré est réellement affiché par au moins une vue.

Pour attendre sans délai fixe :

- `[data-testid="view"]` porte `data-view` (nom de la vue), `data-state` (`loading`, `ready`, `error`, `empty`) et `aria-busy`.
- Les messages utilisent `[data-testid="message"]` avec `role="status"` (succès) ou `role="alert"` (erreur).

Exemple Playwright :

```js
await page.goto('/qa-demo-store/?qa=1&seed=42&now=2026-10-12T10:00:00%2B02:00#/products');
await expect(page.getByTestId('view')).toHaveAttribute('data-state', 'ready');
await page.getByTestId('product-add-cart-17').click();
await expect(page.getByTestId('cart-badge')).toHaveText('1');
```

| data-testid | Constante | Depuis |
| --- | --- | --- |
| `logo` | `TID.logo` | v2 |
| `nav-{id}` | `TID.navLink` | v2 |
| `cart-badge` | `TID.cartBadge` | v1 |
| `message` | `TID.message` | v1 |
| `message-dismiss` | `TID.messageDismiss` | v2 |
| `lang-{id}` | `TID.langSwitch` | v2 |
| `theme-toggle` | `TID.themeToggle` | v2 |
| `logout` | `TID.logout` | v2 |
| `reset-demo` | `TID.resetDemo` | v1 |
| `demo-banner` | `TID.demoBanner` | v2 |
| `view` | `TID.viewRoot` | v2 |
| `consent-banner` | `TID.consentBanner` | v2 |
| `consent-accept-all` | `TID.consentAcceptAll` | v2 |
| `consent-reject-all` | `TID.consentRejectAll` | v2 |
| `consent-customize` | `TID.consentCustomize` | v2 |
| `consent-save` | `TID.consentSave` | v2 |
| `consent-manage` | `TID.consentManage` | v2 |
| `search-input` | `TID.searchInput` | v1 |
| `search-submit` | `TID.searchSubmit` | v2 |
| `category-filter` | `TID.categoryFilter` | v1 |
| `sort-select` | `TID.sortSelect` | v1 |
| `per-page-select` | `TID.perPageSelect` | v2 |
| `filter-min` | `TID.filterMin` | v2 |
| `filter-max` | `TID.filterMax` | v2 |
| `filter-in-stock` | `TID.filterInStock` | v2 |
| `filter-rating` | `TID.filterRating` | v2 |
| `reset-filters` | `TID.resetFilters` | v2 |
| `product-card-{id}` | `TID.productCard` | v1 |
| `product-add-cart-{id}` | `TID.productAddCart` | v1 |
| `product-add-wishlist-{id}` | `TID.productAddWishlist` | v1 |
| `product-compare-{id}` | `TID.productCompare` | v2 |
| `product-price-{id}` | `TID.productPrice` | v2 |
| `page-{id}` | `TID.pageButton` | v2 |
| `recently-viewed` | `TID.recentlyViewed` | v2 |
| `detail-title` | `TID.detailTitle` | v2 |
| `detail-qty` | `TID.detailQty` | v2 |
| `detail-add-cart` | `TID.detailAddCart` | v2 |
| `detail-stock-alert` | `TID.detailStockAlert` | v2 |
| `installments-simulator` | `TID.installmentsSimulator` | v2 |
| `installment-{id}` | `TID.installmentRow` | v2 |
| `review-form` | `TID.reviewForm` | v2 |
| `review-submit` | `TID.reviewSubmit` | v2 |
| `review-{id}` | `TID.reviewItem` | v2 |
| `compare-table` | `TID.compareTable` | v2 |
| `compare-remove-{id}` | `TID.compareRemove` | v2 |
| `cart-item-{id}` | `TID.cartItem` | v1 |
| `cart-qty-{id}` | `TID.cartQty` | v2 |
| `cart-remove-{id}` | `TID.cartRemove` | v2 |
| `cart-total` | `TID.cartTotal` | v1 |
| `coupon-input` | `TID.couponInput` | v1 |
| `coupon-apply` | `TID.couponApply` | v1 |
| `coupon-remove` | `TID.couponRemove` | v2 |
| `shipping-method` | `TID.shippingMethod` | v1 |
| `shipping-country` | `TID.shippingCountry` | v2 |
| `delivery-estimate` | `TID.deliveryEstimate` | v2 |
| `summary-{id}` | `TID.summaryLine` | v2 |
| `vat-{id}` | `TID.vatLine` | v2 |
| `checkout-link` | `TID.checkoutLink` | v2 |
| `checkout-step-{id}` | `TID.checkoutStep` | v2 |
| `checkout-address` | `TID.checkoutAddress` | v1 |
| `checkout-field-{id}` | `TID.checkoutField` | v2 |
| `checkout-next` | `TID.checkoutNext` | v2 |
| `checkout-back` | `TID.checkoutBack` | v2 |
| `loyalty-redeem` | `TID.loyaltyRedeem` | v2 |
| `installments-choice` | `TID.installmentsChoice` | v2 |
| `payment-method` | `TID.paymentMethod` | v1 |
| `payment-card` | `TID.paymentCard` | v2 |
| `place-order` | `TID.placeOrder` | v1 |
| `order-confirmation` | `TID.orderConfirmation` | v1 |
| `order-number` | `TID.orderNumber` | v1 |
| `order-{id}` | `TID.orderRow` | v1 |
| `order-status-{id}` | `TID.orderStatus` | v2 |
| `order-cancel-{id}` | `TID.orderCancel` | v2 |
| `order-invoice-{id}` | `TID.orderInvoice` | v2 |
| `return-form` | `TID.returnForm` | v2 |
| `return-qty-{id}` | `TID.returnQty` | v2 |
| `return-quote` | `TID.returnQuote` | v2 |
| `return-submit` | `TID.returnSubmit` | v2 |
| `return-result` | `TID.returnResult` | v2 |
| `invoice` | `TID.invoice` | v2 |
| `invoice-print` | `TID.invoicePrint` | v2 |
| `login-username` | `TID.loginUsername` | v1 |
| `login-password` | `TID.loginPassword` | v1 |
| `login-submit` | `TID.loginSubmit` | v1 |
| `register-{id}` | `TID.registerField` | v2 |
| `register-submit` | `TID.registerSubmit` | v2 |
| `wishlist-move-{id}` | `TID.wishlistMove` | v2 |
| `profile-{id}` | `TID.profileField` | v2 |
| `profile-submit` | `TID.profileSubmit` | v2 |
| `loyalty-balance` | `TID.loyaltyBalance` | v2 |
| `loyalty-tier` | `TID.loyaltyTier` | v2 |
| `loyalty-history` | `TID.loyaltyHistory` | v2 |
| `preferences-submit` | `TID.preferencesSubmit` | v2 |
| `my-data-export` | `TID.myDataExport` | v2 |
| `my-data-newsletter` | `TID.myDataNewsletter` | v2 |
| `my-data-delete-password` | `TID.myDataDeletePassword` | v2 |
| `my-data-delete` | `TID.myDataDelete` | v2 |
| `privacy-policy` | `TID.privacyPolicy` | v2 |
| `admin-product-{id}` | `TID.adminProduct` | v1 |
| `admin-stock-{id}` | `TID.adminStock` | v1 |
| `admin-price-{id}` | `TID.adminPrice` | v2 |
| `admin-active-{id}` | `TID.adminActive` | v2 |
| `admin-save-{id}` | `TID.adminSave` | v2 |
| `admin-order-{id}` | `TID.adminOrder` | v2 |
| `admin-status-{id}` | `TID.adminStatus` | v2 |
| `kpi-{id}` | `TID.adminKpi` | v2 |
| `kpi-from` | `TID.adminKpiFrom` | v2 |
| `kpi-to` | `TID.adminKpiTo` | v2 |
| `kpi-chart` | `TID.adminChart` | v2 |
| `reorder-{id}` | `TID.adminReorder` | v2 |
| `admin-purge` | `TID.adminPurge` | v2 |
| `admin-purge-result` | `TID.adminPurgeResult` | v2 |
| `qa-toolbar` | `TID.qaToolbar` | v2 |
| `qa-scenario` | `TID.qaScenario` | v2 |
| `qa-reset` | `TID.qaReset` | v2 |
| `qa-clock` | `TID.qaClock` | v2 |
| `qa-clock-freeze` | `TID.qaClockFreeze` | v2 |
| `qa-clock-real` | `TID.qaClockReal` | v2 |
| `qa-latency` | `TID.qaLatency` | v2 |
| `qa-fail` | `TID.qaFail` | v2 |
| `qa-apply` | `TID.qaApply` | v2 |
| `qa-info` | `TID.qaInfo` | v2 |
