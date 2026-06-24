import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { UsersRepository } from './repositories/users.repository';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Used internally by AuthService during registration. Throws if the
   * email or username is already taken so the caller can surface a clean
   * 409 instead of relying on a raw Prisma unique-constraint error.
   */
  async create(dto: CreateUserDto) {
    const existing = await this.usersRepository.findByEmailOrUsername(
      dto.email,
      dto.username,
    );
    if (existing) {
      const field = existing.email === dto.email ? 'email' : 'username';
      throw new ConflictException(`A user with this ${field} already exists.`);
    }

    const user = await this.usersRepository.create({
      email: dto.email,
      username: dto.username,
      passwordHash: dto.passwordHash,
      role: dto.role,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    return this.toResponseDto(user);
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.usersRepository.findById(id);
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found.');
    }
    return this.toResponseDto(user);
  }

  /**
   * Returns the raw entity (including passwordHash) - used only by
   * AuthService for credential verification. Never expose this via a
   * controller without mapping through toResponseDto first.
   */
  async findByEmailForAuth(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async findByIdForAuth(id: string) {
    return this.usersRepository.findById(id);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    await this.findById(id); // ensures existence + not soft-deleted
    const updated = await this.usersRepository.update(id, dto);
    return this.toResponseDto(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findById(id);
    await this.usersRepository.softDelete(id);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResultDto<UserResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [users, totalItems] = await Promise.all([
      this.usersRepository.findMany({
        skip: query.skip,
        take: limit,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
      this.usersRepository.count({ deletedAt: null }),
    ]);

    return new PaginatedResultDto(
      users.map((u) => this.toResponseDto(u)),
      totalItems,
      page,
      limit,
    );
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      isEmailVerified: true,
      status: 'ACTIVE',
    });
  }

  private toResponseDto(user: Record<string, unknown>): UserResponseDto {
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }
}
