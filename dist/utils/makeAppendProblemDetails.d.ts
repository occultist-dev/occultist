import type { ProblemDetailsParam, ProblemDetails } from '../types.js';
export type AppendProblemDetails = (args: {
    status: number;
    title?: string;
    detail?: string;
    param?: ProblemDetailsParam;
}) => void;
export type ProblemDetailsParamsRefs = {
    title?: string;
    detail?: string;
    httpStatus?: number;
    problemDetails?: ProblemDetails;
};
export declare function makeAppendProblemDetails(refs: ProblemDetailsParamsRefs): AppendProblemDetails;
