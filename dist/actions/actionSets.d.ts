import { type Accept } from "../accept.js";
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
export type ActionMatchResult = UnsupportedContentTypeMatch | ActionAcceptMatch;
/**
 * A set of actions grouped by having equal methods and equivilent paths.
 */
export declare class ActionSet {
    #private;
    constructor(rootIRI: string, method: string, path: string, meta: ActionMeta[]);
    matches(method: string, path: string, accept: Accept): null | ActionMatchResult;
}
