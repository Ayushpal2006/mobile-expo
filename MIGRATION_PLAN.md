# Orion POS — Expo Migration Plan & Architecture Audit

## Executive Summary
This document serves as the master blueprint and audit for migrating the **Orion POS** React Native mobile application from a bare native project (`mobile/`) to a modern, production-grade **Expo** application (`mobile-expo/`).

---

## 1. Current vs. Target Architecture

### Existing Mobile Architecture (`mobile/`)
- **Framework**: Bare React Native (0.87.0) with custom Android native Kotlin bindings.
- **Key Modules**:
  - `HardwareModule.kt` & `PrinterModule.kt` (custom Android bridge for Sunmi/iMin POS hardware detection & ESC/POS print pass-through).
  - `react-native-sqlite-storage` (native C/C++ SQLite bindings for local offline cart/stock database).
  - `react-native-keychain` (Android Keystore / iOS Keychain wrapper).
  - Custom REST `ApiClient` with Bearer token authentication against `backend`.
  - Local-first offline billing engine with atomic SQLite transactions & queue sync.

### Target Expo Architecture (`mobile-expo/`)
- **Framework**: Expo (SDK 54) with Managed / Development Build workflow.
- **State Management & Routing**: React Context API (`AuthContext`) + Typed Stack/Tab Shell (or React Navigation).
- **Secure Storage**: `expo-secure-store` (with fallback for web/dev mock).
- **Local Storage / DB**: `expo-sqlite` (for offline POS catalog & transactions in Phase 3+).
- **Hardware Integration**:
  - Expo Go mock drivers during core UI/API development.
  - Expo Development Build (`expo-dev-client` + custom native plugins) for Sunmi/iMin POS built-in printers, Bluetooth SPP, USB Host, and hardware scanner intent listeners.

---

## 2. Complete File Migration Audit (`mobile/`)

Every source file in `mobile/` has been audited and classified into 6 categories:

### Category 1: Reusable JS/TS Business Logic
*Can be copied/refactored directly into `mobile-expo/src/` with minimal changes.*
- `src/types/index.ts` — Core interfaces (User, Store, Org, Product, Cart, Sale, Totals).
- `src/services/local-billing.service.ts` — Pricing, GST, discount calculations, invoice number generation logic.
- `src/native/utils/ReceiptFormatter.ts` — 58mm & 80mm ESC/POS text formatting logic.
- `src/sync/syncTypes.ts` — Sync payload definitions.
- `src/config/env.ts` — Environment resolution logic.

### Category 2: React Native UI (Migratable UI)
*UI layout & components adaptable to Expo styling & safe area handling.*
- `src/screens/LoginScreen.tsx` — Login form, credential validation UI.
- `src/screens/HomeScreen.tsx` — POS register layout, grid view, cart summary, quick action bar.
- `src/screens/DevScreen.tsx` — Hardware status diagnostic dashboard.
- `src/components/common/*` — Buttons, Cards, Inputs, Modals, Loading Spares.

### Category 3: Native Android Implementation (Requires Expo Rewrite/Plugin)
*Direct native code that cannot run uncompiled in Expo Go.*
- `android/app/src/main/java/com/apkabill/mobile/HardwareModule.kt` → Rewrite as Expo Config Plugin / Custom Native Module.
- `android/app/src/main/java/com/apkabill/mobile/PrinterModule.kt` → Rewrite as Expo Native Module for embedded POS thermal printer SDK.

### Category 4: Expo-Compatible Standard Functionality
*Standard Expo SDK replacements.*
- `react-native-keychain` → `expo-secure-store`
- `react-native-sqlite-storage` → `expo-sqlite`
- Camera / Barcode Scanner → `expo-camera` / `expo-barcode-scanner`
- `@react-native-community/netinfo` → `@react-native-community/netinfo`

### Category 5: Functionality Requiring Expo Development Builds
*Hardware features requiring native compilation via EAS / `expo run:android`.*
- Built-in Sunmi / iMin thermal printer drivers.
- Bluetooth SPP raw socket communication.
- USB Host OTG printer connectivity.
- BroadcastReceiver hardware scanner listeners.

### Category 6: Backend-Driven Functionality
*Features that remain strictly handled by backend REST APIs.*
- Super Admin operations & store provisioning.
- Database migrations for Neon PostgreSQL.
- User registration, password resets, and JWT issuance.
- Sales analytics, inventory aggregate reconciliation.

---

## 3. Strategic Migration Phases

1. **Phase 1 (Done)**: Repository audit, `MIGRATION_PLAN.md`, API/config foundation structure inside `mobile-expo/`.
2. **Phase 2 (Current)**: Mobile App Shell, Navigation Architecture, Auth Flow, Session Context, Common UI Kit.
3. **Phase 3 (Next)**: Core Orion POS screens (Dashboard, Billing/Cart, Products, Customers, Purchases, Reports, Settings).
4. **Phase 4**: Local offline database integration (`expo-sqlite`) & background sync queue.
5. **Phase 5**: Hardware integration (Thermal Printer, Bluetooth, USB) via Expo Development Build & EAS.

---

## 4. Dependencies Strategy

### Currently Installed (`mobile-expo/package.json`)
- `expo`: `~54.0.36`
- `expo-status-bar`: `~3.0.9`
- `react`: `19.1.0`
- `react-native`: `0.81.5`

### Required Phase 2 Additions
- `expo-secure-store`: Secure token storage
- `@react-native-community/netinfo`: Network connectivity monitoring

---

## 5. Known Risks & Mitigation

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| Expo Go lacks custom Sunmi/iMin Java/Kotlin printer SDKs | Cannot print receipts on physical POS device in Expo Go | Use `MockPrinterDriver` in Expo Go; build Expo Dev Client (`expo-dev-client`) for hardware testing |
| SQLite API differences between `react-native-sqlite-storage` and `expo-sqlite` | Local billing query refactoring required | Abstract database operations behind a repository interface (`DatabaseExecutor`) |
| React 19 peer dependency warnings with older RN libraries | Build/install failures | Use standard `npx expo install` for SDK-compatible library versions |
