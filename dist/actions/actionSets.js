import { ContentTypeCache } from "../accept.js";
import { makeURLPattern } from "../utils/makeURLPattern.js";
/**
 * A set of actions grouped by having equal methods and equivilent paths.
 */
export class ActionSet {
    #rootIRI;
    #method;
    #urlPattern;
    #contentTypeActionMap;
    #ctc;
    constructor(rootIRI, method, path, meta) {
        this.#rootIRI = rootIRI;
        this.#method = method;
        this.#urlPattern = makeURLPattern(path, rootIRI);
        [this.#contentTypeActionMap, this.#ctc] = this.#process(meta);
    }
    matches(method, path, accept) {
        if (method !== this.#method) {
            return null;
        }
        else if (!this.#urlPattern.test(path, this.#rootIRI)) {
            return null;
        }
        const contentType = accept.negotiate(this.#ctc);
        const action = this.#contentTypeActionMap.get(contentType);
        if (contentType != null && action != null) {
            return {
                type: 'match',
                action,
                contentType,
            };
        }
        return null;
    }
    #process(meta) {
        const contentTypes = [];
        const contentTypeActionMap = new Map();
        for (let i = 0; i < meta.length; i++) {
            const action = meta[i].action;
            for (let j = 0; j < action.contentTypes.length; j++) {
                const contentType = action.contentTypes[j];
                contentTypes.push(contentType);
                contentTypeActionMap.set(contentType, action);
            }
        }
        return [contentTypeActionMap, new ContentTypeCache(contentTypes)];
    }
}
