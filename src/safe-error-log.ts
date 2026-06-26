export type SafeErrorDetails = {
    name?: string;
    message: string;
    stack?: string;
    code?: string | number;
    telegramErrorCode?: number;
    telegramDescription?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : undefined;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
}

function asStringOrNumber(value: unknown): string | number | undefined {
    return typeof value === 'string' || typeof value === 'number'
        ? value
        : undefined;
}

export function toSafeErrorDetails(error: unknown): SafeErrorDetails {
    if (error instanceof Error) {
        const errorRecord = asRecord(error);
        const response = asRecord(errorRecord?.response);

        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: asStringOrNumber(errorRecord?.code),
            telegramErrorCode: asNumber(response?.error_code),
            telegramDescription: asString(response?.description),
        };
    }

    return {
        message: typeof error === 'string' ? error : String(error),
    };
}
