type UploadOwnerSource = {
    getUploadOwnerIds(): Promise<number[]>;
};

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

export class UploadOwnerSelector {
    private ownerIdsCache: number[] | null = null;
    private ownerIdsCacheTime = 0;
    private nextIndex = 0;

    constructor(
        private readonly source: UploadOwnerSource,
        private readonly cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    ) {}

    async getNextOwnerId(): Promise<number | null> {
        const ownerIds = await this.getOwnerIds();
        if (ownerIds.length === 0) {
            return null;
        }

        const index = this.nextIndex % ownerIds.length;
        this.nextIndex = (index + 1) % ownerIds.length;

        return ownerIds[index];
    }

    private async getOwnerIds(): Promise<number[]> {
        const now = Date.now();
        if (this.ownerIdsCache && now - this.ownerIdsCacheTime < this.cacheTtlMs) {
            return this.ownerIdsCache;
        }

        const ownerIds = await this.source.getUploadOwnerIds();
        this.ownerIdsCache = ownerIds;
        this.ownerIdsCacheTime = now;

        return ownerIds;
    }
}
