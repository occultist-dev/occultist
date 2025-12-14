/**
 * Maps the URL of the request to the root IRI.
 */
export function normalizeURL(rootIRI, urlStr) {
    const sourceURL = new URL(urlStr);
    const targetURL = new URL(rootIRI);
    targetURL.pathname = sourceURL.pathname;
    targetURL.search = sourceURL.search;
    targetURL.hash = sourceURL.hash;
    return targetURL.toString();
}
