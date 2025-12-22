import type { JSONLDContext } from "../jsonld.ts";
import type { ActionSpec } from '../actions/spec.ts';
export declare function getActionContext({ spec, vocab, aliases, }: {
    vocab?: string;
    aliases?: Record<string, string>;
    spec: ActionSpec;
}): JSONLDContext;
