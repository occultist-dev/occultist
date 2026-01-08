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
    #extensionMap = new Map();
    #ctc;
    #autoLanguageCodes;
    constructor(rootIRI, method, path, meta, reverseExtensions) {
        this.#rootIRI = rootIRI;
        this.#method = method;
        [
            this.#contentTypeActionMap,
            this.#extensionMap,
            this.#ctc,
            this.#autoLanguageCodes,
        ] = this.#process(meta, reverseExtensions);
        if (this.#extensionMap.size > 0) {
            path += ':auto1(\\.[\\w\\-]+)?';
            if (this.#autoLanguageCodes) {
                path += ':auto2(\\.[\\w\\-]+)?';
            }
        }
        this.#urlPattern = makeURLPattern(path, rootIRI);
    }
    /**
     * @param method HTTP method to match against.
     * @param path The pathname of the request.
     * @param accept The accept cache of th erequest.
     */
    matches(method, path, accept) {
        if (method !== this.#method) {
            return null;
        }
        const res = this.#urlPattern.exec(path, this.#rootIRI);
        if (res == null) {
            return null;
        }
        let contentType;
        let languageCode;
        if (res.pathname.groups.auto1 != null && res.pathname.groups.auto2 != null) {
            languageCode = res.pathname.groups.auto1.replace('.', '');
            const fileExtension = res.pathname.groups.auto2.replace('.', '');
            contentType = this.#extensionMap.get(fileExtension);
            if (contentType == null)
                return null;
        }
        else if (res.pathname.groups.auto1 != null || res.pathname.groups.auto2 != null) {
            const autoParam = res.pathname.groups.auto1 ?? res.pathname.groups.auto2;
            const fileExtension = autoParam.replace('.', '');
            contentType = this.#extensionMap.get(fileExtension);
            if (contentType == null)
                return null;
        }
        if (contentType == null) {
            contentType = accept.negotiate(this.#ctc);
        }
        if (contentType == null)
            return null;
        const action = this.#contentTypeActionMap.get(contentType);
        if (action != null) {
            return {
                type: 'match',
                action,
                contentType,
                languageCode,
            };
        }
        return null;
    }
    #process(meta, reverseExtensions) {
        let autoLanguageCodes = false;
        const contentTypes = [];
        const contentTypeActionMap = new Map();
        const extensionMap = new Map();
        let l1 = meta.length;
        for (let i = 0; i < l1; i++) {
            const action = meta[i].action;
            let l2 = action.contentTypes.length;
            for (let j = 0; j < l2; j++) {
                const contentType = action.contentTypes[j];
                contentTypes.push(contentType);
                contentTypeActionMap.set(contentType, action);
                if (!autoLanguageCodes && meta[i].autoLanguageCodes) {
                    autoLanguageCodes = true;
                }
                if (meta[i].autoFileExtensions &&
                    reverseExtensions.has(contentType) &&
                    !extensionMap.has(contentType)) {
                    extensionMap.set(reverseExtensions.get(contentType), contentType);
                }
            }
        }
        return [
            contentTypeActionMap,
            extensionMap,
            new ContentTypeCache(contentTypes),
            autoLanguageCodes,
        ];
    }
}
