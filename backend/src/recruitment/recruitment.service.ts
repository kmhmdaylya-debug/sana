import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicantStatus,
  AuditAction,
  InterviewStatus,
  OfferStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  ApplicantQueryDto,
  CreateApplicantDto,
  CreateInterviewDto,
  CreateInterviewFeedbackDto,
  CreateOfferDto,
  CreateOpeningDto,
  CreateRequisitionDto,
  OfferQueryDto,
  OpeningQueryDto,
  RequisitionQueryDto,
  UpdateApplicantStatusDto,
  UpdateInterviewDto,
  UpdateOfferStatusDto,
} from './dto/recruitment.dto';

@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // =========================================================================
  // درخواست جذب
  // =========================================================================

  async listRequisitions(query: RequisitionQueryDto, pagination: PaginationDto) {
    const where: Prisma.JobRequisitionWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.jobRequisition.count({ where }),
      this.prisma.jobRequisition.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          orgUnit: { select: { id: true, name: true } },
          _count: { select: { openings: true } },
        },
      }),
    ]);

    // نام درخواست‌دهنده‌ها (مدل رابطه مستقیم ندارد)
    const requesterIds = [...new Set(rows.map((r) => r.requestedById).filter(Boolean))] as string[];
    const requesters = requesterIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, fullName: true } })
      : [];

    return {
      data: rows.map((r) => ({
        ...r,
        requestedBy: requesters.find((u) => u.id === r.requestedById) ?? null,
        budget: Number(r.budget),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createRequisition(dto: CreateRequisitionDto, user: AuthenticatedUser) {
    const row = await this.prisma.jobRequisition.create({
      data: {
        companyId: dto.companyId,
        orgUnitId: dto.orgUnitId ?? null,
        workLocationId: dto.workLocationId ?? null,
        title: dto.title.trim(),
        headcount: dto.headcount,
        reason: dto.reason ?? null,
        budget: BigInt(dto.budget ?? 0),
        status: 'DRAFT',
        requestedById: user.id,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'JobRequisition',
      entityId: row.id,
      after: { title: row.title, headcount: row.headcount },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تغییر وضعیت درخواست جذب (ثبت/تأیید/بایگانی) */
  async setRequisitionStatus(id: string, status: string, user: AuthenticatedUser) {
    const req = await this.prisma.jobRequisition.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('درخواست جذب یافت نشد.');

    // قاعده سرور: هیچ‌کس درخواست خودش را تأیید نمی‌کند
    if (status === 'APPROVED' && req.requestedById === user.id && !user.isSuperAdmin) {
      throw new BadRequestException('هیچ‌کس اجازه تأیید درخواست جذب خودش را ندارد.');
    }

    await this.prisma.jobRequisition.update({
      where: { id },
      data: {
        status,
        ...(status === 'APPROVED' ? { approvedAt: new Date() } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: status === 'APPROVED' ? AuditAction.APPROVE : AuditAction.UPDATE,
      entity: 'JobRequisition',
      entityId: id,
      after: { status },
    });

    return {
      data: { id, status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // آگهی استخدام
  // =========================================================================

  async listOpenings(query: OpeningQueryDto, pagination: PaginationDto) {
    const where: Prisma.JobOpeningWhereInput = {
      ...(query.requisitionId ? { requisitionId: query.requisitionId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.jobOpening.count({ where }),
      this.prisma.jobOpening.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requisition: {
            select: { id: true, title: true, companyId: true, status: true, company: { select: { code: true, name: true } } },
          },
          _count: { select: { applicants: true } },
        },
      }),
    ]);

    return {
      data: rows.map((o) => ({
        ...o,
        salaryMin: Number(o.salaryMin),
        salaryMax: Number(o.salaryMax),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createOpening(dto: CreateOpeningDto, user: AuthenticatedUser) {
    const requisition = await this.prisma.jobRequisition.findUnique({ where: { id: dto.requisitionId } });
    if (!requisition) throw new NotFoundException('درخواست جذب یافت نشد.');
    if (requisition.status !== 'APPROVED') {
      throw new BadRequestException('تا تأیید نشدن درخواست جذب نمی‌توان آگهی ثبت کرد.');
    }

    const row = await this.prisma.jobOpening.create({
      data: {
        requisitionId: dto.requisitionId,
        title: dto.title.trim(),
        description: dto.description ?? null,
        requiredSkills: dto.requiredSkills ?? null,
        preferredSkills: dto.preferredSkills ?? null,
        employmentType: dto.employmentType,
        salaryMin: BigInt(dto.salaryMin ?? 0),
        salaryMax: BigInt(dto.salaryMax ?? 0),
        applicationDeadline: dto.applicationDeadline ? new Date(dto.applicationDeadline) : null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'JobOpening',
      entityId: row.id,
      after: { title: row.title, requisitionId: dto.requisitionId },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // داوطلبان
  // =========================================================================

  async listApplicants(query: ApplicantQueryDto, pagination: PaginationDto) {
    const where: Prisma.ApplicantWhereInput = {
      ...(query.openingId ? { openingId: query.openingId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search } },
              { lastName: { contains: query.search } },
              { nationalId: { contains: query.search } },
              { mobile: { contains: query.search } },
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.applicant.count({ where }),
      this.prisma.applicant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          opening: { select: { id: true, title: true, employmentType: true } },
          _count: { select: { interviews: true, offers: true, documents: true } },
        },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async getApplicant(id: string) {
    const row = await this.prisma.applicant.findUnique({
      where: { id },
      include: {
        opening: { select: { id: true, title: true, employmentType: true, requisition: { select: { title: true } } } },
        documents: { orderBy: { createdAt: 'desc' } },
        interviews: {
          orderBy: { scheduledAt: 'desc' },
          include: {
            interviewer: { select: { id: true, fullName: true } },
            feedback: { include: { interviewer: { select: { fullName: true } } } },
          },
        },
        offers: { orderBy: { version: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('داوطلب یافت نشد.');
    return {
      data: { ...row, offers: row.offers.map((o) => ({ ...o, salary: Number(o.salary) })) },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createApplicant(dto: CreateApplicantDto, user: AuthenticatedUser) {
    const opening = await this.prisma.jobOpening.findUnique({ where: { id: dto.openingId } });
    if (!opening) throw new NotFoundException('آگهی استخدام یافت نشد.');
    if (opening.status !== 'OPEN') throw new BadRequestException('این آگهی دیگر فعال نیست.');

    const row = await this.prisma.applicant.create({
      data: {
        openingId: dto.openingId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        mobile: dto.mobile ?? null,
        email: dto.email ?? null,
        nationalId: dto.nationalId ?? null,
        resumePath: dto.resumePath ?? null,
        source: dto.source ?? null,
        status: ApplicantStatus.APPLIED,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Applicant',
      entityId: row.id,
      after: { openingId: dto.openingId, name: `${dto.firstName} ${dto.lastName}` },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تغییر مرحله داوطلب در فرآیند جذب */
  async setApplicantStatus(id: string, dto: UpdateApplicantStatusDto, user: AuthenticatedUser) {
    const applicant = await this.prisma.applicant.findUnique({
      where: { id },
      include: { opening: { select: { title: true } } },
    });
    if (!applicant) throw new NotFoundException('داوطلب یافت نشد.');

    await this.prisma.applicant.update({
      where: { id },
      data: { status: dto.status, stageNote: dto.stageNote ?? applicant.stageNote },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Applicant',
      entityId: id,
      before: { status: applicant.status },
      after: { status: dto.status },
    });

    return {
      data: { id, status: dto.status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // مصاحبه‌ها
  // =========================================================================

  async listInterviews(pagination: PaginationDto, applicantId?: string) {
    const where: Prisma.InterviewWhereInput = {
      ...(applicantId ? { applicantId } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.interview.count({ where }),
      this.prisma.interview.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          applicant: { select: { id: true, firstName: true, lastName: true, status: true } },
          opening: { select: { title: true } },
          interviewer: { select: { id: true, fullName: true } },
          _count: { select: { feedback: true } },
        },
      }),
    ]);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createInterview(dto: CreateInterviewDto, user: AuthenticatedUser) {
    const applicant = await this.prisma.applicant.findUnique({ where: { id: dto.applicantId } });
    if (!applicant) throw new NotFoundException('داوطلب یافت نشد.');
    if (applicant.openingId !== dto.openingId) {
      throw new BadRequestException('داوطلب به این آگهی تعلق ندارد.');
    }

    const row = await this.prisma.interview.create({
      data: {
        applicantId: dto.applicantId,
        openingId: dto.openingId,
        interviewerId: dto.interviewerId ?? null,
        scheduledAt: new Date(dto.scheduledAt),
        mode: dto.mode ?? 'ONSITE',
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Interview',
      entityId: row.id,
      after: { applicantId: dto.applicantId, scheduledAt: dto.scheduledAt },
    });

    // اطلاع به مصاحبه‌گر
    if (dto.interviewerId && dto.interviewerId !== user.id) {
      await this.notifications.notify(dto.interviewerId, {
        type: 'SYSTEM',
        title: 'مصاحبه به شما واگذار شد',
        body: `مصاحبه داوطلب «${applicant.firstName} ${applicant.lastName}»`,
        link: `/recruitment/applicants/${dto.applicantId}`,
      });
    }

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateInterview(id: string, dto: UpdateInterviewDto, user: AuthenticatedUser) {
    const interview = await this.prisma.interview.findUnique({ where: { id } });
    if (!interview) throw new NotFoundException('مصاحبه یافت نشد.');

    const row = await this.prisma.interview.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.score !== undefined ? { score: dto.score } : {}),
        ...(dto.scheduledAt !== undefined ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Interview',
      entityId: id,
      before: { status: interview.status },
      after: { status: dto.status ?? undefined, score: dto.score ?? undefined },
    });

    return {
      data: { id: row.id, status: row.status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت بازخورد مصاحبه — فقط مصاحبه‌گر خودش */
  async addFeedback(interviewId: string, dto: CreateInterviewFeedbackDto, user: AuthenticatedUser) {
    const interview = await this.prisma.interview.findUnique({ where: { id: interviewId } });
    if (!interview) throw new NotFoundException('مصاحبه یافت نشد.');
    if (interview.interviewerId && interview.interviewerId !== user.id && !user.isSuperAdmin) {
      throw new BadRequestException('فقط مصاحبه‌گر تعیین‌شده می‌تواند بازخورد ثبت کند.');
    }

    const duplicate = await this.prisma.interviewFeedback.findUnique({
      where: { interviewId_interviewerId: { interviewId, interviewerId: user.id } },
    });
    if (duplicate) throw new BadRequestException('بازخورد شما برای این مصاحبه قبلاً ثبت شده است.');

    const row = await this.prisma.interviewFeedback.create({
      data: {
        interviewId,
        interviewerId: user.id,
        scoresJson: dto.scoresJson,
        recommendation: dto.recommendation ?? null,
        comment: dto.comment ?? null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'InterviewFeedback',
      entityId: row.id,
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // پیشنهاد استخدام (Offer)
  // =========================================================================

  async listOffers(query: OfferQueryDto, pagination: PaginationDto) {
    const where: Prisma.OfferWhereInput = {
      ...(query.applicantId ? { applicantId: query.applicantId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.offer.count({ where }),
      this.prisma.offer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          applicant: { select: { id: true, firstName: true, lastName: true, status: true } },
        },
      }),
    ]);

    return {
      data: rows.map((o) => ({ ...o, salary: Number(o.salary) })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async createOffer(dto: CreateOfferDto, user: AuthenticatedUser) {
    const applicant = await this.prisma.applicant.findUnique({ where: { id: dto.applicantId } });
    if (!applicant) throw new NotFoundException('داوطلب یافت نشد.');

    const last = await this.prisma.offer.findFirst({
      where: { applicantId: dto.applicantId },
      orderBy: { version: 'desc' },
    });
    if (last && last.status === OfferStatus.ACCEPTED) {
      throw new BadRequestException('پیشنهاد پذیرفته‌شده قبلی وجود دارد؛ برای تغییر، نسخه مذاکره ثبت کنید.');
    }

    const row = await this.prisma.offer.create({
      data: {
        applicantId: dto.applicantId,
        version: (last?.version ?? 0) + 1,
        salary: BigInt(dto.salary),
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: OfferStatus.DRAFT,
        notes: dto.notes ?? null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Offer',
      entityId: row.id,
      after: { applicantId: dto.applicantId, version: row.version },
    });

    return {
      data: { id: row.id, version: row.version },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async setOfferStatus(id: string, dto: UpdateOfferStatusDto, user: AuthenticatedUser) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: { applicant: { select: { firstName: true, lastName: true, opening: { select: { title: true } } } } },
    });
    if (!offer) throw new NotFoundException('پیشنهاد استخدام یافت نشد.');

    await this.prisma.offer.update({ where: { id }, data: { status: dto.status } });

    // پذیرش پیشنهاد → داوطلب HIRED می‌شود
    if (dto.status === OfferStatus.ACCEPTED) {
      await this.prisma.applicant.update({ where: { id: offer.applicantId }, data: { status: ApplicantStatus.HIRED } });
    }

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Offer',
      entityId: id,
      before: { status: offer.status },
      after: { status: dto.status },
    });

    return {
      data: { id, status: dto.status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
