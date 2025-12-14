import type { JSONLDContext } from "../jsonld.js";
import type { ActionSpec } from '../actions/spec.js';
export declare function getActionContext({ spec, vocab, aliases, }: {
    vocab?: string;
    aliases?: Record<string, string>;
    spec: ActionSpec;
}): JSONLDContext;
