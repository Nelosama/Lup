import { publicText } from "../common/policy.service";
import { ApiConsumes, ApiBody } from "@nestjs/swagger";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { Actor, CurrentUser, Public, Verified } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
import { StorageService } from "./storage.service";
import { configuration } from "../common/config";
class CaptionDto {
  @ApiPropertyOptional({ type: String, maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
class OrderDto {
  @ApiProperty({ type: String, isArray: true, format: "uuid" })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  ids!: string[];
}
@Controller()
export class StorageController {
  constructor(
    private db: PrismaService,
    private storage: StorageService,
  ) {}
  @Verified()
  @Post("users/me/avatar")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
      required: ["file"],
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async avatar(
    @CurrentUser() u: Actor,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Image required");
    const path = await this.storage.upload(file.buffer, `avatars/${u.id}`);
    const previous = await this.db.user.findUniqueOrThrow({
      where: { id: u.id },
      select: { avatarPath: true },
    });
    try {
      await this.db.user.update({
        where: { id: u.id },
        data: { avatarPath: path },
      });
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
    if (previous.avatarPath) await this.storage.remove(previous.avatarPath);
    return { id: u.id, avatarPath: path };
  }
  @Public() @Get("avatars/:id") async avatarUrl(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const u = await this.db.user.findFirst({
      where: { id, status: "ACTIVE" },
      select: { avatarPath: true },
    });
    if (!u?.avatarPath) throw new NotFoundException();
    return { url: await this.storage.url(u.avatarPath) };
  }
  @Verified()
  @Post("professional/portfolio")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        description: { type: "string", maxLength: 300 },
      },
      required: ["file"],
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  async portfolio(
    @CurrentUser() u: Actor,
    @UploadedFile() file: Express.Multer.File,
    @Body() d: CaptionDto,
  ) {
    if (!file) throw new BadRequestException("Image required");
    publicText(d.description ?? "");
    const p = await this.db.professionalProfile.findUniqueOrThrow({
      where: { userId: u.id },
    });
    const count = await this.db.portfolioImage.count({
      where: { professionalId: p.id },
    });
    if (count >= configuration().PORTFOLIO_LIMIT)
      throw new BadRequestException("Portfolio limit reached");
    const path = await this.storage.upload(file.buffer, `portfolio/${u.id}`);
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ProfessionalProfile" WHERE id=${p.id}::uuid FOR UPDATE`;
        const n = await tx.portfolioImage.count({
          where: { professionalId: p.id },
        });
        if (n >= configuration().PORTFOLIO_LIMIT)
          throw new BadRequestException("Portfolio limit reached");
        return tx.portfolioImage.create({
          data: {
            professionalId: p.id,
            storagePath: path,
            description: d.description,
            position: n,
          },
        });
      });
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }
  @Patch("professional/portfolio/order") async order(
    @CurrentUser() u: Actor,
    @Body() d: OrderDto,
  ) {
    const items = await this.db.portfolioImage.findMany({
      where: { professional: { userId: u.id } },
    });
    if (
      d.ids.length !== items.length ||
      new Set(d.ids).size !== items.length ||
      !items.every((i) => d.ids.includes(i.id))
    )
      throw new BadRequestException("Supply all portfolio image IDs");
    await this.db.$transaction(
      d.ids.map((id, position) =>
        this.db.portfolioImage.update({ where: { id }, data: { position } }),
      ),
    );
    return { success: true };
  }
  @Delete("professional/portfolio/:id") async remove(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const image = await this.db.portfolioImage.findFirst({
      where: { id, professional: { userId: u.id } },
    });
    if (!image) throw new NotFoundException();
    await this.storage.remove(image.storagePath);
    await this.db.portfolioImage.delete({ where: { id } });
    return { success: true };
  }
  @Verified()
  @Post("requests/:id/images")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
      required: ["file"],
    },
  })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 },
    }),
  )
  async requestImage(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("Image required");
    const r = await this.db.serviceRequest.findFirst({
      where: { id, clientId: u.id, status: "OPEN" },
    });
    if (!r) throw new ForbiddenException();
    const path = await this.storage.upload(file.buffer, `requests/${u.id}`);
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "ServiceRequest" WHERE id=${id}::uuid FOR UPDATE`;
        if (
          !(await tx.serviceRequest.findFirst({
            where: { id, clientId: u.id, status: "OPEN" },
          }))
        )
          throw new BadRequestException("Request is closed");
        if ((await tx.requestImage.count({ where: { requestId: id } })) >= 5)
          throw new BadRequestException("Image limit reached");
        return tx.requestImage.create({
          data: { requestId: id, storagePath: path },
        });
      });
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }
  @Delete("requests/:id/images/:imageId") async removeRequest(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ) {
    const image = await this.db.requestImage.findFirst({
      where: {
        id: imageId,
        requestId: id,
        request: { clientId: u.id, status: "OPEN" },
      },
    });
    if (!image) throw new NotFoundException();
    await this.storage.remove(image.storagePath);
    await this.db.requestImage.delete({ where: { id: imageId } });
    return { success: true };
  }
  @Public() @Get("images/:id") async image(
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const image = await this.db.portfolioImage.findFirst({
      where: { id, professional: { user: { status: "ACTIVE" } } },
    });
    if (!image) throw new NotFoundException();
    return { url: await this.storage.url(image.storagePath) };
  }
  @Get("request-images/:id") async requestUrl(
    @CurrentUser() u: Actor,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const image = await this.db.requestImage.findUnique({
      where: { id },
      include: {
        request: {
          select: {
            clientId: true,
            engagement: { select: { professionalId: true } },
          },
        },
      },
    });
    if (
      !image ||
      ![
        image.request.clientId,
        image.request.engagement?.professionalId,
      ].includes(u.id)
    )
      throw new NotFoundException();
    return { url: await this.storage.url(image.storagePath) };
  }
}
