import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/guards";
import { PrismaService } from "../common/prisma.service";
@Controller()
export class CatalogController {
  constructor(private db: PrismaService) {}
  @Public() @Get("categories") categories() {
    return this.db.category.findMany({
      where: { active: true, requiresLicense: false },
      include: { translations: true },
      orderBy: { position: "asc" },
    });
  }
  @Public() @Get("locations") locations() {
    return this.db.country.findMany({
      where: { enabled: true },
      include: {
        regions: { orderBy: { name: "asc" } },
        cities: { orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });
  }
}
