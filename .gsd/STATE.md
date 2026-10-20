# Project State

- Current Phase: 6
- Current Plan: 1
- Status: COMPLETED
- Accumulated Decisions:
  - Using Three.js and 3d-force-graph via CDN for lightweight visualization.
  - Analyzing client and server folders specifically.
  - Implemented client-side PWA Android back button/gesture modal interceptor using the custom React hook useModalBackHandler.
  - Implemented ESC/POS thermal printing triggers (opening tickets, closing reports, pre-bills, and comanda confirmations) and historical reprints.
  - Completely sealed cross-tenant IDOR via findOne + TenantId isolation.
  - Completely sealed WebSocket fallbacks via io.to(tenant).emit.
  - Unified electronic invoicing logic across PaymentModal, usePaymentFlow, InvoiceManagementModal, AccountsHistoryTab, and BillingConfigModal via client/src/utils/billingRules.js.
  - Enforced SUNAT rules: Boleta <= S/ 700 optional DNI (defaults to Tipo 0, '-', 'CLIENTE FINAL'), Boleta > S/ 700 requires 8-digit DNI and customer name. Factura requires 11-digit RUC (prefixes 10, 15, 17, 20), Business Name, and Fiscal Address.
  - Guaranteed UBL symmetry on credit notes for Consumidor Final cancellations (Tipo 0).
