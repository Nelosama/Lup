import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
export class LoginDto {
  @ApiProperty({ type: String, format: "email", maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({
    type: String,
    format: "password",
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @Length(12, 128)
  password!: string;
}
export class RegisterDto extends LoginDto {
  @ApiProperty({ type: String, minLength: 2, maxLength: 100 })
  @IsString()
  @Length(2, 100)
  name!: string;
  @ApiProperty({ type: String })
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
  @ApiPropertyOptional({ type: String, format: "uuid" })
  @IsOptional()
  @IsUUID()
  cityId?: string;
  @ApiPropertyOptional({ type: String, enum: ["es", "en"] })
  @IsOptional()
  @IsIn(["es", "en"])
  locale?: string;
  @ApiPropertyOptional({ type: String, enum: ["CLIENT", "PROFESSIONAL"] })
  @IsOptional()
  @IsIn(["CLIENT", "PROFESSIONAL"])
  accountType?: "CLIENT" | "PROFESSIONAL";
}
export class EmailDto {
  @ApiProperty({ type: String, format: "email", maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class TokenDto {
  @ApiProperty({ type: String, minLength: 40, maxLength: 100 })
  @IsString()
  @Length(40, 100)
  token!: string;
}
export class ResetDto extends TokenDto {
  @ApiProperty({
    type: String,
    format: "password",
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @Length(12, 128)
  password!: string;
}
export class PasswordDto {
  @ApiProperty({
    type: String,
    format: "password",
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @Length(12, 128)
  currentPassword!: string;
  @ApiProperty({
    type: String,
    format: "password",
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @Length(12, 128)
  password!: string;
}
