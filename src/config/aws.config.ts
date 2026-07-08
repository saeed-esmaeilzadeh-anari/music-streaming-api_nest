import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3Bucket: process.env.AWS_S3_BUCKET,
  presignedUrlExpirySeconds: parseInt(process.env.AWS_S3_PRESIGNED_URL_EXPIRY_SECONDS ?? '900', 10),
  publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL,
}));
