import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
} from "class-validator";
export class ProfileDto {
  @ApiProperty({ type: String, minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  displayName!: string;
  @ApiProperty({ type: String, minLength: 20, maxLength: 3000 })
  @IsString()
  @Length(20, 3000)
  biography!: string;
  @ApiProperty({ type: String, maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  experienceDescription!: string;
  @ApiProperty({ type: Boolean })
  @IsBoolean()
  isAvailable!: boolean;
  @ApiProperty({ type: String, isArray: true, format: "uuid" })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayMinSize(1)
  @IsUUID("all", { each: true })
  cityIds!: string[];
}
export class ServiceDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  categoryId!: string;
  @ApiProperty({ type: String, minLength: 4, maxLength: 120 })
  @IsString()
  @Length(4, 120)
  title!: string;
  @ApiProperty({ type: String, minLength: 20, maxLength: 3000 })
  @IsString()
  @Length(20, 3000)
  description!: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsNumberString({ no_symbols: false })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  indicativePrice?: string;
  @ApiProperty({ type: String })
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
