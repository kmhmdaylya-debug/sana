import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  SurveyStatus,
  SuggestionStatus,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationService } from '../common/notifications/notification.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  ConfidentialReportQueryDto,
  CreateConfidentialReportDto,
  CreateCorrespondenceDto,
  CreateMeetingDto,
  CreateReferralDto,
  CreateSuggestionDto,
  CreateSurveyDto,
  CorrespondenceQueryDto,
  DecideSuggestionDto,
  MeetingActionDto,
  MeetingQueryDto,
  RespondReferralDto,
  SuggestionQueryDto,
  SubmitSurveyResponseDto,
  SurveyQueryDto,
  UpdateConfidentialReportDto,
  UpdateCorrespondenceDto,
  UpdateMeetingDto,
  UpdateSurveyDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  // =========================================================================
  // مکاتبات اداری
  // =========================================================================

  async listCorrespondences(query: CorrespondenceQueryDto, pagination: PaginationDto) {
    const where: Prisma.CorrespondenceWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceNo: { contains: query.search, mode: 'insensitive' } },
              { subject: { contains: query.search } },
              { senderName: { contains: query.search } },
            ],
          }
        : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.correspondence.count({ where }),
      this.prisma.correspondence.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { letterDate: 'desc' },
        include: {
          company: { select: { id: true, code: true, name: true } },
          _count: { select: { attachments: true, referrals: true } },
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

  async createCorrespondence(dto: CreateCorrespondenceDto, user: AuthenticatedUser) {
    const duplicate = await this.prisma.correspondence.findUnique({ where: { referenceNo: dto.referenceNo.trim() } });
    if (duplicate) throw new BadRequestException(`شماره نامه «${dto.referenceNo}» قبلاً ثبت شده است.`);

    const row = await this.prisma.correspondence.create({
      data: {
        companyId: dto.companyId,
        referenceNo: dto.referenceNo.trim(),
        direction: dto.direction ?? 'INCOMING',
        letterDate: new Date(dto.letterDate),
        subject: dto.subject.trim(),
        senderName: dto.senderName ?? null,
        senderOrg: dto.senderOrg ?? null,
        classification: dto.classification ?? 'NORMAL',
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Correspondence',
      entityId: row.id,
      after: { referenceNo: row.referenceNo, subject: row.subject },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateCorrespondence(id: string, dto: UpdateCorrespondenceDto, user: AuthenticatedUser) {
    const row = await this.prisma.correspondence.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('نامه یافت نشد.');

    await this.prisma.correspondence.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.deadline !== undefined ? { deadline: dto.deadline ? new Date(dto.deadline) : null } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Correspondence',
      entityId: id,
      after: { status: dto.status },
    });

    return {
      data: { id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ارجاع نامه به کاربر/نیرو */
  async referCorrespondence(id: string, dto: CreateReferralDto, user: AuthenticatedUser) {
    const correspondence = await this.prisma.correspondence.findUnique({ where: { id } });
    if (!correspondence) throw new NotFoundException('نامه یافت نشد.');
    if (!dto.toUserId && !dto.toEmployeeId) {
      throw new BadRequestException('یکی از toUserId یا toEmployeeId الزامی است.');
    }

    let toUserId = dto.toUserId;
    if (!toUserId && dto.toEmployeeId) {
      const emp = await this.prisma.employee.findUnique({
        where: { id: dto.toEmployeeId },
        select: { userId: true },
      });
      toUserId = emp?.userId ?? null;
    }

    const referral = await this.prisma.correspondenceReferral.create({
      data: {
        correspondenceId: id,
        toUserId: toUserId ?? null,
        toEmployeeId: dto.toEmployeeId ?? null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
    });

    if (toUserId && toUserId !== user.id) {
      await this.notifications.notify(toUserId, {
        type: 'SYSTEM',
        title: 'نامه جدید به شما ارجاع شد',
        body: correspondence.subject,
        link: `/admin/correspondences/${id}`,
      });
    }

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'CorrespondenceReferral',
      entityId: referral.id,
      after: { correspondenceId: id },
    });

    return {
      data: { id: referral.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** پاسخ به ارجاع دریافتی */
  async respondReferral(referralId: string, dto: RespondReferralDto, user: AuthenticatedUser) {
    const referral = await this.prisma.correspondenceReferral.findUnique({ where: { id: referralId } });
    if (!referral) throw new NotFoundException('ارجاع یافت نشد.');
    if (referral.toUserId && referral.toUserId !== user.id && !user.isSuperAdmin) {
      throw new BadRequestException('فقط گیرنده ارجاع می‌تواند پاسخ دهد.');
    }
    if (referral.status === 'ANSWERED') throw new BadRequestException('به این ارجاع قبلاً پاسخ داده شده است.');

    await this.prisma.correspondenceReferral.update({
      where: { id: referralId },
      data: {
        status: 'ANSWERED',
        response: dto.response,
        respondedAt: new Date(),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'CorrespondenceReferral',
      entityId: referralId,
      after: { status: 'ANSWERED' },
    });

    return {
      data: { id: referralId, status: 'ANSWERED' },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // جلسات
  // =========================================================================

  async listMeetings(query: MeetingQueryDto, pagination: PaginationDto) {
    const where: Prisma.MeetingWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search } } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.meeting.count({ where }),
      this.prisma.meeting.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          organizer: { select: { id: true, fullName: true } },
          participants: { include: { employee: { select: { code: true, firstName: true, lastName: true } } } },
          _count: { select: { actions: true } },
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

  async createMeeting(dto: CreateMeetingDto, user: AuthenticatedUser) {
    const meeting = await this.prisma.meeting.create({
      data: {
        companyId: dto.companyId,
        title: dto.title.trim(),
        scheduledAt: new Date(dto.scheduledAt),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        location: dto.location ?? null,
        agenda: dto.agenda ?? null,
        organizerId: user.id,
        participants: {
          create: dto.participants.map((p) => ({
            employeeId: p.employeeId ?? null,
            userId: p.userId ?? null,
          })),
        },
      },
      include: { participants: true },
    });

    // اطلاع‌رسانی به شرکت‌کنندگان
    for (const p of meeting.participants) {
      const targetUserId = p.userId ?? (p.employeeId ? (await this.prisma.employee.findUnique({ where: { id: p.employeeId }, select: { userId: true } }))?.userId : null);
      if (targetUserId && targetUserId !== user.id) {
        await this.notifications.notify(targetUserId, {
          type: 'SYSTEM',
          title: 'به جلسه دعوت شدید',
          body: `${meeting.title}`,
          link: `/admin/meetings/${meeting.id}`,
        });
      }
    }

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Meeting',
      entityId: meeting.id,
      after: { title: meeting.title, participants: meeting.participants.length },
    });

    return {
      data: { id: meeting.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateMeeting(id: string, dto: UpdateMeetingDto, user: AuthenticatedUser) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException('جلسه یافت نشد.');

    await this.prisma.meeting.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.scheduledAt !== undefined ? { scheduledAt: new Date(dto.scheduledAt) } : {}),
        ...(dto.minutes !== undefined ? { minutes: dto.minutes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Meeting',
      entityId: id,
      after: { status: dto.status },
    });

    return {
      data: { id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت مصوبه جلسه */
  async addMeetingAction(meetingId: string, dto: MeetingActionDto, user: AuthenticatedUser) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('جلسه یافت نشد.');

    const row = await this.prisma.meetingAction.create({
      data: {
        meetingId,
        title: dto.title.trim(),
        responsibleId: dto.responsibleId ?? null,
        responsibleUserId: dto.responsibleUserId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'MeetingAction',
      entityId: row.id,
      after: { meetingId, title: row.title },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تکمیل مصوبه */
  async completeMeetingAction(actionId: string, user: AuthenticatedUser) {
    const action = await this.prisma.meetingAction.findUnique({ where: { id: actionId } });
    if (!action) throw new NotFoundException('مصوبه یافت نشد.');
    if (action.status === 'DONE') throw new BadRequestException('این مصوبه قبلاً تکمیل شده است.');

    await this.prisma.meetingAction.update({
      where: { id: actionId },
      data: { status: 'DONE', completedAt: new Date() },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'MeetingAction',
      entityId: actionId,
      after: { status: 'DONE' },
    });

    return {
      data: { id: actionId, status: 'DONE' },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // نظرسنجی
  // =========================================================================

  async listSurveys(query: SurveyQueryDto, pagination: PaginationDto) {
    const where: Prisma.SurveyWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search } } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.survey.count({ where }),
      this.prisma.survey.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { questions: true, responses: true } },
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

  async createSurvey(dto: CreateSurveyDto, user: AuthenticatedUser) {
    const row = await this.prisma.survey.create({
      data: {
        companyId: dto.companyId,
        title: dto.title.trim(),
        description: dto.description ?? null,
        isAnonymous: dto.isAnonymous ?? true,
        status: SurveyStatus.DRAFT,
        createdById: user.id,
        questions: {
          create: dto.questions.map((q, index) => ({
            text: q.text.trim(),
            questionType: q.questionType ?? 'SCALE',
            options: q.options ?? null,
            sortOrder: q.sortOrder ?? index,
          })),
        },
      },
      include: { questions: true },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Survey',
      entityId: row.id,
      after: { title: row.title, questions: row.questions.length },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateSurvey(id: string, dto: UpdateSurveyDto, user: AuthenticatedUser) {
    const survey = await this.prisma.survey.findUnique({ where: { id } });
    if (!survey) throw new NotFoundException('نظرسنجی یافت نشد.');

    await this.prisma.survey.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.startDate !== undefined ? { startDate: dto.startDate ? new Date(dto.startDate) : null } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Survey',
      entityId: id,
      after: { status: dto.status },
    });

    return {
      data: { id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** ثبت پاسخ نظرسنجی */
  async submitSurveyResponse(surveyId: string, dto: SubmitSurveyResponseDto, user: AuthenticatedUser) {
    const survey = await this.prisma.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw new NotFoundException('نظرسنجی یافت نشد.');
    if (survey.status !== SurveyStatus.OPEN) throw new BadRequestException('این نظرسنجی باز نیست.');

    const duplicate = await this.prisma.surveyResponse.findFirst({
      where: { surveyId, respondentId: user.id },
      select: { id: true },
    });
    if (duplicate) throw new BadRequestException('شما قبلاً به این نظرسنجی پاسخ داده‌اید.');

    await this.prisma.surveyResponse.create({
      data: {
        surveyId,
        respondentId: survey.isAnonymous ? null : user.id,
        answersJson: dto.answersJson,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'SurveyResponse',
      after: { surveyId },
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** نتایج نظرسنجی (فقط مدیران) */
  async surveyResults(surveyId: string) {
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        responses: true,
      },
    });
    if (!survey) throw new NotFoundException('نظرسنجی یافت نشد.');

    return {
      data: {
        survey: {
          id: survey.id,
          title: survey.title,
          status: survey.status,
          isAnonymous: survey.isAnonymous,
        },
        responseCount: survey.responses.length,
        questions: survey.questions,
        responses: survey.responses.map((r) => ({
          id: r.id,
          answersJson: r.answersJson,
          submittedAt: r.submittedAt,
          ...(survey.isAnonymous ? {} : { respondentId: r.respondentId }),
        })),
      },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // پیشنهادها
  // =========================================================================

  async listSuggestions(query: SuggestionQueryDto, pagination: PaginationDto) {
    const where: Prisma.SuggestionWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { title: { contains: query.search } } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.suggestion.count({ where }),
      this.prisma.suggestion.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          responsible: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    // پیشنهادهای ناشناس: نام گزارش‌دهنده نمایش داده نمی‌شود
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

  async createSuggestion(dto: CreateSuggestionDto, user: AuthenticatedUser) {
    const row = await this.prisma.suggestion.create({
      data: {
        companyId: dto.companyId,
        title: dto.title.trim(),
        description: dto.description ?? null,
        category: dto.category ?? null,
        isAnonymous: dto.isAnonymous ?? false,
        reporterId: dto.isAnonymous ? null : user.id,
        status: SuggestionStatus.NEW,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'Suggestion',
      entityId: row.id,
      after: { title: row.title, isAnonymous: row.isAnonymous },
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /** تصمیم‌گیری/تعیین مسئول پیشنهاد */
  async decideSuggestion(id: string, dto: DecideSuggestionDto, user: AuthenticatedUser) {
    const suggestion = await this.prisma.suggestion.findUnique({ where: { id } });
    if (!suggestion) throw new NotFoundException('پیشنهاد یافت نشد.');

    await this.prisma.suggestion.update({
      where: { id },
      data: {
        status: dto.status,
        responsibleId: dto.responsibleId ?? suggestion.responsibleId,
        response: dto.response ?? suggestion.response,
      },
    });

    if (dto.responsibleId && dto.responsibleId !== user.id) {
      await this.notifications.notify(dto.responsibleId, {
        type: 'SYSTEM',
        title: 'بررسی پیشنهاد به شما واگذار شد',
        body: suggestion.title,
        link: `/admin/suggestions/${id}`,
      });
    }

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'Suggestion',
      entityId: id,
      before: { status: suggestion.status },
      after: { status: dto.status },
    });

    return {
      data: { id, status: dto.status },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // =========================================================================
  // گزارش محرمانه
  // =========================================================================

  async listConfidentialReports(query: ConfidentialReportQueryDto, pagination: PaginationDto) {
    const where: Prisma.ConfidentialReportWhereInput = {
      ...(query.companyId ? { companyId: query.companyId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.confidentialReport.count({ where }),
      this.prisma.confidentialReport.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
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

  /** ثبت گزارش محرمانه — فقط مدیران ارشد به آن دسترسی دارند */
  async createConfidentialReport(dto: CreateConfidentialReportDto, user: AuthenticatedUser) {
    const row = await this.prisma.confidentialReport.create({
      data: {
        companyId: dto.companyId,
        title: dto.title.trim(),
        description: dto.description,
        severity: dto.severity ?? 'MEDIUM',
        status: 'NEW',
        reporterId: user.id,
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.CREATE,
      entity: 'ConfidentialReport',
      entityId: row.id,
      note: 'ثبت گزارش محرمانه',
    });

    return {
      data: { id: row.id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  async updateConfidentialReport(id: string, dto: UpdateConfidentialReportDto, user: AuthenticatedUser) {
    const report = await this.prisma.confidentialReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('گزارش یافت نشد.');

    await this.prisma.confidentialReport.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.investigation !== undefined ? { investigation: dto.investigation } : {}),
      },
    });

    await this.audit.record(user.id, {
      action: AuditAction.UPDATE,
      entity: 'ConfidentialReport',
      entityId: id,
      after: { status: dto.status },
    });

    return {
      data: { id },
      success: true,
      timestamp: new Date().toISOString(),
    };
  }
}
