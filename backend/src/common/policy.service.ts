import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "./prisma.service";
@Injectable()
export class PolicyService {
  constructor(private db: PrismaService) {}
  async unblocked(a: string, b: string) {
    if (a === b) throw new BadRequestException("Choose another user");
    const blocked = await this.db.userBlock.count({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    const active = await this.db.user.count({
      where: { id: { in: [a, b] }, status: "ACTIVE" },
    });
    if (blocked || active !== 2)
      throw new ForbiddenException("Interaction unavailable");
  }
  async location(countryCode: string, cityId?: string) {
    const c = await this.db.country.findFirst({
      where: { code: countryCode, enabled: true },
    });
    if (!c) throw new BadRequestException("Country unavailable");
    if (
      cityId &&
      !(await this.db.city.findFirst({ where: { id: cityId, countryCode } }))
    )
      throw new BadRequestException("City does not belong to country");
  }
  async category(id: string) {
    if (
      !(await this.db.category.findFirst({
        where: { id, active: true, requiresLicense: false },
      }))
    )
      throw new BadRequestException("Category unavailable");
  }
}
export function currency(code: string) {
  if (!Intl.supportedValuesOf("currency").includes(code))
    throw new BadRequestException("Invalid ISO 4217 currency");
  return code;
}
// Public descriptions must not contain contact details or precise coordinates. Exact addresses stay outside public fields.
export function publicText(value: string) {
  if (
    /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}|https?:\/\/|\b(?:calle|street|avenida|avenue)\s+\S+\s+\d)/i.test(
      value,
    )
  )
    throw new BadRequestException(
      "Remove contact details and exact addresses from public content",
    );
  return value;
}
