/**
 * Creates a content type cache usually from the set of content type
 * options supported by an action or action set.
 */
export class ContentTypeCache {
    default;
    set;
    map = new Map();
    contentTypes;
    constructor(contentTypes) {
        this.default = contentTypes[0];
        this.contentTypes = contentTypes;
        this.set = new Set(contentTypes);
        this.set.add('*/*');
        this.map.set('*/*', contentTypes[0]);
        for (let index = 0; index < contentTypes.length; index++) {
            const contentType = contentTypes[index];
            const type = contentType.replace(/[^\/]*$/, '*');
            this.map.set(contentType, contentType);
            if (!this.map.has(type)) {
                this.set.add(type);
                this.map.set(type, contentType);
            }
        }
    }
    get [Symbol.toStringTag]() {
        return `[ContentTypeCache ${this.contentTypes.join(' ')}]`;
    }
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
export class Accept {
    acceptRe = /(?<ct>[^,;\s]+)(;\s?q=(?<q>(\d(\.\d+)|(.\d))))?/g;
    accept = [];
    acceptCache = new Set();
    //#acceptLanguage: string[] = [];
    //#acceptLanguageCache: Set<string> = new Set();
    //#acceptEncoding: string[] = [];
    //#acceptEncodingCache: Set<string> = new Set();
    constructor(accept, _acceptLanguage, _acceptEncoding) {
        [this.accept, this.acceptCache] = this.#process(accept);
        //[this.#acceptLanguage, this.#acceptLanguageCache] = this.#process(acceptLanguage);
        //[this.#acceptEncoding, this.#acceptEncodingCache] = this.#process(acceptEncoding);
    }
    /**
     * Creates an accept instance from a request or response instance
     */
    static from(req) {
        const accept = req.headers.get('Accept');
        const acceptLanguage = req.headers.get('Accept-Language');
        const acceptEncoding = req.headers.get('Accept-Encoding');
        return new Accept(accept, acceptLanguage, acceptEncoding);
    }
    debug() {
        return this.accept.join(' ');
    }
    /**
     * Negotiates against the cached set of content type options.
     *
     * @param contentType Content type cache built for an action.
     */
    negotiate(contentType) {
        if (this.accept.length === 0) {
            return contentType.default;
        }
        // TODO: check might be over-optimizing.
        const intersection = this.acceptCache.intersection(contentType.set);
        if (intersection.size === 0) {
            return null;
        }
        for (let index = 0; index < this.accept.length; index++) {
            const match = contentType.map.get(this.accept[index]);
            if (match != null) {
                return match;
            }
        }
        return null;
    }
    #process(header) {
        if (header == null) {
            return [[], new Set('*/*')];
        }
        let match;
        const items = [];
        const cache = new Set();
        while ((match = this.acceptRe.exec(header))) {
            const ct = match.groups?.ct;
            const q = Number(match.groups?.q ?? 1);
            cache.add(ct);
            items.push({ ct, q });
        }
        items.sort((a, b) => b.q - a.q);
        return [
            items.map(({ ct }) => ct),
            cache,
        ];
    }
    get [Symbol.toStringTag]() {
        return `[Accept ${this.accept.join(' ')}]`;
    }
}
