-- Add dedicated capabilities without automatically granting them to tenant roles.
INSERT INTO "Permission" ("id", "code", "label", "group") VALUES
  (gen_random_uuid(), 'employees.view.bank', 'مشاهده اطلاعات بانکی کارکنان', 'employees'),
  (gen_random_uuid(), 'employees.view.salary', 'مشاهده حقوق کارکنان', 'employees'),
  (gen_random_uuid(), 'users.manage.superadmin', 'مدیریت حساب محافظت‌شده', 'users'),
  (gen_random_uuid(), 'confidential-reports.manage', 'مدیریت گزارش محرمانه', 'admin')
ON CONFLICT ("code") DO NOTHING;

UPDATE "Permission"
SET "label" = replace(replace(replace("label", 'وظایف', 'task'), 'وظیفه', 'task'), 'پنل کارمند', 'task')
WHERE "group" IN ('tasks', 'panel');
