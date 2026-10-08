---
phase: 3
plan: 2
wave: 2
depends_on: ["3.1"]
files_modified: 
  - "server/routes/operation.routes.js"
  - "server/routes/billing.routes.js"
  - "server/routes/product.routes.js"
  - "server/routes/superadmin.routes.js"
autonomous: true

must_haves:
  truths:
    - "Se mitiga la vulnerabilidad de IDOR evitando por completo findByPk en los endpoints"
    - "Las operaciones destroy validan TenantId para evitar borrados entre inquilinos"
  artifacts:
    - "Rutas refactorizadas para usar findOne con TenantId"
---

# Plan 3.2: Remediación de IDOR (findByPk y destroy)

<objective>
Sustituir las 40+ llamadas a `findByPk` por `findOne({ where: { id, TenantId: req.tenant.id } })` para aislar los accesos por inquilino, y parchar todos los `destroy()` desprotegidos.

Purpose: Evitar que un restaurante pueda leer, modificar o borrar información (ej. Órdenes, Cuentas, Productos) de otro restaurante alterando el ID en la red.
Output: Endpoints totalmente blindados y multi-tenant safe.
</objective>

<context>
Load for context:
- server/routes/operation.routes.js
- server/routes/billing.routes.js
- server/routes/product.routes.js
- server/routes/superadmin.routes.js
</context>

<tasks>

<task type="auto">
  <name>Parchar findByPk en operation.routes.js</name>
  <files>server/routes/operation.routes.js</files>
  <action>
    Busca todas las instancias de `findByPk`. 
    Reemplázalas por `findOne({ where: { id: variableId, TenantId: req.tenant.id } })`. 
    Si la consulta original incluía opciones como `transaction` o `include`, asegúrate de mantenerlas dentro de `findOne`.
    Asimismo, busca llamadas a `.destroy()` directas y asegúrate de añadir `{ where: { ... , TenantId: req.tenant.id } }`.
    AVOID: Olvidar incluir `TenantId: req.tenant.id`.
  </action>
  <verify>Grep de `findByPk` en operation.routes.js debería arrojar 0 resultados (excepto comentarios).</verify>
  <done>Fugas IDOR cerradas en el módulo de operaciones.</done>
</task>

<task type="auto">
  <name>Parchar findByPk y destroy en otras rutas</name>
  <files>
    - server/routes/billing.routes.js
    - server/routes/product.routes.js
    - server/routes/superadmin.routes.js
  </files>
  <action>
    Realiza el mismo procedimiento de reemplazo sistemático.
    Para `superadmin.routes.js`, dado que el súper administrador gestiona Tenants y no inyecta `req.tenant.id`, las validaciones de acceso deben asegurarse de que si consultan datos de un tenant, pasen el tenantId desde el `req.params.id`.
  </action>
  <verify>Grep de `findByPk` debería estar limpio en estas rutas.</verify>
  <done>Módulos periféricos blindados.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No existen llamadas a `findByPk` (excepto en `auth.middleware.js` para el User ID del token).
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
