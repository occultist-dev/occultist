import { joinPaths } from "./utils/joinPaths.ts"
import type { ContextDefinition, ContextDefinitionContainer, JSONLDContext, TypeDef } from "./jsonld.ts";
import type { Context } from "./actions/context.ts";
import { isPopulatedObject } from "./utils/isPopulatedObject.ts";
import { isPopulatedString } from "./utils/isPopulatedString.ts";

export type MakeTypeDefArgsFromType<Term extends string, Type extends string> =
  {
    term: Term;
    type: Type;
    schema?: undefined;
    isIRI?: boolean;
    protect?: boolean;
    container?: ContextDefinitionContainer;
    context?: Context;
  };

export type MakeTypeDefArgsFromSchema<
  Term extends string,
  Schema extends string,
> = {
  term: Term;
  schema: Schema;
  type?: undefined;
  isIRI?: boolean;
  protect?: boolean;
  container?: ContextDefinitionContainer;
  context?: Context;
};

export type MakeTypeDefArgs<A extends string, B extends string> =
  | MakeTypeDefArgsFromType<A, B>
  | MakeTypeDefArgsFromSchema<A, B>;

export function makeTypeDef(url: string | URL): TypeDef;

export function makeTypeDef<Term extends string, Schema extends string>(
  term: Term,
  type: Schema,
): TypeDef<Term, `${Schema}${Term}`>;

export function makeTypeDef<Term extends string, Type extends string>(
  args: MakeTypeDefArgsFromType<Term, Type>,
): TypeDef<Term, Type>;

export function makeTypeDef<Term extends string, Schema extends string>(
  args: MakeTypeDefArgsFromSchema<Term, Schema>,
): TypeDef<Term, `${Schema}${Term}`>;

export function makeTypeDef<Term extends string, TypeOrSchema extends string>(
  arg1: Term | MakeTypeDefArgs<Term, TypeOrSchema>,
  arg2?: TypeOrSchema,
) {
  let contextDefinition: ContextDefinition = {};
  let protect: boolean = false;
  let args: MakeTypeDefArgs<Term, TypeOrSchema>;

  if ((typeof arg1 === 'string' && arg2 == null) || arg1 instanceof URL) {
    const url = new URL(arg1);
    const schema = url.origin + '/' as TypeOrSchema
    const term = url.toString().replace(url.origin, '');
    
    args = {
      term,
      schema,
    };
  } else if (typeof arg1 === 'string') {
    args = {
      term: arg1,
      schema: arg2 as TypeOrSchema,
    };
  } else {
    args = arg1;

    if (typeof arg1.protect === 'boolean') {
      protect = arg1.protect;
    }
  }

  if (
    args.isIRI || isPopulatedString(args.container) ||
    isPopulatedObject(args.context)
  ) {
    contextDefinition = {};

    if (args.isIRI) {
      contextDefinition['@type'] = '@id';
    }

    if (isPopulatedString(args.container)) {
      contextDefinition['@container'] = args.container;
    }

    if (isPopulatedObject(args.context)) {
      contextDefinition['@context'] = args.context as JSONLDContext;
    }

    if (protect) {
      contextDefinition['@protected'] = true;
    }

    if (isPopulatedString(args.schema)) {
      return {
        term: args.term,
        type: joinPaths(args.schema, args.term),
        contextDefinition,
      } as TypeDef<Term, `${TypeOrSchema}${Term}`>;
    }

    return {
      term: args.term,
      type: args.type,
      contextDefinition,
    };
  }

  if (protect) {
    contextDefinition = { '@protected': true };
  }

  if (isPopulatedString(args.schema)) {
    return {
      term: args.term,
      type: joinPaths(args.schema, args.term),
      contextDefinition,
    } as TypeDef<Term, `${TypeOrSchema}${Term}`>;
  }

  return {
    term: args.term,
    type: args.type,
    contextDefinition,
  };
}

export function makeTypeDefs<Term extends string, TD extends TypeDef<Term>>(
  typeDefs: Readonly<Array<TD>>,
): { [TypeDef in TD as TypeDef['term']]: TypeDef } {
  type TypeDefs = { [TypeDef in TD as TypeDef['term']]: TypeDef };
  const result = typeDefs.reduce(
    (acc, typeDef) => ({
      ...acc,
      [typeDef.term]: typeDef,
    }),
    {},
  );

  return result as TypeDefs;
}
