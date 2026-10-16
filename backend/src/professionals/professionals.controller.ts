import { ApiProperty } from "@nestjs/swagger";
import {
  BadRequestException,
  Body,
  Delete,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { Actor, CurrentUser, Public, Verified } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { paging, publicUser, result, SearchDto } from "../common/dto";
import { currency, PolicyService, publicText } from "../common/policy.service";
import { ProfileDto, ServiceDto } from "./professionals.dto";
import { Prisma } from "@prisma/client";
import { IsString, IsUUID, Length } from "class-validator";
class AreaDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  cityId!: string;
  @ApiProperty({ type: String, minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  zone!: string;
}
const profileSelect = {
  id: true,
  userId: true,
  displayName: true,
  biography: true,
  experienceDescription: true,
  verificationStatus: true,
  isAvailable: true,
  user: {
    select: {
      ...publicUser,
      city: { select: { id: true, name: true, countryCode: true } },
    },
  },
  services: {
    where: { active: true, category: { active: true, requiresLicense: false } },
    include: { category: { include: { translations: true } } },
  },
  areas: {
    include: { city: { select: { id: true, name: true, countryCode: true } } },
  },
  portfolio: { orderBy: { position: "asc" as const } },
} satisfies Prisma.ProfessionalProfileSelect;
const searchSelect = {
  ...profileSelect,
  experienceDescription: false,
  portfolio: false,
  services: {
    ...profileSelect.services,
    take: 1,
    orderBy: { createdAt: "asc" as const },
  },
  areas: { ...profileSelect.areas, take: 1 },
} satisfies Prisma.ProfessionalProfileSelect;
@Controller()
export class ProfessionalsController {
  constructor(
    private db: PrismaService,
    private policy: PolicyService,
  ) {}
  @Public() @Get("professionals") async search(@Query() q: SearchDto) {
    const hasGeo =
      q.latitude !== undefined ||
      q.longitude !== undefined ||
      q.radiusKm !== undefined;
    if (
      hasGeo &&
      (q.latitude === undefined ||
        q.longitude === undefined ||
        q.radiusKm === undefined)
    )
      throw new BadRequestException(
        "Latitude, longitude and radius must be supplied together",
      );
    const distances = hasGeo
      ? await this.db.$queryRaw<
          { professionalId: string; distanceKm: number }[]
        >(Prisma.sql`
      SELECT a."professionalId", MIN(6371.0088*ACOS(LEAST(1.0,GREATEST(-1.0,SIN(RADIANS(${q.latitude}::double precision))*SIN(RADIANS(c.latitude::double precision))+COS(RADIANS(${q.latitude}::double precision))*COS(RADIANS(c.latitude::double precision))*COS(RADIANS(c.longitude::double precision-${q.longitude}::double precision))))))::float8 AS "distanceKm"
      FROM "ServiceArea" a JOIN "City" c ON c.id=a."cityId" JOIN "Country" co ON co.code=c."countryCode" AND co.enabled=TRUE WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      ${q.countryCode ? Prisma.sql`AND c."countryCode"=${q.countryCode}` : Prisma.empty}
      ${q.regionId ? Prisma.sql`AND c."regionId"=${q.regionId}::uuid` : Prisma.empty}
      ${q.cityId ? Prisma.sql`AND c.id=${q.cityId}::uuid` : Prisma.empty}
      ${q.zone ? Prisma.sql`AND a.zone ILIKE ${"%" + q.zone + "%"}` : Prisma.empty}
      GROUP BY a."professionalId"
    `)
      : [];
    const where: Prisma.ProfessionalProfileWhereInput = {
      ...(hasGeo
        ? {
            id: {
              in: distances
                .filter((d) => d.distanceKm <= q.radiusKm!)
                .map((d) => d.professionalId),
            },
          }
        : {}),
      user: { status: "ACTIVE" },
      AND: [{ areas: { some: { city: { country: { enabled: true } } } } }],
      ...(q.q
        ? {
            OR: [
              { displayName: { contains: q.q, mode: "insensitive" } },
              { biography: { contains: q.q, mode: "insensitive" } },
              {
                services: {
                  some: {
                    active: true,
                    title: { contains: q.q, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : {}),
      ...(q.categoryId
        ? {
            services: {
              some: {
                categoryId: q.categoryId,
                active: true,
                category: { active: true, requiresLicense: false },
              },
            },
          }
        : {}),
      ...(q.cityId || q.zone || q.countryCode || q.regionId
        ? {
            areas: {
              some: {
                city: {
                  ...(q.countryCode ? { countryCode: q.countryCode } : {}),
                  ...(q.regionId ? { regionId: q.regionId } : {}),
                },
                ...(q.cityId ? { cityId: q.cityId } : {}),
                ...(q.zone
                  ? { zone: { contains: q.zone, mode: "insensitive" } }
                  : {}),
              },
            },
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.professionalProfile.findMany({
        where,
        select: searchSelect,
        ...paging(q),
        orderBy: { createdAt: "desc" },
      }),
      this.db.professionalProfile.count({ where }),
    ]);
    const ids = items.map((x) => x.userId);
    const stats = ids.length
      ? await this.db.$queryRaw<
          { reviewedUserId: string; rating: number; count: number }[]
        >(Prisma.sql`
      SELECT r."reviewedUserId",AVG(r.rating)::float8 AS rating,COUNT(*)::int AS count
      FROM "Review" r JOIN "Engagement" e ON e.id=r."engagementId"
      WHERE r."reviewedUserId"=e."professionalId" AND r."moderationStatus"='VISIBLE'
      AND r."reviewedUserId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) GROUP BY r."reviewedUserId"
    `)
      : [];
    return result(
      items.map((p) => ({
        ...p,
        biography: Array.from(p.biography).slice(0, 220).join(""),
        ...(hasGeo
          ? {
              distanceKm:
                distances.find((d) => d.professionalId === p.id)?.distanceKm ??
                null,
            }
          : {}),
        rating:
          stats.find((x) => x.reviewedUserId === p.userId)?.rating ?? null,
        reviewCount:
          stats.find((x) => x.reviewedUserId === p.userId)?.count ?? 0,
      })),
      total,
      q,
    );
  }
  @Get("professional/me") async mine(@CurrentUser() u: Actor) {
    return this.db.professionalProfile.findUnique({
      where: { userId: u.id },
      include: {
        services: {
          include: { category: { include: { translations: true } } },
        },
        areas: true,
        portfolio: { orderBy: { position: "asc" } },
      },
    });
  }
  @Verified() @Put("professional/me") async save(
    @CurrentUser() u: Actor,
    @Body() d: ProfileDto,
  ) {
    publicText(d.biography);
    publicText(d.displayName);
    publicText(d.experienceDescription);
    const ids = [...new Set(d.cityIds)];
    const cities = await this.db.city.findMany({
      where: { id: { in: ids }, country: { enabled: true } },
    });
    if (cities.length !== ids.length)
      throw new NotFoundException("Unknown city");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${u.id}::uuid FOR UPDATE`;
      const previous = await tx.professionalProfile.findUnique({
        where: { userId: u.id },
      });
      const invalidate =
        previous &&
        (["displayName", "biography", "experienceDescription"] as const).some(
          (k) => previous[k] !== d[k],
        );
      const p = await tx.professionalProfile.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          displayName: d.displayName,
          biography: d.biography,
          experienceDescription: d.experienceDescription,
          isAvailable: d.isAvailable,
        },
        update: {
          ...(invalidate
            ? {
                verificationStatus: "UNVERIFIED" as const,
                verificationEvidence: null,
              }
            : {}),
          displayName: d.displayName,
          biography: d.biography,
          experienceDescription: d.experienceDescription,
          isAvailable: d.isAvailable,
        },
      });
      if (invalidate && previous.verificationStatus !== "UNVERIFIED")
        await tx.auditLog.create({
          data: {
            actorId: u.id,
            action: "VERIFICATION_INVALIDATED",
            targetId: p.id,
            reason: "Professional changed previously reviewed information",
          },
        });
      await tx.serviceArea.deleteMany({
        where: { professionalId: p.id, cityId: { notIn: ids } },
      });
      await tx.serviceArea.createMany({
        data: ids.map((cityId) => ({ professionalId: p.id, cityId })),
        skipDuplicates: true,
      });
      await tx.userRole.upsert({
        where: { userId_role: { userId: u.id, role: "PROFESSIONAL" } },
        create: { userId: u.id, role: "PROFESSIONAL" },
        update: {},
      });
      return p;
    });
  }
  @Verified() @Post("professional/areas") async area(
    @CurrentUser() u: Actor,
    @Body() d: AreaDto,
  ) {
    publicText(d.zone);
    const city = await this.db.city.findFirst({
      where: { id: d.cityId, country: { enabled: true } },
    });
    if (!city) throw new BadRequestException("City unavailable");
    const p = await this.db.professionalProfile.findUniqueOrThrow({
      where: { userId: u.id },
    });
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProfessionalProfile" WHERE id=${p.id}::uuid FOR UPDATE`;
      if (
        (await tx.serviceArea.count({ where: { professionalId: p.id } })) >= 40
      )
        throw new BadRequestException("Service area limit reached");
      return tx.serviceArea.upsert({
        where: {
          professionalId_cityId_zone: {
            professionalId: p.id,
            cityId: d.cityId,
            zone: d.zone.trim(),
          },
        },
        update: {},
        create: { professionalId: p.id, cityId: d.cityId, zone: d.zone.trim() },
      });
    });
  }
  @Delete("professional/areas") async removeArea(
    @CurrentUser() u: Actor,
    @Body() d: AreaDto,
  ) {
    await this.db.serviceArea.deleteMany({
      where: { professional: { userId: u.id }, cityId: d.cityId, zone: d.zone },
    });
    return { success: true };
  }
  @Public() @Get("professionals/:id") async detail(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const p = await this.db.professionalProfile.findFirst({
      where: {
        id,
        user: { status: "ACTIVE" },
        areas: { some: { city: { country: { enabled: true } } } },
      },
      select: profileSelect,
    });
    if (!p) throw new NotFoundException();
    const [stats, distribution, completedJobs, trend] = await Promise.all([
      this.db.review.aggregate({
        where: {
          reviewedUserId: p.userId,
          moderationStatus: "VISIBLE",
          engagement: { professionalId: p.userId },
        },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      this.db.review.groupBy({
        by: ["rating"],
        where: {
          reviewedUserId: p.userId,
          moderationStatus: "VISIBLE",
          engagement: { professionalId: p.userId },
        },
        _count: true,
      }),
      this.db.engagement.count({
        where: { professionalId: p.userId, status: "COMPLETED" },
      }),
      this.db.$queryRaw<
        { month: Date; rating: number; count: number }[]
      >`SELECT date_trunc('month',r."createdAt" AT TIME ZONE 'UTC') AS month, AVG(r.rating)::float8 AS rating, COUNT(*)::int AS count FROM "Review" r JOIN "Engagement" e ON e.id=r."engagementId" WHERE r."reviewedUserId"=${p.userId}::uuid AND e."professionalId"=r."reviewedUserId" AND r."moderationStatus"='VISIBLE' AND r."createdAt">NOW()-INTERVAL '12 months' GROUP BY month ORDER BY month`,
    ]);
    return {
      ...p,
      rating: stats._avg.rating,
      reviewCount: stats._count.rating,
      distribution,
      trend,
      completedJobs,
    };
  }
  @Verified() @Post("professional/services") async service(
    @CurrentUser() u: Actor,
    @Body() d: ServiceDto,
  ) {
    await this.policy.category(d.categoryId);
    currency(d.currencyCode);
    publicText(d.title);
    publicText(d.description);
    const p = await this.db.professionalProfile.findUniqueOrThrow({
      where: { userId: u.id },
    });
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ProfessionalProfile" WHERE id=${p.id}::uuid FOR UPDATE`;
      if (
        (await tx.professionalService.count({
          where: { professionalId: p.id },
        })) >= 30
      )
        throw new BadRequestException(
          "Service limit reached; edit an existing service",
        );
      return tx.professionalService.create({
        data: { ...d, professionalId: p.id },
      });
    });
  }
  @Verified() @Put("professional/services/:id") async updateService(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ServiceDto,
  ) {
    await this.policy.category(d.categoryId);
    currency(d.currencyCode);
    publicText(d.title);
    publicText(d.description);
    const owned = await this.db.professionalService.findFirst({
      where: { id, professional: { userId: u.id } },
    });
    if (!owned) throw new NotFoundException();
    return this.db.professionalService.update({
      where: { id },
      data: { ...d, indicativePrice: d.indicativePrice ?? null },
    });
  }
  @Public() @Get("services/:id") async serviceDetail(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const s = await this.db.professionalService.findFirst({
      where: {
        id,
        active: true,
        category: { active: true, requiresLicense: false },
        professional: { user: { status: "ACTIVE" } },
      },
      include: {
        category: { include: { translations: true } },
        professional: { select: profileSelect },
      },
    });
    if (!s) throw new NotFoundException();
    return s;
  }
}
