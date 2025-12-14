/**
 * Util class for handling paths defined using URI templates.
 * https://datatracker.ietf.org/doc/html/rfc6570.
 *
 * URI Templates are used instead of URLPattern format to conform to
 * JSON-ld https://schema.org/entryPoint needs. It is possible to add
 * regex syntax which would end up in the generated URLPattern making
 * it in conflict with the URITemplate. To be fixed...
 */
export declare class Path {
    #private;
    constructor(template: string, rootIRI: string);
    get template(): string;
    get pattern(): URLPattern;
    get normalized(): string;
    /**
     * Returns the location of the given key if it is present in
     * the path.
     */
    locationOf(key: string): 'params' | 'query' | 'fragment' | null;
}
