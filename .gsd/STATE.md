# Project State

- Current Phase: 5
- Current Plan: 2
- Status: COMPLETED
- Accumulated Decisions:
  - Using Three.js and 3d-force-graph via CDN for lightweight visualization.
  - Analyzing client and server folders specifically.
  - Implemented client-side PWA Android back button/gesture modal interceptor using the custom React hook useModalBackHandler.
  - Implemented ESC/POS thermal printing triggers (opening tickets, closing reports, pre-bills, and comanda confirmations) and historical reprints.
  - Completely sealed cross-tenant IDOR via findOne + TenantId isolation.
  - Completely sealed WebSocket fallbacks via io.to(tenant).emit.
