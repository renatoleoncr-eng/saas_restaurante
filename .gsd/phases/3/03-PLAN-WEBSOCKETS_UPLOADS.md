---
phase: 3
plan: 3
wave: 3
depends_on: ["3.2"]
files_modified: 
  - "server/routes/operation.routes.js"
  - "server/routes/account.routes.js"
  - "server/routes/layout.routes.js"
  - "server/index.js"
autonomous: true

must_haves:
  truths:
    - "Los WebSockets aíslan la comunicación por inquilino usando salas"
    - "El almacenamiento de archivos usa compresión obligatoria"
  artifacts:
    - "io.to('tenant_' + req.tenant.id).emit()"
---

# Plan 3.3: Aislamiento en Tiempo Real (Sockets)

<objective>
Prevenir el cruce de eventos de WebSockets (que causa que todos los inquilinos vean las comandas y notificaciones del otro) reemplazando todos los `io.emit` por emisiones restringidas a la sala del inquilino.

Purpose: Asegurar la total privacidad operativa entre restaurantes.
Output: Archivos refactorizados para usar `.to('tenant_' + req.tenant.id).emit(...)`.
</objective>

<context>
Load for context:
- server/routes/operation.routes.js
- server/routes/account.routes.js
- server/routes/layout.routes.js
- server/index.js
</context>

<tasks>

<task type="auto">
  <name>Modificar io.emit en Rutas (operation, account, layout)</name>
  <files>
    - server/routes/operation.routes.js
    - server/routes/account.routes.js
    - server/routes/layout.routes.js
  </files>
  <action>
    Busca todas las llamadas a `io.emit` (o `req.app.get('io').emit`).
    Reemplázalas por `io.to('tenant_' + req.tenant.id).emit(...)`.
    AVOID: Dejar `io.emit` desnudo. En casos donde se usan proxys de eventos (ej. `EventEmitter` en `server/index.js`), verifica que el evento emita pasando el `tenantId` para que el hub principal sepa a qué sala enviarlo.
  </action>
  <verify>No quedan llamadas a `io.emit` en estas rutas.</verify>
  <done>Sockets de las rutas aislados.</done>
</task>

<task type="auto">
  <name>Modificar Sockets Principales en server/index.js</name>
  <files>server/index.js</files>
  <action>
    En el manejador central de WebSockets o el listener interno de EventEmitters (`serverEvents.on`), intercepta los eventos globales, extrae el `tenantId` y haz `io.to('tenant_' + data.tenantId).emit(...)`.
    Asegúrate de que la conexión del cliente (que ya emite `join_tenant` en el frontend) esté añadiendo la sala `tenant_ID` correctamente: `socket.join('tenant_' + tenantId)`.
  </action>
  <verify>El listener en el backend responde uniendo la conexión a la sala `tenant_{ID}`.</verify>
  <done>Sistema de notificaciones privado por restaurante.</done>
</task>

<task type="auto">
  <name>Implementar Compresión de Imágenes con Canvas API</name>
  <files>
    - client/src/components/AccountsHistoryTab.jsx
    - client/src/components/PaymentModal.jsx
    - client/src/views/QrManagement.jsx
  </files>
  <action>
    Busca los inputs de tipo `file` en estos componentes. 
    Intercepta el evento `onChange` e inyecta una rutina que dibuje la imagen en un `canvas` (manteniendo un maxWidth/maxHeight razonable, ej. 800px) y genere un Blob JPEG comprimido (`quality = 0.7`) antes de enviarlo al servidor o guardarlo en el state.
    AVOID: Enviar archivos originales de 5MB+ directos al servidor.
  </action>
  <verify>Subir una foto de 5MB en el entorno local y comprobar en la pestaña Network (o consola) que el Blob generado pesa menos de 400KB.</verify>
  <done>Las fotos subidas están comprimidas antes de tocar la VPS.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No existen llamadas a `io.emit` desnudas en todo el proyecto backend.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
