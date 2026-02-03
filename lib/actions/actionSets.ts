import { ContentTypeCache, type Accept } from "../accept.ts";
import { makeURLPattern } from "../utils/makeURLPattern.ts";
import type { ActionCore } from "./core.ts";
import type { ImplementedAction } from "./types.ts";


export type UnsupportedContentTypeMatch = {
  type: 'unsupported-content-type';
  contentTypes: string[];
};

export type ActionAcceptMatch = {
  type: 'match';
  action: ImplementedAction;
  contentType?: string;
  languageTag?: string;
  encoding?: string;
};

export type ActionMatchResult =
  | UnsupportedContentTypeMatch
  | ActionAcceptMatch
;

/**
 * A set of actions grouped by having equal methods and equivilent paths.
 */
export class ActionSet {
  #rootIRI: string;
  #method: string;
  #urlPattern: URLPattern;
  #contentTypeActionMap: Map<string, ImplementedAction>;
  #extensionMap: Map<string, string> = new Map();
  #ctc: ContentTypeCache;
  #autoLanguageTags: boolean;

  constructor(
    rootIRI: string,
    method: string,
    path: string,
    meta: ActionCore[],
    reverseExtensions: Map<string, string>,
  ) {
    this.#rootIRI = rootIRI;
    this.#method = method;

    [
      this.#contentTypeActionMap,
      this.#extensionMap,
      this.#ctc,
      this.#autoLanguageTags,
    ] = this.#process(
      path,
      meta,
      reverseExtensions,
    );

    if (this.#extensionMap.size > 0) {
      path += ':auto1(\\.[\\w\\-]+)?';

      // language tags are only enabled if file extensions are
      if (this.#autoLanguageTags) {
        path += ':auto2(\\.[a-zA-Z0-9\\-]+)?';
      }
    }

    this.#urlPattern = makeURLPattern(
      path,
      rootIRI,
    );
  }

  /**
   * @param method HTTP method to match against.
   * @param path The pathname of the request.
   * @param accept The accept cache of the request.
   */
  matches(method: string, path: string, accept: Accept): null | ActionMatchResult {
    if (method !== this.#method) {
      return null;
    }

    const res = this.#urlPattern.exec(path, this.#rootIRI);

    if (res == null) {
      return null;
    }

    let contentType: string;
    let languageTag: string;

    if (res.pathname.groups.auto1 != null && res.pathname.groups.auto2 != null) {
      languageTag = res.pathname.groups.auto1.replace('.', '');
      const fileExtension = res.pathname.groups.auto2.replace('.', '');

      contentType = this.#extensionMap.get(fileExtension);

      if (contentType == null) return null;
    } else if (res.pathname.groups.auto1 != null || res.pathname.groups.auto2 != null) {
      const autoParam = res.pathname.groups.auto1 ?? res.pathname.groups.auto2;
      const fileExtension = autoParam.replace('.', '');

      contentType = this.#extensionMap.get(fileExtension);

      if (contentType == null) return null;
    }

    if (contentType == null) {
      contentType = accept.negotiate(this.#ctc);
    }

    if (contentType == null) return null;

    const action = this.#contentTypeActionMap.get(contentType);

    if (action != null) {
      return {
        type: 'match',
        action,
        contentType,
        languageTag,
      };
    }

    return null;
  }

  #process(
    path: string,
    meta: ActionCore[],
    reverseExtensions: Map<string, string>,
  ): [
    contentTypeActionMap: Map<string, ImplementedAction>,
    extensionMap: Map<string, string>,
    ctc: ContentTypeCache,
    autoLanguageTags: boolean,
  ] {
    let autoLanguageTags: boolean = false;
    const contentTypes: string[] = [];
    const contentTypeActionMap: Map<string, ImplementedAction> = new Map();
    const extensionMap: Map<string, string> = new Map();

    let l1 = meta.length;
    for (let i = 0; i < l1; i++) {
      const action = meta[i].action as ImplementedAction;

      let l2 = action.contentTypes.length;
      for (let j = 0; j < l2; j++) {
        const contentType = action.contentTypes[j];

        contentTypes.push(contentType);
        contentTypeActionMap.set(contentType, action);

        if (!autoLanguageTags && meta[i].autoLanguageTags) {
          autoLanguageTags = true;
        }

        if (meta[i].autoFileExtensions &&
            reverseExtensions.has(contentType) &&
            !extensionMap.has(contentType) &&
            path !== '/') {
          extensionMap.set(reverseExtensions.get(contentType), contentType);
        }
      }
    }

    return [
      contentTypeActionMap,
      extensionMap,
      new ContentTypeCache(contentTypes),
      autoLanguageTags,
    ];
  }
}

