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
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @Length(12, 128) password!: string;
}
export class RegisterDto extends LoginDto {
  @IsString() @Length(2, 100) name!: string;
  @Matches(/^[A-Z]{2}$/) countryCode!: string;
  @IsOptional() @IsUUID() cityId?: string;
  @IsOptional() @IsIn(["es", "en"]) locale?: string;
  @IsOptional() @IsIn(["CLIENT", "PROFESSIONAL"]) accountType?:
    "CLIENT" | "PROFESSIONAL";
}
export class EmailDto {
  @IsEmail() @MaxLength(254) email!: string;
}
export class TokenDto {
  @IsString() @Length(40, 100) token!: string;
}
export class ResetDto extends TokenDto {
  @IsString() @Length(12, 128) password!: string;
}
export class PasswordDto {
  @IsString() @Length(12, 128) currentPassword!: string;
  @IsString() @Length(12, 128) password!: string;
}
