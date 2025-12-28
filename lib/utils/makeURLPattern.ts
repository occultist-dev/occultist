import url from 'node:url';


type URLPatternConstructor = new (input: string, baseURL: string) => URLPattern;

/**
 * Work-around for how URLPatterns are currently supported across runtimes.
 * This requires node v23 and above to run.
 */
export function makeURLPattern(pattern: string, baseURL: string): URLPattern {
  if (typeof URLPattern === 'undefined') {
    const URLPattern = (url as unknown as { URLPattern: URLPatternConstructor }).URLPattern;

    return new URLPattern(pattern, baseURL);
  }

  return new URLPattern(pattern, baseURL);
}
