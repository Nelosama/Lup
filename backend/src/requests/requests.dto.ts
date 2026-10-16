import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from "class-validator";
export class RequestDto {
  @IsUUID() categoryId!: string;
  @IsString() @Length(5, 120) title!: string;
  @IsString() @Length(20, 4000) description!: string;
  @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @IsUUID() cityId!: string;
  @IsString() @Length(2, 120) approximateLocation!: string;
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) budgetMin?: string;
  @IsOptional() @Matches(/^\d{1,10}(\.\d{1,2})?$/) budgetMax?: string;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @IsOptional() @IsDateString() preferredDate?: string;
}
