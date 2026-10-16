# Lup

Marketplace internacional de servicios, gratuito para clientes y profesionales. Una cuenta permite contratar y ofrecer servicios. Lup conecta a las partes; no procesa pagos ni garantiza el resultado de los trabajos.

Monorepo con React/TypeScript/Vite/Tailwind y una API REST NestJS/Prisma sobre PostgreSQL. El desarrollo parte del commit inicial `c90ae2b`, en la única rama de desarrollo `development`.

## Desarrollo local

Requisitos: Node.js 22 o 24 LTS, npm y PostgreSQL 16. No hacen falta cuentas externas para probar texto, solicitudes y contrataciones.

```bash
npm ci
cp .env.example backend/.env
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
# En otra terminal:
npm run dev:web
```

Abre http://localhost:5173. API: http://localhost:3000/api; OpenAPI de desarrollo: http://localhost:3000/api/docs. Los catálogos contienen ubicaciones reales y categorías; no se crean profesionales, reseñas ni estadísticas ficticias.

En desarrollo `MAIL_MODE=local` guarda enlaces de verificación y recuperación en `backend/.local/outbox/`. Son archivos privados del desarrollador; no representan correo enviado. Registro, verificación y login son pasos independientes. Usa el enlace del buzón local para verificar una cuenta. Las credenciales privilegiadas de Storage solo pertenecen al servidor.

## Validación

```bash
npm run lint
npm run typecheck
npm run build
npm test
# Las pruebas de integración exigen una base aislada llamada lup_test:
docker compose exec postgres createdb -U lup lup_test
DATABASE_URL=postgresql://lup:lup_local_only@localhost:5432/lup_test DIRECT_URL=postgresql://lup:lup_local_only@localhost:5432/lup_test npm run db:migrate
DATABASE_URL=postgresql://lup:lup_local_only@localhost:5432/lup_test DIRECT_URL=postgresql://lup:lup_local_only@localhost:5432/lup_test npm run db:seed
NODE_ENV=test MAIL_MODE=local DATABASE_URL=postgresql://lup:lup_local_only@localhost:5432/lup_test DIRECT_URL=postgresql://lup:lup_local_only@localhost:5432/lup_test npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Consulta [arquitectura](docs/architecture.md), [despliegue](docs/deployment.md), [seguridad y operación](docs/security.md) y [estado verificable](docs/status.md). El estado de producción y las integraciones externas se documentan explícitamente; compilar no significa estar listo para producción.
