import { IncomingMessage } from "node:http";
export declare class WrappedRequest implements Request {
    #private;
    constructor(rootIRI: string, req: Request | IncomingMessage);
    get body(): ReadableStream;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    bytes(): Promise<Uint8Array<ArrayBuffer>>;
    clone(): Request;
    formData(): Promise<FormData>;
    json(): Promise<unknown>;
    text(): Promise<string>;
    get bodyUsed(): boolean;
    get cache(): RequestCache;
    get credentials(): RequestCredentials;
    get destination(): RequestDestination;
    get duplex(): undefined | 'half';
    get headers(): Headers;
    get integrity(): string;
    get isHistoryNavigation(): boolean;
    get keepalive(): boolean;
    get method(): string;
    get mode(): RequestMode;
    get redirect(): RequestRedirect;
    get referrer(): string;
    get referrerPolicy(): ReferrerPolicy;
    get signal(): AbortSignal | undefined;
    get url(): string;
}
