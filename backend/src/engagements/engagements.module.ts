import { Module } from "@nestjs/common";
import { EngagementsController } from "./engagements.controller";
@Module({ controllers: [EngagementsController] })
export class EngagementsModule {}
