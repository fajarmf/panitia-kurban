import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Voucher } from './voucher.entity';
import { User } from '../users/user.entity';

@Entity('scan_logs')
export class ScanLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'voucher_id' })
  voucherId: string;

  @ManyToOne(() => Voucher, (voucher) => voucher.scanLogs)
  @JoinColumn({ name: 'voucher_id' })
  voucher: Voucher;

  @Column({ name: 'scanned_by' })
  scannedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'scanned_by' })
  scannedBy: User;

  @Column()
  action: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'scanned_at' })
  scannedAt: Date;
}
