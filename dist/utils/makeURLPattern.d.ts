/**
 * Work-around for how URLPatterns are currently supported across runtimes.
 * This requires node v23 and above to run.
 */
export declare function makeURLPattern(pattern: string, baseURL: string): URLPattern;
