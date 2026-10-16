# Estado de entrega · 16 de octubre de 2026

Repositorio oficial: https://github.com/Nelosama/Lup. Rama de trabajo única: `development`; `main` se conserva como principal. No se creó otro repositorio, no se modificó otro producto y no se desplegó públicamente.

## Implementado

Monolito modular NestJS con API REST, Prisma y PostgreSQL, frontend React/Vite/Tailwind responsive, identidad SVG original y traducciones ES/EN. Una cuenta combina cliente y profesional.

Registro, verificación, login, logout, recuperación y cambio de contraseña, edición y desactivación, sesiones revocables, Argon2id, cookies HttpOnly/Secure en producción, CSRF, permisos en backend y límites de abuso.

Catálogos de categorías traducidas y ubicaciones reales, perfiles profesionales, servicios con importes Decimal y moneda propia, fotografías de perfil/portafolio/solicitudes, validación real de imágenes, normalización WebP, ordenamiento y eliminación. Integración de Supabase Storage implementada pero pendiente de validación con credenciales del proyecto Lup.

Búsqueda por texto, categoría, país, región, ciudad, zona y radio opcional. Las distancias se calculan sobre centros de ciudades con coordenadas y no se presentan como distancia a una vivienda o profesional. El catálogo inicial no inventa coordenadas.

Solicitudes editables antes de propuestas, cancelación, propuestas comparables, aceptación transaccional con protección de doble aceptación, contratación directa con confirmación, mensajería privada paginada, no leídos y notificaciones. Finalización bilateral, evaluaciones trazables, promedio, distribución y evolución mensual.

Bloqueos, reportes, suspensión, moderación y auditoría. Acceso excepcional a mensajes exclusivamente por un reporte abierto del mensaje específico y con motivo auditado. Super Admin inicial mediante comando offline; no existen cuentas ni contraseñas administrativas predeterminadas. La verificación de perfiles se retira si cambia la información revisada.

Paneles de cliente/profesional y administración con usuarios, profesionales, clientes, categorías, países, solicitudes, propuestas, contrataciones, moderación, auditoría y métricas de datos reales. No se implementaron pagos ni cobros.

Cola cifrada de correo con adaptadores SMTP y Resend HTTPS, reintentos e idempotencia de solicitudes HTTP. Buzón local de desarrollo explícito, sin fingir entregas externas. Preparación de Vercel, Render, Supabase, Docker y CI sin despliegue automático.

## Evidencia local ejecutada

| Comprobación                                     | Resultado                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Instalación desde lockfile (`npm ci`)            | Aprobada                                                                                       |
| Formato, ESLint, TypeScript                      | Aprobados                                                                                      |
| Build NestJS y React/Vite                        | Aprobados                                                                                      |
| Jest: seguridad, archivos, cifrado               | 6 pruebas aprobadas                                                                            |
| Vitest: cliente HTTP, CSRF, errores y formatos   | 5 pruebas aprobadas                                                                            |
| Supertest con PostgreSQL 16 real                 | 24 escenarios aprobados                                                                        |
| Playwright Chromium escritorio y Pixel 7 emulado | 6 pruebas aprobadas                                                                            |
| Auditoría completa npm                           | 0 vulnerabilidades reportadas                                                                  |
| Migraciones desde base vacía y seed repetido     | Aprobados; 8 países, 16 categorías, 32 traducciones, 0 usuarios ficticios                      |
| Backup/restore local PostgreSQL                  | Aprobado; 28 tablas con RLS, índice de aceptación única y migraciones conservados              |
| Docker build y ejecución no root                 | Aprobados; health conectado a PostgreSQL, login HTTP 201 y cookie HttpOnly/Secure/SameSite=Lax |
| GitHub Actions remoto                            | Pendiente de la primera publicación de la rama                                                 |

La suite de API prueba registro de ambos tipos, tokens no reutilizables, revocación, privacidad, autorización, cargas con un adaptador de Storage en memoria, búsquedas, propuestas, aceptación concurrente, contratos, acceso prohibido a conversaciones ajenas, finalización bilateral, reseñas falsas/duplicadas, bloqueos, reportes, moderación, RLS, verificación y administración de catálogos. El adaptador HTTP de correo utiliza una respuesta simulada del proveedor. Estas pruebas no equivalen a ensayos contra Supabase o un proveedor de correo hospedado.

Playwright realiza el flujo cliente/profesional completo en ambos tamaños: registro y verificación local, perfil, servicio, solicitud, propuesta, aceptación, mensaje, finalización y evaluación. También prueba ES/EN, ausencia de desbordamiento horizontal, Escape en diálogos y recuperación de contraseña a través del buzón local.

## Pendientes y preparación de producción

**No está listo para abrir al público.** Faltan credenciales y validación real del proyecto Supabase Lup y del proveedor de correo autorizado, ensayo del proxy/cookies en Vercel–Render, configuración del remitente y del país/ciudad de lanzamiento, revisión legal de términos/privacidad/retención y proceso de apelaciones, MFA de administradores y revisión independiente de seguridad. No se activó ningún proveedor ni servicio de pago.

El limitador HTTP por IP es de memoria y la configuración actual supone una sola instancia; se requiere almacenamiento compartido antes de escalar. Los filtros de texto y la normalización de archivos no sustituyen moderación humana. La eliminación/exportación de datos personales requiere todavía un procedimiento operativo verificado; desactivar no elimina automáticamente contratos, reseñas o auditoría.

La interfaz portuguesa, notificaciones por correo de negocio, mapa/geocodificación, WebSockets, PWA, facturación, monetización y categorías con controles legales no se incluyen en este lanzamiento. No se presentan estadísticas ni distintivos de verificación ficticios. El MVP usa polling y no procesa pagos.

Los builds muestran avisos no bloqueantes de anotaciones de comentarios de Zod y Prisma avisa de la futura migración de configuración a Prisma 7. Dependencias transitivas vulnerables se actualizaron mediante overrides compatibles con las pruebas; revisar esos overrides al actualizar versiones mayores.

## Instalación, secretos y siguiente paso

[README](../README.md) contiene los comandos de instalación y ejecución. [.env.example](../.env.example) y [frontend/.env.example](../frontend/.env.example) enumeran la configuración. [Arquitectura](architecture.md), [seguridad](security.md) y [despliegue](deployment.md) detallan modelo, invariantes, retención, backups y preparación de Vercel/Render/Supabase.

Siguiente paso operativo: configurar exclusivamente credenciales de Lup, realizar los ensayos externos en un staging autorizado y cerrar los requisitos legales/operativos antes de solicitar el despliegue público. Ningún resultado de CI o de compilación reemplaza esas comprobaciones.
