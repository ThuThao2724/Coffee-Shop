import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { buildCorsOriginCheck } from './common/cors-origin';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Do not advertise the framework (nginx also hides upstream X-Powered-By headers).
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  const configService = app.get(ConfigService);
  const logger = new Logger('ApiGateway');
  const allowedOriginsRaw = String(configService.get<string>('ALLOWED_ORIGINS', '') || '').trim();
  const allowedOrigins = allowedOriginsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    credentials: true,
    origin: buildCorsOriginCheck(allowedOrigins),
  });
  app.enableShutdownHooks();

  const port = configService.get('PORT', 8080);
  await app.listen(port);
  logger.log(`API Gateway running on port ${port}`);
}
bootstrap();

