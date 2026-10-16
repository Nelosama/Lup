import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Actor, CurrentUser, Verified } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, publicUser, result, SearchDto } from "../common/dto";
import { currency, PolicyService, publicText } from "../common/policy.service";
import { RequestDto } from "./requests.dto";
export const requestSelect = {
  id: true,
  clientId: true,
  title: true,
  description: true,
  categoryId: true,
  countryCode: true,
  cityId: true,
  approximateLocation: true,
  budgetMin: true,
  budgetMax: true,
  currencyCode: true,
  preferredDate: true,
  status: true,
  createdAt: true,
  category: { include: { translations: true } },
  city: { select: { id: true, name: true } },
  client: { select: publicUser },
  _count: { select: { proposals: true } },
} satisfies Prisma.ServiceRequestSelect;
@Controller("requests")
export class RequestsController {
  constructor(
    private db: PrismaService,
    private policy: PolicyService,
  ) {}
  private async validated(d: RequestDto) {
    await this.policy.location(d.countryCode, d.cityId);
    await this.policy.category(d.categoryId);
    currency(d.currencyCode);
    [d.title, d.description, d.approximateLocation].forEach(publicText);
    if (
      d.budgetMin &&
      d.budgetMax &&
      new Prisma.Decimal(d.budgetMin).greaterThan(d.budgetMax)
    )
      throw new BadRequestException("Invalid budget range");
    return {
      ...d,
      preferredDate: d.preferredDate ? new Date(d.preferredDate) : undefined,
    };
  }
  @Verified() @Post() async create(
    @CurrentUser() u: Actor,
    @Body() d: RequestDto,
  ) {
    const data = await this.validated(d);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${u.id}::uuid FOR UPDATE`;
      if (
        (await tx.serviceRequest.count({
          where: {
            clientId: u.id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) >= 5
      )
        throw new BadRequestException("Daily request limit reached");
      return tx.serviceRequest.create({
        data: { ...data, clientId: u.id },
        select: requestSelect,
      });
    });
  }
  @Get("mine") async mine(@CurrentUser() u: Actor, @Query() p: PageDto) {
    const where = { clientId: u.id };
    const [items, total] = await this.db.$transaction([
      this.db.serviceRequest.findMany({
        where,
        select: requestSelect,
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.serviceRequest.count({ where }),
    ]);
    return result(items, total, p);
  }
  @Get() async list(@CurrentUser() u: Actor, @Query() q: SearchDto) {
    const blocked = await this.db.userBlock.findMany({
      where: { OR: [{ blockerId: u.id }, { blockedId: u.id }] },
    });
    const ids = blocked.map((b) =>
      b.blockerId === u.id ? b.blockedId : b.blockerId,
    );
    const where: Prisma.ServiceRequestWhereInput = {
      status: "OPEN",
      moderationStatus: "VISIBLE",
      client: { status: "ACTIVE" },
      clientId: { notIn: ids },
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.cityId ? { cityId: q.cityId } : {}),
      ...(q.countryCode ? { countryCode: q.countryCode } : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: "insensitive" } },
              { description: { contains: q.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.serviceRequest.findMany({
        where,
        select: requestSelect,
        ...paging(q),
        orderBy: { createdAt: "desc" },
      }),
      this.db.serviceRequest.count({ where }),
    ]);
    return result(items, total, q);
  }
  @Get(":id") async detail(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const r = await this.db.serviceRequest.findFirst({
      where: { id, moderationStatus: "VISIBLE" },
      select: requestSelect,
    });
    if (!r) throw new NotFoundException();
    if (u.id !== r.clientId) await this.policy.unblocked(u.id, r.clientId);
    const proposals = await this.db.proposal.findMany({
      where: {
        requestId: id,
        ...(u.id === r.clientId ? {} : { professional: { userId: u.id } }),
      },
      include: {
        professional: { select: { id: true, userId: true, displayName: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const engagement = await this.db.engagement.findFirst({
      where: {
        requestId: id,
        OR: [{ clientId: u.id }, { professionalId: u.id }],
      },
      select: { id: true, status: true },
    });
    const images =
      u.id === r.clientId || engagement
        ? await this.db.requestImage.findMany({
            where: { requestId: id },
            select: { id: true },
          })
        : [];
    return { ...r, proposals, engagement, images };
  }
  @Verified() @Patch(":id") async edit(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: RequestDto,
  ) {
    const data = await this.validated(d);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceRequest" WHERE id=${id}::uuid FOR UPDATE`;
      const changed = await tx.serviceRequest.updateMany({
        where: { id, clientId: u.id, status: "OPEN", proposals: { none: {} } },
        data,
      });
      if (changed.count !== 1)
        throw new BadRequestException(
          "Only open requests without proposals can be edited",
        );
      return tx.serviceRequest.findUnique({
        where: { id },
        select: requestSelect,
      });
    });
  }
  @Post(":id/cancel") async cancel(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceRequest" WHERE id=${id}::uuid FOR UPDATE`;
      const r = await tx.serviceRequest.updateMany({
        where: { id, clientId: u.id, status: { in: ["OPEN", "IN_REVIEW"] } },
        data: { status: "CANCELED" },
      });
      if (r.count !== 1)
        throw new BadRequestException("Request cannot be canceled");
      await tx.proposal.updateMany({
        where: { requestId: id, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      return { success: true };
    });
  }
}
