export type RouteMatchResult = {
    path: Record<string, string>;
    query: Record<string, undefined | string | string[]>;
};
/**
 * Util class for handling paths defined using URI templates.
 * https://datatracker.ietf.org/doc/html/rfc6570.
 *
 * URI Templates are used instead of URLPattern format to conform to
 * JSON-ld https://schema.org/entryPoint needs. It is possible to add
 * regex syntax which would end up in the generated URLPattern making
 * it in conflict with the URITemplate. To be fixed...
 */
export declare class Route {
    #private;
    constructor(template: string, rootURL: string, autoLanguageTag: boolean, autoFileExtension: boolean);
    get template(): string;
    get regexp(): RegExp;
    get pattern(): URLPattern;
    /**
     * A normalized form of the url template where arguments are named
     * in order of appearance instead of with the provided names. This
     * allows two paths to be compared based of their ability to match
     * to the same request.
     */
    get normalized(): string;
    /**
     * Matches a URL against this route and returns the
     * path and query values.
     *
     * @param url The URL to match.
     */
    match(url: string | URL): undefined | RouteMatchResult;
    /**
     * Returns the location of the given key if it is present in
     * the path.
     */
    locationOf(key: string): 'path' | 'query' | 'fragment' | null;
}
