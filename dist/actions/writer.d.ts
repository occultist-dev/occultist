import { ServerResponse } from 'node:http';
import type { HintArgs } from './types.ts';
export type ResponseTypes = ServerResponse | Response;
export type ResponseBody = BodyInit;
export interface HTTPWriter {
    mergeHeaders(headers: HeadersInit): void;
    writeEarlyHints(args: HintArgs): void;
    mergeHeaders(headers: HeadersInit): void;
    writeHead(status: number, headers?: Headers): void;
    writeBody(body: ResponseBody): void;
    response(): ResponseTypes;
}
export declare class ResponseWriter implements HTTPWriter {
    #private;
    constructor(res?: ServerResponse);
    /**
     * Writes early hints to the request.
     *
     * Runtimes which do not support writing early hints will have the
     * headers added to the headers of the main response instead.
     */
    writeEarlyHints(args: HintArgs): void;
    mergeHeaders(headersInit: HeadersInit): void;
    writeHead(status: number, headers?: Headers): void;
    writeBody(body: ResponseBody): void;
    response(): Response | ServerResponse;
}
