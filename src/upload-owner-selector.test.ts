import assert from 'node:assert';
import { UploadOwnerSelector } from './upload-owner-selector';

type StubUserService = {
    calls: number;
    getUploadOwnerIds: () => Promise<number[]>;
};

function createUserService(ownerIds: number[]): StubUserService {
    return {
        calls: 0,
        async getUploadOwnerIds() {
            this.calls += 1;
            return ownerIds;
        },
    };
}

// returns one cached upload owner id at a time in round-robin order
(async () => {
    const userService = createUserService([10, 20, 30]);
    const selector = new UploadOwnerSelector(userService);

    assert.equal(await selector.getNextOwnerId(), 10);
    assert.equal(await selector.getNextOwnerId(), 20);
    assert.equal(await selector.getNextOwnerId(), 30);
    assert.equal(await selector.getNextOwnerId(), 10);
    assert.equal(userService.calls, 1);
})();

// returns null when no upload owners exist
(async () => {
    const userService = createUserService([]);
    const selector = new UploadOwnerSelector(userService);

    assert.equal(await selector.getNextOwnerId(), null);
})();
