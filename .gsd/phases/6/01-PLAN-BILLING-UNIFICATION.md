---
phase: 6
plan: 1
wave: 1
depends_on: []
title: "Unificación de la Lógica de Facturación Electrónica y Cumplimiento Normativo SUNAT Consumidor Final"
must_haves:
  - "Eliminar discrepancias entre el Detalle de Cuenta (InvoiceManagementModal), Cobro de Mesa (PaymentModal / usePaymentFlow), Historial de Cuentas (AccountsHistoryTab) y Configuración (BillingConfigModal)"
  - "Garantizar cumplimiento estricto de la normativa SUNAT: Boletas <= S/ 700 voluntarias (Consumidor Final con Tipo 0, número '-' y 'CLIENTE FINAL') vs Boletas > S/ 700 obligatorias con DNI de 8 dígitos numéricos y nombres completos"
  - "Desbloquear el botón de cobro en PaymentModal para boletas <= S/ 700 sin exigir DNI"
  - "Blindar el backend para rechazar preventivamente boletas > S/ 700 incompletas y garantizar simetría UBL en notas de crédito de anulación"
---

# Plan 6-01: Unificación de Facturación Electrónica

## Contexto y Diagnóstico
Actualmente la lógica de facturación está duplicada con comportamientos dispares:
1. `PaymentModal.jsx` sobreescribe `isInvoiceDataMissing` en la línea 652 bloqueando cobros <= S/ 700 si no hay DNI.
2. `usePaymentFlow.js` envía `'00000000'` (Tipo 1 inválido) y un `window.confirm` obsoleto.
3. `InvoiceManagementModal.jsx` permite Consumidor Final para <= S/ 700 pero no valida DNI de 8 dígitos para > S/ 700.
4. `AccountsHistoryTab.jsx` envía `'00000000'`.
5. `billing.routes.js` no valida boletas > S/ 700 defensivamente y en notas de crédito fuerza DNI `'00000000'` para comprobantes de Consumidor Final.

---

## Tasks

<task type="auto" id="1">
  <title>Crear Módulo Central de Reglas de Facturación (billingRules.js)</title>
  <files>client/src/utils/billingRules.js</files>
  <action>
    Crear una utilidad compartida exportando:
    1. `validateInvoiceForm({ tipo, total, docNumber, customerName, customerAddress })`:
       - Factura: RUC obligatorio de 11 dígitos numéricos (prefijos 10, 15, 17, 20), Razón Social obligatoria, Dirección obligatoria.
       - Boleta > S/ 700: DNI obligatorio (8 dígitos numéricos), Nombre obligatorio (no genérico ni vacío).
       - Boleta <= S/ 700: DNI y Nombre opcionales. Si se ingresa DNI, debe ser válido (8 dígitos). Si está vacío, es válido como Consumidor Final.
    2. `normalizeInvoicePayload({ tipo, total, docNumber, customerName, customerAddress, items, accountId, userId, fechaEmision, observaciones })`:
       - Para boletas <= S/ 700 sin DNI: asigna `clienteDocumento: '-'`, `clienteNombre: 'CLIENTE FINAL'`, `clienteDireccion: '-'`.
       - Para boletas con DNI: limpia espacios, asigna DNI y Nombre ingresado.
       - Elimina completamente cualquier uso de cadenas '00000000'.
  </action>
  <verify>
    Importar y verificar con pruebas unitarias/validaciones manuales que cubra los casos: Factura válida/inválida, Boleta <= 700 vacía, Boleta <= 700 con DNI, Boleta > 700 sin DNI (rechazada), Boleta > 700 completa.
  </verify>
  <done>
    Existe una única fuente de reglas de validación y normalización para el cliente en el frontend.
  </done>
</task>

<task type="auto" id="2">
  <title>Unificar Componentes de Frontend (PaymentModal, usePaymentFlow, InvoiceManagementModal, AccountsHistoryTab, BillingConfigModal)</title>
  <files>
    client/src/components/PaymentModal.jsx,
    client/src/hooks/usePaymentFlow.js,
    client/src/components/InvoiceManagementModal.jsx,
    client/src/components/AccountsHistoryTab.jsx,
    client/src/components/BillingConfigModal.jsx
  </files>
  <action>
    1. En `PaymentModal.jsx`:
       - Eliminar la sobreescritura de `isInvoiceDataMissing` en la línea 652 que requería DNI incondicionalmente.
       - Usar `validateInvoiceForm` para habilitar el cobro libre en boletas <= S/ 700 y requerir DNI/Nombre solo cuando total > S/ 700.
       - Mostrar feedback visual explicativo si total > S/ 700 indicando que SUNAT exige DNI.
    2. En `usePaymentFlow.js`:
       - Eliminar el confirm obsoleto (`window.confirm("La boleta se emitirá a CLIENTES VARIOS")`).
       - Usar `normalizeInvoicePayload` para enviar el payload estandarizado sin `'00000000'`.
    3. En `InvoiceManagementModal.jsx`:
       - En `handleSubmit`, aplicar `validateInvoiceForm`. Validar que si total > S/ 700 el DNI tenga 8 dígitos numéricos además del nombre.
       - Usar `normalizeInvoicePayload` antes de enviar la petición.
    4. En `AccountsHistoryTab.jsx` y `BillingConfigModal.jsx`:
       - Alinear la emisión para que use la misma normalización y no inyecte `'00000000'`.
  </action>
  <verify>
    Comprobar en la interfaz:
    - Mesa con consumo S/ 80: se puede marcar 'Emitir Comprobante', dejar DNI en blanco y el botón Cobrar queda habilitado.
    - Mesa con consumo S/ 750: el botón Cobrar o Facturar exige DNI (8 dígitos) y Nombre.
    - Detalle de cuenta: 'Facturar' emite sin DNI si es <= S/ 700, y exige DNI 8 dígitos si es > S/ 700.
  </verify>
  <done>
    Todas las pantallas de emisión en el frontend se comportan exactamente bajo la misma regla unificada.
  </done>
</task>

<task type="auto" id="3">
  <title>Blindaje Defensivo en Backend y Simetría en Notas de Crédito (billing.routes.js)</title>
  <files>server/routes/billing.routes.js</files>
  <action>
    1. En `POST /billing/invoices`:
       - Crear función helper `resolveSunatClient(tipo, total, doc, name, dir)`:
         - Si `tipo === 'factura'`: Validar RUC 11 dígitos, prefijo (10, 15, 17, 20), RUC diferente al de la empresa y Razón Social.
         - Si `tipo === 'boleta'` y `total > 700`: Validar que `clienteDocumento` sea numérico de 8 dígitos y `clienteNombre` esté presente y no sea genérico. Si falla, responder con status 400 y mensaje en español claro.
         - Si `tipo === 'boleta'` y `total <= 700`: Si no hay documento o es '-', '00000000' o vacío, forzar `number: '-'`, `type: '0'` y `name: 'CLIENTE FINAL'`. Si viene DNI válido de 8 dígitos, asignar `type: '1'`, `number: doc`, `name: name`.
    2. En `POST /billing/invoices/:id/anular`:
       - Al anular por nota de crédito (código 07), inspeccionar el `clienteDocumento` y tipo del comprobante original.
       - Si la boleta original fue emitida como Consumidor Final (documento `'-'` o vacío), enviar la nota de crédito con `type: '0'`, `number: '-'` y `name: 'CLIENTE FINAL'` para mantener estricta simetría fiscal con el documento afectado.
  </action>
  <verify>
    Ejecutar tests o curl simulando:
    - Emisión boleta S/ 50 sin documento -> hubPayload.client tiene type '0', number '-', name 'CLIENTE FINAL'.
    - Emisión boleta S/ 800 sin documento -> Backend retorna 400 con error descriptivo de SUNAT.
    - Anulación de boleta Consumidor Final -> hubPayload.client de la NC tiene type '0' y number '-'.
  </verify>
  <done>
    Backend valida y normaliza de forma autónoma y consistente cualquier petición de facturación y anulación.
  </done>
</task>
