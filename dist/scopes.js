import { joinPaths } from "./utils/joinPaths.js";
import { ActionAuth } from "./actions/actions.js";
import { ActionMeta } from "./actions/meta.js";
import { HTTP } from "./registry.js";
export class Scope {
    #path;
    #serverTiming = false;
    #registry;
    #writer;
    #http;
    #children = [];
    #public = true;
    #propergateMeta;
    constructor({ path, serverTiming, registry, writer, propergateMeta, }) {
        this.#path = path;
        this.#serverTiming = serverTiming;
        this.#registry = registry;
        this.#writer = writer;
        this.#http = new HTTP(this);
        this.#propergateMeta = propergateMeta;
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
                console.warn(`Action ${meta.method}: ${meta.path} not fully implemented before processing`);
            }
            return meta.action != null;
        })
            .map((meta) => meta.action);
    }
    get handlers() {
        return this.actions.flatMap((action) => action.handlers);
    }
    public() {
        this.#public = true;
        return this;
    }
    private() {
        this.#public = false;
        return this;
    }
    /**
     * Creates any HTTP method.
     *
     * @param method The HTTP method.
     * @param name   Name for the action being produced.
     * @param path   Path the action responds to.
     */
    method(method, name, path) {
        const meta = new ActionMeta(this.#registry.rootIRI, method.toUpperCase(), name, path, this.#registry, this.#writer, this);
        meta.serverTiming = this.#serverTiming;
        this.#children.push(meta);
        this.#propergateMeta(meta);
        return new ActionAuth(meta);
    }
    url() {
        return joinPaths(this.#registry.rootIRI, this.#path);
    }
    finalize() {
        const partials = {
            '@id': this.url(),
            '@container': '@type',
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
            this.#registry.http.get('scope', this.#path)
                .public()
                .handle('application/ld+json', (ctx) => {
                ctx.body = JSON.stringify(partials);
            });
        }
        else {
            this.#registry.http.get('scope', this.#path)
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
                this.#registry.http.get('scope-action', joinPaths(this.url(), action.name))
                    .public()
                    .handle('application/ld+json', async (ctx) => {
                    ctx.body = JSON.stringify(await action.jsonld());
                });
            }
            else {
                this.#registry.http.get('scope-action', joinPaths(this.url(), action.name))
                    .private()
                    .handle('application/ld+json', async (ctx) => {
                    ctx.body = JSON.stringify(await action.jsonld());
                });
            }
        }
    }
}
