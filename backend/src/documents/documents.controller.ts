import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DocumentsService, UploadedFilePayload } from './documents.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateDocumentDto, DocumentQueryDto, UpdateDocumentDto } from './dto/documents.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_VIEW)
  @ApiOperation({ summary: 'فهرست مدارک' })
  list(@Query() query: DocumentQueryDto, @Query() pagination: PaginationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(query, pagination, user);
  }
  @Get('expiring')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_VIEW)
  @ApiOperation({ summary: 'مدارک در حال انقضا (۶۰ روز آینده)' })
  expiring(@CurrentUser() user: AuthenticatedUser) {
    return this.service.expiring(user);
  }
  @Post()
  @RequirePermissions(PERMISSIONS.DOCUMENTS_CREATE)
  @ApiOperation({ summary: 'ایجاد مدرک (بدون فایل)' })
  create(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }
  @Post(':id/versions')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_CREATE)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, fieldSize: 2000 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'آپلود نسخه جدید فایل مدرک' })
  uploadVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFilePayload,
    @Body('note') note?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.service.uploadVersion(id, file, note, user as AuthenticatedUser);
  }
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_UPDATE)
  @ApiOperation({ summary: 'ویرایش مشخصات مدرک' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }
  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_DELETE)
  @ApiOperation({ summary: 'حذف منطقی مدرک' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.remove(id, user);
  }
  @Get('versions/:versionId/download')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_VIEW)
  @ApiOperation({ summary: 'دانلود نسخه مدرک (ثبت لاگ)' })
  async download(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.service.downloadVersion(versionId, user);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    return res.send(file.buffer);
  }
  @Get(':id')
  @RequirePermissions(PERMISSIONS.DOCUMENTS_VIEW)
  @ApiOperation({ summary: 'جزئیات مدرک با نسخه‌ها' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.get(id, user);
  }
}
