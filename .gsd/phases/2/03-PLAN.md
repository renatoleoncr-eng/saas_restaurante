---
phase: 2
plan: 3
wave: 1
depends_on: ["02"]
files_modified:
  - server/routes/session.routes.js
  - client/src/components/TableControl.jsx
  - client/src/components/AccountDetailsModal.jsx
  - client/src/components/SessionManagerModal.jsx
  - client/src/components/SessionsHistoryTab.jsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "El sistema permite imprimir y reimprimir el ticket de apertura de caja"
    - "El envío de pedidos solicita confirmación para la impresión de comandas en Cocina/Barra"
    - "Es posible imprimir la pre-cuenta (consumos) de mesas activas y cerradas"
    - "El historial de turnos permite reimprimir los reportes de apertura y cierre físicamente"
    - "El direccionamiento a múltiples impresoras (Caja, Barra, Cocina) funciona según la configuración asignada"
  artifacts: []
  key_links:
    - "TableControl envía el estado printComanda al API de creación de pedidos"
    - "TableControl y AccountDetailsModal llaman al endpoint print-pre-cuenta del API"
    - "SessionManagerModal y SessionsHistoryTab llaman al endpoint de reimpresión de turno con el parámetro type"
---

# Plan 2.3: Integración de Impresión Térmica ESC/POS (USB/Windows) en Frontend y Backend

<objective>
Implementar los disparadores y controles de impresión en la interfaz del salón y caja, habilitando la confirmación de comandas, la impresión de pre-cuentas de mesa, la reimpresión de turnos (aperturas/cierres) y la integración final con el backend de impresión.
</objective>

<context>
Load for context:
- server/routes/session.routes.js
- client/src/components/TableControl.jsx
- client/src/components/AccountDetailsModal.jsx
- client/src/components/SessionManagerModal.jsx
- client/src/components/SessionsHistoryTab.jsx
</context>

<tasks>

<task type="auto">
  <name>Soporte de Reimpresión de Apertura en Backend</name>
  <files>server/routes/session.routes.js</files>
  <action>
    En server/routes/session.routes.js, en la ruta POST /sessions/:id/print:
    Leer el parámetro "type" del cuerpo del request (req.body).
    Si "type" es igual a "apertura", llamar a triggerAperturaPrint(session, session.Opener) y retornar éxito/error de impresión.
    De lo contrario, continuar con el flujo normal de impresión de reporte de cierre (triggerCierrePrint).
  </action>
  <verify>Hacer un POST manual a /api/sessions/1/print con payload {"type": "apertura"} y verificar que retorne 200/éxito.</verify>
  <done>El backend soporta la reimpresión de tickets de apertura de turnos históricos.</done>
</task>

<task type="auto">
  <name>Confirmación de Comanda y Botón de Pre-cuenta en Mesa</name>
  <files>client/src/components/TableControl.jsx</files>
  <action>
    En TableControl.jsx, en la función executeSendOrder, agregar una confirmación con window.confirm("¿Deseas imprimir la comanda de este pedido en Cocina/Barra?") antes de mandar el pedido. Mandar el resultado como boolean "printComanda" en el payload del POST /api/orders.
    Definir la función handlePrintPreCuenta(accountId) para mandar un POST a /api/accounts/:id/print-pre-cuenta.
    En la vista desktop (cerca del botón "Pagar") y móvil (al lado de "Pagar"), agregar el botón "Pre-cuenta" con el ícono Printer si la cuenta tiene consumos.
  </action>
  <verify>Verificar que la vista de mesa compile y muestre el prompt de confirmación y el botón de Pre-cuenta.</verify>
  <done>Los mozos confirman antes de imprimir comanda y pueden emitir la pre-cuenta física de la mesa.</done>
</task>

<task type="auto">
  <name>Reimpresión de Consumos en Detalles de Cuenta</name>
  <files>client/src/components/AccountDetailsModal.jsx</files>
  <action>
    En AccountDetailsModal.jsx, importar Printer de lucide-react.
    Definir la función handlePrintPreCuenta() llamando al endpoint /api/accounts/:id/print-pre-cuenta.
    Agregar el botón "Imprimir Consumos" en el header (al lado del botón de cerrar/X) para permitir re-imprimir cuentas abiertas y cerradas.
  </action>
  <verify>Abrir el modal de detalles de una cuenta y verificar el botón "Imprimir Consumos".</verify>
  <done>Es posible reimprimir el detalle de consumos de cualquier cuenta histórica o activa desde sus detalles.</done>
</task>

<task type="auto">
  <name>Reimpresión de Apertura en Turno Activo</name>
  <files>client/src/components/SessionManagerModal.jsx</files>
  <action>
    En SessionManagerModal.jsx, importar Printer de lucide-react.
    Definir handleReprintApertura() llamando a /api/sessions/:id/print con payload {"type": "apertura"}.
    En la vista de turno activo (Shift Summary View), agregar un botón "Reimprimir Ticket de Apertura" debajo del grid de estado/apertura.
  </action>
  <verify>Abrir el modal de caja activa y comprobar la existencia del botón de reimpresión de apertura.</verify>
  <done>El cajero puede reimprimir el ticket de apertura del turno en curso.</done>
</task>

<task type="auto">
  <name>Reimpresión de Apertura y Cierre en Historial de Turnos</name>
  <files>client/src/components/SessionsHistoryTab.jsx</files>
  <action>
    En SessionsHistoryTab.jsx, importar Printer de lucide-react.
    En el modal de detalle del turno (SessionDetailsModal), definir handlePrintSessionReport(type) llamando al endpoint /api/sessions/:id/print con payload {"type": type}.
    En el footer del modal, agregar dos botones al lado de "Cerrar": "Imprimir Apertura" y "Imprimir Cierre", usando el ícono de impresora y estilos adecuados.
  </action>
  <verify>Visualizar un turno del historial, entrar a su detalle y ensayar la reimpresión física de apertura y cierre.</verify>
  <done>El administrador puede reimprimir reportes de turnos pasados en cualquier momento.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] El ticket de apertura de caja se imprime en apertura y se puede reimprimir.
- [ ] El envío de pedidos solicita confirmación para comanda de cocina/barra.
- [ ] Las pre-cuentas de consumo de mesa se pueden imprimir y reimprimir.
- [ ] El historial de turnos tiene botones funcionales de impresión de apertura y cierre.
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
