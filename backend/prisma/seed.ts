import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const countries = [
    [
      "HN",
      "Honduras",
      "HNL",
      "Francisco Morazán",
      "Tegucigalpa",
      "America/Tegucigalpa",
    ],
    [
      "MX",
      "México",
      "MXN",
      "Ciudad de México",
      "Ciudad de México",
      "America/Mexico_City",
    ],
    ["US", "United States", "USD", "Florida", "Miami", "America/New_York"],
    ["ES", "España", "EUR", "Comunidad de Madrid", "Madrid", "Europe/Madrid"],
    ["CR", "Costa Rica", "CRC", "San José", "San José", "America/Costa_Rica"],
    ["CO", "Colombia", "COP", "Bogotá D.C.", "Bogotá", "America/Bogota"],
    ["BR", "Brasil", "BRL", "São Paulo", "São Paulo", "America/Sao_Paulo"],
    ["PT", "Portugal", "EUR", "Lisboa", "Lisboa", "Europe/Lisbon"],
  ];
  for (const [
    code,
    name,
    currencyCode,
    regionName,
    cityName,
    timezone,
  ] of countries) {
    await db.country.upsert({
      where: { code },
      create: { code, name, currencyCode, enabled: true },
      update: {},
    });
    const region = await db.region.upsert({
      where: { countryCode_name: { countryCode: code, name: regionName } },
      create: { countryCode: code, name: regionName },
      update: {},
    });
    await db.city.upsert({
      where: { regionId_name: { regionId: region.id, name: cityName } },
      create: {
        countryCode: code,
        regionId: region.id,
        name: cityName,
        timezone,
      },
      update: {},
    });
  }
  const categories = [
    ["electricity", "Electricidad", "Electrical work", true],
    ["plumbing", "Fontanería", "Plumbing", true],
    ["painting", "Pintura", "Painting", false],
    ["carpentry", "Carpintería", "Carpentry", false],
    ["gardening", "Jardinería", "Gardening", false],
    ["cleaning", "Limpieza", "Cleaning", false],
    [
      "appliance-repair",
      "Reparación de electrodomésticos",
      "Appliance repair",
      false,
    ],
    ["air-conditioning", "Aire acondicionado", "Air conditioning", true],
    ["installations", "Instalaciones", "Installations", true],
    ["maintenance", "Mantenimiento", "Maintenance", false],
    ["moving", "Mudanzas", "Moving", false],
    ["technical-services", "Servicios técnicos", "Technical services", false],
    ["computer-repair", "Reparación de computadoras", "Computer repair", false],
    ["graphic-design", "Diseño gráfico", "Graphic design", false],
    ["photography", "Fotografía", "Photography", false],
    ["digital-services", "Servicios digitales", "Digital services", false],
  ] as const;
  for (const [position, [slug, es, en, regulated]] of categories.entries()) {
    const c = await db.category.upsert({
      where: { slug },
      create: {
        slug,
        position,
        active: !regulated,
        requiresLicense: regulated,
      },
      update: {},
    });
    for (const [locale, name] of [
      ["es", es],
      ["en", en],
    ])
      await db.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId: c.id, locale } },
        create: { categoryId: c.id, locale, name },
        update: {},
      });
  }
  console.log(
    "Seeded real location and category catalogs; no users, reviews or statistics fabricated",
  );
}
main().finally(() => db.$disconnect());
