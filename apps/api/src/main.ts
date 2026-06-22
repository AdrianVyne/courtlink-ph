import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { DomainExceptionFilter } from "./common/domain-exception.filter.js";
import { registerRequestObservability } from "./observability/request-observability.js";
import { StructuredLogger } from "./observability/structured-logger.js";
import { MAX_PROOF_BYTES } from "./storage/object-storage.js";

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger();
  const adapter = new FastifyAdapter({ logger: false });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger });
  registerRequestObservability(adapter.getInstance(), (event) => logger.log(event, "HTTP"));
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new DomainExceptionFilter(logger));
  app.enableShutdownHooks();

  const multipart = await import("@fastify/multipart");
  await app.register(multipart.default as never, {
    limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle("CourtLink PH API").setVersion("1").build(),
  );
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
  logger.log({ event: "api.ready", port }, "Bootstrap");
}

void bootstrap();
