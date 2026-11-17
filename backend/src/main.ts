import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppValidationPipe } from './common/pipes/app-validation.pipe';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { swaggerAccess } from './common/guards/swagger-access';
/** مقادیر BigInt (مبالغ ریالی) در پاسخ JSON به عدد تبدیل می‌شوند */
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);
  const trustedProxies = config.get<string[]>('app.trustedProxies') ?? [];
  if (trustedProxies.length) app.set('trust proxy', trustedProxies);

  app.setGlobalPrefix(config.get<string>('app.apiPrefix') ?? 'api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new AppValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());


  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Requested-With', 'X-Device-Name'],
    exposedHeaders: ['Content-Disposition'],
  });

  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));

  app.use(require('helmet')({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'https:'],
        fontSrc: ["'self'", 'https:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    originAgentCluster: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  // کوکی refresh_token باید خوانده شود
  app.use(require('cookie-parser')());

  const swaggerEnabled = config.get<boolean>('app.swaggerEnabled');
  if (swaggerEnabled) {
    if (config.get<string>('app.env') === 'production') {
      app.use(swaggerAccess(config, app.get(JwtService), app.get(JwtStrategy)));
    }
    const docConfig = new DocumentBuilder()
      .setTitle('سامانه مدیریت منابع انسانی «سنا»')
      .setDescription(
        'مستندات REST API سامانه مدیریت منابع انسانی — شامل احراز هویت، ساختار سازمانی، پرونده پرسنلی، ' +
          'قرارداد و مدارک، حضور و غیاب، شیفت، مرخصی، حقوق و دستمزد، ارزیابی عملکرد، task، دارایی، آموزش، ' +
          'گردش تأیید، استخدام و جذب، مأموریت، وام و مزایا، مکاتبات، گزارش‌ها و مدیریت کاربران و مجوزها.',
      )
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .addTag('auth', 'احراز هویت')
      .addTag('org', 'ساختار سازمانی')
      .addTag('employees', 'پرونده پرسنلی')
      .addTag('contracts', 'قراردادها')
      .addTag('documents', 'مدارک')
      .addTag('attendance', 'حضور و غیاب')
      .addTag('shifts', 'شیفت و برنامه کاری')
      .addTag('leaves', 'مرخصی')
      .addTag('payroll', 'حقوق و دستمزد')
      .addTag('evaluations', 'ارزیابی عملکرد')
      .addTag('tasks', 'task')
      .addTag('assets', 'دارایی و تجهیزات')
      .addTag('training', 'آموزش و گواهینامه')
      .addTag('approvals', 'گردش تأیید')
      .addTag('recruitment', 'استخدام و جذب')
      .addTag('lifecycle', 'ورود و خروج نیرو')
      .addTag('missions', 'مأموریت')
      .addTag('loans', 'وام و مزایا')
      .addTag('admin', 'مکاتبات، جلسات و نظرسنجی')
      .addTag('announcements', 'اعلان‌ها و اعلامیه‌ها')
      .addTag('users', 'کاربران')
      .addTag('roles', 'نقش‌ها و مجوزها')
      .addTag('reports', 'گزارش‌ها')
      .addTag('dashboard', 'داشبورد')
      .addTag('audit', 'ممیزی و امنیت')
      .addTag('settings', 'تنظیمات')
      .addTag('backup', 'پشتیبان‌گیری')
      .build();

    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: false, docExpansion: 'none', filter: true },
      customSiteTitle: 'سنا — مستندات API',
    });

  }

  const port = config.get<number>('app.port') ?? 4114;
  const host = config.get<string>('app.host') ?? '127.0.0.1';
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`سامانه مدیریت منابع انسانی «سنا» روی http://localhost:${port}/api اجرا شد.`);
  if (swaggerEnabled) {
    // eslint-disable-next-line no-console
    console.log(`مستندات Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
