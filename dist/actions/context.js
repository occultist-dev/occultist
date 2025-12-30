class EditableContext {
    hit = false;
    etag;
    status;
    body;
    staticAssets = new Map();
    cspDirectives;
}
;
/**
 * Request context object.
 */
export class CacheContext {
    #editable = new EditableContext();
    req;
    method;
    url;
    contentType;
    public;
    authKey;
    auth;
    cacheRun;
    cacheOperation;
    action;
    registry;
    params;
    query;
    headers;
    constructor(args) {
        this.req = args.req;
        this.url = args.req.url;
        this.contentType = args.contentType;
        this.public = args.public;
        this.authKey = args.authKey;
        this.auth = args.auth;
        this.cacheRun = args.cacheOperation != null;
        this.cacheOperation = args.cacheOperation ?? null;
        this.action = args.handler.action;
        this.method = args.handler.action.method;
        this.registry = args.handler.action.registry;
        this.params = args.params;
        this.query = args.query;
        this.headers = args.headers;
        Object.freeze(this);
    }
    get hit() {
        return this.#editable.hit;
    }
    set hit(hit) {
        this.#editable.hit = hit;
    }
    get status() {
        return this.#editable.status;
    }
    set status(status) {
        this.#editable.status = status;
    }
    get body() {
        return this.#editable.body;
    }
    set body(body) {
        this.#editable.body = body;
    }
    get etag() {
        return this.#editable.etag;
    }
    set etag(etag) {
        this.#editable.etag = etag;
    }
    get [Symbol.toStringTag]() {
        return `action=${this.action.name} method=${this.method} contentType=${this.contentType}`;
    }
}
/**
 * Request context object.
 */
export class Context {
    #editable = new EditableContext();
    req;
    method;
    url;
    contentType;
    public = false;
    authKey;
    auth;
    cacheRun;
    cacheOperation;
    state = {};
    action;
    registry;
    params;
    query;
    payload;
    headers;
    constructor(args) {
        this.req = args.req;
        this.url = args.req.url;
        this.contentType = args.contentType;
        this.public = args.public;
        this.authKey = args.authKey;
        this.auth = args.auth;
        this.cacheOperation = args.cacheOperation ?? null;
        this.cacheRun = args.cacheOperation != null;
        this.action = args.handler.action;
        this.method = args.handler.action.method;
        this.registry = args.handler.action.registry;
        this.params = args.params;
        this.query = args.query;
        this.payload = args.payload;
        this.headers = args.headers;
        Object.freeze(this);
        Object.freeze(this.auth);
    }
    get status() {
        return this.#editable.status;
    }
    set status(status) {
        this.#editable.status = status;
    }
    get body() {
        return this.#editable.body;
    }
    set body(body) {
        this.#editable.body = body;
    }
    /**
     * Returns the public facing URL of a static asset using its
     * static file alias.
     *
     * @param assetAlias The alias of the static asset.
     * @param cspDirective A directive to add the asset to when generating CSP headers.
     * @returns The public facing URL of the static asset.
     */
    useAsset(assetAlias, cspDirective) {
        const staticAlias = assetAlias.split('/')[0];
        const extension = this.registry.getStaticExtension(staticAlias);
        if (extension == null)
            return;
        const asset = extension.getAsset(assetAlias);
        if (asset == null)
            return;
        this.#editable.staticAssets.set(asset.alias, asset);
        if (typeof cspDirective === 'string' && cspDirective != null) {
            if (!this.#editable.cspDirectives.has(cspDirective)) {
                this.#editable.cspDirectives.set(cspDirective, [asset.alias]);
            }
            else {
                this.#editable.cspDirectives.get(cspDirective).push(asset.alias);
            }
        }
        return asset;
    }
    get [Symbol.toStringTag]() {
        return `action=${this.action.name} method=${this.method} contentType=${this.contentType}`;
    }
}
