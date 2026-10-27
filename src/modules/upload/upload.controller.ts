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
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadService } from './upload.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard) // default: all routes require JWT
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /uploads/presign
   * Authenticated: yes — we need userId to create the Upload record.
   */
  @Post('presign')
  async requestPresignedUrl(@CurrentUser('id') userId: string, @Body() dto: RequestUploadDto) {
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
    @Req() req: Request & { rawBody?: Buffer; body?: unknown },
  ): Promise<void> {
    console.log('[LOCAL PUT CONTROLLER HIT]', {
      uploadId,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      rawBodyIsBuffer: Buffer.isBuffer(req.rawBody),
      bodyLength: Buffer.isBuffer(req.body)
        ? req.body.length
        : Buffer.isBuffer(req.rawBody)
          ? req.rawBody.length
          : 0,
    });

    const buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.isBuffer(req.rawBody)
        ? req.rawBody
        : undefined;

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('No file bytes received by the local upload endpoint.');
    }

    await this.uploadService.receiveLocalUpload(uploadId, buffer);
  }

  /**
   * POST /uploads/confirm
   * Authenticated: yes — confirms ownership of the upload before finalising.
   */
  @Post('confirm')
  async confirmUpload(@CurrentUser('id') userId: string, @Body() dto: ConfirmUploadDto) {
    return this.uploadService.confirmUpload(userId, dto);
  }

  /**
   * Stable public media URL for published tracks. The controller redirects
   * to a fresh short-lived storage URL on each request, so the URL saved on
   * the Track record does not expire.
   */
  @Get('tracks/:trackId/audio')
  @Public()
  async redirectTrackAudio(
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Res() response: Response,
  ): Promise<void> {
    const targetUrl = await this.uploadService.getTrackAudioRedirectUrl(trackId);
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.redirect(302, targetUrl);
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
