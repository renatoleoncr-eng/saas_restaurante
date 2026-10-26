---
phase: 7
plan: 1
wave: 1
depends_on: []
files_modified:
  - client/package.json
  - server/routes/performance.routes.js
  - server/index.js
autonomous: true
user_setup: []

must_haves:
  truths:
    - "recharts is installed in client and imports cleanly without dependency conflicts"
    - "GET /api/performance/stats is protected and only accessible with valid JWT and role 'admin'"
    - "GET /api/performance/stats returns monthly KPIs (ingresos, ocupación, ticket promedio, total cuentas, gastos, rentabilidad)"
    - "GET /api/performance/stats returns evolutivo mensual (12 meses con ingresos, gastos, cuentas y ocupación)"
    - "GET /api/performance/stats returns comparativo diario (mes seleccionado vs mes anterior)"
    - "GET /api/performance/stats returns ranking de productividad por usuario, preferencia de mesas y distribución de ventas (top productos y métodos de pago)"
    - "Queries respect multi-tenant isolation (TenantId) and operate with 7:00 AM Peru operational day cutoff"
  artifacts:
    - "server/routes/performance.routes.js"
    - "client/package.json"
---

# Plan 7.1: Dependencias Frontend & Endpoint de Estadísticas de Performance en Backend

<objective>
Instalar la librería de visualización `recharts` en el cliente e implementar el módulo backend completo de estadísticas y métricas de rendimiento (`/api/performance/stats`) para restaurantes, con cálculo robusto de KPIs, evolutivos, ocupación de mesas, productividad y distribución de ventas, blindado con aislamiento multi-tenant y restricción exclusiva para rol `admin`.

Purpose: Proporcionar la base de datos y la API de agregación estadística necesaria para alimentar el cuadro de mando de performance del restaurante.
Output: Dependencia `recharts` en el cliente, nuevo archivo de rutas `server/routes/performance.routes.js` registrado en `server/index.js` y script de verificación de endpoint.
</objective>

<context>
Load for context:
- server/models/index.js
- server/routes/revenue.routes.js
- server/routes/operation.routes.js
- server/utils/dateUtils.js
- server/middleware/auth.middleware.js
- server/index.js
- C:/Antigravity/Gestion Mak/server/controllers/performanceController.js
</context>

<tasks>

<task type="auto">
  <name>Instalar dependencia recharts en el cliente frontend</name>
  <files>client/package.json</files>
  <action>
    1. Instalar la librería `recharts` en el proyecto del cliente ejecutando `npm install recharts --prefix client --legacy-peer-deps`.
    2. Verificar que `recharts` quede registrado en `dependencies` de `client/package.json`.
    3. Comprobar que Vite resuelva los módulos de recharts sin errores de compatibilidad con React 18.
    AVOID: Modificar la versión de React 18 existente en el cliente.
  </action>
  <verify>
    npm --prefix client list recharts
  </verify>
  <done>
    `recharts` se encuentra instalado en `client/node_modules` y registrado en `client/package.json`.
  </done>
</task>

<task type="auto">
  <name>Crear rutas y controlador de performance con agregaciones estadísticas</name>
  <files>server/routes/performance.routes.js, server/index.js</files>
  <action>
    1. Crear `server/routes/performance.routes.js` exportando un Express Router.
    2. Implementar `GET /performance/stats` con middleware `requireRole('admin')` y tenant scoping obligatorio (`req.tenant.id`).
    3. Extraer query params: `year`, `month`, `startDay`, `endDay`.
       - Determinar `selectedYear`, `selectedMonth` (1-12) y días en el mes (`daysInSelectedMonth`).
       - Aplicar corte de día operativo de 7:00 AM (desfase de 12 horas UTC = 5h Perú UTC-5 + 7h turno operativo) compatible tanto con MySQL como con SQLite (`sequelize.getDialect() === 'mysql'`).
    4. Implementar las agregaciones estadísticas:
       - **Available Years**: Años desde el primer registro hasta el año actual.
       - **KPIs**:
         * `ingresos`: Suma de `Payment.amount` donde `createdAt` cae en el rango seleccionado y `method != 'qr_adjustment'`.
         * `totalAccounts`: Conteo de `Account` cerradas en el rango.
         * `avgTicket`: `ingresos / totalAccounts` (o 0 si totalAccounts es 0).
         * `occupancyRate`: Tasa de ocupación de mesas. Calcular total de mesas activas (`Table.count({ where: { TenantId } })`). Para cada día operativo del rango, contar mesas distintas con al menos una cuenta. Promediar el ratio sobre los días operativos evaluados.
         * `totalExpenses`: Suma de `Expense.amount` en el rango.
         * `rentabilidad`: `ingresos - totalExpenses`.
       - **Evolutivo Mensual (Ene - Dic)**:
         * 12 meses del año seleccionado con: `ingresos` (ventas), `gastos` (egresos), `cuentas` y `ocupacion`.
       - **Comparativo Diario**:
         * Array de días 1..días del mes con: `day`, `label` ('D', 'L', 'M', 'M', 'J', 'V', 'S'), `current` (ventas del día mes actual), `previous` (ventas del día mes anterior).
       - **Volumen Diario (Mesas y Cuentas)**:
         * Array de días dentro de `startDay` y `endDay` con: `day`, `cuentas` (total cuentas atendidas) y `mesas` (mesas únicas atendidas).
       - **Preferencia de Mesas (Top Tables)**:
         * Mesas con más cuentas en el rango, incluyendo número de mesa y área (`Table.number`, `Area.name`, `count`).
       - **Distribución de Ventas (Top Products & Categorías & Métodos de Pago)**:
         * Top 10 productos más vendidos con `name`, `category`, `quantity` y `total`.
         * Distribución de ingresos por método de pago (`efectivo`, `yape`, `tarjeta`, `transferencia`).
       - **Ranking de Productividad por Usuario**:
         * `byOrders`: Mozos/usuarios que tomaron pedidos (nombre, total en S/, cantidad de órdenes).
         * `byPayments`: Cajeros/usuarios que procesaron cobros (nombre, total en S/, cantidad de pagos).
    5. Registrar la ruta en `server/index.js`:
       `const performanceRoutes = require('./routes/performance.routes');`
       `app.use('/api', requireTenant, authMiddleware, performanceRoutes);`
    AVOID: Agrupaciones SQL con alias en ORDER BY que fallen bajo el modo estricto de MySQL (`sql_mode=only_full_group_by`). Ordenar en JavaScript cuando sea necesario.
  </action>
  <verify>
    node -e "const r = require('./server/routes/performance.routes'); console.log('Performance routes loaded successfully');"
  </verify>
  <done>
    `server/routes/performance.routes.js` expone `GET /performance/stats` montado en `/api` y devuelve todas las métricas requeridas.
  </done>
</task>

<task type="auto">
  <name>Verificar endpoint de performance y permisos de acceso mediante script de prueba</name>
  <files>test_performance_api.js</files>
  <action>
    1. Crear un script temporal `test_performance_api.js` que invoque la lógica del endpoint con base de datos SQLite local o mock tenant.
    2. Comprobar que:
       - No arroja excepciones SQL o errores de sintaxis.
       - La estructura del JSON resultante coincide exactamente con lo esperado (`kpis`, `evolution`, `dailyComparison`, `dailyVolumeData`, `topTables`, `topProducts`, `paymentMethods`, `userProductivity`, `availableYears`).
       - Maneja rangos de días personalizados (quincenas, mes completo) de forma adecuada.
    3. Ejecutar el script y validar salida exitosa. Luego remover o mantener el script de test.
    AVOID: Dejar queries que generen bloqueos o requieran datos no existentes en la BD.
  </action>
  <verify>
    node test_performance_api.js
  </verify>
  <done>
    El script confirma que el endpoint retorna código 200 y el contrato de datos completo sin inconsistencias.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] `recharts` está instalado y disponible para imports en `client/src`.
- [ ] El endpoint `/api/performance/stats` está registrado y protegido con `authMiddleware` y `requireRole('admin')`.
- [ ] Las consultas consideran el corte operativo de 7 AM y el dialecto de la base de datos (MySQL y SQLite).
- [ ] Las métricas de ingresos, ocupación de mesas, ticket promedio, comparativo diario y productividad se calculan sin errores.
</verification>

<success_criteria>
- [ ] API backend de Performance operativa y verificada con éxito.
</success_criteria>
