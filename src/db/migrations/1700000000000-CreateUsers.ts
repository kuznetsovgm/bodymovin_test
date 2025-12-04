import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsers1700000000000 implements MigrationInterface {
    name = 'CreateUsers1700000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'users',
            columns: [
                {
                    name: 'telegramId',
                    type: 'bigint',
                    isNullable: false,
                    isPrimary: true,
                    isUnique: true,
                },
                {
                    name: 'username',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'firstName',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'lastName',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'languageCode',
                    type: 'varchar',
                    length: '16',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamptz',
                    isNullable: false,
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updatedAt',
                    type: 'timestamptz',
                    isNullable: false,
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                },
            ],
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('users');
    }
}
