import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { createTransport } from "nodemailer";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { configuration } from "../common/config";
export function sealMail(payload: object, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function openMail(ciphertext: string, key: string) {
  const data = Buffer.from(ciphertext, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    data.subarray(0, 12),
  );
  cipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  ) as { to: string; subject: string; url: string };
}
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  readonly deliveries: { email: string; purpose: string; token: string }[] = [];
  private timer?: NodeJS.Timeout;
  private working = false;
  constructor(private db: PrismaService) {}
  ensureConfigured() {
    if (configuration().MAIL_MODE === "disabled")
      throw new ServiceUnavailableException("Email delivery is not configured");
  }
  onModuleInit() {
    if (["smtp", "resend"].includes(configuration().MAIL_MODE))
      this.timer = setInterval(() => void this.drain(), 5000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async send(
    email: string,
    purpose: string,
    token: string,
    tx: Prisma.TransactionClient,
  ) {
    this.ensureConfigured();
    const c = configuration();
    const path = purpose === "VERIFY_EMAIL" ? "verify-email" : "reset-password";
    const payload = {
      to: email,
      subject: purpose,
      url: `${c.PUBLIC_WEB_URL}/${path}?token=${token}`,
    };
    if (["smtp", "resend"].includes(c.MAIL_MODE)) {
      await tx.mailOutbox.create({
        data: { ciphertext: sealMail(payload, c.MAIL_ENCRYPTION_KEY!) },
      });
      return;
    }
    if (c.NODE_ENV === "test") {
      this.deliveries.push({ email, purpose, token });
      return;
    }
    await mkdir(c.LOCAL_OUTBOX_DIR, { recursive: true, mode: 0o700 });
    await writeFile(
      `${c.LOCAL_OUTBOX_DIR}/${randomUUID()}.json`,
      JSON.stringify({ ...payload, developmentOnly: true }),
      { mode: 0o600 },
    );
  }
  async drain() {
    if (this.working) return;
    this.working = true;
    try {
      const c = configuration();
      await this.db.mailOutbox.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
      });
      await this.db.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            { id: string; ciphertext: string; attempts: number }[]
          >`SELECT id,ciphertext,attempts FROM "MailOutbox" WHERE attempts<5 AND "nextAttemptAt"<=NOW() ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED`;
          const job = rows[0];
          if (!job) return;
          try {
            const mail = openMail(job.ciphertext, c.MAIL_ENCRYPTION_KEY!);
            const payload = {
              from: c.MAIL_FROM!,
              to: mail.to,
              subject:
                mail.subject === "VERIFY_EMAIL"
                  ? "Lup · Verify your email / Verifica tu correo"
                  : "Lup · Password recovery / Recuperación de contraseña",
              text: `${mail.url}\n\nLup never asks for card details. Lup nunca solicita tarjetas bancarias.`,
            };
            if (c.MAIL_MODE === "resend") {
              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${c.RESEND_API_KEY}`,
                  "Content-Type": "application/json",
                  "Idempotency-Key": job.id,
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(8000),
              });
              if (!response.ok)
                throw new Error("Mail provider rejected the request");
              const result = (await response.json()) as { id?: string };
              if (!result.id) throw new Error("No provider acceptance ID");
            } else {
              const transport = createTransport({
                host: c.SMTP_HOST,
                port: c.SMTP_PORT,
                secure: c.SMTP_PORT === 465,
                requireTLS: true,
                auth: { user: c.SMTP_USER, pass: c.SMTP_PASSWORD },
                connectionTimeout: 8000,
                greetingTimeout: 8000,
                socketTimeout: 8000,
                tls: { rejectUnauthorized: true },
              });
              const info = await transport.sendMail(payload);
              if (!info.accepted?.length) throw new Error("Delivery rejected");
            }
            await tx.mailOutbox.delete({ where: { id: job.id } });
          } catch {
            await tx.mailOutbox.update({
              where: { id: job.id },
              data: {
                attempts: { increment: 1 },
                nextAttemptAt: new Date(Date.now() + 60000 * 2 ** job.attempts),
              },
            });
            console.error(
              JSON.stringify({
                event: "mail_delivery_failed",
                jobId: job.id,
                attempt: job.attempts + 1,
              }),
            );
          }
        },
        { timeout: 20000 },
      );
    } catch {
      console.error(JSON.stringify({ event: "mail_worker_failed" }));
    } finally {
      this.working = false;
    }
  }
}
