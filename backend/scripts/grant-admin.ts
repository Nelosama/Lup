import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const email = process.argv[2];
  const reason = process.argv[3];
  if (!email || !reason || reason.length < 20)
    throw new Error(
      'Usage: npm run admin:grant -w backend -- email "authorization reason (20+ characters)"',
    );
  const u = await db.user.findUniqueOrThrow({
    where: { email: email.toLowerCase() },
  });
  if (!u.emailVerifiedAt || u.status !== "ACTIVE")
    throw new Error("An active, email-verified account is required");
  await db.$transaction([
    db.userRole.upsert({
      where: { userId_role: { userId: u.id, role: "SUPER_ADMIN" } },
      create: { userId: u.id, role: "SUPER_ADMIN" },
      update: {},
    }),
    db.auditLog.create({
      data: {
        actorId: u.id,
        action: "OFFLINE_SUPER_ADMIN_GRANT",
        targetId: u.id,
        reason,
      },
    }),
  ]);
  console.log("SUPER_ADMIN granted; action recorded in audit log");
}
main().finally(() => db.$disconnect());
