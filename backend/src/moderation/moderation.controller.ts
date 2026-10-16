import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { IsIn, IsString, IsUUID, Length } from "class-validator";
import { Actor, CurrentUser, Roles } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, publicUser, result } from "../common/dto";
class ReportDto {
  @IsIn([
    "USER",
    "PROFILE",
    "REQUEST",
    "CONVERSATION",
    "MESSAGE",
    "REVIEW",
    "ENGAGEMENT",
  ])
  targetType!: string;
  @IsUUID() targetId!: string;
  @IsString() @Length(10, 2000) reason!: string;
}
class ResolutionDto {
  @IsIn(["DISMISS", "RESOLVE", "HIDE_CONTENT", "SUSPEND_USER"]) action!:
    "DISMISS" | "RESOLVE" | "HIDE_CONTENT" | "SUSPEND_USER";
  @IsString() @Length(15, 2000) reason!: string;
}
class ReasonDto {
  @IsString() @Length(20, 2000) reason!: string;
}
@Controller()
export class ModerationController {
  constructor(private db: PrismaService) {}
  @Post("reports") async report(@CurrentUser() u: Actor, @Body() d: ReportDto) {
    let exists = false;
    switch (d.targetType) {
      case "USER":
        exists = !!(await this.db.user.findUnique({
          where: { id: d.targetId },
        }));
        break;
      case "PROFILE":
        exists = !!(await this.db.professionalProfile.findUnique({
          where: { id: d.targetId },
        }));
        break;
      case "REQUEST":
        exists = !!(await this.db.serviceRequest.findUnique({
          where: { id: d.targetId },
        }));
        break;
      case "REVIEW":
        exists = !!(await this.db.review.findUnique({
          where: { id: d.targetId },
        }));
        break;
      case "CONVERSATION":
        exists = !!(await this.db.conversationParticipant.findUnique({
          where: {
            conversationId_userId: { conversationId: d.targetId, userId: u.id },
          },
        }));
        break;
      case "MESSAGE":
        exists = !!(await this.db.message.findFirst({
          where: {
            id: d.targetId,
            conversation: { participants: { some: { userId: u.id } } },
          },
        }));
        break;
      case "ENGAGEMENT":
        exists = !!(await this.db.engagement.findFirst({
          where: {
            id: d.targetId,
            OR: [{ clientId: u.id }, { professionalId: u.id }],
          },
        }));
        break;
    }
    if (!exists) throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${u.id}::uuid FOR UPDATE`;
      if (
        (await tx.report.count({
          where: {
            reporterId: u.id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) >= 20
      )
        throw new BadRequestException("Daily report limit reached");
      return tx.report.create({ data: { ...d, reporterId: u.id } });
    });
  }
  @Get("blocks") blocks(@CurrentUser() u: Actor) {
    return this.db.userBlock.findMany({
      where: { blockerId: u.id },
      select: { blockedId: true, blocked: { select: publicUser } },
    });
  }
  @Post("blocks/:id") async block(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    if (u.id === id) throw new BadRequestException();
    await this.db.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: u.id, blockedId: id } },
      update: {},
      create: { blockerId: u.id, blockedId: id },
    });
    return { success: true };
  }
  @Delete("blocks/:id") async unblock(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.db.userBlock.deleteMany({
      where: { blockerId: u.id, blockedId: id },
    });
    return { success: true };
  }
  @Roles("MODERATOR", "ADMIN", "SUPER_ADMIN")
  @Get("moderation/reports")
  async reports(@Query() p: PageDto) {
    const [items, total] = await this.db.$transaction([
      this.db.report.findMany({
        orderBy: { createdAt: "desc" },
        ...paging(p),
        include: { reporter: { select: publicUser }, actions: true },
      }),
      this.db.report.count(),
    ]);
    return result(items, total, p);
  }
  @Roles("MODERATOR", "ADMIN", "SUPER_ADMIN")
  @Post("moderation/reports/:id/evidence")
  async evidence(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ReasonDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id } });
      if (
        !report ||
        report.status !== "OPEN" ||
        report.targetType !== "MESSAGE"
      )
        throw new BadRequestException(
          "Only an open report of a specific message authorizes access",
        );
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: "REPORTED_MESSAGE_ACCESS",
          targetId: report.targetId,
          reason: d.reason,
        },
      });
      return tx.message.findUnique({
        where: { id: report.targetId },
        select: { id: true, senderId: true, body: true, createdAt: true },
      });
    });
  }
  @Roles("MODERATOR", "ADMIN", "SUPER_ADMIN")
  @Post("moderation/reports/:id/resolve")
  async resolve(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ResolutionDto,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Report" WHERE id=${id}::uuid FOR UPDATE`;
      const r = await tx.report.findUnique({ where: { id } });
      if (!r || r.status !== "OPEN")
        throw new BadRequestException("Report is closed");
      if (d.action === "SUSPEND_USER") {
        if (!["USER", "PROFILE"].includes(r.targetType))
          throw new BadRequestException("A user report is required");
        const userId =
          r.targetType === "PROFILE"
            ? (
                await tx.professionalProfile.findUniqueOrThrow({
                  where: { id: r.targetId },
                })
              ).userId
            : r.targetId;
        const target = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          include: { roles: true },
        });
        if (
          target.roles.some((x) =>
            ["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(x.role),
          )
        )
          throw new BadRequestException(
            "Privileged users require an offline security procedure",
          );
        await tx.user.update({
          where: { id: userId },
          data: { status: "SUSPENDED" },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.notification.create({
          data: { userId, kind: "MODERATION", resourceId: r.id },
        });
      } else if (d.action === "HIDE_CONTENT") {
        if (r.targetType === "REQUEST")
          await tx.serviceRequest.update({
            where: { id: r.targetId },
            data: { moderationStatus: "HIDDEN" },
          });
        else if (r.targetType === "REVIEW")
          await tx.review.update({
            where: { id: r.targetId },
            data: { moderationStatus: "HIDDEN" },
          });
        else if (r.targetType === "MESSAGE")
          await tx.message.update({
            where: { id: r.targetId },
            data: { moderationStatus: "HIDDEN" },
          });
        else throw new BadRequestException("Target cannot be hidden");
      }
      await tx.moderationAction.create({
        data: {
          actorId: u.id,
          reportId: id,
          action: d.action,
          reason: d.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: d.action,
          targetId: r.targetId,
          reason: d.reason,
        },
      });
      return tx.report.update({
        where: { id },
        data: { status: d.action === "DISMISS" ? "DISMISSED" : "RESOLVED" },
      });
    });
  }
}
