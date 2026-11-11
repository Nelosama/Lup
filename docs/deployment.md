# Preparación de despliegue

No se ha publicado la aplicación ni provisionado recursos externos. No aplicar estos archivos hasta contar con autorización de despliegue. Los planes gratuitos tienen límites y condiciones que deben comprobarse con cada proveedor.

## Supabase PostgreSQL

Crear o elegir exclusivamente un proyecto Lup autorizado. `DATABASE_URL` se usa para consultas (pool de sesión recomendado, o transaction pool con `pgbouncer=true&connection_limit=1` según el proveedor). `DIRECT_URL` debe ser una conexión directa o pool de sesión compatible con migraciones. Añadir `sslmode=require` en las URLs de producción. Nunca usar la base de otro producto. Guardar URLs únicamente en secretos del backend y del operador.

Las migraciones habilitan RLS sin políticas públicas. El backend conecta como propietario de las tablas y es el único punto de autorización. Los roles Supabase `anon` y `authenticated` no necesitan acceso a tablas de negocio. No agregar una clave privilegiada al frontend. Si se adopta otro rol de base, revisar su acceso y políticas explícitamente.

En una base nueva autorizada, hacer backup y ejecutar `npm run db:migrate`; luego `npm run db:seed`. El seed es idempotente y no modifica valores ya administrados. No ejecutar `prisma db push`, `migrate reset` o migraciones destructivas en producción. No se ejecutan migraciones automáticamente al iniciar la API. El seed habilita ocho países reales para pruebas; deshabilitar desde administración los países que no formen parte del lanzamiento comercial.

## Supabase Storage

Crear un bucket **privado** `lup-images`, límite de 5 MB, tipo permitido `image/webp`. No crear políticas anónimas de lectura/escritura. La API usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET` para cargar imágenes normalizadas y crear enlaces firmados de 10 minutos. Establecer cuotas y revisión de contenido. La API no solicita ni guarda documentos de identidad.

Las pruebas automatizadas validan archivos y flujos con un adaptador en memoria; no prueban el servicio hospedado real. Validar carga, lectura firmada, vencimiento y eliminación con credenciales Lup antes de declarar la integración lista.

## Render / API

`render.yaml` prepara un único servicio Node 24 con plan gratuito. No incluye base ni servicios pagos. Build: `npm ci && npm run db:generate && npm run build -w backend`. Inicio: `npm run start -w backend`. Health check: `/api/health`. Ejecutar migraciones como paso de release autorizado desde un entorno con acceso a `DIRECT_URL` (el plan gratuito puede no admitir pre-deploy commands). También hay Dockerfile sin secretos en capas y usuario final no root.

Configurar las variables listadas en `.env.example`. Producción exige un adaptador real (Resend por HTTPS o SMTP) y URL/orígenes HTTPS; `MAIL_MODE=local` y correo deshabilitado no permiten iniciar producción. `MAIL_ENCRYPTION_KEY` debe tener 32 bytes codificados en 64 caracteres hexadecimales y permanecer estable mientras haya mensajes en cola. Generar con `openssl rand -hex 32` y guardarla directamente en un gestor de secretos. No imprimirla en logs ni versionarla. Puerto SMTP 587 con STARTTLS obligatorio o 465 con TLS; credenciales de un proveedor expresamente autorizado. Los adaptadores no están validados contra un proveedor externo en esta sesión.

El plan gratuito de Render [bloquea los puertos SMTP 25, 465 y 587](https://render.com/docs/free). Por eso `render.yaml` prepara `MAIL_MODE=resend`, con `RESEND_API_KEY`, `MAIL_FROM` y `MAIL_ENCRYPTION_KEY`. El worker usa la API HTTPS de Resend, cifrado de payloads e idempotency keys. Debe ser una cuenta Lup autorizada con remitente verificado; no se crea una cuenta, se contrata un plan ni se envía un correo durante esta sesión. Confirmar límites y condiciones del proveedor antes de activarlo. SMTP sigue disponible para hosts que lo admitan.

## Vercel / frontend

Importar el repositorio existente con Root Directory `frontend`. Instalar desde la raíz del monorepo, compilar el workspace y servir `frontend/dist`. Definir `VITE_API_URL=/api` (sin secretos). Tras conocer la URL HTTPS real del backend autorizado:

```bash
node scripts/configure-vercel.mjs https://URL-REAL-DEL-BACKEND
```

El script escribe la regla de proxy `/api/*` antes del fallback SPA y conserva cabeceras de seguridad. No despliega nada. El archivo inicial solo configura el fallback y no contiene una URL inventada; es necesario generar el proxy antes del despliegue. Vercel reenviará el Origin del frontend y cookies host-only para `/api`; incluir el origen HTTPS exacto de Vercel o dominio final en `WEB_ORIGINS` y `PUBLIC_WEB_URL`. Verificar este comportamiento en un staging autorizado, incluyendo POST multipart. Los límites de cuerpo del proxy pueden ser inferiores a 5 MB; ajustar el máximo de la aplicación a la cuota comprobada.

Con este proxy se recomienda SameSite=Lax. Acceso directo entre dominios distintos requiere CORS exacto, SameSite=None y Secure, y puede ser bloqueado por políticas de cookies de terceros; preferir un proxy de mismo origen. Verificar `TRUST_PROXY_HOPS` con la cadena Vercel–Render antes de abrir el servicio. El valor de ejemplo 1 corresponde al acceso directo a Render y puede requerir ajuste con el proxy de Vercel.

## CI

GitHub Actions instala desde lockfile, genera Prisma, aplica migraciones a PostgreSQL 16 limpio, ejecuta lint, typecheck, ambos builds, Jest/Vitest, integración con Supertest, auditoría de dependencias de producción y Playwright en escritorio/móvil. Los fallos publican trazas de navegador por siete días; solo usan cuentas sintéticas. Configurar branch protection para `main` y exigir `Lup CI / validate` desde GitHub; el workflow por sí mismo no impone esa protección. No incluye despliegue automático.
