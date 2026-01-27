import { joinPaths } from "./utils/joinPaths.js";
import { ActionAuth } from "./actions/actions.js";
import { ActionCore } from "./actions/core.js";
import { HTTP } from "./registry.js";
export class Scope {
    #path;
    #recordServerTiming;
    #registry;
    #writer;
    #http;
    #children = [];
    #public = true;
    #auth;
    #propergateMeta;
    #autoLanguageTags;
    #autoFileExtensions;
    constructor(path, registry, writer, propergateMeta, recordServerTiming, autoLanguageTags, autoFileExtensions) {
        this.#path = path;
        this.#registry = registry;
        this.#writer = writer;
        this.#http = new HTTP(this);
        this.#propergateMeta = propergateMeta;
        this.#recordServerTiming = recordServerTiming;
        this.#autoLanguageTags = autoLanguageTags;
        this.#autoFileExtensions = autoFileExtensions;
    }
    get path() {
        return this.#path;
    }
    get registry() {
        return this.#registry;
    }
    get http() {
        return this.#http;
    }
    get actions() {
        return this.#children
            .filter((meta) => {
            if (meta.action == null) {
                console.warn(`Action ${meta.method}: ${meta.route} not fully implemented before processing`);
            }
            return meta.action != null;
        })
            .map((meta) => meta.action);
    }
    get handlers() {
        return this.actions.flatMap((action) => action.handlers);
    }
    public(authMiddleware) {
        this.#public = true;
        this.#auth = authMiddleware;
        return this;
    }
    private(authMiddleware) {
        this.#public = false;
        this.#auth = authMiddleware;
        return this;
    }
    /**
     * Creates an action for any HTTP method.
     *
     * @param method The HTTP method name.
     * @param name   Name for the action being produced.
     * @param path   Path the action responds to.
     */
    endpoint(method, path, args) {
        const meta = new ActionCore(this.registry.rootIRI, method, args?.name, path, this.#registry, this.#writer, this, args?.autoLanguageTags ?? args?.autoRouteParams ?? this.#autoLanguageTags, args?.autoFileExtensions ?? args?.autoRouteParams ?? this.#autoFileExtensions, this.#recordServerTiming);
        meta.recordServerTiming = this.#recordServerTiming;
        this.#children.push(meta);
        return new ActionAuth(meta);
    }
    url() {
        return joinPaths(this.#registry.rootIRI, this.#path);
    }
    finalize() {
        const partials = {
            '@id': this.url(),
        };
        for (let index = 0; index < this.#children.length; index++) {
            const meta = this.#children[index];
            const action = meta.action;
            if (action == null || action.type == null) {
                continue;
            }
            const partial = action.jsonldPartial();
            if (partial == null) {
                continue;
            }
            partials[partial['@type']] = partial;
        }
        if (this.#public) {
            this.#registry.http.get(this.#path)
                .public()
                .handle('application/ld+json', (ctx) => {
                ctx.body = JSON.stringify(partials);
            });
        }
        else {
            this.#registry.http.get(this.#path)
                .public()
                .handle('application/ld+json', (ctx) => {
                ctx.body = JSON.stringify(partials);
            });
        }
        for (let index = 0; index < this.#children.length; index++) {
            const action = this.#children[index].action;
            if (action == null || action.type == null) {
                continue;
            }
            if (this.#public) {
                this.#registry.http.get(joinPaths(this.url(), action.name))
                    .public(this.#auth)
                    .handle('application/ld+json', async (ctx) => {
                    ctx.body = JSON.stringify(await action.jsonld());
                });
            }
            else {
                this.#registry.http.get(joinPaths(this.url(), action.name))
                    .private(this.#auth)
                    .handle('application/ld+json', async (ctx) => {
                    ctx.body = JSON.stringify(await action.jsonld());
                });
            }
        }
    }
}
