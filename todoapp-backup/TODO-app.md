# TODO - App General

Esta nota documenta mejoras generales para la aplicación de ecommerce/gimnasio.

## Experiencia de usuario

- [ ] Mejorar la navegación entre landing, tienda y admin.
- [x] Añadir botones de llamada a la acción claros en el landing page (ej. "Comprar ahora", "Ver productos").
- [x] Mostrar el estado del carrito en todo momento con un indicador visible.
- [x] Añadir mensajes de confirmación al agregar productos al carrito.
- [x] Implementar feedback visual al cerrar sesión o iniciar sesión.
- [x] Crear una sección de FAQ o información de envío y devoluciones.

## Contenido y diseño

- [x] Mejorar la jerarquía visual del landing page con secciones más claras.
- [x] Añadir secciones de testimonios o beneficios reales.
- [ ] Mostrar detalles de cada producto (ingredientes, beneficios, uso recomendado).
- [x] Coordinar mejor las monedas: COP y USD deben mostrarse con formato consistente.
- [x] Añadir filtros por categoría, precio o tipo de producto.

## Funcionalidad

- [x] Validar que el registro y login funcionan bien para usuario y admin.
- [x] Implementar login real contra backend con `POST /api/auth/login`.
- [x] Reemplazar el auth local de `localStorage` por un flujo backend con token JWT y `/api/auth/me`.
- [x] Añadir control para evitar compras si el producto está agotado.
- [x] Implementar búsqueda de productos.
- [x] Añadir un historial de compras o resumen de pedidos.
- [x] Permitir editar cantidad de producto desde el carrito.
- [ ] Preparar una pasarela de pago futura (Nequi/MercadoPago) con flujo de checkout.
- [x] Agregar checkout backend y persistir ventas / stock en la base de datos.
- [ ] Añadir módulo de rutinas y entrenadores.
- [ ] Generar rutinas con IA según objetivo, nivel y progreso.
- [ ] Registrar análisis de progreso personal y estadísticas de entrenamiento.
- [ ] Añadir ranking/gamificación del gimnasio.

## Admin y métricas

- [ ] Mejorar dashboard con más métricas clave.
- [x] Añadir administración de inventario y usuarios.
- [ ] Agregar reportes de ventas y comparaciones por periodo.

## Detalles técnicos

- [ ] Revisar responsive para móvil/tablet en todas las páginas.
- [ ] Asegurar que la app funciona correctamente en producción.
- [x] Guardar notas y tareas en archivos TODO para trabajar gradualmente.

## Estado actual

- La edición y administración de productos funciona en admin.
- El checkout está integrado con backend y guarda ventas/stock.
- La página de producto muestra descripción, stock, categoría y precio.
- El login de usuario y admin se conecta al backend, con sesión persistida en `localStorage`.
