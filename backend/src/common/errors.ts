import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message: unknown = "Unexpected server error";
    if (e instanceof HttpException) {
      status = e.getStatus();
      const r = e.getResponse();
      message = typeof r === "string" ? r : (r as { message: unknown }).message;
    } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") {
        status = 409;
        message = "This operation conflicts with an existing record";
      } else if (e.code === "P2025") {
        status = 404;
        message = "Record not found";
      } else if (e.code === "P2003") {
        status = 400;
        message = "Invalid relationship";
      } else if (e.code === "P2034") {
        status = 409;
        message = "Concurrent change; reload and retry";
      }
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          event: "unhandled_error",
          name: e instanceof Error ? e.name : "Unknown",
        }),
      );
    res.status(status).json({ statusCode: status, message });
  }
}
