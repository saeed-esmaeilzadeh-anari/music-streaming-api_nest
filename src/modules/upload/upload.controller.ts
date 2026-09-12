import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import {
  RequestUploadDto,
  PresignedUploadResponseDto,
  ConfirmUploadDto,
  UploadResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/constants/role.enum';

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ARTIST, Role.ADMIN, Role.LISTENER)
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presign')
  @ApiOperation({
    summary: 'Request a presigned S3 upload URL',
    description:
      'Returns a short-lived URL the client should PUT the raw file to directly. ' +
      'Call POST /uploads/confirm afterwards to trigger processing.',
  })
  @ApiResponse({ status: 201, type: PresignedUploadResponseDto })
  requestUpload(@CurrentUser('id') userId: string, @Body() dto: RequestUploadDto) {
    return this.uploadService.requestUpload(userId, dto);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm a completed S3 upload and trigger processing' })
  @ApiResponse({ status: 200, type: UploadResponseDto })
  confirmUpload(@CurrentUser('id') userId: string, @Body() dto: ConfirmUploadDto) {
    return this.uploadService.confirmUpload(userId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get the status of an upload' })
  @ApiResponse({ status: 200, type: UploadResponseDto })
  findOne(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.uploadService.findById(userId, id);
  }
}
