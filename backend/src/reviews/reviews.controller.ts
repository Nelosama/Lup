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
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { Actor, CurrentUser, Public, Verified } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, publicUser, result } from "../common/dto";
import { publicText } from "../common/policy.service";
class ReviewDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  engagementId!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;
  @ApiProperty({ type: String, maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  comment!: string;
}
@Controller("reviews")
export class ReviewsController {
  constructor(private db: PrismaService) {}
  @Get("mine") async mine(@CurrentUser() u: Actor, @Query() p: PageDto) {
    const where = { reviewerId: u.id };
    const [items, total] = await this.db.$transaction([
      this.db.review.findMany({
        where,
        include: { engagement: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        ...paging(p),
      }),
      this.db.review.count({ where }),
    ]);
    return result(items, total, p);
  }
  @Public() @Get("user/:id") async list(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() p: PageDto,
  ) {
    const where = {
      reviewedUserId: id,
      moderationStatus: "VISIBLE" as const,
      reviewedUser: { status: "ACTIVE" as const },
    };
    const [items, total] = await this.db.$transaction([
      this.db.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewer: { select: publicUser },
        },
        orderBy: { createdAt: "desc" },
        ...paging(p),
      }),
      this.db.review.count({ where }),
    ]);
    return result(items, total, p);
  }
  @Verified() @Post() async create(
    @CurrentUser() u: Actor,
    @Body() d: ReviewDto,
  ) {
    publicText(d.comment);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Engagement" WHERE id=${d.engagementId}::uuid FOR UPDATE`;
      const e = await tx.engagement.findUnique({
        where: { id: d.engagementId },
      });
      if (!e || ![e.clientId, e.professionalId].includes(u.id))
        throw new NotFoundException();
      if (
        e.status !== "COMPLETED" ||
        !e.clientCompletedAt ||
        !e.professionalCompletedAt
      )
        throw new BadRequestException("A mutually completed job is required");
      const reviewedUserId =
        e.clientId === u.id ? e.professionalId : e.clientId;
      const review = await tx.review.create({
        data: { ...d, reviewerId: u.id, reviewedUserId },
      });
      await tx.notification.create({
        data: { userId: reviewedUserId, kind: "NEW_REVIEW", resourceId: e.id },
      });
      return review;
    });
  }
}
