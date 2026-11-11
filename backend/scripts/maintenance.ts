import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const now = new Date();
  const [sessions, tokens, attempts, outbox] = await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.authToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.loginAttempt.deleteMany({
      where: { windowStartedAt: { lt: new Date(Date.now() - 86400000) } },
    }),
    db.mailOutbox.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - 86400000) } },
    }),
  ]);
  console.log(
    JSON.stringify({
      sessions: sessions.count,
      tokens: tokens.count,
      attempts: attempts.count,
      outbox: outbox.count,
    }),
  );
}
main().finally(() => db.$disconnect());
