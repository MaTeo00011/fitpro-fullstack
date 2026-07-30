# TODO - Dashboard Admin

Esta nota sirve para anotar mejoras y tareas pendientes del dashboard administrativo.

## Tareas prioritarias

- [ ] Mostrar claramente la moneda en el dashboard (USD/COP) y la tasa de cambio usada.
- [ ] Agregar métricas clave adicionales:
  - Total ventas acumuladas
  - Ventas de la semana / mes
  - Productos más vendidos
  - Usuarios nuevos / activos
  - Stock bajo / productos agotados
  - Progreso de entrenamientos y métricas de rutina
  - Ranking del gimnasio y usuarios más activos
- [ ] Añadir filtro de rango de fechas para el gráfico (últimos 7 días, 30 días, mes actual).
- [ ] Mostrar comparación con el periodo anterior (por ejemplo "+15% respecto a la semana pasada").
- [ ] Incluir un listado de eventos recientes:
  - Últimos pedidos
  - Últimos usuarios registrados
  - Cambios recientes en productos
  - Nuevas rutinas o logros completados
- [ ] Mejorar el mensaje cuando no hay datos disponibles en el gráfico.
- [ ] Asegurar que la experiencia sea responsive en móviles y tabletas.
- [ ] Añadir soporte de IA para generación de rutinas y recomendaciones.
- [ ] Añadir gestión de entrenadores y panel de rutinas personalizadas.

## Estado actual

- El dashboard muestra métricas básicas: total productos, ventas del día, usuarios y pedidos hoy.
- Hay un gráfico de ventas de los últimos 7 días que convierte ventas COP a USD.
- Ya existe ciclo de datos para mostrar ventas diarias desde `cart.service`.
- Falta enriquecer el dashboard con más métricas, rangos y datos históricos.

## Próximos pasos sugeridos

1. Añadir métricas de ventas acumuladas y promedio diario.
2. Mostrar claramente la moneda usada en cada valor y la tasa de conversión.
3. Agregar un panel de eventos recientes (pedidos, usuarios, cambios en productos).
4. Mejorar la vista responsive del dashboard para móvil/tablet.
