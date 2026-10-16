import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";
export class RequestDto {
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  categoryId!: string;
  @ApiProperty({ type: String, minLength: 5, maxLength: 120 })
  @IsString()
  @Length(5, 120)
  title!: string;
  @ApiProperty({ type: String, minLength: 20, maxLength: 4000 })
  @IsString()
  @Length(20, 4000)
  description!: string;
  @ApiProperty({ type: String })
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  cityId!: string;
  @ApiProperty({ type: String, minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  approximateLocation!: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  budgetMin?: string;
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  budgetMax?: string;
  @ApiProperty({ type: String })
  @Matches(/^[A-Z]{3}$/)
  currencyCode!: string;
  @ApiPropertyOptional({ type: String, format: "date-time" })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;
}
