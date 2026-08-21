# Apka Bill POS — Pilot Success & Sign-Off Criteria (Step M10)

## Target Milestones for Pilot Graduation

A pilot deployment is considered **SUCCESSFUL & READY FOR FULL COMMERCIAL ROLLOUT** when all the following quantitative criteria are met:

---

### 1. Stability & Startup Invariants
- **0 Unhandled Blank Screens**: App starts cleanly on all pilot devices.
- **< 0.1% Crash Rate**: No unexpected unhandled exceptions during live checkout transactions.
- **100% Offline Resilience**: Zero lost transactions during network drops or cold restarts.

### 2. Billing & Transaction Accuracy
- **Zero Financial Discrepancies**: Billed amounts match drawer cash and dynamic UPI receipts exactly.
- **100% Inventory Consistency**: Stock quantities update accurately for all sales, stock adjustments, and returns.
- **0 Duplicate Sales**: Idempotency keys prevent double billing on multiple checkout taps.

### 3. Usability & Merchant Autonomy
- **Independent Daily Operation**: Merchant completes normal checkout, customer entry, and daily sales report review without developer assistance after Day 1.
- **< 5 Seconds per Cash Sale**: 3-tap rapid checkout flow enables fast line clearance during peak hours.

### 4. Hardware & Printing (Where Attached)
- **Clear ESC/POS Receipts**: Store name, line items, GSTIN, and UPI QR code render with high contrast on standard 58mm/80mm thermal rolls.
- **Graceful Paper-Out Handling**: Clear warning prompt if printer roll is depleted without crashing or stalling the billing queue.
