import { SettingsService } from './settings.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';

const actor = {
  id: 'actor-a', username: 'actor.a', fullName: 'Test Actor', email: 'actor@test.com',
  mobile: null, isSuperAdmin: false, employeeId: null, roleIds: [], roleCodes: [],
  permissions: ['settings.view', 'settings.manage'],
  scope: { unrestricted: false, companyIds: ['company-a'], branchIds: [], orgUnitIds: [], employeeIds: [], ownEmployeeId: null },
} as unknown as AuthenticatedUser;

describe('SettingsService', () => {
  let prisma: any;
  let service: SettingsService;

  beforeEach(() => {
    prisma = {
      setting: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(work => work(prisma)),
    };
    service = new SettingsService(prisma);
  });

  describe('listSettings', () => {
    it('returns paginated settings', async () => {
      prisma.setting.count.mockResolvedValue(2);
      prisma.setting.findMany.mockResolvedValue([{ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Sana Co', group: 'GENERAL' }, { id: 's2', key: 'LEAVES.AUTO_APPROVE_HOURLY', value: 'false', group: 'LEAVES' }]);
      const result = await service.listSettings({ page: 1, limit: 10, skip: 0 } as any, actor);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('filters by group', async () => {
      await service.listSettings({ page: 1, limit: 10, skip: 0, group: 'GENERAL' } as any, actor);
      const where = prisma.setting.findMany.mock.calls[0][0].where;
      expect(where.group).toBe('GENERAL');
    });

    it('filters by key search', async () => {
      await service.listSettings({ page: 1, limit: 10, skip: 0, search: 'COMPANY' } as any, actor);
      const where = prisma.setting.findMany.mock.calls[0][0].where;
      expect(where.key).toEqual({ contains: 'COMPANY', mode: 'insensitive' });
    });
  });

  describe('getSetting', () => {
    it('returns setting by key', async () => {
      prisma.setting.findUnique.mockResolvedValue({ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Sana Co', group: 'GENERAL' });
      const result = await service.getSetting('GENERAL.COMPANY_NAME', actor);
      expect(result.key).toBe('GENERAL.COMPANY_NAME');
      expect(result.value).toBe('Sana Co');
    });

    it('throws NotFoundException for non-existent setting', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);
      await expect(service.getSetting('NONEXISTENT.KEY', actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createSetting', () => {
    it('creates setting', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);
      prisma.setting.create.mockResolvedValue({ id: 's1', key: 'NEW.SETTING', value: 'value', group: 'CUSTOM', updatedById: 'actor-a' });
      const result = await service.createSetting({ key: 'NEW.SETTING', value: 'value', group: 'CUSTOM', label: 'New Setting', dataType: 'string' } as any, actor);
      expect(result.key).toBe('NEW.SETTING');
      expect(result.group).toBe('CUSTOM');
    });

    it('rejects duplicate setting key', async () => {
      prisma.setting.findUnique.mockResolvedValue({ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Sana Co', deletedAt: null });
      await expect(service.createSetting({ key: 'GENERAL.COMPANY_NAME', value: 'New Co', group: 'GENERAL' } as any, actor)).rejects.toThrow(ConflictException);
    });

    it('rejects invalid key format', async () => {
      await expect(service.createSetting({ key: 'invalid key', value: 'value', group: 'GENERAL' } as any, actor)).rejects.toThrow(BadRequestException);
    });

    it('rejects empty key', async () => {
      await expect(service.createSetting({ key: '', value: 'value', group: 'GENERAL' } as any, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateSetting', () => {
    it('updates setting value', async () => {
      prisma.setting.findUnique.mockResolvedValue({ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Old Co', group: 'GENERAL', deletedAt: null });
      prisma.setting.update.mockResolvedValue({ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'New Co', updatedById: 'actor-a', updatedAt: new Date() });
      const result = await service.updateSetting('GENERAL.COMPANY_NAME', { value: 'New Co' } as any, actor);
      expect(result.value).toBe('New Co');
      expect(result.updatedById).toBe('actor-a');
    });

    it('rejects updating non-existent setting', async () => {
      prisma.setting.findUnique.mockResolvedValue(null);
      await expect(service.updateSetting('NONEXISTENT.KEY', { value: 'value' } as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteSetting', () => {
    it('soft deletes setting', async () => {
      prisma.setting.findUnique.mockResolvedValue({ id: 's1', key: 'CUSTOM.SETTING', value: 'value', deletedAt: null });
      prisma.setting.update.mockResolvedValue({ id: 's1', deletedAt: new Date() });
      const result = await service.deleteSetting('CUSTOM.SETTING', actor);
      expect(result.success).toBe(true);
    });

    it('rejects deleting system setting', async () => {
      prisma.setting.findUnique.mockResolvedValue({ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Sana Co', isSystem: true, deletedAt: null });
      await expect(service.deleteSetting('GENERAL.COMPANY_NAME', actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSettingByGroup', () => {
    it('returns all settings in a group', async () => {
      prisma.setting.findMany.mockResolvedValue([{ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Sana Co', group: 'GENERAL' }, { id: 's2', key: 'GENERAL.DEFAULT_LANGUAGE', value: 'fa', group: 'GENERAL' }]);
      const result = await service.getSettingByGroup('GENERAL', actor);
      expect(result).toHaveLength(2);
      expect(result[0].group).toBe('GENERAL');
    });
  });

  describe('bulkUpdateSettings', () => {
    it('updates multiple settings in transaction', async () => {
      prisma.setting.findMany.mockResolvedValue([{ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Old Co', deletedAt: null }, { id: 's2', key: 'LEAVES.AUTO_APPROVE_HOURLY', value: 'false', deletedAt: null }]);
      prisma.setting.update.mockResolvedValue({ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'New Co' });
      const result = await service.bulkUpdateSettings([{ key: 'GENERAL.COMPANY_NAME', value: 'New Co' }, { key: 'LEAVES.AUTO_APPROVE_HOURLY', value: 'true' }] as any, actor);
      expect(result.updated).toBe(2);
    });

    it('rejects partial update if any setting not found', async () => {
      prisma.setting.findMany.mockResolvedValue([{ id: 's1', key: 'GENERAL.COMPANY_NAME', value: 'Old Co', deletedAt: null }]);
      await expect(service.bulkUpdateSettings([{ key: 'GENERAL.COMPANY_NAME', value: 'New Co' }, { key: 'NONEXISTENT.KEY', value: 'value' }] as any, actor)).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateSettingValue', () => {
    it('validates string setting value', async () => {
      const result = service.validateSettingValue('string', 'valid value');
      expect(result.valid).toBe(true);
    });

    it('rejects empty string for required setting', async () => {
      const result = service.validateSettingValue('string', '');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('validates integer setting value', async () => {
      const result = service.validateSettingValue('int', '42');
      expect(result.valid).toBe(true);
    });

    it('rejects non-integer value for int setting', async () => {
      const result = service.validateSettingValue('int', 'not-a-number');
      expect(result.valid).toBe(false);
    });

    it('validates boolean setting value', async () => {
      expect(service.validateSettingValue('boolean', 'true').valid).toBe(true);
      expect(service.validateSettingValue('boolean', 'false').valid).toBe(true);
      expect(service.validateSettingValue('boolean', 'invalid').valid).toBe(false);
    });

    it('validates JSON setting value', async () => {
      expect(service.validateSettingValue('json', '{"key": "value"}').valid).toBe(true);
      expect(service.validateSettingValue('json', 'invalid json').valid).toBe(false);
    });
  });
});