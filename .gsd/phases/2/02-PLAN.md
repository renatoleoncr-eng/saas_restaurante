---
phase: 2
plan: 2
wave: 1
depends_on: []
files_modified:
  - server/utils/dateUtils.js
  - client/src/views/ReportesView.jsx
  - client/src/components/SessionManagerModal.jsx
  - client/src/views/Dashboard.jsx
  - client/src/views/QrManagement.jsx
  - client/src/components/BillingConfigModal.jsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "El reporte de caja por defecto muestra el día operativo correcto antes de las 7:00 AM (el día calendario anterior)"
    - "El registro de egresos en el turno nocturno cae en el día de hotel activo y se asocia con la sesión de caja abierta"
    - "Los meseros y cajeros pueden acceder a la facturación electrónica"
    - "La pestaña de Configuración en el modal de facturación está oculta e inaccesible para meseros y cajeros"
    - "Los meseros pueden ver la pantalla de cliente con el QR, nombre y celular vigentes, pero no pueden realizar acciones como editar, borrar o ajustar saldo"
  artifacts: []
---

# Plan 2.2: Ajustes de Día Operativo en Caja y Permisos de Facturación y QR para Mesero

<objective>
Alinear la inicialización de la fecha de caja/reportes con el día operativo real (7 AM a 7 AM), habilitar el acceso a facturación electrónica para meseros/cajeros sin pestañas de configuración, y permitir el acceso de lectura de QRs vigentes al rol de mesero sin permitir acciones.

Purpose: Asegurar que los movimientos de la noche se reporten en el turno correcto y permitir que los meseros emitan facturas y verifiquen QRs sin tener acceso a configuraciones críticas.
Output: Reportes de caja ajustados a 7 AM, modales de facturación y gestión QR con visibilidad y permisos controlados por rol.
</objective>

<context>
Load for context:
- server/utils/dateUtils.js
- client/src/views/ReportesView.jsx
- client/src/components/SessionManagerModal.jsx
- client/src/views/Dashboard.jsx
- client/src/views/QrManagement.jsx
- client/src/components/BillingConfigModal.jsx
</context>

<tasks>

<task type="auto">
  <name>Ajustes de Lógica de Caja (7 AM a 7 AM)</name>
  <files>server/utils/dateUtils.js, client/src/views/ReportesView.jsx, client/src/components/SessionManagerModal.jsx</files>
  <action>
    Modificar dateUtils.js para restar 1 día al rango por defecto si la hora local en Lima es antes de las 7:00 AM.
    Modificar ReportesView.jsx para restar 1 día en getLocalDate si la hora local es antes de las 7:00 AM.
    En SessionManagerModal.jsx, eliminar la propiedad date de la llamada de creación de egresos en handleAddExpense para que se registre con el timestamp exacto del servidor.
    AVOID: Alterar la fecha en TableControl.jsx o MenuConfig.jsx para no interferir con la lógica de pedidos ni la planificación diaria del menú.
  </action>
  <verify>Verificar que el cliente compile correctamente con npm run build.</verify>
  <done>Reportes e inicialización de fecha por defecto consideran el rollover a las 7 AM. Egresos se guardan con el timestamp del servidor.</done>
</task>

<task type="auto">
  <name>Acceso de Meseros y Cajeros a Facturación</name>
  <files>client/src/views/Dashboard.jsx, client/src/components/BillingConfigModal.jsx</files>
  <action>
    En Dashboard.jsx, habilitar que meseros y cajeros vean el botón de Facturación Electrónica en sus dropdowns de usuario desktop/mobile.
    En BillingConfigModal.jsx, importar useRestaurant y recuperar el usuario activo. Ocultar la pestaña 'Configuración' y proteger su renderizado de forma que activeTab === 'config' solo funcione para el rol admin.
  </action>
  <verify>Confirmar que el modal de facturación cargue correctamente en el frontend.</verify>
  <done>Acceso a facturación visible para meseros/cajeros, con la pestaña de configuración protegida y oculta.</done>
</task>

<task type="auto">
  <name>Acceso de Lectura a QRs para Meseros</name>
  <files>client/src/views/Dashboard.jsx, client/src/views/QrManagement.jsx</files>
  <action>
    En Dashboard.jsx, quitar qr_management de las restrictedViews para el rol waiter.
    En Dashboard.jsx, mostrar el botón de "Pantalla Cliente" en el dropdown de usuario desktop/mobile para el rol waiter.
    En QrManagement.jsx, filtrar las pestañas superiores para que los meseros solo vean 'Gestión QR' (ocultar Publicidad y Ruleta).
    En QrManagement.jsx, ocultar las pestañas de sub-navegación ('Configuración'/'Movimientos') y el botón '+ Agregar QR' para el rol waiter.
    En QrManagement.jsx, ocultar las columnas de 'Límite', 'Acumulado', 'Ilimitado', y 'Acciones' en la tabla de QRs si el usuario es waiter.
    En QrManagement.jsx, asegurar que un mesero solo visualice: Imagen QR, Nombre y Celular del QR vigente/disponible.
  </action>
  <verify>Verificar que no haya errores de compilación y que la vista compile en producción.</verify>
  <done>Los meseros pueden navegar a la pantalla de cliente, ver la lista de QRs con solo 3 datos de lectura, y no tienen acceso a acciones ni otras pestañas.</done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] El reporte de caja por defecto muestra el día operativo correcto antes de las 7:00 AM (el día calendario anterior)
- [ ] El registro de egresos en el turno nocturno cae en el día de hotel activo y se asocia con la sesión de caja abierta
- [ ] Los meseros y cajeros pueden acceder a la facturación electrónica
- [ ] La pestaña de Configuración en el modal de facturación está oculta e inaccesible para meseros y cajeros
- [ ] Los meseros pueden ver la pantalla de cliente con el QR, nombre y celular vigentes, pero no pueden realizar acciones como editar, borrar o ajustar saldo
</verification>

<success_criteria>
- [ ] All tasks verified
- [ ] Must-haves confirmed
</success_criteria>
