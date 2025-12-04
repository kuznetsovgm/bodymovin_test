import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './user.entity';
import { logger } from '../logger';
import { CreateUsers1700000000000 } from './migrations/1700000000000-CreateUsers';

const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres';
const PG_DB = process.env.PG_DB || 'postgres';
const PG_SYNC = process.env.PG_SYNC === 'true';

export const dataSource = new DataSource({
    type: 'postgres',
    host: PG_HOST,
    port: PG_PORT,
    username: PG_USER,
    password: PG_PASSWORD,
    database: PG_DB,
    entities: [User],
    synchronize: PG_SYNC,
    logging: false,
    migrations: [CreateUsers1700000000000],
    migrationsRun: true,
});

let initPromise: Promise<DataSource> | null = null;

export async function getDataSource(): Promise<DataSource> {
    if (dataSource.isInitialized) {
        return dataSource;
    }

    if (!initPromise) {
        initPromise = dataSource.initialize().then((ds) => {
            logger.info('Connected to PostgreSQL', {
                host: PG_HOST,
                port: PG_PORT,
                db: PG_DB,
                sync: PG_SYNC,
            });
            return ds;
        }).catch((err) => {
            initPromise = null;
            logger.error('Failed to connect to PostgreSQL', err);
            throw err;
        });
    }

    return initPromise;
}
