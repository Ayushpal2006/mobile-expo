# Apka Bill POS — Pilot Hotfix & Release Process (Step M10)

## Emergency Hotfix Workflow

When a **P0** or **P1** blocker is identified during pilot store operations:

```text
1. Reproduce Issue on Dev / Emulator
        ↓
2. Identify Root Cause (JNI / API / State / Math)
        ↓
3. Implement Minimal Surgical Fix
        ↓
4. Run Full Regression Test Suite (`npm test`)
        ↓
5. Validate Release Preflight (`npm run validate`)
        ↓
6. Package & Deploy Hotfix
        ├── If JS/UI Bug: Deploy OTA Update via expo-updates
        └── If Native Driver / Permission: Build New Preview APK via EAS
        ↓
7. Verify on Pilot Hardware & Close Triage Ticket
```

---

## Safety Invariants During Hotfix
- **NO Speculative Feature Additions:** Hotfixes must contain only the code required to resolve the blocker.
- **NO Database Schema Migrations:** Database migrations must never be rushed into a hotfix without full offline backup validation.
- **Strict Parity Test Pass:** All 123 automated test assertions must pass 100% prior to dispatch.
