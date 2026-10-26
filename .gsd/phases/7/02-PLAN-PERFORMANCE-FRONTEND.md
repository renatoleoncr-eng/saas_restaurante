---
phase: 7
plan: 2
wave: 2
depends_on:
  - "7.1"
files_modified:
  - client/src/views/PerformanceDashboard.jsx
  - client/src/views/Dashboard.jsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "Only users with role 'admin' can view and access the Performance menu option"
    - "The sidebar navigation contains 'Performance' with TrendingUp icon for admin profiles on desktop and mobile"
    - "Clicking 'Performance' renders PerformanceDashboard cleanly"
    - "Selectors for Year, Month, and Day Range (with 'Todo', '1ª Q', '2ª Q' shortcuts) update charts reactively"
    - "KPI cards render Ingresos Totales, % Mesas Ocupadas, Ticket Promedio y Cantidad de Cuentas"
    - "AreaCharts render Evolutivo Mensual de Ingresos vs Gastos y Evolutivo de % Ocupación"
    - "LineChart renders Comparativo Diario de Ingresos (Mes Seleccionado vs Mes Anterior)"
    - "BarCharts render Mesas/Cuentas por Día, Ranking de Productividad por Usuario, Preferencia de Mesas y Distribución de Ventas"
    - "UI is completely responsive and fits mobile devices without layout shifts or horizontal clipping"
    - "npm run build --prefix client passes with zero errors"
  artifacts:
    - "client/src/views/PerformanceDashboard.jsx"
    - "client/src/views/Dashboard.jsx"
---

# Plan 7.2: Componente Frontend PerformanceDashboard e Integración de Navegación

<objective>
Construir el componente de dashboard `PerformanceDashboard.jsx` en React con Recharts, replicando la experiencia premium y analítica de Gestión Mak adaptada al restaurante, e integrarlo en la barra de navegación lateral y vistas del sistema en `Dashboard.jsx`, restringido exclusivamente al rol `admin`.

Purpose: Entregar al administrador del restaurante un centro de analítica y rendimiento con KPIs en tiempo real, evolutivos mensuales, comparativas diarias, productividad de mozos/cajeros, preferencias de mesas y distribución de ventas.
Output: Vista `client/src/views/PerformanceDashboard.jsx`, navegación actualizada en `client/src/views/Dashboard.jsx` y build de frontend validado.
</objective>

<context>
Load for context:
- client/src/views/Dashboard.jsx
- client/src/contexts/RestaurantContext.jsx
- C:/Antigravity/Gestion Mak/client/src/pages/PerformanceDashboard.jsx
- .gsd/phases/7/01-PLAN-PERFORMANCE-BACKEND.md
</context>

<tasks>

<task type="auto">
  <name>Construir la vista integral PerformanceDashboard.jsx con Recharts</name>
  <files>client/src/views/PerformanceDashboard.jsx</files>
  <action>
    1. Crear `client/src/views/PerformanceDashboard.jsx` importando `recharts`, `lucide-react`, `axios` y `useRestaurant`.
    2. Estados del dashboard:
       - `year` (año seleccionado, default año actual).
       - `month` (mes seleccionado 1-12, default mes actual).
       - `startDay` y `endDay` (default 1 y último día del mes actual).
       - `data` (respuesta de `/api/performance/stats`), `loading`, `error`.
    3. Cabecera y Controles de Filtro:
       - Título: "Performance del Restaurante" con icono `TrendingUp` azul.
       - Barra de filtros: Selector de Año, Selector de Mes (Enero a Diciembre) y Rango del Día (de - a) con botones de acceso rápido "Todo", "1ª Q" (1 - 15) y "2ª Q" (16 - fin).
    4. Bloque de 4 KPIs Superiores (Grid responsivo de 2 cols en mobile, 4 cols en desktop):
       - **Ingresos**: `S/ {kpis.ingresos}` (icono morado `S/`).
       - **% Ocupación Mesas**: `{kpis.occupancyRate}%` (icono azul `Users` o `LayoutGrid`).
       - **Ticket Promedio**: `S/ {kpis.avgTicket}` (icono verde `S/`).
       - **Cuentas Atendidas**: `{kpis.totalAccounts}` (icono naranja `TrendingUp`).
    5. Bloque de Evolutivo Anual (2 columnas):
       - **Evolutivo Mensual {year} (Ingresos vs Gastos)**: `AreaChart` interactivo con gradiente verde (#10b981) para "Ingresos Reales" y gradiente fucsia (#f43f5e) para "Gastos Operativos", con tooltip formateado en soles `S/`.
       - **Evolutivo de % de Ocupación {year}**: `AreaChart` con gradiente teal/cyan (#0d9488) de 0% a 100%, mostrando la tasa de ocupación mes a mes.
    6. Bloque de Métricas Diarias (2 columnas):
       - **Comparativo Diario (Día {startDay} - {endDay})**: `LineChart` con línea sólida azul para el "Mes Seleccionado" y línea discontinua gris para el "Mes Anterior", con tooltip mostrando día de la semana (`Día 5 (L)`).
       - **Mesas y Cuentas Atendidas por Día**: `BarChart` con barras para cuentas atendidas y mesas ocupadas, con etiquetas numéricas superiores.
    7. Bloque de Distribución y Productividad (2 o 3 columnas):
       - **Ranking de Productividad por Usuario**: `BarChart` horizontal mostrando ventas por mozo/usuario (`byOrders`) o cobros (`byPayments`) con etiquetas de monto `S/`.
       - **Preferencia de Mesas**: `BarChart` horizontal mostrando el Top de mesas con mayor volumen de cuentas, indicando Mesa y Área.
       - **Distribución de Ventas**: `BarChart` horizontal con el Top de productos más vendidos en unidades (`u.`) y desglose de ingresos por método de pago (Efectivo, Yape/Plin, Tarjeta, Transferencia).
    8. Diseño responsivo: padding adecuado (`p-4 md:p-8`), contenedores con `ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0}` para evitar desfases de layout al colapsar el sidebar.
    AVOID: Errores de ResizeObserver o alturas de gráfico en 0 envolviendo cada ResponsiveContainer en un div con altura fija (`h-[300px]`, `h-[250px]`).
  </action>
  <verify>
    node -e "const fs = require('fs'); const content = fs.readFileSync('client/src/views/PerformanceDashboard.jsx', 'utf8'); if (!content.includes('PerformanceDashboard') || !content.includes('recharts')) throw new Error('Invalid component'); console.log('PerformanceDashboard.jsx syntax check passed');"
  </verify>
  <done>
    `PerformanceDashboard.jsx` creado con todos los KPIs, evolutivos y gráficos solicitados, compatible con la API de backend.
  </done>
</task>

<task type="auto">
  <name>Integrar vista Performance en navegación y rutas de Dashboard.jsx para perfil Admin</name>
  <files>client/src/views/Dashboard.jsx</files>
  <action>
    1. En `client/src/views/Dashboard.jsx`:
       - Importar el componente `PerformanceDashboard` desde `./PerformanceDashboard`.
       - En la barra de navegación del sidebar (tanto versión expandida como colapsada):
         * Agregar el botón "Performance" justo después de "Caja" o "Auditoría" con el icono `TrendingUp` o `LineChart`.
         * Renderizarlo **únicamente** si `user.role === 'admin'`:
           ```jsx
           {user.role === 'admin' && (
               <button
                   onClick={() => { setCurrentView('performance'); if (window.innerWidth < 768) setIsCollapsed(true); }}
                   title="Performance"
                   className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors flex items-center gap-3 ${currentView === 'performance' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'} ${isCollapsed ? 'justify-center px-0' : ''}`}
               >
                   <TrendingUp size={20} />
                   {!isCollapsed && <span>Performance</span>}
               </button>
           )}
           ```
       - En la función `renderContent()`:
         * Agregar el caso:
           ```jsx
           if (currentView === 'performance') {
               return <PerformanceDashboard />;
           }
           ```
       - En la validación de redirección por roles restringidos:
         * Asegurar que usuarios con roles `waiter`, `cashier`, `kitchen` sean redirigidos a `'main'` si intentan acceder a `'performance'`:
           ```js
           const restrictedViews = {
               waiter: ['drink_promos', 'audit', 'performance'],
               cashier: ['drink_promos', 'audit', 'performance'],
               kitchen: ['carta', 'insumos', 'menu', 'reports', 'drink_promos', 'qr_management', 'audit', 'performance']
           };
           ```
    AVOID: Romper la transición de colapso/expansión del sidebar en dispositivos móviles o desktops.
  </action>
  <verify>
    node -e "const fs = require('fs'); const content = fs.readFileSync('client/src/views/Dashboard.jsx', 'utf8'); if (!content.includes('performance') || !content.includes('PerformanceDashboard')) throw new Error('Navigation not integrated'); console.log('Dashboard navigation integration passed');"
  </verify>
  <done>
    El menú "Performance" aparece en el sidebar exclusivamente para administradores y despliega la vista `PerformanceDashboard`.
  </done>
</task>

<task type="auto">
  <name>Verificar build completo del cliente y validación visual</name>
  <files>client/src/views/PerformanceDashboard.jsx, client/src/views/Dashboard.jsx</files>
  <action>
    1. Ejecutar el build de producción de Vite en el cliente: `npm run build --prefix client`.
    2. Verificar que no existan errores de sintaxis JSX, imports no resueltos o advertencias de bundle.
    3. Comprobar que los assets queden generados correctamente en `client/dist`.
    AVOID: Omitir la comprobación del build antes de dar por completado el trabajo.
  </action>
  <verify>
    npm run build --prefix client
  </verify>
  <done>
    `npm run build --prefix client` compila exitosamente con código de salida 0.
  </done>
</task>

</tasks>

<verification>
After all tasks, verify:
- [ ] La pestaña "Performance" aparece visible en el menú lateral solo para usuarios administradores.
- [ ] Usuarios no administradores no ven el enlace y son redirigidos si intentan entrar.
- [ ] Los 4 KPIs del resumen mensual cargan y formatean valores monetarios y porcentuales.
- [ ] Todos los gráficos de Recharts (evolutivo mensual, comparativo diario, barras de mesas y productos, productividad) se renderizan correctamente sin errores de renderizado.
- [ ] La compilación con `npm run build --prefix client` se ejecuta limpia y sin errores.
</verification>

<success_criteria>
- [ ] Opción y vista de Performance completamente funcional, estéticamente idéntica a Gestión Mak y operativa para perfiles Admin.
</success_criteria>
