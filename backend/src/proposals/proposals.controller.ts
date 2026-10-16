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
import { IsString, Length, Matches } from "class-validator";
import { Actor, CurrentUser, Verified } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { PageDto, paging, result } from "../common/dto";
import { PolicyService } from "../common/policy.service";
class ProposalDto {
  @IsString() @Length(20, 3000) description!: string;
  @Matches(/^\d{1,10}(\.\d{1,2})?$/) estimatedPrice!: string;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @IsString() @Length(2, 120) estimatedDuration!: string;
}
@Controller()
export class ProposalsController {
  constructor(
    private db: PrismaService,
    private policy: PolicyService,
  ) {}
  @Get("proposals/mine") async mine(
    @CurrentUser() u: Actor,
    @Query() p: PageDto,
  ) {
    const where = { professional: { userId: u.id } };
    const [items, total] = await this.db.$transaction([
      this.db.proposal.findMany({
        where,
        include: {
          request: { select: { id: true, title: true, status: true } },
        },
        ...paging(p),
        orderBy: { createdAt: "desc" },
      }),
      this.db.proposal.count({ where }),
    ]);
    return result(items, total, p);
  }
  @Verified() @Post("requests/:id/proposals") async create(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() d: ProposalDto,
  ) {
    const p = await this.db.professionalProfile.findUnique({
      where: { userId: u.id },
    });
    if (!p) throw new BadRequestException("Complete your professional profile");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceRequest" WHERE id=${id}::uuid FOR UPDATE`;
      const r = await tx.serviceRequest.findUnique({
        where: { id },
        include: { category: true },
      });
      if (
        !r ||
        r.status !== "OPEN" ||
        r.moderationStatus !== "VISIBLE" ||
        !r.category.active ||
        r.category.requiresLicense
      )
        throw new BadRequestException("Request is closed");
      await this.policy.unblocked(u.id, r.clientId);
      if (d.currencyCode !== r.currencyCode)
        throw new BadRequestException("Use the request currency");
      const proposal = await tx.proposal.create({
        data: { ...d, requestId: id, professionalId: p.id },
      });
      await tx.notification.create({
        data: { userId: r.clientId, kind: "NEW_PROPOSAL", resourceId: id },
      });
      return proposal;
    });
  }
  @Verified() @Post("proposals/:id/accept") async accept(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const proposal = await this.db.proposal.findUnique({
      where: { id },
      include: { professional: { select: { userId: true } } },
    });
    if (!proposal) throw new NotFoundException();
    await this.policy.unblocked(u.id, proposal.professional.userId);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceRequest" WHERE id=${proposal.requestId}::uuid FOR UPDATE`;
      const request = await tx.serviceRequest.findUnique({
        where: { id: proposal.requestId },
        include: { category: true },
      });
      const current = await tx.proposal.findUnique({ where: { id } });
      if (!request || request.clientId !== u.id) throw new NotFoundException();
      if (
        request.status !== "OPEN" ||
        current?.status !== "PENDING" ||
        request.moderationStatus !== "VISIBLE" ||
        !request.category.active ||
        request.category.requiresLicense
      )
        throw new BadRequestException("Proposal cannot be accepted");
      const engagement = await tx.engagement.create({
        data: {
          clientId: u.id,
          professionalId: proposal.professional.userId,
          requestId: request.id,
          proposalId: id,
          title: request.title,
          agreedPrice: proposal.estimatedPrice,
          currencyCode: proposal.currencyCode,
          professionalAgreedAt: new Date(),
          conversation: {
            create: {
              requestId: request.id,
              participants: {
                create: [
                  { userId: u.id },
                  { userId: proposal.professional.userId },
                ],
              },
            },
          },
        },
        include: { conversation: { select: { id: true } } },
      });
      await tx.proposal.update({ where: { id }, data: { status: "ACCEPTED" } });
      const rejected = await tx.proposal.findMany({
        where: { requestId: request.id, id: { not: id }, status: "PENDING" },
        select: { professional: { select: { userId: true } } },
      });
      await tx.notification.createMany({
        data: rejected.map((p) => ({
          userId: p.professional.userId,
          kind: "PROPOSAL_REJECTED",
          resourceId: request.id,
        })),
      });
      await tx.proposal.updateMany({
        where: { requestId: request.id, id: { not: id }, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      await tx.serviceRequest.update({
        where: { id: request.id },
        data: { status: "ASSIGNED" },
      });
      await tx.notification.create({
        data: {
          userId: proposal.professional.userId,
          kind: "PROPOSAL_ACCEPTED",
          resourceId: engagement.id,
        },
      });
      return engagement;
    });
  }
  @Post("proposals/:id/withdraw") async withdraw(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const p = await this.db.proposal.findFirst({
      where: { id, professional: { userId: u.id } },
    });
    if (!p) throw new NotFoundException();
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceRequest" WHERE id=${p.requestId}::uuid FOR UPDATE`;
      const updated = await tx.proposal.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "WITHDRAWN" },
      });
      if (updated.count !== 1)
        throw new BadRequestException("Proposal cannot be withdrawn");
      return { success: true };
    });
  }
}
