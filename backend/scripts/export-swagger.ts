import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { AppModule } from '../src/app.module';

async function exportSwagger() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
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

  const document = SwaggerModule.createDocument(app, config);
  writeFileSync('swagger.json', JSON.stringify(document, null, 2));
  console.log('Swagger spec exported to swagger.json');

  await app.close();
}

exportSwagger().catch((err) => {
  console.error('Failed to export Swagger spec:', err);
  process.exit(1);
});