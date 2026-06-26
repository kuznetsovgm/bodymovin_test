import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateWorkerBotTokens1751020000000 implements MigrationInterface {
    name = 'CreateWorkerBotTokens1751020000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'worker_bot_tokens',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    isNullable: false,
                    default: 'gen_random_uuid()',
                },
                {
                    name: 'token',
                    type: 'varchar',
                    length: '1000',
                    isNullable: false,
                    isUnique: true,
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '16',
                    isNullable: false,
                    default: "'active'",
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
        await queryRunner.dropTable('worker_bot_tokens');
    }
}
