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
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  radiusKm?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;
  @IsOptional() @IsString() @MaxLength(100) zone?: string;
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
