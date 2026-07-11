# Phase 4.3 — Operator Flow Audit

**Date:** 2026-07-12
**Branch:** `harden-v2-boundaries`
**Purpose:** Verify every operator action has an accessible API route and admin UI control before implementation.

## Audit Table

| Step | Action | Existing API | Existing UI | Operator can complete | Gap | Required action |
|------|--------|-------------|-------------|----------------------|-----|-----------------|
| 1 | Create client | NONE | NONE | NO | No client-store, no `/api/clients`, no UI | Create client-store + API route + admin UI |
| 2 | Create order | NONE | NONE | NO | No order-store, no `/api/orders`, no UI | Create order-store + API route + admin UI |
| 3 | Enter client request | NONE (order.note exists in DB) | NONE | NO | No way to enter request text | Add request text input in order creation |
| 4 | Run advisor classification | `classifyIntent()` pure function | NONE | NO | Not exposed via API | Create `/api/advisor` POST endpoint |
| 5 | Confirm Level 1 | via `createEngagement('level_1')` | Create engagement modal | YES | Engagement creation works for level_1 | None — already works |
| 6 | Record rough result | order.note field exists | NONE | NO | No UI to view/update order notes | Add order detail view |
| 7 | Upgrade order to Package A/B | via `createEngagement('package_a'/'package_b')` | Create engagement modal | YES | Already works | None |
| 8 | See upgrade in history | `listOrderEngagements` API exists | Engagements view | YES | Already works | None |
| 9 | Create engagement (A=10k) | `POST /api/orders/:id/engagements` | Engagements view | YES | Already works | None |
| 10 | Accept engagement | `PATCH /api/orders/0/engagements/:eid` | Engagements view | YES | Already works | None |
| 11 | Create payment | `POST /api/payments` | Payments view | YES | Already works | None |
| 12 | Confirm payment | `PATCH /api/payments/:pid` | Payments view (auto-confirm) | YES | Already works | None |
| 13 | Seed deliverables | `POST /api/orders/0/engagements/:eid/deliverables` | Visual view | YES | Already works | None |
| 14 | Attach artifact | `PATCH /api/deliverables/:did` (action=attach) | Visual view | YES | Already works | None |
| 15 | Move deliverable to ready | `PATCH /api/deliverables/:did` (toStatus=ready) | Visual view | YES | Already works | None |
| 16 | Request revision | `PATCH /api/deliverables/:did` (action=request_revision) | Visual view | YES | Already works | None |
| 17 | Resolve revision | `PATCH /api/deliverables/:did` (action=resolve_revision) | Visual view (NOT in UI) | PARTIAL | No resolve button in UI | Add resolve revision button |
| 18 | Deliver all items (manager) | `PATCH /api/deliverables/:did` (toStatus=delivered) | Visual view | YES | Already works | None |
| 19 | Create supplier | `POST /api/suppliers` | Suppliers view | YES | Already works | None |
| 20 | Create price list | `POST /api/suppliers/:sid/price-lists` | Suppliers view | YES | Already works | None |
| 21 | Add price item | `POST /api/suppliers/:sid/price-lists` (action=add_item) | Suppliers view (NOT in UI) | PARTIAL | No add-item form in UI | Add price item form |
| 22 | Publish price list | `POST /api/suppliers/:sid/price-lists` (action=publish) | Suppliers view | YES | Already works | None |
| 23 | Generate supplier-aware estimate | `POST /api/suppliers/:sid/price-lists` (action=supplier_estimate) | Suppliers view (NOT in UI) | PARTIAL | No estimate generation button | Add estimate generation UI |
| 24 | Move engagement to delivered | `PATCH /api/orders/0/engagements/:eid` (toStatus=delivered) | Engagements view (NOT in UI) | PARTIAL | No delivered button in engagements | Add delivered/credited buttons |
| 25 | Convert to furniture order | `transitionEngagement` to `credited` | NONE | NO | No UI for credit transition | Add credited button |
| 26 | Apply credit (10k/20k) | SQL CASE in `transitionEngagement` to `credited` | NONE | NO | No credit display | Show credit in order detail |
| 27 | Retry duplicate credit | `transitionEngagement` rejects (invalid transition) | NONE | NO | Already blocked by status machine | Verify in smoke test |
| 28 | Inspect status and history | `GET /api/orders/:id/engagements` | Engagements view (by order) | YES | Already works | None |

## Gaps requiring implementation

### Critical (blocks operator flow)
1. **Client CRUD** — No client-store, no API, no UI → operator cannot create clients
2. **Order CRUD** — No order-store, no API, no UI → operator cannot create orders
3. **Advisor API** — classifyIntent not exposed → operator cannot classify requests via UI
4. **Credit transition UI** — No button to transition to `credited` → operator cannot apply credit

### Important (completes operator flow)
5. **Resolve revision button** — API exists but no UI button → operator cannot resolve revisions via UI
6. **Add price item form** — API exists but no UI form → operator cannot add price items via UI
7. **Estimate generation button** — API exists but no UI → operator cannot generate estimates via UI
8. **Delivered/credited buttons** — API exists but no UI → operator cannot complete delivery via UI

### Nice to have
9. **Order detail view** — Show full order history, engagements, credit status
10. **Production launch panel** — Build info, connectivity, rehearsal results

## Resolution

All gaps will be resolved by:
- Creating `client-store.js` + `order-store.js` with full CRUD
- Creating `/api/clients`, `/api/orders`, `/api/advisor` API routes
- Extending admin UI with Clients, Orders views and additional buttons
- Adding resolve revision, add price item, estimate generation, delivered/credited buttons
