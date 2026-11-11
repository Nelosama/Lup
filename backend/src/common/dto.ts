import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";
export class PageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 12;
}
export class SearchDto extends PageDto {
  @ApiPropertyOptional({ type: Number, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
  @ApiPropertyOptional({ type: Number, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ type: String, format: "uuid" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
  @ApiPropertyOptional({ type: String, format: "uuid" })
  @IsOptional()
  @IsUUID()
  cityId?: string;
  @ApiPropertyOptional({ type: String, format: "uuid" })
  @IsOptional()
  @IsUUID()
  regionId?: string;
  @ApiPropertyOptional({ type: String, maxLength: 2 })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  zone?: string;
}
export function paging(p: PageDto) {
  return { skip: (p.page - 1) * p.limit, take: p.limit };
}
export function result<T>(items: T[], total: number, p: PageDto) {
  return { items, total, page: p.page, limit: p.limit };
}
export const publicUser = { id: true, name: true, avatarPath: true } as const;
export const privateUser = {
  ...publicUser,
  email: true,
  phone: true,
  countryCode: true,
  cityId: true,
  locale: true,
  timezone: true,
  emailVerifiedAt: true,
  status: true,
  roles: { select: { role: true } },
  professional: { select: { id: true } },
} as const;
