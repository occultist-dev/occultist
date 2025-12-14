import type { JSONLDContext, ContextVersion, TypeDef } from "../jsonld.js";
export declare function contextBuilder({ vocab, version, protect, idTerm, aliases, typeDefs: argsTypeDefs, }: {
    idTerm?: string;
    vocab?: string;
    version?: ContextVersion;
    protect?: boolean;
    aliases?: Record<string, string>;
    typeDefs?: Record<string, TypeDef> | Array<TypeDef>;
}): JSONLDContext;
