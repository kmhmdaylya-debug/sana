import { validate } from 'class-validator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, CreateProjectTaskDto } from './dto/projects.dto';
import { CreateTaskDto, ReviewTaskRetryDto } from '../tasks/dto/tasks.dto';

describe('Work category persistence', () => {
  const actor = { id: 'manager', isSuperAdmin: true, scope: { unrestricted: true } } as any;
  let prisma: any;
  let service: ProjectsService;
  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'project', code: 'P', title: 'Project' }), update: jest.fn().mockResolvedValue({ id: 'project' }) },
      projectTask: { create: jest.fn().mockResolvedValue({ id: 'stage' }), findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ProjectsService(prisma, { resolveCompanyId: jest.fn().mockResolvedValue('company') } as any, { record: jest.fn() } as any);
  });

  it('stores a project category without changing membership or dates', async () => {
    await service.create({ code: 'P', title: 'Project', startDate: '2026-11-01', endDate: '2026-12-01', category: 'DESIGN' }, actor);
    expect(prisma.project.create.mock.calls[0][0].data).toMatchObject({ category: 'DESIGN', companyId: 'company' });
  });

  it('allows a category to be changed or cleared on an existing project', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'project', code: 'P', title: 'Project' });
    await service.update('project', { category: 'DEVELOPMENT' }, actor);
    expect(prisma.project.update.mock.calls[0][0].data).toEqual({ category: 'DEVELOPMENT' });
    await service.update('project', { category: null }, actor);
    expect(prisma.project.update.mock.calls[1][0].data).toEqual({ category: null });
  });

  it('stores an explicit stage category and leaves null available for live parent inheritance', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'project', category: 'DESIGN', tasks: [] });
    const dto = { title: 'Stage', startDate: '2026-11-01', endDate: '2026-12-01' };
    await service.addTask('project', { ...dto, category: 'CONTENT' }, actor);
    expect(prisma.projectTask.create.mock.calls[0][0].data.category).toBe('CONTENT');
    await service.addTask('project', dto, actor);
    expect(prisma.projectTask.create.mock.calls[1][0].data.category).toBeNull();
  });

  it.each([CreateProjectDto, CreateProjectTaskDto, CreateTaskDto])('validates category keys in %p', async Dto => {
    const errors = await validate(Object.assign(new Dto(), { category: 'arbitrary-color' }));
    expect(errors.some(error => error.property === 'category')).toBe(true);
    const valid = await validate(Object.assign(new Dto(), { category: 'DESIGN' }));
    expect(valid.some(error => error.property === 'category')).toBe(false);
  });

  it('does not accept a string as an approval boolean', async () => {
    const errors = await validate(Object.assign(new ReviewTaskRetryDto(), { approved: 'false' }));
    expect(errors.some(error => error.property === 'approved')).toBe(true);
  });
});
