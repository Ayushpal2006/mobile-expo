# Apka Bill POS — Customer Feedback Triage Framework (Step M10)

## Overview
This framework governs how pilot merchant feedback is classified, prioritized, and converted into action items without building speculative features.

---

## 1. Feedback Classification Matrix

| Type | Definition | Action Required |
| :--- | :--- | :--- |
| **BUG (P0 / P1)** | App crashes, checkout blocked, or numbers incorrect | Immediate root-cause fix via Hotfix Process |
| **USABILITY / UX** | User got confused or missed an action | UI layout tweak, clearer label, or tap target resize |
| **FEATURE REQUEST** | Customer requested new capability | Evaluate through 5-Point Validation Framework below |
| **TRAINING ISSUE** | Feature exists but user did not know where it was | Merchant documentation or onboarding walkthrough |
| **OUT OF SCOPE** | Request conflicts with core POS retail design | Mark as Wont-Fix with clear business explanation |

---

## 2. 5-Point Feature Request Validation Framework

Before creating any backlog ticket for a requested feature, answer:

1. **Customer Request:** Exactly what did the merchant ask for?
2. **Underlying Problem:** What business friction are they attempting to solve?
3. **Current Workaround:** How do they handle this scenario in their store today?
4. **Frequency & Scope:** Has more than 1 merchant requested this? Is it universal to Indian retail?
5. **Operational Impact:** Does it protect revenue, reduce checkout seconds, or ensure tax compliance?

### Decision Gates
- **BUILD NOW:** Confirmed operational bottleneck affecting core checkout or legal compliance.
- **VALIDATE FURTHER:** Interesting request, but need feedback from 2+ additional stores.
- **BACKLOG:** Valid enhancement for post-pilot roadmap.
- **DO NOT BUILD:** Overly bespoke or conflicting with retail POS speed.

---

## 3. Severity Classification

- **P0 (Critical Blocker):** App fails to start, blank screen, checkout crash, or financial corruption.
- **P1 (High Priority):** Secondary workflow broken (e.g. barcode scan fails or report export errors).
- **P2 (Medium Priority):** Usability issue or layout glitch with available workaround.
- **P3 (Low Priority):** Cosmetic tweak or minor text alignment.
