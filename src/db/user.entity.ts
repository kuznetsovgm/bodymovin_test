import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

const telegramIdTransformer = {
    from: (v: string | number | bigint | null) => (!!v ? BigInt(v) : null),
    to: (v: string | number | bigint | null) => (!!v ? v.toString() : null),
};

@Entity({ name: 'users' })
export class User {
    @PrimaryColumn({
        primary: true,
        nullable: false,
        unique: true,
        unsigned: true,
        type: 'bigint',
        transformer: telegramIdTransformer,
    })
    telegramId!: bigint;

    @Column({ type: 'varchar', length: 255, nullable: true })
    username!: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    firstName!: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    lastName!: string | null;

    @Column({ type: 'varchar', length: 16, nullable: true })
    languageCode!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt!: Date;
}
