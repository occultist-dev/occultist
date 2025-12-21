import type { JSONPrimitive, JSONValue, OrArray, RecursiveDigit, RecursiveIncrement, TypeDef } from "../jsonld.ts";
import {Action} from "./actions.ts";
import type { Context } from './context.ts';

export type EmptyState = Record<string, unknown>;
export type EmptySpec = Map<PropertyKey, never>;
export type ContextState = Record<string, unknown>;

export type EntryPoint = {
  contentType?: string;
  encodingType?: string;
  httpMethod?: string;
  urlTemplate: string;
  actionPlatform?: string;
};

export type Target = string | EntryPoint;

export type Merge<M1 extends ContextState, M2 extends ContextState> = {
  [K in keyof M1 as K extends keyof M2 ? never : K]: M1[K];
} & {
  [K in keyof M2]: M2[K];
};

export type ExtensionMap = Record<string, string>;

export type FileValue = File | string;

export type ParsedIRIValues = Record<string, JSONPrimitive | JSONPrimitive[]>;

export type HandlerMetadata = Record<string | symbol, unknown>;

export type HandleArgs<
  State extends ContextState = ContextState,
> = {
  contentType: string | string[];
  metadata?: HandlerMetadata;
  handler: Middleware<State>
};

export type ParameterizedHandleArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = {
  contentType: string | string[];
  metadata?: HandlerMetadata;
  handler: ParameterizedMiddleware<State, Spec>
};

export type AnyHandleArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec = ActionSpec,
> =
  | HandleArgs<State>
  | ParameterizedHandleArgs<State, Spec>
;

export type ParameterizedContext<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = Context<State> & {
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  payload: ActionPayload<Spec>;
  action: Action<State>;
};

export type AnyContext<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = 
  | Context<State>
  | ParameterizedContext<State, Spec>
;

export type NextFn = () => Promise<void>;

export type Middleware<
  State extends ContextState = ContextState,
> = (ctx: Context<State>, next: NextFn) => void | Promise<void>;

export type ParameterizedMiddleware<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = (
  ctx: ParameterizedContext<
    State,
    Spec
  >,
  next: NextFn,
) => void | Promise<void>;

export type AnyMiddleware<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<State> = ActionSpec<State>,
> = 
  | Middleware<State>
  | ParameterizedMiddleware<State, Spec>
;

export type ValueOption<Value extends JSONValue> = Value;

export type TextValueOption<Value extends JSONValue> = {
  text: string;
  value: Value;
};

export type ActionOption<Value extends JSONValue> =
  | ValueOption<Value>
  | TextValueOption<Value>;

export type ActionOptionsRetriever<Value extends JSONValue> =
  | (() => OrArray<ActionOption<Value>>)
  | (() => Promise<OrArray<ActionOption<Value>>>);

export type ActionOptions<Value extends JSONValue> =
  | OrArray<ActionOption<Value>>
  | ActionOptionsRetriever<Value>;

export type ValidatorFn<
  DataType extends JSONValue | FileValue,
  Value extends DataType,
> = (
  value: DataType,
) => value is Value;

export type TransformerFn<
  Value extends JSONValue | FileValue | FileValue[],
  // deno-lint-ignore no-explicit-any
  TransformTo extends any,
  State extends ContextState = ContextState,
> = (value: Value, state: State) => TransformTo | Promise<TransformTo>;

export type FileSingleSpec<
  Value extends FileValue = FileValue,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'file';
  multipleValues?: undefined;
  options?: undefined;
  contentType?: string | string[];
  validator?: ValidatorFn<FileValue, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type FileMultiSpec<
  Value extends FileValue = FileValue,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'file';
  multipleValues: true;
  options?: undefined;
  contentType?: string | string[];
  validator?: ValidatorFn<FileValue, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type BooleanSingleSpec<
  Value extends boolean = boolean,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'boolean';
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<boolean, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type BooleanMultiSpec<
  Value extends boolean = boolean,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'boolean';
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<boolean, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type NumberSingleSpec<
  Value extends number = number,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'number';
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<number, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type NumberMultiSpec<
  Value extends number = number,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'number';
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<number, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type StringSingleSpec<
  Value extends string = string,
  TransformTo extends unknown = unknown,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'string';
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<string, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type StringMultiSpec<
  Value extends string = string,
  TransformTo extends unknown = unknown,
  ActionState extends ContextState = ContextState,
> = {
  dataType: 'string';
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<string, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type JSONValueSingleSpec<
  Value extends JSONValue = JSONValue,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType?: undefined;
  options?: ActionOptions<Value>;
  multipleValues?: undefined;
  contentType?: undefined;
  validator?: ValidatorFn<JSONValue, Value>;
  transformer?: TransformerFn<Value, TransformTo, ActionState>;
};

export type JSONValueMultiSpec<
  Value extends JSONValue = JSONValue,
  // deno-lint-ignore no-explicit-any
  TransformTo extends any = any,
  ActionState extends ContextState = ContextState,
> = {
  dataType?: undefined;
  options?: ActionOptions<Value>;
  multipleValues: true;
  contentType?: undefined;
  validator?: ValidatorFn<JSONValue, Value>;
  transformer?: TransformerFn<Value[], TransformTo, ActionState>;
};

export type SpecOptions<
  ActionState extends ContextState = ContextState,
> =
  // deno-lint-ignore no-explicit-any
  | BooleanSingleSpec<boolean, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | BooleanMultiSpec<boolean, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | NumberSingleSpec<number, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | NumberMultiSpec<number, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | StringSingleSpec<string, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | StringMultiSpec<string, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | JSONValueSingleSpec<JSONValue, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | JSONValueMultiSpec<JSONValue, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | FileSingleSpec<FileValue, any, ActionState>
  // deno-lint-ignore no-explicit-any
  | FileMultiSpec<FileValue, any, ActionState>
;

export type BaseSpec<
  ActionState extends ContextState = ContextState,
  InternalTerm extends string = string,
> =
  & {
    valueName?: string;
    internalTerm?: InternalTerm;
    readonlyValue?: boolean;
    defaultValue?: JSONValue;
    valueRequired?: boolean;
    minValue?: JSONPrimitive;
    maxValue?: JSONPrimitive;
    stepValue?: number;
    valuePattern?: string;
    validationMessage?: string;
    parseFailureMessage?: string;
    parseFailureStatus?: number;
  }
  & (
    | { typeDef?: TypeDef; type?: undefined }
    | { type: string; typeDef?: undefined }
  )
  & SpecOptions<ActionState>;

export type ValueSpec<ActionState extends ContextState = ContextState> =
  & BaseSpec<ActionState>
  & {
    multipleValues?: false;
    valueMaxLength?: number;
    valueMinLength?: number;
    properties?: undefined;
  };

export type ArraySpec<ActionState extends ContextState = ContextState> =
  & BaseSpec<ActionState>
  & {
    multipleValues: true;
    valueMaxLength?: number;
    valueMinLength?: number;
    properties?: undefined;
  };

export type ObjectSpec<
  ActionState extends ContextState = ContextState,
  RecursionCount extends RecursiveDigit | 'STOP' = 7,
> = BaseSpec & {
  multipleValues?: false;
  valueMaxLength?: undefined;
  valueMinLength?: undefined;
  properties: {
    [term: string]: PropertySpec<
      ActionState,
      RecursiveIncrement<RecursionCount>
    >;
  };
};

export type ObjectArraySpec<
  ActionState extends ContextState = ContextState,
  RecursionCount extends RecursiveDigit | 'STOP' = 7,
> = BaseSpec & {
  multipleValues: true;
  valueMaxLength?: number;
  valueMinLength?: number;
  properties: {
    [term: string]: PropertySpec<
      ActionState,
      RecursiveIncrement<RecursionCount>
    >;
  };
};

/**
 * @todo Support ActionState typing the Transformed func
 */
export type PropertySpec<
  ActionState extends ContextState = ContextState,
  RecursionCount extends RecursiveDigit | 'STOP' = 7,
> =
  // RecursionCount extends 'STOP' ? (
  | ValueSpec<ActionState>
  | ArraySpec<ActionState>
  | ObjectSpec
  | ObjectArraySpec; // ) : (
//   | ValueSpec<ActionState>
//   | ArraySpec<ActionState>
//   | ObjectSpec<ActionState>
//   | ObjectArraySpec<ActionState>
// )

export type ActionSpec<ActionState extends ContextState = ContextState> = {
  [term: string]: PropertySpec<ActionState>;
};

export type PropertySpecResult<PropertySpecItem extends PropertySpec> =
  PropertySpecItem extends FileSingleSpec<
    infer Value,
    infer TransformTo,
    infer State
  > ? PropertySpecItem['transformer'] extends TransformerFn<
      Value,
      TransformTo,
      State
    > ? TransformTo
    : PropertySpecItem['validator'] extends ValidatorFn<FileValue, Value> ? Value
    : FileValue
    : PropertySpecItem extends FileMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<FileValue, Value> ? Value[]
      : FileValue[]
    : PropertySpecItem extends BooleanSingleSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<boolean, Value>
        ? Value
      : boolean
    : PropertySpecItem extends BooleanMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<boolean, Value>
        ? Value[]
      : boolean[]
    : PropertySpecItem extends NumberSingleSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<number, Value> ? Value
      : number
    : PropertySpecItem extends NumberMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<number, Value>
        ? Value[]
      : number[]
    : PropertySpecItem extends StringSingleSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<string, Value> ? Value
      : string
    : PropertySpecItem extends StringMultiSpec<
      infer Value,
      infer TransformTo,
      infer State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo,
        State
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<
        string,
        Value
      > ? Value[]
      : string[]
    : PropertySpecItem extends JSONValueSingleSpec<
      infer Value,
      infer TransformTo,
      infer _State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<
        JSONValue,
        Value
      > ? Value
      : JSONValue
    : PropertySpecItem extends JSONValueMultiSpec<
      infer Value,
      infer TransformTo,
      infer _State
    > ? PropertySpecItem['transformer'] extends TransformerFn<
        Value,
        TransformTo
      > ? TransformTo
      : PropertySpecItem['validator'] extends ValidatorFn<
        JSONValue,
        Value
      > ? Value[]
      : JSONValue[]
    : JSONValue;

export type ActionPayload<
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
> = {
  [
    Term in keyof Spec as Spec[Term] extends { internalTerm: string }
      ? Spec[Term]['internalTerm']
      : Term
  ]: Spec[Term] extends ObjectArraySpec
    ? Array<ActionPayload<Spec[Term]['properties']>>
    : Spec[Term] extends ObjectSpec ? ActionPayload<Spec[Term]['properties']>
    : PropertySpecResult<Spec[Term]>;
};

export type ResponseInputSpec = {
  '@type': 'https://schema.org/PropertyValueSpecification';
  readonlyValue?: boolean;
  defaultValue?: JSONValue;
  minValue?: JSONPrimitive;
  maxValue?: JSONPrimitive;
  stepValue?: number;
  valueName?: string;
  valuePatern?: string;
  valueRequired?: boolean;
  multipleValues?: boolean;
  valueMaxLength?: number;
  valueMinLength?: number;
};

export type SpecValue = {
  [key: string]: SpecValue | ActionOptions<JSONValue> | ResponseInputSpec;
}

