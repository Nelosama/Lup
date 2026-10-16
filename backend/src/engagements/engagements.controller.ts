import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { IsIn, IsString, IsUUID, Length, Matches } from "class-validator";
import { Actor, CurrentUser, Verified } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, publicUser, result } from "../common/dto";
import { currency, PolicyService } from "../common/policy.service";
class DirectDto {
  @IsUUID() professionalId!: string;
  @IsString() @Length(5, 120) title!: string;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
}
class StateDto {
  @IsIn(["AGREE", "START", "COMPLETE", "CANCEL", "DISPUTE"]) action!:
    "AGREE" | "START" | "COMPLETE" | "CANCEL" | "DISPUTE";
}
@Controller("engagements")
export class EngagementsController {
  constructor(
    private db: PrismaService,
    private policy: PolicyService,
  ) {}
  @Get() async list(@CurrentUser() u: Actor, @Query() p: PageDto) {
    const where = { OR: [{ clientId: u.id }, { professionalId: u.id }] };
    const [items, total] = await this.db.$transaction([
      this.db.engagement.findMany({
        where,
        include: {
          client: { select: publicUser },
          professional: { select: publicUser },
          conversation: { select: { id: true } },
        },
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.engagement.count({ where }),
    ]);
    return result(items, total, p);
  }
  @Verified() @Post("direct") async direct(
    @CurrentUser() u: Actor,
    @Body() d: DirectDto,
  ) {
    const p = await this.db.professionalProfile.findUnique({
      where: { id: d.professionalId },
    });
    if (!p || !p.isAvailable)
      throw new BadRequestException("Professional unavailable");
    await this.policy.unblocked(u.id, p.userId);
    currency(d.currencyCode);
    return this.db.$transaction(async (tx) => {
      const job = await tx.engagement.create({
        data: {
          clientId: u.id,
          professionalId: p.userId,
          title: d.title,
          currencyCode: d.currencyCode,
          directKey: [u.id, p.userId].join(":"),
          conversation: {
            create: {
              participants: {
                create: [{ userId: u.id }, { userId: p.userId }],
              },
            },
          },
        },
      });
      await tx.notification.create({
        data: { userId: p.userId, kind: "NEW_ENGAGEMENT", resourceId: job.id },
      });
      return job;
    });
  }
  @Get(":id") async detail(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const e = await this.db.engagement.findFirst({
      where: { id, OR: [{ clientId: u.id }, { professionalId: u.id }] },
      include: {
        client: { select: publicUser },
        professional: { select: publicUser },
        conversation: { select: { id: true } },
        reviews: { where: { moderationStatus: "VISIBLE" } },
      },
    });
    if (!e) throw new NotFoundException();
    return e;
  }
  @Post(":id/state") async state(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: StateDto,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Engagement" WHERE id=${id}::uuid FOR UPDATE`;
      const e = await tx.engagement.findUnique({ where: { id } });
      if (!e || ![e.clientId, e.professionalId].includes(u.id))
        throw new NotFoundException();
      const other = u.id === e.clientId ? e.professionalId : e.clientId;
      if (d.action === "AGREE") {
        if (
          e.status !== "AGREED" ||
          u.id !== e.professionalId ||
          e.professionalAgreedAt
        )
          throw new BadRequestException("Cannot confirm");
        await tx.engagement.update({
          where: { id },
          data: { professionalAgreedAt: new Date() },
        });
      } else if (d.action === "START") {
        if (e.status !== "AGREED" || !e.professionalAgreedAt)
          throw new BadRequestException("Both parties must agree first");
        await tx.engagement.update({
          where: { id },
          data: { status: "IN_PROGRESS" },
        });
        if (e.requestId)
          await tx.serviceRequest.update({
            where: { id: e.requestId },
            data: { status: "IN_PROGRESS" },
          });
      } else if (d.action === "COMPLETE") {
        if (e.status !== "IN_PROGRESS")
          throw new BadRequestException("Start the job first");
        const isClient = u.id === e.clientId;
        if (isClient ? e.clientCompletedAt : e.professionalCompletedAt)
          throw new BadRequestException("Already confirmed");
        const done = isClient
          ? !!e.professionalCompletedAt
          : !!e.clientCompletedAt;
        await tx.engagement.update({
          where: { id },
          data: {
            ...(isClient
              ? { clientCompletedAt: new Date() }
              : { professionalCompletedAt: new Date() }),
            ...(done
              ? {
                  status: "COMPLETED",
                  completedAt: new Date(),
                  directKey: null,
                }
              : {}),
          },
        });
        if (done && e.requestId)
          await tx.serviceRequest.update({
            where: { id: e.requestId },
            data: { status: "COMPLETED" },
          });
      } else if (d.action === "CANCEL") {
        if (!["AGREED", "IN_PROGRESS"].includes(e.status))
          throw new BadRequestException("Cannot cancel");
        await tx.engagement.update({
          where: { id },
          data: { status: "CANCELED", directKey: null },
        });
        if (e.requestId)
          await tx.serviceRequest.update({
            where: { id: e.requestId },
            data: { status: "CANCELED" },
          });
      } else {
        if (!["IN_PROGRESS", "COMPLETED"].includes(e.status))
          throw new BadRequestException("Cannot dispute");
        await tx.engagement.update({
          where: { id },
          data: { status: "DISPUTED" },
        });
        await tx.report.create({
          data: {
            reporterId: u.id,
            targetType: "ENGAGEMENT",
            targetId: id,
            reason: "A participant disputed this job",
          },
        });
      }
      await tx.notification.create({
        data: { userId: other, kind: "ENGAGEMENT_STATE", resourceId: id },
      });
      return tx.engagement.findUnique({ where: { id } });
    });
  }
}
