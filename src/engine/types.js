/**
 * Shared JSDoc types of the calculation engine (documentation only, no runtime code).
 *
 * @typedef {number} Cents Integer amount in cents (TTC unless stated otherwise).
 * @typedef {string} IsoDate Calendar date `YYYY-MM-DD`, interpreted in Europe/Paris.
 * @typedef {'standard' | 'express' | 'pickup'} ShippingMethodId
 * @typedef {'FR' | 'EU' | 'WORLD'} Zone
 * @typedef {'bronze' | 'silver' | 'gold'} LoyaltyTier
 * @typedef {'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'ReturnRequested' | 'Refunded'} OrderStatus
 *
 * @typedef {object} Product
 * @property {number} id
 * @property {string} sku
 * @property {string} name
 * @property {string} description
 * @property {string} category
 * @property {Cents} price Current selling price, TTC.
 * @property {Cents} oldPrice Reference price before promotion (0 when none).
 * @property {IsoDate | null} promoStart
 * @property {IsoDate | null} promoEnd
 * @property {number} stock
 * @property {number} weightGrams
 * @property {number} rating
 * @property {number} reviews
 * @property {string} badge
 * @property {boolean} isNew
 * @property {string} image
 * @property {boolean} active
 *
 * @typedef {object} QuoteInput
 * @property {{ product: Product, qty: number }[]} lines
 * @property {string | null} [couponCode]
 * @property {ShippingMethodId} shippingMethod
 * @property {string} country ISO 3166-1 alpha-2 code.
 * @property {{ balance: number, tier: LoyaltyTier, redeem: number } | null} [loyalty]
 * @property {Date} now
 *
 * @typedef {object} QuoteLine
 * @property {number} productId
 * @property {string} name
 * @property {string} category
 * @property {number} qty
 * @property {Cents} unitPrice
 * @property {Cents} gross unitPrice × qty.
 * @property {Cents} discount Share of the order-level discounts.
 * @property {Cents} net Amount actually paid for the line.
 * @property {number} vatBp VAT rate in basis points (2000 = 20 %).
 *
 * @typedef {object} VatLine
 * @property {number} rateBp
 * @property {Cents} ttc
 * @property {Cents} ht
 * @property {Cents} vat
 *
 * @typedef {object} Quote
 * @property {string} engineVersion
 * @property {string} rulesVersion
 * @property {QuoteLine[]} lines
 * @property {Cents} merchandise
 * @property {{ code: string, type: string, discount: Cents, shippingDiscount: Cents } | null} coupon
 * @property {Cents} loyaltyDiscount
 * @property {number} loyaltyPointsRedeemed
 * @property {Cents} merchandiseNet
 * @property {{ method: ShippingMethodId, zone: Zone, gross: Cents, discount: Cents, net: Cents, weightGrams: number }} shipping
 * @property {Cents} standardShippingCost
 * @property {VatLine[]} vat
 * @property {Cents} totalHt
 * @property {Cents} totalVat
 * @property {Cents} total
 * @property {number} loyaltyPointsEarned
 * @property {{ from: IsoDate, to: IsoDate }} delivery
 *
 * @typedef {object} LoyaltyEntry
 * @property {'earn' | 'redeem' | 'revoke' | 'restore'} type
 * @property {number} points Always positive; the sign comes from the type.
 * @property {IsoDate} date
 * @property {string} orderId
 */
export {};
