import type { ProblemDetails } from "./types.ts";
export declare class ProblemDetailsError extends Error {
    status: number;
    problemDetails: ProblemDetails;
    parentErr?: unknown;
    constructor(status: number, problemDetails: string | ProblemDetails, parentErr?: unknown);
    toContent(contentType?: string): string;
}
export declare class BadRequestError extends ProblemDetailsError {
    constructor(title: string);
}
export declare class NotFoundError extends ProblemDetailsError {
    constructor(title: string);
}
