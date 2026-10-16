import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { DatabaseModule, PrismaService } from "./common/prisma.service";
import { AuthModule } from "./auth/auth.module";
import { AccessGuard, Public } from "./auth/guards";
import { UsersModule } from "./users/users.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ProfessionalsModule } from "./professionals/professionals.module";
import { RequestsModule } from "./requests/requests.module";
import { ProposalsModule } from "./proposals/proposals.module";
import { EngagementsModule } from "./engagements/engagements.module";
import { ConversationsModule } from "./conversations/conversations.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ModerationModule } from "./moderation/moderation.module";
import { AdminModule } from "./admin/admin.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { StorageModule } from "./storage/storage.module";

@Controller("health")
class HealthController {
  constructor(private db: PrismaService) {}
  @Public() @Get() async health() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected" };
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
  }
}
@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    ProfessionalsModule,
    RequestsModule,
    ProposalsModule,
    EngagementsModule,
    ConversationsModule,
    ReviewsModule,
    ModerationModule,
    NotificationsModule,
    AdminModule,
    StorageModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: [
          "req.headers.cookie",
          "req.headers.authorization",
          'req.headers["x-csrf-token"]',
          'res.headers["set-cookie"]',
        ],
        autoLogging: process.env.NODE_ENV !== "test",
        serializers: {
          req: (req: { method: string; url: string; id: string }) => ({
            method: req.method,
            path: req.url?.split("?")[0],
            id: req.id,
          }),
        },
      },
    }),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
})
export class AppModule {}
