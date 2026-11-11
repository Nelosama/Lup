import { INestApplication, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { configuration } from "./common/config";
import { ErrorFilter } from "./common/errors";
export function setup(app: INestApplication) {
  const c = configuration();
  app.setGlobalPrefix("api");
  app.getHttpAdapter().getInstance().set("trust proxy", c.TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(json({ limit: "64kb" }));
  app.use(urlencoded({ extended: false, limit: "64kb" }));
  app.use(cookieParser());
  app.enableCors({
    origin: c.WEB_ORIGINS.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  if (c.NODE_ENV !== "production") {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Lup API")
        .setVersion("0.1.0")
        .addCookieAuth("lup_session")
        .build(),
    );
    doc.security = [{ cookie: [] }];
    for (const path of Object.values(doc.paths))
      for (const method of ["post", "put", "patch", "delete"] as const) {
        const op = path?.[method];
        if (op) {
          op.parameters = [
            ...(op.parameters ?? []),
            {
              name: "Origin",
              in: "header",
              required: true,
              schema: { type: "string" },
              description: "Exact origin configured in WEB_ORIGINS",
            },
          ];
          if (!op.security || op.security.length)
            op.parameters.push({
              name: "X-CSRF-Token",
              in: "header",
              required: true,
              schema: { type: "string" },
              description:
                "CSRF token returned by auth/login or auth/me; keep in memory only",
            });
        }
      }
    SwaggerModule.setup("api/docs", app, doc);
  }
}
