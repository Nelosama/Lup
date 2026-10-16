import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  IsIn,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Length,
  Matches,
} from "class-validator";
import { Actor, CurrentUser } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PolicyService, publicText } from "../common/policy.service";
import { privateUser } from "../common/dto";
class UpdateUserDto {
  @ApiPropertyOptional({ type: String, minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string | null;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;
  @ApiPropertyOptional({ type: String, format: "uuid" })
  @IsOptional()
  @IsUUID()
  cityId?: string;
  @ApiPropertyOptional({ type: String, enum: ["es", "en"] })
  @IsOptional()
  @IsIn(["es", "en"])
  locale?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
@Controller("users")
export class UsersController {
  constructor(
    private db: PrismaService,
    private policy: PolicyService,
  ) {}
  @Get("me") me(@CurrentUser() u: Actor) {
    return u;
  }
  @Get("summary") async summary(@CurrentUser() u: Actor) {
    const [openRequests, pendingProposals, activeJobs, unread] =
      await Promise.all([
        this.db.serviceRequest.count({
          where: { clientId: u.id, status: "OPEN" },
        }),
        this.db.proposal.count({
          where: { professional: { userId: u.id }, status: "PENDING" },
        }),
        this.db.engagement.count({
          where: {
            OR: [{ clientId: u.id }, { professionalId: u.id }],
            status: { in: ["AGREED", "IN_PROGRESS"] },
          },
        }),
        this.db.$queryRaw<
          { count: bigint }[]
        >`SELECT COUNT(*) AS count FROM "Message" m JOIN "ConversationParticipant" p ON p."conversationId"=m."conversationId" WHERE p."userId"=${u.id}::uuid AND m."senderId"<>${u.id}::uuid AND m."createdAt">p."lastReadAt" AND m."moderationStatus"='VISIBLE'`,
      ]);
    return {
      openRequests,
      pendingProposals,
      activeJobs,
      unread: Number(unread[0].count),
    };
  }
  @Get("me/sessions") sessions(@CurrentUser() u: Actor) {
    return this.db.session.findMany({
      where: { userId: u.id, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
  }
  @Delete("me/sessions/:id") async revoke(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.db.session.deleteMany({ where: { id, userId: u.id } });
    return { success: true };
  }
  @Patch("me") async update(@CurrentUser() u: Actor, @Body() d: UpdateUserDto) {
    if (d.name !== undefined) publicText(d.name);
    await this.policy.location(
      d.countryCode ?? u.countryCode,
      d.cityId ?? u.cityId ?? undefined,
    );
    return this.db.user.update({
      where: { id: u.id },
      data: d,
      select: privateUser,
    });
  }
  @Post("me/deactivate") async deactivate(@CurrentUser() u: Actor) {
    await this.db.$transaction([
      this.db.user.update({
        where: { id: u.id },
        data: { status: "DEACTIVATED" },
      }),
      this.db.session.deleteMany({ where: { userId: u.id } }),
      this.db.professionalProfile.updateMany({
        where: { userId: u.id },
        data: { isAvailable: false },
      }),
    ]);
    return { success: true };
  }
}
