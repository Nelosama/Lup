# Seguridad y operación

## Controles implementados

Contraseñas Argon2id (64 MiB, tres iteraciones y paralelismo 1), tokens aleatorios de 256 bits guardados como SHA-256, sesiones revocables con caducidad de siete días. Las cookies son HttpOnly, host-only, ruta `/api`, Secure en producción y SameSite configurable. Los tokens de sesión y CSRF se mantienen solo en memoria del navegador; localStorage contiene únicamente la preferencia de idioma.

Toda escritura exige un Origin permitido. Con sesión también exige `X-CSRF-Token`. No usar clientes que omitan Origin para escribir: las integraciones autorizadas deben suministrar el origen configurado. CORS contiene orígenes exactos, sin comodines. `TRUST_PROXY_HOPS` debe coincidir con la topología real para que el límite por IP sea correcto; no confiar indiscriminadamente en `X-Forwarded-For`.

Verificación y recuperación con tokens de un solo uso, propósito y vencimiento (24 h / 30 min). Cambiar o restablecer contraseña revoca todas las sesiones. Errores de login genéricos, hash simulado para usuarios desconocidos, límite por IP y contador persistente por hash del correo (15 intentos en 15 minutos). Registro y recuperación tienen respuestas genéricas; si el correo está deshabilitado ambos endpoints fallan para todos los correos. El correo real se procesa en una cola, por lo que las respuestas HTTP no distinguen resultados de entrega individuales.

Helmet, límites de cuerpo, validación estricta de DTOs y archivos, logs estructurados sin cuerpos ni query strings, RLS sin políticas anónimas en todas las tablas de negocio. La conexión del backend debe ser propietaria de las tablas. No se deben otorgar políticas de acceso público a sesiones, mensajes o usuarios para habilitar el frontend: este consume Nest.

## Super Admin inicial

Con autorización de un responsable, registrar y verificar una cuenta. Desde un entorno de operación con acceso a la base correcta:

```bash
npm run admin:grant -w backend -- responsable@example.com "Autorización del propietario para administrar Lup"
```

El comando agrega SUPER_ADMIN y escribe auditoría. No se ejecuta automáticamente ni crea contraseñas predeterminadas. No se pueden suspender cuentas privilegiadas por las interfaces normales: su revocación requiere intervención offline auditada. Pendiente MFA para administradores antes de producción.

## Procedimiento de verificación profesional

No se solicitan documentos de identidad. El estado inicial es UNVERIFIED. Un responsable puede pasar a PENDING_REVIEW, revisar fuentes profesionales públicas con autorización del titular y registrar fecha, criterios, referencias y resultado en el campo privado de evidencia. Solo SUPER_ADMIN puede marcar VERIFIED y no puede verificarse a sí mismo. El registro de evidencia y auditoría es obligatorio. La insignia significa revisión administrativa de información profesional declarada, no comprobación de identidad, licencia universal, seguridad ni garantía del trabajo. Si no hay revisión documental suficiente, conservar UNVERIFIED o REJECTED. Definir los criterios específicos del país y capacitar al revisor antes de usar VERIFIED en un lanzamiento real.

## Retención y eliminación

Política provisional que requiere revisión legal por jurisdicción: sesiones y tokens vencidos se purgan diariamente; intentos de login pasados y correo pendiente de más de 24 h se eliminan. Los adaptadores de entrega se prueban con dobles de prueba; la aceptación por un proveedor no demuestra entrega en la bandeja del destinatario. El buzón local es exclusivamente de desarrollo y debe eliminarse manualmente después de las pruebas. No trasladarlo a producción.

Desactivar una cuenta la retira de búsquedas y revoca sesiones; no elimina contratos, reseñas ni auditoría. Las solicitudes de acceso o eliminación deben verificarse y gestionarse por un responsable, con anonimización selectiva y preservación de registros exigidos legalmente. No hay borrados masivos en cascada de registros comerciales. Plazos definitivos para mensajes, reportes, auditoría y backups deben acordarse con asesoría legal antes del lanzamiento. No existe todavía un proceso automático de exportación/anonimización.

Ejecutar diariamente (no requiere planificador de pago):

```bash
npm exec -w backend -- tsx scripts/maintenance.ts
```

Alertar por `mail_delivery_failed`/`mail_worker_failed`; cinco intentos agotados requieren acción del operador. Revisar conteo de la cola con SQL autorizado sin imprimir su contenido. Revisar objetos huérfanos de Storage después de fallos de compensación y mantener presupuestos/cuotas en los proveedores.

## Backups y restauración

Usar el mecanismo incluido en el plan Supabase autorizado; verificar su retención real. No se habilita PITR ni otro servicio con cargo automáticamente. Exportación lógica alternativa desde un host autorizado, sin credenciales en argumentos o historial:

```bash
# PG* se suministra como secretos del operador; no guardar el archivo en el repositorio.
pg_dump --format=custom --no-owner --file=lup-backup.dump
# Restaurar exclusivamente en una base vacía de ensayo, nunca sobre producción:
pg_restore --no-owner --no-acl --dbname=lup_restore_check lup-backup.dump
```

Cifrar el archivo, limitar accesos y conservar por el plazo autorizado. Respaldar también objetos de Storage y sus referencias con un proceso aprobado; un dump de PostgreSQL no incluye fotografías. Cada mes restaurar en una base aislada, ejecutar `prisma migrate status`, comprobaciones de relaciones, conteos y un flujo de prueba con cuentas sintéticas. Registrar tiempos, RPO/RTO observados y resultado. La restauración en Supabase real no se ha ejecutado en esta sesión.

## Riesgos y requisitos antes de abrir al público

MFA administrativo; revisión legal y política final de retención; proveedor de correo con SPF/DKIM/DMARC; prueba real de correo y Supabase; validación del proxy y cookies en hosting; alertas y backups con restauración comprobada; revisión independiente de seguridad y límites operativos. Los filtros de texto no detectan todas las direcciones, ingeniería social o abuso visual: se necesita moderación humana. No hay análisis antivirus externo ni verificación de identidad en este MVP.
