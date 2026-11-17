import { BackupService } from './backup.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['backup.manage', 'backup.view'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('BackupService', () => {
  let prisma: any;
  let service: BackupService;

  beforeEach(() => {
    prisma = {
      backupHistory: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    service = new BackupService(prisma);
  });

  describe('listBackups', () => {
    it('returns paginated backup history', async () => {
      prisma.backupHistory.count.mockResolvedValue(2);
      prisma.backupHistory.findMany.mockResolvedValue([{ id: 'b1', fileName: 'backup-2026-01-01.sql', size: 1024000, result: 'SUCCESS', createdById: 'actor-a' }, { id: 'b2', fileName: 'backup-2026-01-02.sql', size: 2048000, result: 'SUCCESS', createdById: 'actor-a' }]);
      const result = await service.listBackups({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by result', async () => {
      await service.listBackups({ page: 1, limit: 10, skip: 0, result: 'SUCCESS' } as any, actor);
      const where = prisma.backupHistory.findMany.mock.calls[0][0].where;
      expect(where.result).toBe('SUCCESS');
    });

    it('filters by createdBy', async () => {
      await service.listBackups({ page: 1, limit: 10, skip: 0, createdById: 'actor-a' } as any, actor);
      const where = prisma.backupHistory.findMany.mock.calls[0][0].where;
      expect(where.createdById).toBe('actor-a');
    });
  });

  describe('getBackup', () => {
    it('returns backup by id', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue({ id: 'b1', fileName: 'backup-2026-01-01.sql', result: 'SUCCESS', deletedAt: null });
      const result = await service.getBackup('b1', actor);
      expect(result.id).toBe('b1');
    });

    it('throws NotFoundException for non-existent backup', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue(null);
      await expect(service.getBackup('b1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBackup', () => {
    it('creates backup record', async () => {
      prisma.backupHistory.create.mockResolvedValue({ id: 'b1', fileName: 'backup-2026-01-03.sql', size: 3072000, checksum: 'abc123', result: 'SUCCESS', createdById: 'actor-a' });
      const result = await service.createBackup({ fileName: 'backup-2026-01-03.sql', size: 3072000, checksum: 'abc123', location: '/backups/backup-2026-01-03.sql' } as any, actor);
      expect(result.fileName).toBe('backup-2026-01-03.sql');
      expect(result.result).toBe('SUCCESS');
      expect(result.createdById).toBe('actor-a');
    });

    it('rejects invalid checksum format', async () => {
      await expect(service.createBackup({ fileName: 'backup.sql', size: 1000, checksum: 'invalid-checksum', location: '/backups/backup.sql' } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects zero size backup', async () => {
      await expect(service.createBackup({ fileName: 'backup.sql', size: 0, checksum: 'abc123', location: '/backups/backup.sql' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateBackup', () => {
    it('updates backup status', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue({ id: 'b1', fileName: 'backup.sql', result: 'RUNNING', deletedAt: null });
      prisma.backupHistory.update.mockResolvedValue({ id: 'b1', result: 'SUCCESS', finishedAt: new Date() });
      const result = await service.updateBackup('b1', { result: 'SUCCESS' } as any, actor);
      expect(result.result).toBe('SUCCESS');
      expect(result.finishedAt).toBeDefined();
    });

    it('rejects updating non-existent backup', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue(null);
      await expect(service.updateBackup('b1', { result: 'SUCCESS' } as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteBackup', () => {
    it('soft deletes backup record', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue({ id: 'b1', fileName: 'backup.sql', deletedAt: null });
      prisma.backupHistory.update.mockResolvedValue({ id: 'b1', deletedAt: new Date() });
      const result = await service.deleteBackup('b1', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting non-existent backup', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue(null);
      await expect(service.deleteBackup('b1', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBackupStats', () => {
    it('returns backup statistics', async () => {
      prisma.backupHistory.groupBy.mockResolvedValue([{ result: 'SUCCESS', _count: { _all: 10 } }, { result: 'FAILED', _count: { _all: 1 } }]);
      const result = await service.getBackupStats(actor);
      expect(result.byResult).toHaveLength(2);
      expect(result.total).toBe(11);
      expect(result.successRate).toBeCloseTo(90.9, 1);
    });
  });

  describe('scheduleBackup', () => {
    it('schedules automated backup', async () => {
      prisma.backupHistory.create.mockResolvedValue({ id: 'b1', fileName: 'scheduled-backup.sql', status: 'SCHEDULED', createdById: 'actor-a' });
      const result = await service.scheduleBackup({ schedule: '0 2 * * *', retentionDays: 30, encryptionKey: 'enc-key-32-chars-long!!' } as any, actor);
      expect(result.schedule).toBe('0 2 * * *');
      expect(result.retentionDays).toBe(30);
    });

    it('rejects invalid cron schedule', async () => {
      await expect(service.scheduleBackup({ schedule: 'invalid-cron', retentionDays: 30 } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects too short retention', async () => {
      await expect(service.scheduleBackup({ schedule: '0 2 * * *', retentionDays: 1 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('restoreBackup', () => {
    it('creates restore record', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue({ id: 'b1', fileName: 'backup.sql', result: 'SUCCESS', deletedAt: null });
      prisma.backupHistory.create.mockResolvedValue({ id: 'b2', fileName: 'restore-2026-01-01.sql', result: 'RUNNING', createdById: 'actor-a' });
      const result = await service.restoreBackup('b1', { targetDatabase: 'sana_hrms_restore' } as any, actor);
      expect(result.result).toBe('RUNNING');
      expect(result.createdById).toBe('actor-a');
    });

    it('rejects restore from failed backup', async () => {
      prisma.backupHistory.findUnique.mockResolvedValue({ id: 'b1', fileName: 'backup.sql', result: 'FAILED', deletedAt: null });
      await expect(service.restoreBackup('b1', { targetDatabase: 'sana_hrms_restore' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cleanupOldBackups', () => {
    it('marks old backups for cleanup', async () => {
      prisma.backupHistory.findMany.mockResolvedValue([{ id: 'b1', fileName: 'old-backup.sql', createdAt: new Date('2026-01-01') }, { id: 'b2', fileName: 'older-backup.sql', createdAt: new Date('2026-01-02') }]);
      prisma.backupHistory.updateMany.mockResolvedValue({ count: 2 });
      const result = await service.cleanupOldBackups({ retentionDays: 30 } as any, actor);
      expect(result.cleaned).toBe(2);
    });

    it('rejects zero retention days', async () => {
      await expect(service.cleanupOldBackups({ retentionDays: 0 } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });
});
