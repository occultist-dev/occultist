import type { ImplementedAction } from "../actions/types.js";
import { ProblemDetailsError } from "../errors.js";
import type { ActionSpec, ContextState, FileSingleSpec, FileMultiSpec, BooleanSingleSpec, BooleanMultiSpec, NumberSingleSpec, NumberMultiSpec, StringSingleSpec, StringMultiSpec, ParsedIRIValues, PropertySpec } from "../actions/spec.js";
import { getParamLocation } from "./getParamLocation.js";


export type IRIValue<
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
> = {
  [Term in keyof Spec]: (
    Spec[Term] extends FileSingleSpec | FileMultiSpec ? never
      : Spec[Term]['valueName'] extends string ? (
          Spec[Term] extends BooleanSingleSpec ? boolean
            : Spec[Term] extends BooleanMultiSpec ? boolean[]
            : Spec[Term] extends NumberSingleSpec ? number
            : Spec[Term] extends NumberMultiSpec ? number[]
            : Spec[Term] extends StringSingleSpec ? string
            : Spec[Term] extends StringMultiSpec ? string[]
            : never
        )
      : never
  );
};

export type RequestIRIResult<
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
> = {
  pathValues: ParsedIRIValues;
  queryValues: ParsedIRIValues;
  iriValues: IRIValue<Spec>;
};

export function getRequestIRIValues<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
>({
  iri,
  action,
}: {
  iri: string;
  action: ImplementedAction<State, Spec>;
}): RequestIRIResult<Spec> {
  const pathValues: ParsedIRIValues = Object.create(null);
  const queryValues: ParsedIRIValues = Object.create(null);
  // deno-lint-ignore no-explicit-any
  const iriValues = Object.create(null) as IRIValue<any>;
  const urlPatternResult = action.pattern.exec(iri);
  const pathParams = urlPatternResult?.pathname.groups || Object.create(null);
  const searchParams = new URL(iri).searchParams;

  const valueNames = Object.values<PropertySpec>(action.spec)
    .filter((specItem) => typeof specItem.valueName === 'string')
    .map((specItem) => specItem.valueName);

  //if (action.strict) {
    for (const valueName of searchParams.keys()) {
      if (!valueNames.includes(valueName)) {
        throw new ProblemDetailsError(400, {
          title: `Unexpected value "${valueName}"`,
        });
      }
    }
  //}

  for (
    const [term, specItem] of Object.entries(
      action.spec as unknown as Record<string, PropertySpec>,
    )
  ) {
    if (typeof specItem.valueName !== 'string') {
      continue;
    }

    let value: string | string[] | undefined | null;
    const valueName = specItem.valueName;
    const multipleValues = Boolean(specItem.multipleValues);
    const paramLocation = getParamLocation(valueName, action.pattern);

    if (paramLocation === 'path') {
      value = pathParams[valueName];
    } else {
      value = searchParams.getAll(valueName);
    }

    if (value === null) {
      value = undefined;
    }

    if (!multipleValues && Array.isArray(value) && value.length > 1) {
      throw new ProblemDetailsError(400, {
        title: `Invalid request`,
        errors: [{
          name: term,
          pointer: `#${term}`,
          reason: `Received array when expecting single value`,
        }],
      });
    }

    if (multipleValues && typeof value === 'string') {
      value = [value];
    } else if (!multipleValues && Array.isArray(value)) {
      value = value[0];
    }

    if (typeof value === 'undefined') {
      continue;
    } else if (!specItem.valueRequired && Array.isArray(value) && value.length === 0) {
      continue;
    }

    if (specItem.dataType === 'boolean' && typeof value === 'string') {
      iriValues[term] = parseBoolean({
        term,
        value,
        pointer: `#${term}`,
      });
    } else if (specItem.dataType === 'boolean' && Array.isArray(value)) {
      iriValues[term] = value.map((value, index) => parseBoolean({
        term,
        value,
        pointer: `#${term}[${index}]`,
      }));
    } else if (specItem.dataType === 'number' && typeof value === 'string') {
      iriValues[term] = parseNumber({
        term,
        value,
        pointer: `#${term}`,
      });
    } else if (specItem.dataType === 'number' && Array.isArray(value)) {
      iriValues[term] = value.map((value, index) => parseNumber({
        term,
        value,
        pointer: `#${term}[${index}]`,
      }));
    } else {
      // string values don't require parsing
      iriValues[term] = value;
    }

    if (paramLocation === 'path') {
      pathValues[term] = iriValues[term];
    } else {
      queryValues[term] = iriValues[term];
    }
  }

  return {
    pathValues,
    queryValues,
    iriValues,
  };
}

function parseBoolean({
  term,
  value,
  pointer,
}: {
  term: string;
  value: string;
  pointer: string;
}): boolean {
  if (!['', 'true', 'false'].includes(value)) {
    throw new ProblemDetailsError(400, {
      title: `Invalid request`,
      errors: [{
        name: term,
        pointer,
        reason: `Boolean values must be "", "true" or "false"`,
      }],
    })
  }

  return value === '' || value === 'true';
}

function parseNumber({
  term,
  value,
  pointer,
}: {
  term: string;
  value: string;
  pointer: string;
}): number {
  const numberValue = Number(value);

  if (isNaN(numberValue) || !Number.isFinite(numberValue)) {
    throw new ProblemDetailsError(400, {
      title: `Invalid request`,
      errors: [{
        name: term,
        pointer,
        reason: `Numeric values must valid numbers and finite`,
      }],
    });
  }

  return numberValue;
}
