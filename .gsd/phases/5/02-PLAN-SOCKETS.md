---
phase: 5
plan: 2
wave: 1
depends_on: []
files_modified: 
  - "server/index.js"
autonomous: true

must_haves:
  truths:
    - "No se permite en ningún punto de la plataforma emitir un evento por WebSocket a todos los clientes simultáneamente."
    - "Los eventos que no dispongan de tenantId explícito deben abortarse de forma segura en lugar de emitirse globalmente."
  artifacts:
    - "server/index.js actualizado sin bloque 'else { io.emit(...) }'"
---

# Plan 5.2: Confinamiento Estricto de WebSockets

<objective>
Eliminar el antipatrón de fallback global encontrado en `server/index.js` para asegurar que las emisiones de WebSockets siempre vayan dirigidas a la sala específica de un inquilino.

Purpose: Prevenir fugas masivas de información en tiempo real a restaurantes ajenos.
Output: Archivo principal de WebSockets sellado.
</objective>

<context>
Load for context:
- server/index.js
</context>

<tasks>

<task type="auto">
  <name>Suprimir fallback global en sockets y emisores</name>
  <files>server/index.js</files>
  <action>
    Abre `server/index.js` y busca los listeners de WebSockets (`socket.on(...)`) y del Emisor de Eventos de la App (`appEmitter.on(...)`).
    Actualiza la lógica que dice:
    `if (tenantId) { io.to('tenant_' + tenantId).emit(...); } else { io.emit(...); }`
    
    Bórrales el bloque `else`. Si no hay `tenantId`, simplemente haz un `console.warn` alertando de un intento de emisión anómalo, o ignóralo:
    `if (tenantId) { io.to('tenant_' + tenantId).emit(...); } else { console.warn('Intento de emisión huérfana para evento XYZ sin tenantId'); }`
    
    AVOID: Reemplazar el bloque a ciegas con expresiones regulares que rompan la sintaxis. Asegúrate de leer y reemplazar bloque por bloque, ya que hay múltiples listeners.
  </action>
  <verify>Ejecutar `grep -r "io.emit" server/index.js`. No debería haber ninguna llamada desnuda a `io.emit()` para eventos de negocio.</verify>
  <done>Todos los eventos emitidos desde el servidor están encapsulados por `io.to('tenant_' + tenantId)`.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] No existe ninguna emisión global desnuda en el servidor central.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
