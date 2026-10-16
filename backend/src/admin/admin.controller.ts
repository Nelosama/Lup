import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Actor, CurrentUser, Roles } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, publicUser, result } from "../common/dto";
class TranslationDto {
  @IsIn(["es", "en", "pt"]) locale!: string;
  @IsString() @Length(2, 100) name!: string;
}
class CategoryDto {
  @Matches(/^[a-z0-9-]{2,80}$/) slug!: string;
  @IsBoolean() active!: boolean;
  @IsBoolean() requiresLicense!: boolean;
  @IsInt() @Min(0) position!: number;
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TranslationDto)
  translations!: TranslationDto[];
}
class StatusDto {
  @IsIn(["ACTIVE", "SUSPENDED"]) status!: "ACTIVE" | "SUSPENDED";
  @IsString() @Length(15, 2000) reason!: string;
}
class VerificationDto {
  @IsIn(["PENDING_REVIEW", "VERIFIED", "REJECTED", "UNVERIFIED"]) status!:
    "PENDING_REVIEW" | "VERIFIED" | "REJECTED" | "UNVERIFIED";
  @IsString() @Length(30, 2000) evidence!: string;
}
class CountryDto {
  @IsBoolean() enabled!: boolean;
}
@Controller("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminController {
  constructor(private db: PrismaService) {}
  @Get("users") users(@Query() p: PageDto) {
    return this.userList(p);
  }
  @Get("professionals") professionals(@Query() p: PageDto) {
    return this.userList(p, "PROFESSIONAL");
  }
  @Get("clients") clients(@Query() p: PageDto) {
    return this.userList(p, "CLIENT");
  }
  private async userList(p: PageDto, role?: "PROFESSIONAL" | "CLIENT") {
    const where = role ? { roles: { some: { role } } } : {};
    const [items, total] = await this.db.$transaction([
      this.db.user.findMany({
        where,
        select: {
          ...publicUser,
          email: true,
          status: true,
          createdAt: true,
          roles: { select: { role: true } },
          professional: { select: { id: true, verificationStatus: true } },
        },
        orderBy: { createdAt: "desc" },
        ...paging(p),
      }),
      this.db.user.count({ where }),
    ]);
    return result(items, total, p);
  }
  @Roles("SUPER_ADMIN") @Post("users/:id/status") async status(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: StatusDto,
  ) {
    if (id === u.id)
      throw new BadRequestException("Cannot change your own status");
    const target = await this.db.user.findUniqueOrThrow({
      where: { id },
      include: { roles: true },
    });
    if (
      target.roles.some((x) =>
        ["SUPER_ADMIN", "ADMIN", "MODERATOR"].includes(x.role),
      )
    )
      throw new BadRequestException(
        "Privileged accounts require the offline security procedure",
      );
    return this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { status: d.status } });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: `USER_${d.status}`,
          targetId: id,
          reason: d.reason,
        },
      });
      return { success: true };
    });
  }
  @Roles("SUPER_ADMIN")
  @Post("professionals/:id/verification")
  async verification(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: VerificationDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const p = await tx.professionalProfile.findUniqueOrThrow({
        where: { id },
      });
      if (p.userId === u.id)
        throw new BadRequestException("Cannot verify yourself");
      await tx.professionalProfile.update({
        where: { id },
        data: {
          verificationStatus: d.status,
          verificationEvidence: d.evidence,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: `VERIFICATION_${d.status}`,
          targetId: id,
          reason: d.evidence,
        },
      });
      return { success: true };
    });
  }
  @Get("categories") categories() {
    return this.db.category.findMany({
      include: { translations: true },
      orderBy: { position: "asc" },
    });
  }
  private validateCategory(d: CategoryDto) {
    if (d.active && d.requiresLicense)
      throw new BadRequestException(
        "Regulated categories require a defined legal workflow before activation",
      );
    if (
      !d.translations.some((t) => t.locale === "es") ||
      !d.translations.some((t) => t.locale === "en") ||
      new Set(d.translations.map((t) => t.locale)).size !==
        d.translations.length
    )
      throw new BadRequestException("Unique ES and EN translations required");
  }
  @Post("categories") async createCategory(
    @CurrentUser() u: Actor,
    @Body() d: CategoryDto,
  ) {
    this.validateCategory(d);
    return this.db.$transaction(async (tx) => {
      const { translations, ...data } = d;
      const c = await tx.category.create({
        data: { ...data, translations: { create: translations } },
      });
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: "CATEGORY_CREATE",
          targetId: c.id,
          reason: "Catalog administration",
        },
      });
      return c;
    });
  }
  @Patch("categories/:id") async category(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: CategoryDto,
  ) {
    this.validateCategory(d);
    return this.db.$transaction(async (tx) => {
      await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
      const { translations, ...data } = d;
      const c = await tx.category.update({
        where: { id },
        data: { ...data, translations: { create: translations } },
      });
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: "CATEGORY_UPDATE",
          targetId: id,
          reason: "Catalog administration",
        },
      });
      return c;
    });
  }
  @Get("countries") countries() {
    return this.db.country.findMany({ orderBy: { name: "asc" } });
  }
  @Roles("SUPER_ADMIN") @Patch("countries/:code") async country(
    @CurrentUser() u: Actor,
    @Param("code") code: string,
    @Body() d: CountryDto,
  ) {
    return this.db.$transaction(async (tx) => {
      const c = await tx.country.update({ where: { code }, data: d });
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: "COUNTRY_UPDATE",
          targetId: code,
          reason: `enabled=${d.enabled}`,
        },
      });
      return c;
    });
  }
  @Get("requests") async requests(@Query() p: PageDto) {
    const [items, total] = await this.db.$transaction([
      this.db.serviceRequest.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          moderationStatus: true,
          createdAt: true,
          clientId: true,
          categoryId: true,
          cityId: true,
          _count: { select: { proposals: true } },
        },
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.serviceRequest.count(),
    ]);
    return result(items, total, p);
  }
  @Get("proposals") async proposals(@Query() p: PageDto) {
    const [items, total] = await this.db.$transaction([
      this.db.proposal.findMany({
        select: {
          id: true,
          requestId: true,
          professionalId: true,
          status: true,
          createdAt: true,
        },
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.proposal.count(),
    ]);
    return result(items, total, p);
  }
  @Get("engagements") async engagements(@Query() p: PageDto) {
    const [items, total] = await this.db.$transaction([
      this.db.engagement.findMany({
        select: {
          id: true,
          title: true,
          clientId: true,
          professionalId: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.engagement.count(),
    ]);
    return result(items, total, p);
  }
  @Roles("SUPER_ADMIN") @Get("audit") async audit(@Query() p: PageDto) {
    const [items, total] = await this.db.$transaction([
      this.db.auditLog.findMany({
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.auditLog.count(),
    ]);
    return result(items, total, p);
  }
  @Get("analytics") async analytics() {
    const [
      users,
      professionals,
      clients,
      requests,
      withProposals,
      proposals,
      accepted,
      engagements,
      completed,
      reviews,
      recurringClients,
      recurringProfessionals,
      byCity,
      byCategory,
      firstProposal,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.professionalProfile.count({
        where: { isAvailable: true, user: { status: "ACTIVE" } },
      }),
      this.db.user.count({
        where: { status: "ACTIVE", requests: { some: {} } },
      }),
      this.db.serviceRequest.count(),
      this.db.serviceRequest.count({ where: { proposals: { some: {} } } }),
      this.db.proposal.count(),
      this.db.proposal.count({ where: { status: "ACCEPTED" } }),
      this.db.engagement.count(),
      this.db.engagement.count({ where: { status: "COMPLETED" } }),
      this.db.review.count({ where: { moderationStatus: "VISIBLE" } }),
      this.db.engagement.groupBy({
        by: ["clientId"],
        _count: true,
        having: { clientId: { _count: { gt: 1 } } },
      }),
      this.db.engagement.groupBy({
        by: ["professionalId"],
        _count: true,
        having: { professionalId: { _count: { gt: 1 } } },
      }),
      this.db.serviceRequest.groupBy({ by: ["cityId"], _count: true }),
      this.db.serviceRequest.groupBy({ by: ["categoryId"], _count: true }),
      this.db.$queryRaw<
        { seconds: number | null }[]
      >`SELECT AVG(EXTRACT(EPOCH FROM (p.first-r."createdAt")))::float8 AS seconds FROM "ServiceRequest" r JOIN (SELECT "requestId", MIN("createdAt") first FROM "Proposal" GROUP BY "requestId") p ON p."requestId"=r.id`,
    ]);
    return {
      users,
      activeProfessionals: professionals,
      activeClients: clients,
      requests,
      requestsWithProposals: withProposals,
      proposals,
      acceptedProposals: accepted,
      reportedEngagements: engagements,
      mutuallyReportedCompletedJobs: completed,
      independentlyVerifiedJobs: null,
      reviews,
      recurringClients: recurringClients.length,
      recurringProfessionals: recurringProfessionals.length,
      byCity,
      byCategory,
      averageSecondsToFirstProposal: firstProposal[0]?.seconds ?? null,
    };
  }
}
