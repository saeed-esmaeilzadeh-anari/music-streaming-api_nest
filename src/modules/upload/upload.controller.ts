import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Req,
  RawBodyRequest,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard }    from '../../modules/auth/guards/jwt-auth.guard';
import { CurrentUser }     from '../../common/decorators/current-user.decorator';
import { UploadService }   from './upload.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * POST /uploads/presign
   *
   * Step 1 of the upload flow.
   * Returns { uploadId, uploadUrl, s3Key, expiresIn }.
   *
   * uploadUrl is:
   *   - A real AWS presigned PUT URL when STORAGE_PROVIDER=s3
   *   - PUT /uploads/local-put/:uploadId when STORAGE_PROVIDER=local
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
   * Local-provider only. Receives raw file bytes from the frontend and
   * stores them on disk. Mirrors the S3 presigned PUT contract exactly
   * (same HTTP verb, same Content-Type header, raw binary body) so the
   * frontend upload code requires zero changes between providers.
   *
   * IMPORTANT: this route must be registered with NestJS raw-body support.
   * In main.ts:
   *   app.use('/api/v1/uploads/local-put/*', (req, res, next) => {
   *     express.raw({ type: '*\/*', limit: '110mb' })(req, res, next);
   *   });
   * Or enable rawBody globally: NestFactory.create(AppModule, { rawBody: true })
   * and use the @RawBody() decorator.
   */
  @Put('local-put/:uploadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async receiveLocalUpload(
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
    @CurrentUser('id') userId: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<void> {
    const buffer = req.rawBody;
    if (!buffer || buffer.length === 0) {
      return; // empty body — treat as no-op (client-side bug)
    }
    await this.uploadService.receiveLocalUpload(uploadId, userId, buffer);
  }

  /**
   * POST /uploads/confirm
   *
   * Step 3 of the upload flow.
   * Works identically for both local and S3 providers.
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
   *
   * Poll upload status. Returns the Upload Prisma record.
   */
  @Get(':id')
  async getUploadStatus(
    @Param('id', ParseUUIDPipe) uploadId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.uploadService.getUploadStatus(uploadId, userId);
  }
}
