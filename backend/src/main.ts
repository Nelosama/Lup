import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { configuration } from "./common/config";
import { setup } from "./setup";
async function main() {
  const c = configuration();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  setup(app);
  app.enableShutdownHooks();
  await app.listen(c.PORT, "0.0.0.0");
}
void main();
