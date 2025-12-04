import { Repository } from 'typeorm';
import { Context } from 'telegraf';
import { User } from './user.entity';
import { getDataSource } from './data-source';
import { logger } from '../logger';

export class UserService {
    private repo: Repository<User> | null = null;

    private async getRepo(): Promise<Repository<User>> {
        if (this.repo) {
            return this.repo;
        }
        const ds = await getDataSource();
        this.repo = ds.getRepository(User);
        return this.repo;
    }

    async upsertFromContext(ctx: Context): Promise<void> {
        if (!ctx.from) {
            return;
        }

        try {
            const repo = await this.getRepo();
            const payload: Partial<User> = {
                telegramId: BigInt(ctx.from.id),
                username: ctx.from.username || null,
                firstName: ctx.from.first_name || null,
                lastName: ctx.from.last_name || null,
                languageCode: (ctx.from as any).language_code || null,
            };
            await repo.save(repo.create(payload));
        } catch (error) {
            logger.error('Failed to upsert user', error);
        }
    }
}
