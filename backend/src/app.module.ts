import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './common/config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { AccessModule } from './common/access/access.module';
import { AuditModule } from './common/audit/audit.module';
import { NotificationModule } from './common/notifications/notification.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { OrgModule } from './org/org.module';
import { EmployeesModule } from './employees/employees.module';
import { ContractsModule } from './contracts/contracts.module';
import { DocumentsModule } from './documents/documents.module';
import { AttendanceModule } from './attendance/attendance.module';
import { ShiftsModule } from './shifts/shifts.module';
import { LeavesModule } from './leaves/leaves.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { PayrollModule } from './payroll/payroll.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';
import { EmployeePanelModule } from './employee-panel/employee-panel.module';
import { AssetsModule } from './assets/assets.module';
import { TrainingModule } from './training/training.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { MissionsModule } from './missions/missions.module';
import { LoansModule } from './loans/loans.module';
import { AdminModule } from './admin/admin.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { SettingsModule } from './settings/settings.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: ['.env'] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('app.security.rateLimitTtlMs') ?? 60000,
          limit: config.get<number>('app.security.rateLimitLimit') ?? 300,
        },
      ],
    }),
    PrismaModule,
    AccessModule,
    AuditModule,
    NotificationModule,

    AuthModule,
    UsersModule,
    RolesModule,
    OrgModule,
    EmployeesModule,
    ContractsModule,
    DocumentsModule,
    AttendanceModule,
    ShiftsModule,
    LeavesModule,
    ApprovalsModule,
    PayrollModule,
    EvaluationsModule,
    TasksModule,
    ProjectsModule,
    EmployeePanelModule,
    AssetsModule,
    TrainingModule,
    RecruitmentModule,
    LifecycleModule,
    MissionsModule,
    LoansModule,
    AdminModule,
    AnnouncementsModule,
    NotificationsModule,
    ReportsModule,
    DashboardModule,
    AuditLogModule,
    SettingsModule,
    BackupModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
