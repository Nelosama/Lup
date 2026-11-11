import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { AuthService } from "./auth.service";
import {
  EmailDto,
  LoginDto,
  PasswordDto,
  RegisterDto,
  ResetDto,
  TokenDto,
} from "./auth.dto";
import { Actor, AuthRequest, CurrentUser, Public } from "./guards";
import { configuration } from "../common/config";
import { PrismaService } from "../common/prisma.service";
@Controller("auth")
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(
    private auth: AuthService,
    private db: PrismaService,
  ) {}
  @Public() @Post("register") register(@Body() d: RegisterDto) {
    return this.auth.register(d);
  }
  @Public() @Post("login") async login(
    @Body() d: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.auth.login(d.email, d.password);
    const c = configuration();
    res.cookie("lup_session", r.token, {
      httpOnly: true,
      secure: c.NODE_ENV === "production",
      sameSite: c.COOKIE_SAME_SITE,
      path: "/api",
      maxAge: 7 * 86400000,
    });
    return { user: r.user, csrfToken: r.session.csrfToken };
  }
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get("me")
  me(@CurrentUser() u: Actor, @Req() req: AuthRequest) {
    return { user: u, csrfToken: req.csrfToken };
  }
  @Post("logout") async logout(
    @Req() req: AuthRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.db.session.deleteMany({ where: { id: req.sessionId } });
    res.clearCookie("lup_session", {
      path: "/api",
      secure: configuration().NODE_ENV === "production",
      sameSite: configuration().COOKIE_SAME_SITE,
    });
    return { success: true };
  }
  @Public() @Post("forgot-password") forgot(@Body() d: EmailDto) {
    return this.auth.recover(d.email);
  }
  @Public() @Post("reset-password") reset(@Body() d: ResetDto) {
    return this.auth.consume(d.token, "RESET_PASSWORD", d.password);
  }
  @Public() @Post("verify-email") verify(@Body() d: TokenDto) {
    return this.auth.consume(d.token, "VERIFY_EMAIL");
  }
  @Post("resend-verification") async resend(@CurrentUser() u: Actor) {
    if (!u.emailVerifiedAt)
      await this.auth.issue(u.id, u.email, "VERIFY_EMAIL");
    return { success: true };
  }
  @Post("change-password") change(
    @CurrentUser() u: Actor,
    @Body() d: PasswordDto,
  ) {
    return this.auth.changePassword(u.id, d.currentPassword, d.password);
  }
}
