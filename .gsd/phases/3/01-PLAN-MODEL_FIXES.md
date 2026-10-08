---
phase: 3
plan: 1
wave: 1
depends_on: []
files_modified: 
  - "server/models/index.js"
  - "server/sync.js"
  - "server/routes/config.routes.js"
  - "server/routes/roulette.routes.js"
autonomous: true

must_haves:
  truths:
    - "El modelo Setting usa id auto-incremental como llave primaria para evitar choques globales."
    - "Las rutas de impresión y ruleta guardan settings correctamente usando findOne y update/create en vez de upsert (para evitar fallos por cambio de llave primaria)."
    - "DailyMenu ya no tiene unique: true en date, permitiendo múltiples menús del día de distintos inquilinos."
  artifacts:
    - "server/models/index.js modificado sin primaryKey en Setting.key"
    - "server/sync.js modificado con script de migración para rescatar printer_config de la tabla Settings."
---

# Plan 3.1: Arreglo Arquitectónico de Modelos (DailyMenu y Setting)

<objective>
Refactorizar las restricciones únicas que estaban rompiendo la multitenencia: `DailyMenu.date` y `Setting.key`. 
Se garantiza que **el sistema de impresión no falle** migrando los datos antiguos y reescribiendo la lógica de guardado en las rutas de forma robusta.

Purpose: Evitar que un restaurante sobreescriba la configuración o choque al crear un menú en la misma fecha que otro inquilino.
Output: Base de datos aislada correctamente a nivel de esquema (índices).
</objective>

<context>
Load for context:
- server/models/index.js
- server/sync.js
- server/routes/config.routes.js
- server/routes/roulette.routes.js
</context>

<tasks>

<task type="auto">
  <name>Modificar Restricciones Únicas Globales en models/index.js</name>
  <files>server/models/index.js</files>
  <action>
    - En el modelo `DailyMenu`: quita `unique: true` de la propiedad `date`.
    - En el modelo `Setting`: 
      - Agrega una nueva columna `id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }`.
      - Cambia la propiedad `key` para que NO tenga `primaryKey: true`.
      - Añade en el objeto de opciones finales (3er parámetro): `indexes: [{ unique: true, fields: ['TenantId', 'key'] }]`.
    AVOID: Alterar el bucle final que inyecta `TenantId` a todos los modelos. Esto se mantiene.
  </action>
  <verify>Revisar visualmente que el código no tenga `unique: true` en DailyMenu.date ni `primaryKey: true` en Setting.key</verify>
  <done>Restricciones globales eliminadas.</done>
</task>

<task type="auto">
  <name>Refactorizar lógica de Impresión y Ruleta para no depender de upsert</name>
  <files>
    - server/routes/config.routes.js
    - server/routes/roulette.routes.js
  </files>
  <action>
    - En `config.routes.js` (POST `/config/printers`): En lugar de `Setting.upsert`, haz un `Setting.findOne({ where: { key: 'printer_config', TenantId: req.tenant.id } })`. Si existe, haz `await setting.update({ value: ... })`. Si no, haz `await Setting.create({ key: 'printer_config', value: ..., TenantId: req.tenant.id, description: ... })`.
    - En `config.routes.js` (GET `/config/printers`): En lugar de buscar `printer_config_${req.tenant.id}`, busca `{ where: { key: 'printer_config', TenantId: req.tenant.id } }`. Como fallback si no lo encuentra, busca el global `printer_config` sin tenantId para migración.
    - Repite el MISMO procedimiento en `roulette.routes.js` para `roulette_config_${type}`, usando `key: 'roulette_config_' + type` y `TenantId: req.tenant.id`.
    AVOID: Usar `Setting.upsert()`, porque Sequelize fallará al no tener la primary key exacta definida como antes.
  </action>
  <verify>Los endpoints POST no usan `upsert` y envían `TenantId: req.tenant.id`.</verify>
  <done>Rutas robustecidas.</done>
</task>

<task type="auto">
  <name>Migrar Settings Legacy en sync.js</name>
  <files>server/sync.js</files>
  <action>
    Dentro de la función `syncDB` o `runAutomaticFix`, añade lógica para buscar Settings que tengan keys como `printer_config_1` o `roulette_config_standard` y actualízalos para que el key sea limpio (`printer_config`) y su `TenantId` sea extraído correctamente, de modo que la impresión no falle para clientes existentes.
    (Nota: El proyecto corre en VPS con MySQL. Asegúrate de usar un bloque `try/catch` robusto para `ALTER TABLE Settings DROP PRIMARY KEY, ADD id INT AUTO_INCREMENT PRIMARY KEY;` de forma segura, o en su defecto, usa el comportamiento por defecto de Sequelize para alterar la tabla de forma segura sin romper la producción `sync({alter: true})` pero configurado explícitamente para esa tabla si es necesario. Verifica que si el índice ya existe, no tire la DB).
  </action>
  <verify>El código de migración SQL dentro de sync.js está protegido por bloques try/catch que previenen crasheos si el índice ya existe.</verify>
  <done>Los datos viejos de impresión no se pierden y la DB inicia correctamente.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No existe `unique: true` en DailyMenu.
- [ ] Setting usa `id` y `upsert` ha sido eliminado de config.routes.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
