# Apka Bill POS — Pilot Deployment Plan (Step M10)

## Overview
This document outlines the phased rollout plan for deploying Apka Bill Mobile POS to friendly users and initial retail pilot stores.

---

## 5-Stage Rollout Strategy

```text
STAGE 1: Internal Developer Verification (Done)
        ↓
STAGE 2: Friendly Store Pilot (1 Trusted Merchant)
        ↓
STAGE 3: Real Retail Pilot Deployment (1 Store Counter)
        ↓
STAGE 4: Daily Operation & Telemetry Observation (7 Days)
        ↓
STAGE 5: Structured Feedback Review & Production Sign-off
```

---

### Stage 1: Internal Verification (Completed)
- 123 automated parity and calculation test assertions passing.
- Standalone APK release builds verified with 0 blank-screen startup failures.
- Native AutoReplyPrint hardware driver verified with lazy fallback protection.

### Stage 2: Friendly User Testing (1 Merchant)
- Install standalone APK on target hardware (Android Phone or Tablet).
- Validate onboarding: Store setup, catalog creation, cash checkout, and invoice generation.
- Collect usability feedback and verify UI clarity.

### Stage 3: Real Pilot Deployment (1 Active Retail Store)
- Deploy to one physical retail counter.
- Pair with physical Bluetooth or USB thermal receipt printer.
- Run real customer transactions in parallel with existing billing method for safety.

### Stage 4: Daily Observation (7-Day Period)
- Monitor for any unexpected app restarts, session drops, or paper-out handling.
- Review feedback entries submitted via the in-app **💬 Pilot Feedback & Support** modal.
- Verify end-of-day reports match drawer cash totals.

### Stage 5: Triage & Promotion
- Classify all reported items using `FEEDBACK_TRIAGE.md`.
- Resolve any high-priority issues via `HOTFIX_PROCESS.md`.
- Approve general release when `PILOT_SUCCESS_CRITERIA.md` benchmarks are met.
