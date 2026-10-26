# Especificación: Módulo de Performance para Restaurante (Solo Admin)

## 1. Visión General
Implementar un centro de analítica y rendimiento gerencial ("Performance") en el sistema de gestión del restaurante Makala, con diseño y funcionalidades análogas al dashboard de Performance de Gestión Mak, pero adaptado a la operación gastronómica (mesas, mozos, productos, cuentas y métodos de pago).

Acceso: **Exclusivo para usuarios con rol `admin`**.

---

## 2. Requerimientos Funcionales

### 2.1. Filtros Temporales Dinámicos
- **Año**: Selector desplegable con años disponibles en la base de datos (por defecto, año en curso).
- **Mes**: Selector desplegable con los 12 meses del año (por defecto, mes en curso).
- **Rango del Día**:
  - Inputs numéricos de día inicial (`startDay`) y día final (`endDay`).
  - Accesos rápidos con un solo clic:
    - **Todo**: Día 1 al último día del mes.
    - **1ª Q**: Día 1 al 15.
    - **2ª Q**: Día 16 al último día del mes.

### 2.2. Cuadro Resumen del Mes (KPI Cards)
1. **Ingresos Totales**: Suma de pagos reales registrados en el periodo en soles (S/ XX,XXX.XX).
2. **% de Mesas Ocupadas**: Tasa promedio de ocupación de mesas (mesas con consumo / capacidad total de mesas activas).
3. **Ticket Promedio**: Promedio facturado por cuenta atendida (S/ XX.XX).
4. **Cuentas Atendidas**: Cantidad total de cuentas cerradas en el mes/rango.

### 2.3. Evolutivos Anuales y Mensuales
1. **Evolutivo Mensual (Ingresos vs Gastos)**:
   - Gráfico de áreas (`AreaChart`) de Enero a Diciembre.
   - Verde para ingresos de ventas y fucsia para gastos operativos.
2. **Evolutivo de % de Ocupación de Mesas**:
   - Gráfico de áreas (`AreaChart`) de Enero a Diciembre con escala de 0% a 100%.

### 2.4. Métricas Diarias del Mes Seleccionado
1. **Comparativo Diario de Ingresos**:
   - Gráfico de líneas (`LineChart`) comparando las ventas día a día del mes actual vs el mes anterior.
   - Eje X: Día del mes con día de la semana (ej. `Día 12 (V)`).
2. **Volumen Diario de Cuentas y Mesas**:
   - Gráfico de barras (`BarChart`) con la cantidad de cuentas y mesas atendidas cada día.

### 2.5. Productividad y Preferencias
1. **Ranking de Productividad por Usuario**:
   - Ventas generadas por mozo/usuario (`byOrders`) y cobros procesados por cajero (`byPayments`).
2. **Preferencia de Mesas**:
   - Top de mesas más solicitadas/rotadas (Mesa # y Área).
3. **Distribución de Ventas**:
   - Top de productos más vendidos en unidades (`u.`).
   - Distribución de ingresos por método de pago (Efectivo, Yape/Plin, Tarjeta, Transferencia).

---

## 3. Seguridad y Arquitectura
- **Backend**: Endpoint `GET /api/performance/stats` protegido por `requireTenant`, `authMiddleware` y `requireRole('admin')`.
- **Frontend**: Item de navegación en sidebar visible solo para `user.role === 'admin'`. Redirección automática a `'main'` si un rol no admin intenta acceder.
- **Zona Horaria y Día Operativo**: Corte a las 07:00 AM (desfase de 12 horas UTC) para respetar los turnos nocturnos del restaurante.
