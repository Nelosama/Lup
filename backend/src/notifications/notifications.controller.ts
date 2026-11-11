import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Actor, CurrentUser } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, result } from "../common/dto";
@Controller("notifications")
export class NotificationsController {
  constructor(private db: PrismaService) {}
  @Get() async list(@CurrentUser() u: Actor, @Query() p: PageDto) {
    const where = { userId: u.id };
    const [items, total, unread] = await this.db.$transaction([
      this.db.notification.findMany({
        where,
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.notification.count({ where }),
      this.db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { ...result(items, total, p), unread };
  }
  @Post(":id/read") async read(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.db.notification.updateMany({
      where: { id, userId: u.id },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}
