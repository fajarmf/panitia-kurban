import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Voucher } from '../vouchers/voucher.entity';
import { Pengkurban } from '../pengkurban/pengkurban.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  year: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'logo_path', nullable: true })
  logoPath: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Voucher, (voucher) => voucher.event)
  vouchers: Voucher[];

  @OneToMany(() => Pengkurban, (pengkurban) => pengkurban.event)
  pengkurban: Pengkurban[];
}
