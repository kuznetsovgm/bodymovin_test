import { Context, MiddlewareFn } from 'telegraf';
import { UserService } from './user-service';

export function createSaveUserMiddleware(userService: UserService): MiddlewareFn<Context> {
    return async (ctx: Context, next: () => Promise<unknown>) => {
        await userService.upsertFromContext(ctx);
        return next();
    };
}
