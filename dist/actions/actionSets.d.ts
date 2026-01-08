import { type Accept } from "../accept.ts";
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
export type ActionMatchResult = UnsupportedContentTypeMatch | ActionAcceptMatch;
/**
 * A set of actions grouped by having equal methods and equivilent paths.
 */
export declare class ActionSet {
    #private;
    constructor(rootIRI: string, method: string, path: string, meta: ActionCore[], reverseExtensions: Map<string, string>);
    /**
     * @param method HTTP method to match against.
     * @param path The pathname of the request.
     * @param accept The accept cache of th erequest.
     */
    matches(method: string, path: string, accept: Accept): null | ActionMatchResult;
}
