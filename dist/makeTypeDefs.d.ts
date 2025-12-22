import type { ContextDefinitionContainer, TypeDef } from "./jsonld.ts";
import type { Context } from "./actions/context.ts";
export type MakeTypeDefArgsFromType<Term extends string, Type extends string> = {
    term: Term;
    type: Type;
    schema?: undefined;
    isIRI?: boolean;
    protect?: boolean;
    container?: ContextDefinitionContainer;
    context?: Context;
};
export type MakeTypeDefArgsFromSchema<Term extends string, Schema extends string> = {
    term: Term;
    schema: Schema;
    type?: undefined;
    isIRI?: boolean;
    protect?: boolean;
    container?: ContextDefinitionContainer;
    context?: Context;
};
export type MakeTypeDefArgs<A extends string, B extends string> = MakeTypeDefArgsFromType<A, B> | MakeTypeDefArgsFromSchema<A, B>;
export declare function makeTypeDef<Term extends string, Schema extends string>(term: Term, type: Schema): TypeDef<Term, `${Schema}${Term}`>;
export declare function makeTypeDef<Term extends string, Type extends string>(args: MakeTypeDefArgsFromType<Term, Type>): TypeDef<Term, Type>;
export declare function makeTypeDef<Term extends string, Schema extends string>(args: MakeTypeDefArgsFromSchema<Term, Schema>): TypeDef<Term, `${Schema}${Term}`>;
export declare function makeTypeDefs<Term extends string, TD extends TypeDef<Term>>(typeDefs: Readonly<Array<TD>>): {
    [TypeDef in TD as TypeDef['term']]: TypeDef;
};
