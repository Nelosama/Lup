import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  DIRECT_URL: z.string().startsWith("postgresql://"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGINS: z.string().default("http://localhost:5173"),
  PUBLIC_WEB_URL: z.url().default("http://localhost:5173"),
  COOKIE_SAME_SITE: z.enum(["lax", "none", "strict"]).default("lax"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  SUPABASE_URL: z.url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("lup-images"),
  PORTFOLIO_LIMIT: z.coerce.number().int().min(1).max(50).default(12),
  MAIL_MODE: z
    .enum(["disabled", "local", "smtp", "resend"])
    .default("disabled"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.email().optional(),
  MAIL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),
  LOCAL_OUTBOX_DIR: z.string().default(".local/outbox"),
});
export type Config = z.infer<typeof schema>;
export function configuration(): Config {
  const c = schema.parse(process.env);
  const origins = c.WEB_ORIGINS.split(",");
  for (const o of origins) {
    const url = new URL(o);
    if (url.origin !== o || o === "*")
      throw new Error("WEB_ORIGINS must contain exact origins");
  }
  if (
    c.NODE_ENV === "production" &&
    (c.MAIL_MODE === "local" || origins.some((o) => !o.startsWith("https://")))
  )
    throw new Error(
      "Production requires HTTPS origins and a real mail adapter (local mail forbidden)",
    );
  if (
    c.MAIL_MODE === "smtp" &&
    (!c.SMTP_HOST ||
      !c.SMTP_USER ||
      !c.SMTP_PASSWORD ||
      !c.MAIL_FROM ||
      !c.MAIL_ENCRYPTION_KEY)
  )
    throw new Error(
      "SMTP requires host, credentials, sender and a 32-byte hex encryption key",
    );
  if (
    c.NODE_ENV === "production" &&
    (!c.PUBLIC_WEB_URL.startsWith("https://") ||
      !["smtp", "resend"].includes(c.MAIL_MODE))
  )
    throw new Error(
      "Production requires HTTPS public URL and a delivery adapter",
    );
  if (
    c.MAIL_MODE === "resend" &&
    (!c.RESEND_API_KEY || !c.MAIL_FROM || !c.MAIL_ENCRYPTION_KEY)
  )
    throw new Error(
      "Resend requires API key, sender and a 32-byte encryption key",
    );
  if (c.COOKIE_SAME_SITE === "none" && c.NODE_ENV !== "production")
    throw new Error("SameSite=None requires production HTTPS");
  return c;
}
