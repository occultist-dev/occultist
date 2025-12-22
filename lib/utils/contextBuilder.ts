import type { JSONLDContext, ContextVersion, TypeDef } from "../jsonld.ts";
import { isNil } from "./isNil.ts";
import { isPopulatedObject } from "./isPopulatedObject.ts";

export function contextBuilder({
  vocab,
  version = 1.1,
  protect = false,
  idTerm,
  aliases,
  typeDefs: argsTypeDefs,
}: {
  idTerm?: string;
  vocab?: string;
  version?: ContextVersion;
  protect?: boolean;
  aliases?: Record<string, string>;
  typeDefs?: Record<string, TypeDef> | Array<TypeDef>;
}): JSONLDContext {
  let typeDefs: null | Array<TypeDef> = null;

  if (Array.isArray(argsTypeDefs)) {
    typeDefs = argsTypeDefs;
  } else if (!isNil(argsTypeDefs)) {
    typeDefs = Object.values(argsTypeDefs);
  }

  const inverseAliases: Record<string, string> = {};
  const shadowedAliases: string[] = [];
  const context: JSONLDContext = {};

  if (version === 1.1) {
    context['@version'] = version;
  }

  if (vocab != null) {
    context['@vocab'] = vocab;
  }

  if (protect) {
    context['@protected'] = true;
  }

  if (idTerm != null) {
    context[idTerm] = '@id';
  }

  if (Array.isArray(typeDefs)) {
    for (const typeDef of typeDefs) {
      if (typeDef.term.startsWith('@')) {
        throw new Error(`Terms cannot start with @. Recieved ${typeDef.term}`);
      }

      if (
        typeof aliases !== 'undefined' && Object.hasOwn(aliases, typeDef.term)
      ) {
        shadowedAliases.push(typeDef.term);
      }
    }
  }

  if (typeof aliases !== 'undefined') {
    for (const [alias, iri] of Object.entries(aliases)) {
      if (iri === vocab) {
        continue;
      }

      if (!shadowedAliases.includes(alias)) {
        context[alias] = iri;
        inverseAliases[iri] = alias;
      }
    }
  }

  if (Array.isArray(typeDefs)) {
    for (const typeDef of typeDefs) {
      if (idTerm === typeDef.term) {
        continue;
      }

      let type: string = typeDef.type;
      const matchesVocab = typeDef.type.startsWith(vocab);

      if (vocab != null && matchesVocab) {
        type = typeDef.type.replace(vocab, '');
      } else if (typeof aliases !== 'undefined') {
        for (const [alias, value] of Object.entries(aliases)) {
          if (typeDef.type.startsWith(value)) {
            type = typeDef.type.replace(value, `${alias}:`);
          }
        }
      }

      if (!matchesVocab && isPopulatedObject(typeDef.contextDefinition)) {
        context[typeDef.term] = {
          '@id': type,
          ...typeDef.contextDefinition,
        };
      } else if (isPopulatedObject(typeDef.contextDefinition)) {
        context[typeDef.term] = {
          '@id': type,
          ...typeDef.contextDefinition,
        };
      } else if (!matchesVocab) {
        context[typeDef.term] = type;
      }
    }
  }

  return context;
}
