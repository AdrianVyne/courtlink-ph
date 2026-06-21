import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("api/v1");

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("CourtLink PH API").setVersion("1").build(),
  );
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  Logger.log(`API listening on ${port}`, "Bootstrap");
}

void bootstrap();
