import { Repository } from 'typeorm';
import { WorkerBotToken } from './worker-bot-token.entity';
import { getDataSource } from './data-source';
import { logger } from '../logger';

export class WorkerBotTokenService {
    private repo: Repository<WorkerBotToken> | null = null;

    private async getRepo(): Promise<Repository<WorkerBotToken>> {
        if (this.repo) {
            return this.repo;
        }
        const ds = await getDataSource();
        this.repo = ds.getRepository(WorkerBotToken);
        return this.repo;
    }

    async addToken(token: string): Promise<WorkerBotToken> {
        const repo = await this.getRepo();
        const entity = repo.create({ token, status: 'active' });
        return repo.save(entity);
    }

    async setStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
        const repo = await this.getRepo();
        await repo.update(id, { status });
    }

    async listAll(): Promise<WorkerBotToken[]> {
        try {
            const repo = await this.getRepo();
            return repo.find({ order: { createdAt: 'ASC' } });
        } catch (error) {
            logger.error('Failed to list worker bot tokens', error);
            return [];
        }
    }

    async getActiveTokensWithIds(): Promise<Array<{ id: string; token: string }>> {
        try {
            const repo = await this.getRepo();
            const tokens = await repo.find({
                where: { status: 'active' },
                select: ['id', 'token'],
                order: { createdAt: 'ASC' },
            });
            return tokens.map((t) => ({ id: t.id, token: t.token }));
        } catch (error) {
            logger.error('Failed to load active worker bot tokens', error);
            return [];
        }
    }

    async findById(id: string): Promise<WorkerBotToken | null> {
        try {
            const repo = await this.getRepo();
            return repo.findOneBy({ id });
        } catch (error) {
            logger.error('Failed to find worker bot token', error);
            return null;
        }
    }
}
