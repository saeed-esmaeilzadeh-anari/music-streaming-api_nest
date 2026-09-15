import { Injectable } from '@nestjs/common';
import { Prisma, Upload } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UploadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.UploadCreateInput): Promise<Upload> {
    return this.prisma.upload.create({ data });
  }

  findById(id: string): Promise<Upload | null> {
    return this.prisma.upload.findUnique({ where: { id } });
  }

  findByS3Key(s3Key: string): Promise<Upload | null> {
    return this.prisma.upload.findUnique({ where: { s3Key } });
  }

  update(id: string, data: Prisma.UploadUpdateInput): Promise<Upload> {
    return this.prisma.upload.update({ where: { id }, data });
  }
}
