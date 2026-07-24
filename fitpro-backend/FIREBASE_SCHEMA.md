# Mapeo de esquema PostgreSQL → Firestore (propuesta)

Este documento propone la estructura en Firestore para FitPro, basada en `fitpro-backend/database.sql`.

Colecciones principales (Firestore):

- `gimnasios` (documents):
  - Campos: nombre, email, password_hash, plan, trial_end (timestamp), activo, created_at, updated_at
  - Subcolecciones: `membresias` (opcional)

- `usuarios` (documents):
  - Campos: gimnasio_id (ref o id), first_name, last_name, age, phone, training_type, personalized_type, payment_type, payment_start, payment_end, status, created_at, updated_at
  - Subcolecciones:
    - `rutinas` (documents)
    - `progreso` (documents)

- `productos` (documents):
  - Campos: gimnasio_id, name, description, price, currency, stock, icon, image, category, created_at, updated_at

- `rutinas` (posible estrategia alternativa):
  - Opción A: colección global `rutinas` con campo `usuario_id` (documentos) y subcolección `ejercicios`.
  - Opción B: anidar `rutinas` dentro de cada `usuarios/{uid}/rutinas` (más directo para acceso por usuario).
  - Recomendación: usar `usuarios/{uid}/rutinas` para consultas por usuario y mantener colección global `rutinas` solo si se requiere acceso compartido.

- `ejercicios`:
  - Recomendado como subcolección `usuarios/{uid}/rutinas/{rid}/ejercicios`.

- `progreso`:
  - Guardar como subcolección `usuarios/{uid}/progreso` con documentos por fecha.

- `ventas` (documents):
  - Campos: usuario_id, customer_email, customer_name, phone, city, address, payment_method, total, shipping_cost, currency, created_at
  - Subcolección: `venta_items` (documents) con name, quantity, price, currency, producto_id

Consideraciones:

- Firestore es NoSQL; duplicar datos es aceptable para optimizar lecturas (ej. guardar `producto_snapshot` en `venta_items`).
- Usar identificadores legibles: conservar los `id` numéricos originales como campo `old_id` si se desea, y usar Firestore auto-ids o usar String(id).
- Fechas/timestamps: convertir a `admin.firestore.Timestamp` en migración.
- Índices: crear índices compuestos según consultas (ej. `usuarios` por `gimnasio_id` y `status`).
- Reglas de seguridad: definir acceso por rol (`admin`, `gym_admin`, `coach`, `user`) y validar `gimnasio_id` en las escrituras.

Migración:
- Extraer filas de PostgreSQL y escribir documentos en Firestore.
- Para `rutinas` y `ejercicios`, migrar `rutinas` y crear subcolección `ejercicios` con los registros relacionados.
- Para `progreso`, migrar a `usuarios/{uid}/progreso`.
- Para `ventas`, migrar `venta_items` a subcolección de cada venta.

Performance:
- Considerar Firestore batchedWrites (500 ops por batch) y límites de writes por documento.

Rollback:
- Mantener backup JSON exportado de Postgres antes de ejecutar escritura en Firestore.

---

Siguientes pasos: ejecutar el script de migración con credencial de servicio Firebase y verificar muestras en la consola Firestore.