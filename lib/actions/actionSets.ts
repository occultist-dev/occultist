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
  language?: string;
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

  constructor(
    rootIRI: string,
    method: string,
    path: string,
    meta: ActionCore[],
    reverseExtensions: Map<string, string>,
  ) {
    this.#rootIRI = rootIRI;
    this.#method = method;

    [this.#contentTypeActionMap, this.#extensionMap, this.#ctc] = this.#process(
      meta,
      reverseExtensions,
    );

    if (this.#extensionMap.size > 0) {
      path += ':fileExtension(\\.[\\w\\-]+)?';
    }

    this.#urlPattern = makeURLPattern(
      path,
      rootIRI,
    );
  }

  /**
   * @param method HTTP method to match against.
   * @param path The pathname of the request.
   * @param accept The accept cache of th erequest.
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

    if (res.pathname.groups.fileExtension != null) {
      const fileExtension = res.pathname.groups.fileExtension.replace('.', '');

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
      };
    }

    return null;
  }

  #process(
    meta: ActionCore[],
    reverseExtensions: Map<string, string>,
  ): [
    Map<string, ImplementedAction>,
    Map<string, string>,
    ContentTypeCache,
  ] {
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

        if (meta[i].autoFileExtensions &&
            reverseExtensions.has(contentType) &&
            !extensionMap.has(contentType)) {
          extensionMap.set(reverseExtensions.get(contentType), contentType);
        }
      }
    }

    return [
      contentTypeActionMap,
      extensionMap,
      new ContentTypeCache(contentTypes),
    ];
  }
}

