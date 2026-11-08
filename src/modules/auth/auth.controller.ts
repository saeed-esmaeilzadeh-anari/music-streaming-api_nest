import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, AuthResponseDto } from './dto';
import { Public, CurrentUser } from '../../common/decorators';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshJwtPayload } from './types/jwt-payload.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new listener account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.extractMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractMeta(req));
  }

  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a valid refresh token for a new token pair' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired' })
  refresh(
    @Body() _dto: RefreshTokenDto,
    @CurrentUser() payload: RefreshJwtPayload & { refreshToken: string },
    @Req() req: Request,
  ) {
    return this.authService.refreshTokens(payload, this.extractMeta(req));
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a single refresh token (logout from this device)' })
  @ApiResponse({ status: 204 })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiOperation({ summary: "List the current user's active sessions without exposing tokens" })
  @ApiResponse({ status: 200, description: 'Active session metadata' })
  listSessions(@CurrentUser('id') userId: string) {
    return this.authService.listActiveSessions(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  @ApiOperation({ summary: "Revoke one of the current user's sessions" })
  @ApiResponse({ status: 204 })
  revokeSession(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ) {
    return this.authService.revokeSession(userId, sessionId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  @ApiOperation({ summary: 'Revoke all refresh tokens for the current user (logout everywhere)' })
  @ApiResponse({ status: 204 })
  logoutAll(@CurrentUser('id') userId: string) {
    return this.authService.logoutAllDevices(userId);
  }

  private extractMeta(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}
