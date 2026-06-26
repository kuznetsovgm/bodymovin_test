import assert from 'node:assert';
import { toSafeErrorDetails } from './safe-error-log';

// keeps generated sticker upload payloads out of serialized logs
(() => {
    const generatedSticker = Buffer.from('generated sticker file contents');
    const error = new Error('Bad Request: file is too big');
    Object.assign(error, {
        code: 400,
        response: {
            error_code: 400,
            description: 'Bad Request: file is too big',
        },
        on: {
            method: 'uploadStickerFile',
            payload: {
                sticker: generatedSticker,
            },
        },
    });

    const details = toSafeErrorDetails(error);
    const serializedDetails = JSON.stringify(details);

    assert.equal(details.message, 'Bad Request: file is too big');
    assert.equal(details.code, 400);
    assert.equal(details.telegramErrorCode, 400);
    assert.equal(details.telegramDescription, 'Bad Request: file is too big');
    assert.equal(serializedDetails.includes('generated sticker file contents'), false);
    assert.equal(serializedDetails.includes('payload'), false);
    assert.equal(serializedDetails.includes('sticker'), false);
})();
