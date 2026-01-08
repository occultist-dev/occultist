import { makeURLPattern } from "../utils/makeURLPattern.ts";

const paramsRe = /((?<s>[^\{\}]+)|({(?<t>[\?\#\.])?(?<v>[^}]+)}))/g
const languageTagReStr = '(?:\\.(?<languageTag>[a-zA-Z0-9][a-zA-Z0-9\\-]+))';
const fileExtensionReStr = '(?:\\.(?<fileExtension>[a-z][a-zA-Z0-9\\-]+))';


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
export class Route {
  #rootURL: string;
  #template: string;
  #regexp: RegExp;
  #pattern: URLPattern;
  #normalized: string;
  #pathKeys: Set<string> = new Set();
  #queryKeys: Set<string> = new Set();
  #fragmentKeys: Set<string> = new Set();
  #autoLanguageTag: boolean;
  #autoFileExtension: boolean;

  constructor(
    template: string,
    rootURL: string,
    autoLanguageTag: boolean,
    autoFileExtension: boolean,
  ) {
    this.#template = template;
    this.#rootURL = rootURL;
    this.#autoLanguageTag = autoLanguageTag;
    this.#autoFileExtension = autoFileExtension;

    [this.#pattern, this.#normalized] = this.#makePatterns()
  }

  get template(): string {
    return this.#template;
  }

  get regexp(): RegExp {
    return this.#regexp;
  }

  get pattern(): URLPattern {
    return this.#pattern;
  }

  /**
   * A normalized form of the url template where arguments are named
   * in order of appearance instead of with the provided names. This 
   * allows two paths to be compared based of their ability to match
   * to the same request.
   */
  get normalized(): string {
    return this.#normalized;
  }

  /**
   * Matches a URL against this route and returns the
   * path and query values.
   *
   * @param url The URL to match.
   */
  match(url: string | URL): undefined | RouteMatchResult {
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
      } else {
        query[key] = value[0];
      }
    }

    return { path, query };
  }
  
  /**
   * Returns the location of the given key if it is present in
   * the path.
   */
  locationOf(key: string): 'path' | 'query' | 'fragment' | null {
    if (this.#pathKeys.has(key)) {
      return 'path';
    } else if (this.#queryKeys.has(key)) {
      return 'query';
    } else if (this.#fragmentKeys.has(key)) {
      return 'fragment';
    }

    return null;
  }

  #makePatterns(): [URLPattern, string] {
    let pattern: string = '';
    let normalized: string = '';
    
    // assign values to key location sets for quick querying
    let match: RegExpExecArray | null;
    let foundQueryOrFragment = false;
    let index = 0;
    let template: string = '';
    let regexpStr: string = '^';

    while ((match = paramsRe.exec(this.#template))) {
      const segment = match.groups?.s;
      const type = match.groups?.t;
      const value = match.groups?.v;

      if (type != null && type !== '.' && !foundQueryOrFragment) {
        foundQueryOrFragment = true;

        if (this.#autoLanguageTag && this.#autoFileExtension) {
          regexpStr += `(${languageTagReStr}?${fileExtensionReStr})?`
          template += '{.languageTag,fileExtension}';
        } else if (this.#autoFileExtension) {
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
        regexpStr += `(\\.(?<${value}>[^\\/\\.]+))`
        pattern += `.:${value}`;
        normalized += `.:value${index}`;
        this.#pathKeys.add(value);
      } else if (!foundQueryOrFragment && value != null) {
        index++;
        regexpStr += `(?<${value}>[^\\/\\.]+)`
        pattern += `:${value}`;
        normalized += `:value${index}`;
        this.#pathKeys.add(value);
      }
    }

    if (!foundQueryOrFragment) {
      if (this.#autoLanguageTag && this.#autoFileExtension) {
        regexpStr += `(${languageTagReStr}?${fileExtensionReStr})`
        template += '{.languageTag,fileExtension}';
        this.#pathKeys.add('languageTag');
        this.#pathKeys.add('fileExtension');
      } else if (this.#autoFileExtension) {
        regexpStr += fileExtensionReStr;
        template += '{.fileExtension}';
        this.#pathKeys.add('fileExtension');
      }
    }

    regexpStr += '$';

    this.#template = template;
    this.#regexp = new RegExp(regexpStr)

    return [
      makeURLPattern(pattern, this.#rootURL),
      normalized,
    ];
  }
}
