---
phase: 5
plan: 1
wave: 1
depends_on: []
files_modified: 
  - "server/routes/qr.routes.js"
  - "server/routes/drink-promotions.routes.js"
  - "server/routes/roulette.routes.js"
  - "server/routes/session.routes.js"
autonomous: true

must_haves:
  truths:
    - "No existe ninguna invocación a findByPk en los archivos objetivo."
    - "Las consultas de extracción única están estrictamente filtradas por el TenantId del request (req.tenant.id)."
  artifacts:
    - "qr.routes.js refactorizado a findOne con validación de inquilino"
    - "drink-promotions.routes.js refactorizado a findOne con validación de inquilino"
    - "roulette.routes.js refactorizado a findOne con validación de inquilino"
    - "session.routes.js refactorizado a findOne con validación de inquilino"
---

# Plan 5.1: Sellado de Fugas ORM Restantes (IDOR)

<objective>
Refactorizar las rutas secundarias que fueron omitidas en la pasada masiva de AST, eliminando todo rastro de `findByPk` y sustituyéndolo por consultas seguras `findOne` que incorporen explícitamente `req.tenant.id`.

Purpose: Evitar que un usuario autenticado manipule el ID en la URL para interactuar con datos de otro inquilino.
Output: Archivos de rutas secundarios blindados contra IDOR.
</objective>

<context>
Load for context:
- server/routes/qr.routes.js
- server/routes/drink-promotions.routes.js
- server/routes/roulette.routes.js
- server/routes/session.routes.js
</context>

<tasks>

<task type="auto">
  <name>Refactorizar findByPk en rutas secundarias</name>
  <files>
    - server/routes/qr.routes.js
    - server/routes/drink-promotions.routes.js
    - server/routes/roulette.routes.js
    - server/routes/session.routes.js
  </files>
  <action>
    Abre cada archivo listado y busca todas las instancias de `.findByPk(`.
    Reemplaza cada ocurrencia de `Model.findByPk(id, options)` por `Model.findOne({ where: { id: id, TenantId: req.tenant.id }, ...options })`.
    - En `qr.routes.js`: `QrAccount.findByPk(qrId)` -> `findOne`.
    - En `drink-promotions.routes.js`: `DrinkItemRecipe.findByPk(existing.id)` -> `findOne`.
    - En `roulette.routes.js`: `Account.findByPk(accountId)` -> `findOne`.
    - En `session.routes.js`: `User.findByPk(userId)` y `Tenant.findByPk(req.tenant.id)`. (Nota: para `Tenant`, NO agregues `TenantId: req.tenant.id` porque la tabla Tenants no tiene esa columna, déjalo usando `findByPk` o cambia a `id`).
    AVOID: Usar scripts AST globales; realiza el reemplazo de manera específica y manual revisando el contexto de cada llamada para no romper firmas como transacciones (`transaction: t`).
  </action>
  <verify>Buscar en los archivos modificados la cadena `findByPk`. Debe retornar vacío (salvo para Tenants en session.routes.js).</verify>
  <done>Todos los registros consultados en estas rutas exigen que el inquilino coincida con el visitante.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] Ninguna de las 4 rutas secundarias permite extraer registros usando únicamente el ID numérico.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
