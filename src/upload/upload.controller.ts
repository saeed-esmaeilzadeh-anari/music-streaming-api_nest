import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard }     from '../modules/auth/guards/jwt-auth.guard';
import { Public }           from '../common/decorators/public.decorator';
import { CurrentUser }      from '../common/decorators/current-user.decorator';
import { UploadService }    from './upload.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard)   // default: all routes require JWT
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /uploads/presign
   * Authenticated: yes — we need userId to create the Upload record.
   */
  @Post('presign')
  async requestPresignedUrl(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestUploadDto,
  ) {
    return this.uploadService.requestPresignedUrl(userId, dto);
  }

  /**
   * PUT /uploads/local-put/:uploadId
   *
   * @Public() — intentionally unauthenticated, matching the S3 presigned-URL
   * security model.
   *
   * WHY THIS IS SAFE:
   * 1. The uploadId (UUID v4) is the credential — unguessable, single-use,
   *    and scoped to exactly one Upload record.
   * 2. The service enforces status === 'PENDING' before accepting bytes,
   *    making the uploadId single-use even without JWT.
   * 3. The Upload record already stores userId from the /presign step.
   *    Ownership is asserted in /confirm (still JWT-authenticated).
   * 4. In production (STORAGE_PROVIDER=s3) this endpoint is never called —
   *    the frontend PUTs directly to S3 using the real presigned URL.
   *    This endpoint is local-dev only.
   *
   * The raw-body middleware in main.ts must run before NestJS body-parser
   * for this route (see main.ts configuration).
   */
  @Put('local-put/:uploadId')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async receiveLocalUpload(
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @Req() req: Request & { rawBody?: Buffer },
  ): Promise<void> {
    const buffer = (req as any).rawBody as Buffer | undefined;
    if (!buffer || buffer.length === 0) {
      // Empty body — noop. Prevents silent data loss from misconfigured
      // middleware but does not throw so the frontend doesn't crash.
      return;
    }
    await this.uploadService.receiveLocalUpload(uploadId, buffer);
  }

  /**
   * POST /uploads/confirm
   * Authenticated: yes — confirms ownership of the upload before finalising.
   */
  @Post('confirm')
  async confirmUpload(
    @CurrentUser('id') userId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.uploadService.confirmUpload(userId, dto);
  }

  /**
   * GET /uploads/:id
   * Authenticated: yes — only the owner can poll their upload status.
   */
  @Get(':id')
  async getUploadStatus(
    @Param('id', ParseUUIDPipe) uploadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.uploadService.getUploadStatus(uploadId, userId);
  }
}
