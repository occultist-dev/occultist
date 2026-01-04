

/**
 * Maps the URL of the request to the root IRI.
 */
export function normalizeURL(rootURL: string, urlStr: string): string {
    const sourceURL = new URL(urlStr);
    const targetURL = new URL(rootURL);
    
    targetURL.pathname = sourceURL.pathname;
    targetURL.search = sourceURL.search;
    targetURL.hash = sourceURL.hash;

    return targetURL.toString();
}
