---
phase: 2
plan: 1
wave: 1
depends_on: []
files_modified:
  - server/models/index.js
  - server/routes/orders.js
  - server/routes/users.js
  - client/src/components/UserManagementModal.jsx
  - client/src/components/PinPadModal.jsx
  - client/src/components/TableControl.jsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Users can have a 4-digit PIN assigned"
    - "Generic terminal users can be configured to require PIN prompts"
    - "Terminal actions map to the PIN owner's UserId, not the generic terminal UserID"
  artifacts:
    - "client/src/components/PinPadModal.jsx exists"
  key_links:
    - "TableControl calls PinPadModal before order creation if requirePinPrompt is true"
    - "Order creation API resolves authorPin to actual UserId"
---

# Plan 2.1: Trazabilidad de Mozos con PIN en Terminales Compartidos

<objective>
Implementar validación con PIN de 4 dígitos para cajeros y terminales compartidas, asegurando que las ventas se registren a nombre del mozo que realmente atiende la mesa.

Purpose: En terminales compartidas o cajas centrales, varios mozos usan la misma sesión genérica (ej. "Computadora Principal"), lo que hace perder la trazabilidad de quién vendió qué.
Output: Base de datos y endpoints modificados para soportar `authorPin`, y frontend con teclado numérico `PinPadModal.jsx`.
</objective>

<context>
Load for context:
- server/models/index.js
- server/routes/orders.js
- client/src/components/UserManagementModal.jsx
- client/src/components/TableControl.jsx
</context>

<tasks>

<task type="auto">
  <name>Database & API Backend Updates</name>
  <files>server/models/index.js, server/routes/orders.js, server/routes/users.js</files>
  <action>
    Add `pin` (STRING) and `requirePinPrompt` (BOOLEAN, default: false) to the `User` model in models/index.js.
    In server/routes/users.js, update the `POST /` and `PUT /:id` endpoints to accept and save `pin` and `requirePinPrompt`.
    In server/routes/orders.js, update the `POST /` order creation endpoint. If `req.body.authorPin` is provided, find the user with that PIN. If found, override `UserId` with the found user's ID for all created orders. If `authorPin` is invalid, return 401. If not provided, fallback to `req.user.id`.
    AVOID: Modifying other existing fields in the models.
  </action>
  <verify>curl -X GET /api/users to ensure server restarts and models sync correctly without errors.</verify>
  <done>User model includes new columns; API accepts authorPin and attributes order correctly.</done>
</task>

<task type="auto">
  <name>Frontend User Management</name>
  <files>client/src/components/UserManagementModal.jsx</files>
  <action>
    Add inputs to edit `pin` (input type password, max length 4) and a checkbox for `requirePinPrompt` (label: "Modo Terminal Compartida (Exigir PIN)"). 
    Map these correctly to the `formData` state and ensure they are sent in the API payload during creation/update.
  </action>
  <verify>Check UI rendering for UserManagementModal logic using standard tests or UI inspection.</verify>
  <done>Admin can assign PINs and toggle the Terminal Shared mode for any user.</done>
</task>

<task type="auto">
  <name>Frontend Order Flow & UI</name>
  <files>client/src/components/PinPadModal.jsx, client/src/components/TableControl.jsx</files>
  <action>
    Create a new React component `PinPadModal.jsx` featuring a large, touch-friendly 0-9 numeric pad. It should emit `onSubmit(pin)`.
    In `TableControl.jsx`, intercept the order submission flow (e.g. `sendOrder` or `handleConfirm`).
    Check `user.requirePinPrompt` (from the globally loaded user session/context).
    If true, set state to open `PinPadModal`. Once the PIN is entered, append it to the payload as `authorPin` and execute the API call.
    If false, execute the API call immediately.
  </action>
  <verify>Ensure TableControl compiles without syntax errors and PinPadModal is correctly exported.</verify>
  <done>Terminal users see the PIN prompt before adding orders; mobile users bypass it.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Users can have a 4-digit PIN assigned
- [ ] Generic terminal users can be configured to require PIN prompts
- [ ] Terminal actions map to the PIN owner's UserId, not the generic terminal UserID
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
