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
    #autoLanguageTags;
    constructor(rootIRI, method, path, meta, reverseExtensions) {
        this.#rootIRI = rootIRI;
        this.#method = method;
        [
            this.#contentTypeActionMap,
            this.#extensionMap,
            this.#ctc,
            this.#autoLanguageTags,
        ] = this.#process(meta, reverseExtensions);
        if (this.#extensionMap.size > 0) {
            path += ':auto1(\\.[\\w\\-]+)?';
            // language tags are only enabled if file extensions are
            if (this.#autoLanguageTags) {
                path += ':auto2(\\.[a-zA-Z0-9\\-]+)?';
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
        let languageTag;
        if (res.pathname.groups.auto1 != null && res.pathname.groups.auto2 != null) {
            languageTag = res.pathname.groups.auto1.replace('.', '');
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
                languageTag,
            };
        }
        return null;
    }
    #process(meta, reverseExtensions) {
        let autoLanguageTags = false;
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
                if (!autoLanguageTags && meta[i].autoLanguageTags) {
                    autoLanguageTags = true;
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
            autoLanguageTags,
        ];
    }
}
