/**
 * Creates a content type cache usually from the set of content type
 * options supported by an action or action set.
 */
export declare class ContentTypeCache {
    default: string;
    set: Set<string>;
    map: Map<string, string>;
    contentTypes: string[];
    constructor(contentTypes: string[]);
    get [Symbol.toStringTag](): string;
}
/**
 * This accept object is created from a request before any content negotiation
 * begins allowing all subsequent checks to re-use the same caches header values.
 *
 * @todo Implement support for all accept headers.
 *
 * @param accept - The value of the request's accept header.
 * @param acceptLanguage - The value of the request's accept-language header.
 * @param acceptEncoding - The value of the request's accept-encoding header.
 */
export declare class Accept {
    #private;
    acceptRe: RegExp;
    accept: string[];
    acceptCache: Set<string>;
    constructor(accept: string | null, _acceptLanguage: string | null, _acceptEncoding: string | null);
    /**
     * Creates an accept instance from a request or response instance
     */
    static from(req: Request): Accept;
    debug(): string;
    /**
     * Negotiates against the cached set of content type options.
     *
     * @param contentType Content type cache built for an action.
     */
    negotiate(contentType: ContentTypeCache): null | string;
    get [Symbol.toStringTag](): string;
}
