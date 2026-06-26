import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'worker_bot_tokens' })
export class WorkerBotToken {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 1000, unique: true, nullable: false })
    token!: string;

    @Column({ type: 'varchar', length: 16, nullable: false, default: 'active' })
    status!: 'active' | 'inactive';

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}
