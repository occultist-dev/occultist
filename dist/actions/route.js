import { makeURLPattern } from "../utils/makeURLPattern.js";
const paramsRe = /((?<s>[^\{\}]+)|({(?<t>[\?\#\.])?(?<v>[^}]+)}))/g;
const languageCodeReStr = '(?:\\.(?<languageCode>[a-zA-Z0-9][a-zA-Z0-9\\-]+))';
const fileExtensionReStr = '(?:\\.(?<fileExtension>[a-z][a-zA-Z0-9\\-]+))';
/**
 * Util class for handling paths defined using URI templates.
 * https://datatracker.ietf.org/doc/html/rfc6570.
 *
 * URI Templates are used instead of URLPattern format to conform to
 * JSON-ld https://schema.org/entryPoint needs. It is possible to add
 * regex syntax which would end up in the generated URLPattern making
 * it in conflict with the URITemplate. To be fixed...
 */
export class Route {
    #rootURL;
    #template;
    #regexp;
    #pattern;
    #normalized;
    #pathKeys = new Set();
    #queryKeys = new Set();
    #fragmentKeys = new Set();
    #autoLanguageCode;
    #autoFileExtension;
    constructor(template, rootURL, autoLanguageCode, autoFileExtension) {
        this.#template = template;
        this.#rootURL = rootURL;
        this.#autoLanguageCode = autoLanguageCode;
        this.#autoFileExtension = autoFileExtension;
        [this.#pattern, this.#normalized] = this.#makePatterns();
    }
    get template() {
        return this.#template;
    }
    get regexp() {
        return this.#regexp;
    }
    get pattern() {
        return this.#pattern;
    }
    /**
     * A normalized form of the url template where arguments are named
     * in order of appearance instead of with the provided names. This
     * allows two paths to be compared based of their ability to match
     * to the same request.
     */
    get normalized() {
        return this.#normalized;
    }
    /**
     * Matches a URL against this route and returns the
     * path and query values.
     *
     * @param url The URL to match.
     */
    match(url) {
        if (!url.toString().startsWith(this.#rootURL)) {
            return;
        }
        const url2 = new URL(url);
        const match = this.#regexp.exec(url2.pathname);
        if (match?.groups == null) {
            return;
        }
        const path = Object.create(null);
        const query = Object.create(null);
        for (const [key, value] of Object.entries(match.groups)) {
            path[key] = value;
        }
        for (const key of url2.searchParams.keys()) {
            const value = url2.searchParams.getAll(key);
            if (value.length > 1) {
                query[key] = value;
            }
            else {
                query[key] = value[0];
            }
        }
        return { path, query };
    }
    /**
     * Returns the location of the given key if it is present in
     * the path.
     */
    locationOf(key) {
        if (this.#pathKeys.has(key)) {
            return 'path';
        }
        else if (this.#queryKeys.has(key)) {
            return 'query';
        }
        else if (this.#fragmentKeys.has(key)) {
            return 'fragment';
        }
        return null;
    }
    #makePatterns() {
        let pattern = '';
        let normalized = '';
        // assign values to key location sets for quick querying
        let match;
        let foundQueryOrFragment = false;
        let index = 0;
        let template = '';
        let regexpStr = '^';
        while ((match = paramsRe.exec(this.#template))) {
            const segment = match.groups?.s;
            const type = match.groups?.t;
            const value = match.groups?.v;
            if (type != null && type !== '.' && !foundQueryOrFragment) {
                foundQueryOrFragment = true;
                if (this.#autoLanguageCode && this.#autoFileExtension) {
                    regexpStr += `(${languageCodeReStr}?${fileExtensionReStr})?`;
                    template += '{.languageCode,fileExtension}';
                }
                else if (this.#autoFileExtension) {
                    regexpStr += fileExtensionReStr + '?';
                    template += '{.fileExtension}';
                }
            }
            template += match[0];
            if (!foundQueryOrFragment && segment != null && type == null) {
                regexpStr += segment;
                normalized += segment;
                pattern += segment;
            }
            if (value == null) {
                continue;
            }
            if (type === '.' && !foundQueryOrFragment && value != null) {
                index++;
                regexpStr += `(\\.(?<${value}>[^\\/\\.]+))`;
                pattern += `.:${value}`;
                normalized += `.:value${index}`;
                this.#pathKeys.add(value);
            }
            else if (!foundQueryOrFragment && value != null) {
                index++;
                regexpStr += `(?<${value}>[^\\/\\.]+)`;
                pattern += `:${value}`;
                normalized += `:value${index}`;
                this.#pathKeys.add(value);
            }
        }
        if (!foundQueryOrFragment) {
            if (this.#autoLanguageCode && this.#autoFileExtension) {
                regexpStr += `(${languageCodeReStr}?${fileExtensionReStr})`;
                template += '{.languageCode,fileExtension}';
                this.#pathKeys.add('languageCode');
                this.#pathKeys.add('fileExtension');
            }
            else if (this.#autoFileExtension) {
                regexpStr += fileExtensionReStr;
                template += '{.fileExtension}';
                this.#pathKeys.add('fileExtension');
            }
        }
        regexpStr += '$';
        this.#template = template;
        this.#regexp = new RegExp(regexpStr);
        return [
            makeURLPattern(pattern, this.#rootURL),
            normalized,
        ];
    }
}
