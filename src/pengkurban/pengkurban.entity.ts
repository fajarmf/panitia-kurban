import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { AnimalType } from '../common/enums/animal-type.enum';
import { PurchaseType } from '../common/enums/purchase-type.enum';

@Entity('pengkurban')
export class Pengkurban {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.pengkurban)
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: AnimalType, name: 'animal_type' })
  animalType: AnimalType;

  @Column({ type: 'enum', enum: PurchaseType, name: 'purchase_type' })
  purchaseType: PurchaseType;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
