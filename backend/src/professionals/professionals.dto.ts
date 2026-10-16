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
  @IsString() @Length(2, 100) displayName!: string;
  @IsString() @Length(20, 3000) biography!: string;
  @IsString() @MaxLength(2000) experienceDescription!: string;
  @IsBoolean() isAvailable!: boolean;
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayMinSize(1)
  @IsUUID("all", { each: true })
  cityIds!: string[];
}
export class ServiceDto {
  @IsUUID() categoryId!: string;
  @IsString() @Length(4, 120) title!: string;
  @IsString() @Length(20, 3000) description!: string;
  @IsOptional()
  @IsNumberString({ no_symbols: false })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/)
  indicativePrice?: string;
  @Matches(/^[A-Z]{3}$/) currencyCode!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
