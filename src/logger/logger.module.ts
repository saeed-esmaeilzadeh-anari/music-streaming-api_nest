import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<boolean>('app.isProduction');
        return {
          pinoHttp: {
            level: config.get<string>('app.env') === 'test' ? 'silent' : process.env.LOG_LEVEL ?? 'info',
            genReqId: (req: any) => req.headers['x-request-id'] ?? randomUUID(),
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                  },
                },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'req.body.passwordHash',
                'req.body.refreshToken',
              ],
              censor: '***REDACTED***',
            },
            customProps: () => ({ context: 'HTTP' }),
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
