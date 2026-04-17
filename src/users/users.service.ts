import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' },
      select: ['id', 'username', 'fullName', 'role', 'isActive', 'createdAt'],
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('Username sudah digunakan');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      ...dto,
      password: hashedPassword,
    });
    const saved = await this.usersRepository.save(user);
    const { password, ...result } = saved;
    return result as User;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    Object.assign(user, dto);
    const saved = await this.usersRepository.save(user);
    const { password, ...result } = saved;
    return result as User;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async count(): Promise<number> {
    return this.usersRepository.count({ where: { isActive: true } });
  }
}
