import { ApiOperation } from "@nestjs/swagger";
import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { Prisma, Role } from "@prisma/client";
import { PrismaService } from "../common/prisma.service";
import { privateUser } from "../common/dto";
import { configuration } from "../common/config";
import { digest } from "./auth.service";
export type Actor = Prisma.UserGetPayload<{ select: typeof privateUser }>;
export type AuthRequest = Request & {
  actor?: Actor;
  sessionId?: string;
  csrfToken?: string;
};
export const Public = () =>
  applyDecorators(SetMetadata("public", true), ApiOperation({ security: [] }));
export const Roles = (...roles: Role[]) => SetMetadata("roles", roles);
export const Verified = () => SetMetadata("verified", true);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthRequest>().actor,
);
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private db: PrismaService,
    private reflector: Reflector,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const c = configuration();
    const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const origin = req.headers.origin;
    if (origin && !c.WEB_ORIGINS.split(",").includes(origin))
      throw new ForbiddenException("Origin not permitted");
    if (write && !origin) throw new ForbiddenException("Origin required");
    const token = req.cookies?.lup_session;
    if (token) {
      const session = await this.db.session.findUnique({
        where: { tokenHash: digest(token) },
        include: { user: { select: privateUser } },
      });
      if (
        session &&
        session.expiresAt > new Date() &&
        session.user.status === "ACTIVE"
      ) {
        req.actor = session.user;
        req.sessionId = session.id;
        req.csrfToken = session.csrfToken;
        if (write && req.headers["x-csrf-token"] !== session.csrfToken)
          throw new ForbiddenException("Invalid CSRF token");
      }
    }
    const meta = [ctx.getHandler(), ctx.getClass()];
    if (!this.reflector.getAllAndOverride("public", meta) && !req.actor)
      throw new UnauthorizedException();
    const roles = this.reflector.getAllAndOverride<Role[]>("roles", meta);
    if (roles && !req.actor?.roles.some((r) => roles.includes(r.role)))
      throw new ForbiddenException("Permission required");
    if (
      this.reflector.getAllAndOverride("verified", meta) &&
      !req.actor?.emailVerifiedAt
    )
      throw new ForbiddenException("Verify your email first");
    return true;
  }
}
