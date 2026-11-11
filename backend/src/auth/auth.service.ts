import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { hash, verify, argon2id } from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../common/prisma.service";
import { PolicyService, publicText } from "../common/policy.service";
import { privateUser } from "../common/dto";
import { RegisterDto } from "./auth.dto";
import { MailService } from "./mail.service";
import { TokenPurpose } from "@prisma/client";
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
const random = () => randomBytes(32).toString("hex");
export const passwordHash = (p: string) =>
  hash(p, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
@Injectable()
export class AuthService {
  private dummy = passwordHash(random());
  constructor(
    private db: PrismaService,
    private policy: PolicyService,
    private mail: MailService,
  ) {}
  async register(d: RegisterDto) {
    this.mail.ensureConfigured();
    publicText(d.name);
    await this.policy.location(d.countryCode, d.cityId);
    const email = d.email.trim().toLowerCase();
    const h = await passwordHash(d.password);
    if (await this.db.user.findUnique({ where: { email } }))
      return {
        message: "If the address is eligible, check your email or sign in",
      };
    try {
      const u = await this.db.user.create({
        data: {
          email,
          name: d.name.trim(),
          passwordHash: h,
          countryCode: d.countryCode,
          cityId: d.cityId,
          locale: d.locale,
          roles: {
            create: [
              { role: "CLIENT" },
              ...(d.accountType === "PROFESSIONAL"
                ? [{ role: "PROFESSIONAL" as const }]
                : []),
            ],
          },
        },
      });
      await this.issue(u.id, email, "VERIFY_EMAIL");
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
    return {
      message: "If the address is eligible, check your email or sign in",
    };
  }
  async login(email: string, password: string) {
    const key = digest(email.trim().toLowerCase());
    await this.db.$transaction(async (tx) => {
      await tx.loginAttempt.upsert({
        where: { key },
        create: { key, attempts: 0 },
        update: {},
      });
      await tx.$queryRaw`SELECT key FROM "LoginAttempt" WHERE key=${key} FOR UPDATE`;
      const a = await tx.loginAttempt.findUniqueOrThrow({ where: { key } });
      if (a.windowStartedAt.getTime() < Date.now() - 900000)
        await tx.loginAttempt.update({
          where: { key },
          data: { attempts: 1, windowStartedAt: new Date() },
        });
      else {
        if (a.attempts >= 15)
          throw new UnauthorizedException("Invalid credentials");
        await tx.loginAttempt.update({
          where: { key },
          data: { attempts: { increment: 1 } },
        });
      }
    });
    const u = await this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { ...privateUser, passwordHash: true },
    });
    const ok = await verify(u?.passwordHash ?? (await this.dummy), password);
    if (!u || !ok || u.status !== "ACTIVE")
      throw new UnauthorizedException("Invalid credentials");
    await this.db.loginAttempt.deleteMany({ where: { key } });
    const token = random();
    const session = await this.db.session.create({
      data: {
        userId: u.id,
        tokenHash: digest(token),
        csrfToken: random(),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    const { passwordHash: _passwordHash, ...user } = u;
    return { token, session, user };
  }
  async issue(userId: string, email: string, purpose: TokenPurpose) {
    const token = random();
    await this.db.$transaction(async (tx) => {
      await tx.authToken.deleteMany({ where: { userId, purpose } });
      await tx.authToken.create({
        data: {
          userId,
          purpose,
          tokenHash: digest(token),
          expiresAt: new Date(
            Date.now() + (purpose === "RESET_PASSWORD" ? 30 : 1440) * 60000,
          ),
        },
      });
      await this.mail.send(email, purpose, token, tx);
    });
  }
  async recover(email: string) {
    this.mail.ensureConfigured();
    const u = await this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (u && u.status === "ACTIVE")
      await this.issue(u.id, u.email, "RESET_PASSWORD");
    return {
      message: "If the address is eligible, recovery instructions are queued",
    };
  }
  async consume(token: string, purpose: TokenPurpose, password?: string) {
    const h = password ? await passwordHash(password) : undefined;
    await this.db.$transaction(async (tx) => {
      const t = await tx.authToken.findUnique({
        where: { tokenHash: digest(token) },
      });
      if (!t || t.purpose !== purpose || t.expiresAt < new Date())
        throw new BadRequestException("Invalid or expired token");
      const deleted = await tx.authToken.deleteMany({ where: { id: t.id } });
      if (deleted.count !== 1)
        throw new BadRequestException("Token already used");
      await tx.user.update({
        where: { id: t.userId },
        data:
          purpose === "VERIFY_EMAIL"
            ? { emailVerifiedAt: new Date() }
            : { passwordHash: h },
      });
      if (purpose === "RESET_PASSWORD") {
        await tx.session.deleteMany({ where: { userId: t.userId } });
        await tx.authToken.deleteMany({ where: { userId: t.userId, purpose } });
      }
    });
    return { success: true };
  }
  async changePassword(userId: string, current: string, next: string) {
    const u = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verify(u.passwordHash, current)))
      throw new UnauthorizedException("Invalid credentials");
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: { passwordHash: await passwordHash(next) },
      }),
      this.db.session.deleteMany({ where: { userId } }),
      this.db.authToken.deleteMany({
        where: { userId, purpose: "RESET_PASSWORD" },
      }),
    ]);
    return { success: true };
  }
}
