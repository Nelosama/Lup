import { ApiProperty } from "@nestjs/swagger";
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
import { IsString, IsUUID, Length } from "class-validator";
import { Actor, CurrentUser, Verified } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, publicUser, result } from "../common/dto";
import { PolicyService } from "../common/policy.service";
class ConversationDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  professionalId!: string;
}
class MessageDto {
  @ApiProperty({ type: String, minLength: 1, maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  body!: string;
}
@Controller("conversations")
export class ConversationsController {
  constructor(
    private db: PrismaService,
    private policy: PolicyService,
  ) {}
  private async member(id: string, userId: string) {
    const c = await this.db.conversation.findFirst({
      where: { id, participants: { some: { userId } } },
      include: {
        participants: {
          select: {
            userId: true,
            lastReadAt: true,
            user: { select: publicUser },
          },
        },
      },
    });
    if (!c) throw new NotFoundException();
    return c;
  }
  @Verified() @Post() async create(
    @CurrentUser() u: Actor,
    @Body() d: ConversationDto,
  ) {
    const p = await this.db.professionalProfile.findUnique({
      where: { id: d.professionalId },
    });
    if (!p) throw new NotFoundException();
    await this.policy.unblocked(u.id, p.userId);
    const directKey = [u.id, p.userId].sort().join(":");
    return this.db.conversation.upsert({
      where: { directKey },
      update: {},
      create: {
        directKey,
        participants: { create: [{ userId: u.id }, { userId: p.userId }] },
      },
    });
  }
  @Get() async list(@CurrentUser() u: Actor, @Query() p: PageDto) {
    const where = { participants: { some: { userId: u.id } } };
    const [items, total] = await this.db.$transaction([
      this.db.conversation.findMany({
        where,
        include: {
          participants: {
            select: {
              userId: true,
              lastReadAt: true,
              user: { select: publicUser },
            },
          },
          engagement: { select: { title: true } },
          messages: {
            where: { moderationStatus: "VISIBLE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, body: true, senderId: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
        ...paging(p),
      }),
      this.db.conversation.count({ where }),
    ]);
    const counts = await this.db.$queryRaw<
      { conversationId: string; count: bigint }[]
    >`SELECT m."conversationId", COUNT(*) AS count FROM "Message" m JOIN "ConversationParticipant" p ON p."conversationId"=m."conversationId" WHERE p."userId"=${u.id}::uuid AND m."senderId"<>${u.id}::uuid AND m."createdAt">p."lastReadAt" AND m."moderationStatus"='VISIBLE' GROUP BY m."conversationId"`;
    return result(
      items.map((i) => ({
        ...i,
        unread: Number(
          counts.find((c) => c.conversationId === i.id)?.count ?? 0,
        ),
      })),
      total,
      p,
    );
  }
  @Get(":id/messages") async messages(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() p: PageDto,
  ) {
    await this.member(id, u.id);
    const where = { conversationId: id, moderationStatus: "VISIBLE" as const };
    const [items, total] = await this.db.$transaction([
      this.db.message.findMany({
        where,
        select: {
          id: true,
          body: true,
          senderId: true,
          createdAt: true,
          sender: { select: publicUser },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...paging(p),
      }),
      this.db.message.count({ where }),
    ]);
    return result(items, total, p);
  }
  @Verified() @Post(":id/messages") async send(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: MessageDto,
  ) {
    const c = await this.member(id, u.id);
    const recipient = c.participants.find((p) => p.userId !== u.id);
    if (!recipient) throw new BadRequestException();
    await this.policy.unblocked(u.id, recipient.userId);
    return this.db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId: id, senderId: u.id, body: d.body.trim() },
      });
      await tx.notification.create({
        data: { userId: recipient.userId, kind: "NEW_MESSAGE", resourceId: id },
      });
      return message;
    });
  }
  @Post(":id/read") async read(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.member(id, u.id);
    await this.db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId: u.id } },
      data: { lastReadAt: new Date() },
    });
    return { success: true };
  }
}
