import { ContentTypeCache, type Accept } from "../accept.js";
import { makeURLPattern } from "../utils/makeURLPattern.js";
import type { ActionMeta } from "./meta.js";
import type { ImplementedAction } from "./types.js";


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
  #ctc: ContentTypeCache;

  constructor(
    rootIRI: string,
    method: string,
    path: string,
    meta: ActionMeta[],
  ) {
    this.#rootIRI = rootIRI;
    this.#method = method;

    this.#urlPattern = makeURLPattern(path, rootIRI);

    [this.#contentTypeActionMap, this.#ctc] = this.#process(meta);
  }

  matches(method: string, path: string, accept: Accept): null | ActionMatchResult {
    if (method !== this.#method) {
      return null;
    } else if (!this.#urlPattern.test(path, this.#rootIRI)) {
      return null;
    }

    const contentType = accept.negotiate(this.#ctc);
    const action = this.#contentTypeActionMap.get(contentType as string);

    if (contentType != null && action != null) {
      return {
        type: 'match',
        action,
        contentType,
      };
    }

    return null;
  }

  #process(meta: ActionMeta[]): [Map<string, ImplementedAction>, ContentTypeCache] {
    const contentTypes: string[] = [];
    const contentTypeActionMap: Map<string, ImplementedAction> = new Map();

    for (let i = 0; i < meta.length; i++) {
      const action = meta[i].action as ImplementedAction;

      for (let j = 0; j < action.contentTypes.length; j++) {
        const contentType = action.contentTypes[j];

        contentTypes.push(contentType);
        contentTypeActionMap.set(contentType, action);
      }
    }

    return [contentTypeActionMap, new ContentTypeCache(contentTypes)];
  }
}

