class EditableContext {
    hit = false;
    etag;
    status;
    body;
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
    public = false;
    authKey;
    auth;
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
        this.cacheOperation = args.cacheOperation;
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
    get [Symbol.toStringTag]() {
        return `action=${this.action.name} method=${this.method} contentType=${this.contentType}`;
    }
}
