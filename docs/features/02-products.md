# 2. Products

The catalogue of what Brightloop sells, including options that change the price.

**Status:** ✅ built · 🟡 partly built · ⬜ not built. [All features](README.md)

## Features

| Feature | Status | Note |
| --- | --- | --- |
| Create products | ✅ | Admin only |
| Update products | 🟡 | API only; the screen has a retire and restore button but no edit form |
| Delete products | 🟡 | Retired rather than deleted, because old records refer to them |
| Name and notes | ✅ | Notes also serve as the description |
| Sales price and cost price | ✅ | |
| Product types | ✅ | Software, Add-on, Service |
| Product categories | ⬜ | Type is the only grouping |
| Variants | ✅ | Any attribute and value, such as Brand: Odoo |
| Additional pricing for variants | ✅ | |

## Rules

**Variant pricing:** a line's default unit price is the sales price plus the variant's extra price. A ₹1,000 product with the Odoo brand at +₹560 defaults to ₹1,560.

**Unique variants:** the same attribute and value can't be added twice to one product.

**Retired products** can't be added to new subscriptions. Existing subscriptions keep billing them.

**Tax:** the product type decides which [tax rules](07-billing-and-invoices.md#tax) apply.

**Cost price** is visible to the admin and staff, never to customers.

## Screens

Products: list, add product, and add or remove variants.

## API

`GET|POST /products`, `GET|PATCH /products/:id`, `POST /products/:id/variants`, `DELETE /products/:id/variants/:variantId`
