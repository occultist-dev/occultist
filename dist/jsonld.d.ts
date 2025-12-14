import type { ShallowMerge } from "./merge.js";
export type RecursiveDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type RecursiveNextDigit = [1, 2, 3, 4, 5, 6, 7, 'STOP'];
export type RecursiveIncrement<T> = T extends RecursiveDigit ? RecursiveNextDigit[T] : 'STOP';
export type EmptyObject = Pick<{
    [key: string]: any;
}, ''>;
export type GuardType<T> = T extends (value: any) => value is infer U ? U : never;
export type JSONPrimitive = string | number | boolean | null | undefined;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export type JSONObject = {
    [member: string]: JSONValue;
};
export interface JSONArray extends Array<JSONValue> {
}
export type OrArray<T> = T | Array<T>;
export type Merge<T1 extends object, T2 extends object> = ShallowMerge<T1, T2>;
export type IRI = string;
export type IRIObject = {
    '@id': IRI;
};
export type Aliases = Record<string, string>;
export type ContextVersion = 1.1;
export type ContextDefinitionType = '@id';
export type ContextDefinitionContainer = '@list' | '@set';
export type ContextDefinition = {
    '@id'?: string;
    '@type'?: ContextDefinitionType;
    '@container'?: ContextDefinitionContainer;
    '@context'?: JSONLDContext;
    '@protected'?: boolean;
};
export type JSONLDContext = {
    '@version'?: ContextVersion;
    '@base'?: string;
    '@protected'?: boolean;
    '@vocab'?: string;
} & Record<string, string | ContextDefinition>;
export type TypeDef<Term extends string = any, Type extends string = any> = {
    type: Type;
    term: Term;
    contextDefinition?: ContextDefinition;
};
