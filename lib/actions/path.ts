import { makeURLPattern } from "../utils/makeURLPattern.js";

const paramsRe = /((?<s>[^\{\}]+)|({(?<t>[\?\#])?(?<v>[^}]+)}))/g

/**
 * Util class for handling paths defined using URI templates.
 * https://datatracker.ietf.org/doc/html/rfc6570.
 *
 * URI Templates are used instead of URLPattern format to conform to
 * JSON-ld https://schema.org/entryPoint needs. It is possible to add
 * regex syntax which would end up in the generated URLPattern making
 * it in conflict with the URITemplate. To be fixed...
 */
export class Path {
  #rootIRI: string;
  #template: string;
  #pattern: URLPattern;
  #normalized: string;
  #paramKeys: Set<string> = new Set();
  #queryKeys: Set<string> = new Set();
  #fragmentKeys: Set<string> = new Set();

  constructor(template: string, rootIRI: string) {
    this.#template = template;
    this.#rootIRI = rootIRI;

    [this.#pattern, this.#normalized] = this.#makePatterns()
  }

  get template(): string {
    return this.#template;
  }

  get pattern(): URLPattern {
    return this.#pattern;
  }

  get normalized(): string {
    return this.#normalized;
  }

  /**
   * Returns the location of the given key if it is present in
   * the path.
   */
  locationOf(key: string): 'params' | 'query' | 'fragment' | null {
    if (this.#paramKeys.has(key)) {
      return 'params';
    } else if (this.#queryKeys.has(key)) {
      return 'query';
    } else if (this.#fragmentKeys.has(key)) {
      return 'fragment';
    }

    return null;
  }

  #makePatterns(): [URLPattern, string] {
    const paramsRe = /((?<s>[^\{\}]+)|({(?<t>[\?\#])?(?<v>[^}]+)}))/g
    let pattern: string = '';
    let normalized: string = '';
    
    // assign values to key location sets for quick querying
    let match: RegExpExecArray | null;
    let foundQueryOrFragment = false;
    let index = 0;

    while ((match = paramsRe.exec(this.#template))) {
      const segment = match.groups?.s;
      const type = match.groups?.t;
      const value = match.groups?.v;

      if (type != null) {
        foundQueryOrFragment = true;
      }

      if (!foundQueryOrFragment && segment != null && type == null) {
        normalized += segment;
        pattern += segment;
      }
      
      if (value == null) {
        continue;
      }

      if (!foundQueryOrFragment && value != null) {
        index++;
        pattern += `:${value}`;
        normalized += `:value${index}`;
      }
    }

    return [
      makeURLPattern(pattern, this.#rootIRI),
      normalized,
    ];
  }
  
}
