---
phase: 4
plan: 1
wave: 1
depends_on: []
files_modified: 
  - "server/routes/promotion.routes.js"
  - "server/routes/qr.routes.js"
  - "server/index.js"
autonomous: true

must_haves:
  truths:
    - "Los archivos subidos se almacenan en carpetas categorizadas por año, mes y sub-tipo (ej. promociones, qrs)."
    - "El tenantId (si existe) se incrusta en la ruta de almacenamiento y URL para garantizar la segregación (ej. uploads/promotions/2026/10/tenant_1/)."
    - "Los archivos estáticos están protegidos contra acceso cruzado (IDOR en lecturas)."
  artifacts:
    - "multer diskStorage y construcción de imageUrl en promotion.routes.js reescritos"
    - "multer diskStorage y construcción de imageUrl en qr.routes.js reescritos"
    - "middleware estático en server/index.js configurado para proteger las rutas"
---

# Plan 4.1: Estructuración y Aislamiento de Storage (Regla 5)

<objective>
Refactorizar la configuración de Multer en los endpoints de promociones y códigos QR para cumplir con la Regla 5. Además, asegurar que las URLs generadas apunten al subdirectorio correcto y restringir el acceso a los archivos físicos para que un restaurante no pueda visualizar las fotos de otro.

Purpose: Evitar colisiones, organizar el almacenamiento y sellar fugas de información estática.
Output: Storage organizado jerárquicamente y protegido por middleware.
</objective>

<context>
Load for context:
- server/routes/promotion.routes.js
- server/routes/qr.routes.js
- server/index.js
</context>

<tasks>

<task type="auto">
  <name>Refactorizar Multer y URL en promotion.routes.js</name>
  <files>server/routes/promotion.routes.js</files>
  <action>
    1. Modifica la función `destination` en `multer.diskStorage`:
       - Extrae el `req.tenant.id` (si existe, o 'global').
       - Usa `new Date()` para obtener año y mes (ej. "2026", "10").
       - Construye el path base y la carpeta relativa: `const relPath = path.join('promotions', year, month, 'tenant_' + tenantId)`.
       - Crea el directorio físico si no existe (`fs.mkdirSync(..., { recursive: true })`) y usa `cb(null, targetDir)`.
    2. Modifica el controlador (POST `/`):
       - Modifica `const imageUrl = \`/uploads/\${file.filename}\`;` para que incluya la ruta dinámica que generaste en multer: `const imageUrl = \`/uploads/promotions/\${year}/\${month}/tenant_\${tenantId}/\${file.filename}\`;`.
    AVOID: Cambiar solo multer sin cambiar la variable `imageUrl`.
  </action>
  <verify>Las subidas apuntan a subdirectorios y la DB guarda la URL correcta.</verify>
  <done>Promociones asiladas correctamente.</done>
</task>

<task type="auto">
  <name>Refactorizar Multer y URL en qr.routes.js</name>
  <files>server/routes/qr.routes.js</files>
  <action>
    Realiza el mismo procedimiento que en `promotion.routes.js`, pero usando la categoría `qrs` en vez de `promotions`.
    - Path relativo: `path.join('qrs', year, month, 'tenant_' + tenantId)`.
    - Modifica la asignación de `imageUrl` tanto en `POST /` como en `PUT /:id` para que el string sea `\`/uploads/qrs/\${year}/\${month}/tenant_\${tenantId}/\${req.file.filename}\``.
    Asegúrate de calcular bien `year` y `month` dentro del controlador (igual que en multer).
  </action>
  <verify>Las subidas de QR se guardan y devuelven URLs estructuradas.</verify>
  <done>Códigos QR aislados.</done>
</task>

<task type="auto">
  <name>Proteger Endpoint Estático en server/index.js</name>
  <files>server/index.js</files>
  <action>
    Busca `app.use('/uploads', express.static(path.join(__dirname, 'uploads')));`.
    Envuélvelo con un middleware de validación rápida. 
    Ejemplo:
    `app.use('/uploads', (req, res, next) => { ... }, express.static(...))`
    El middleware debe verificar si la URL solicitada (`req.url`) incluye el patrón `/tenant_(\d+)/`. Si es así, verificar que `req.tenant` exista y que `req.tenant.id` coincida con el número. (Ojo: ten en cuenta que el acceso público inicial podría requerir autenticación; el middleware ya existente `tenantMiddleware` debe haberse ejecutado para que `req.tenant` esté disponible, de lo contrario, extraer de cabecera/subdominio o dejarlo si es puramente público pero proteger `cuenta_`, `qrs`, `promotions`).
    Dado que las promociones pueden visualizarse por clientes (usuarios finales sin sesión de admin), asegúrate de que al menos se resuelva el tenant. Si el tenant de la visita coincide con el `tenant_{id}` de la URL, permitir acceso. Si no, `403`.
  </action>
  <verify>Acceder a `/uploads/promotions/.../tenant_2/...` desde un frontend de `tenant_1` da error 403.</verify>
  <done>Archivos estáticos restringidos por inquilino.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No hay llamadas estáticas `cb(null, uploadDir)` donde `uploadDir` apunte a la raíz `/uploads`.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
