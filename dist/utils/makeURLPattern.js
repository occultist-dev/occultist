import url from 'node:url';
/**
 * Work-around for how URLPatterns are currently supported across runtimes.
 * This requires node v23 and above to run.
 */
export function makeURLPattern(pattern, baseURL) {
    if (typeof URLPattern === 'undefined') {
        const URLPattern = url.URLPattern;
        return new URLPattern(pattern, baseURL);
    }
    return new URLPattern(pattern, baseURL);
}
