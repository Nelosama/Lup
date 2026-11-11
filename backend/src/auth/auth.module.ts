import { Global, Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { MailService } from "./mail.service";
import { PolicyService } from "../common/policy.service";
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, MailService, PolicyService],
  exports: [AuthService, MailService, PolicyService],
})
export class AuthModule {}
