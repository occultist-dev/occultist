import { JsonPointer } from 'json-ptr';
import { STATUS_CODE } from "@std/http/status";
import type { JSONValue } from "./jsonld.ts";
// import type { ActionSpec, ParsedIRIValues, ActionPayload, ValueSpec, ArraySpec, ObjectSpec, ObjectArraySpec, PropertySpec, SpecValue } from "./types.ts";
import { getInternalName } from "./utils/getInternalName.ts";
import { type BodyValue, getRequestBodyValues } from "./utils/getRequestBodyValues.ts";
import { type IRIValue, getRequestIRIValues } from "./utils/getRequestIRIValues.ts";
import { isNil } from "./utils/isNil.ts";
import { isObject } from "./utils/isObject.ts";
import { isPopulatedObject } from "./utils/isPopulatedObject.ts";
import { type ProblemDetailsParamsRefs, makeAppendProblemDetails } from "./utils/makeAppendProblemDetails.ts";
import { failsRequiredRequirement, failsTypeRequirement, failsContentTypeRequirement, failsMaxValue, failsMinValue, failValueMinLength, failValueMaxLength, failsStepValue, failsPatternValue, failsValidator, isObjectArraySpec, isObjectSpec, isArraySpec } from "./validators.ts";
import { InvalidActionParamsError, ProblemDetailsError } from "./errors.ts";
import { alwaysArray } from "./utils/alwaysArray.ts";
import type { ImplementedAction } from "./actions/types.ts";
import type { ActionPayload, ActionSpec, ArraySpec, ContextState, ObjectArraySpec, ObjectSpec, ParsedIRIValues, PropertySpec, SpecValue, ValueSpec } from "./actions/spec.ts";




export type ProcessActionArgs<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
> = {
  iri: string;
  req: Request;
  spec: Spec,
  state: State;
  action: ImplementedAction<State, Spec>;
};

export type ProcessActionResult<
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
> = {
  params: ParsedIRIValues;
  query: ParsedIRIValues;
  payload: ActionPayload<Spec>;
};

export async function processAction<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
>({
  iri,
  req,
  spec,
  state,
  action,
}: ProcessActionArgs<State, Spec>): Promise<ProcessActionResult> {
  let httpStatus: number | null = null;
  const payload: Partial<ActionPayload<Spec>> = {};
  const transformers: Record<string, Promise<unknown>> = {};
  const refs: ProblemDetailsParamsRefs = {};
  const appendProblemDetailsParam = makeAppendProblemDetails(refs);

  let params: ParsedIRIValues;
  let query: ParsedIRIValues;
  let iriValues: IRIValue;
  let bodyValues: BodyValue;

  {
    const result = getRequestIRIValues({ iri, action });

    params = result.pathValues;
    query = result.queryValues;
    iriValues = result.iriValues;
  }

  {
    const result = await getRequestBodyValues({ req, action });

    bodyValues = result.bodyValues;
  }

  const mergedValues = Object.assign(Object.create(null), bodyValues, iriValues);

  function hasRequiredFields(
    specObject: Record<
      string,
      {
        valueRequired?: boolean;
        valueName?: string;
      }
    >,
  ) {
    if (!isPopulatedObject(specObject)) {
      return false;
    }

    for (const specValue of Object.values(specObject)) {
      if (specValue.valueRequired && specValue.valueName == null) {
        return true;
      }
    }

    return false;
  }

  function handleValueSpecValue({
    paramName,
    pointer,
    value,
    specValue,
  }: {
    paramName: string;
    pointer: string;
    value: JSONValue;
    specValue: ValueSpec;
  }) {
    if (typeof value === 'undefined' && !specValue.valueRequired) {
      return;
    } else if (value === null && !specValue.valueRequired) {
      return;
    }

    if (failsRequiredRequirement(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value required`,
          pointer,
        },
      });

      return null;
    } else if (failsTypeRequirement(value, specValue)) {
      if (
        specValue.dataType === 'boolean' ||
        specValue.dataType === 'number' ||
        specValue.dataType === 'file'
      ) {
        appendProblemDetailsParam({
          status: STATUS_CODE.BadRequest,
          param: {
            name: paramName,
            reason: `Invalid datatype provided when a ${specValue.dataType} is expected`,
            pointer,
          },
        });
      } else {
        appendProblemDetailsParam({
          status: STATUS_CODE.BadRequest,
          param: {
            name: paramName,
            reason: `Invalid datatype provided`,
            pointer,
          },
        });
      }

      return null;
    } else if (failsContentTypeRequirement(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `File does not meet content type requirements for upload`,
          pointer,
        },
      });
    } else if (failsMaxValue(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value too large`,
          pointer,
        },
      });

      return null;
    } else if (failsMinValue(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value too small`,
          pointer,
        },
      });

      return null;
    } else if (failValueMinLength(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value's length too small`,
          pointer,
        },
      });

      return null;
    } else if (failValueMaxLength(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value's length too large`,
          pointer,
        },
      });

      return null;
    } else if (failsStepValue(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value does not meet step requirements`,
          pointer,
        },
      });

      return null;
    } else if (failsPatternValue(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value does not meet pattern requirements`,
          pointer,
        },
      });

      return null;
    } else if (failsValidator(value, specValue)) {
      appendProblemDetailsParam({
        status: STATUS_CODE.BadRequest,
        param: {
          name: paramName,
          reason: `Value is not valid`,
          pointer,
        },
      });

      return null;
    }

    const transformer = specValue.transformer as (
      value: JSONValue,
      state: State,
    ) => unknown | Promise<unknown>;

    if (typeof transformer !== 'undefined') {
      // deno-lint-ignore no-async-promise-executor
      transformers[pointer] = new Promise(async (resolve, reject) => {
        try {
          resolve(await transformer(value, state));
        } catch (err) {
          if (err instanceof InvalidActionParamsError) {
            if (typeof httpStatus !== 'number') {
              httpStatus = err.status;
            } else if (httpStatus !== err.status) {
              httpStatus = STATUS_CODE.BadRequest;
            }

            appendProblemDetailsParam({
              param: {
                name: paramName,
                reason: err.message,
                pointer,
              },
              status: STATUS_CODE.BadRequest,
            });
          } else {
            appendProblemDetailsParam({
              param: {
                name: paramName,
                reason: `Failed to cast value`,
                pointer,
              },
              status: STATUS_CODE.BadRequest,
            });
          }

          reject(err);
        }
      });

      return null;
    }

    return value;
  }

  function handleArraySpecValue({
    paramName,
    pointer,
    value: parentValue,
    specValue,
  }: {
    paramName: string;
    pointer: string;
    value: JSONValue;
    specValue: ArraySpec;
  }): unknown[] | null {
    if (typeof parentValue === 'undefined' && !specValue.valueRequired) {
      return [];
    } else if (parentValue === null && !specValue.valueRequired) {
      return [];
    }

    if (failsTypeRequirement(parentValue, specValue)) {
      throw new Error('Nope');
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value required`,
          pointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    }

    const arrayValue = alwaysArray(parentValue);

    if (failValueMinLength(arrayValue, specValue)) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value's length too small`,
          pointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    } else if (failValueMaxLength(arrayValue, specValue)) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value's length too large`,
          pointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    }

    const sanitizedValue: Array<unknown> = [];
    const childSpecValue: ValueSpec = {
      ...specValue,
      multipleValues: undefined,
    } as ValueSpec;

    for (let index = 0; index < arrayValue.length; index++) {
      const value = arrayValue[index];

      sanitizedValue.push(
        handleValueSpecValue({
          paramName,
          value,
          specValue: childSpecValue,
          pointer: `${pointer}/${index}`,
        }),
      );
    }

    return sanitizedValue;
  }

  function handleObjectSpecValue({
    paramName,
    pointer,
    value: parentValue,
    specValue: parentSpecValue,
  }: {
    paramName: string;
    pointer: string;
    value: JSONValue;
    specValue: ObjectSpec;
  }): Record<string, unknown> | null {
    if (failsTypeRequirement(parentValue, parentSpecValue)) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value required`,
          pointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    } else if (!isObject(parentValue)) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Object expected`,
          pointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    }

    for (
      const [paramName, specValue] of Object.entries(
        parentSpecValue.properties,
      )
    ) {
      if (specValue.valueRequired && isNil(parentValue[paramName])) {
        appendProblemDetailsParam({
          param: {
            name: paramName,
            reason: `Value required`,
            pointer: `${pointer}/${paramName}`,
          },
          status: STATUS_CODE.BadRequest,
        });
      }
    }

    const sanitizedValue: Record<string, unknown> = {};
    const specValue = parentSpecValue.properties[paramName];

    if (typeof specValue !== 'undefined') {
      for (const [paramNameX, value] of Object.entries(parentValue)) {
        const internalName = getInternalName({
          paramName,
          specValue,
        });

        sanitizedValue[internalName] = handleSpecValue({
          paramName: paramNameX,
          value,
          specValue,
          pointer: `${pointer}/${internalName}`,
        });
      }
    }

    return sanitizedValue;
  }

  function handleObjectArraySpecValue({
    paramName,
    pointer: parentPointer,
    value: parentValue,
    specValue,
  }: {
    paramName: string;
    pointer: string;
    value: JSONValue;
    specValue: ObjectArraySpec;
  }): unknown[] | null {
    if (failsTypeRequirement(parentValue, specValue)) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value required`,
          pointer: parentPointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    }

    const arrayValue = alwaysArray(parentValue);

    if (failValueMinLength(arrayValue, specValue)) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value's length too small`,
          pointer: parentPointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    } else if (failValueMaxLength(arrayValue, specValue)) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value's length too large`,
          pointer: parentPointer,
        },
        status: STATUS_CODE.BadRequest,
      });

      return null;
    }

    const objectSpecValue: ObjectSpec = {
      ...specValue,
      multipleValues: undefined,
    } as ObjectSpec;
    const sanitizedArrayValue: Array<unknown> = [];

    for (let index = 0; index < arrayValue.length; index++) {
      const value = arrayValue[index];
      // deno-lint-ignore no-explicit-any
      const sanitizedValue: Record<string, any> = {};
      const pointer = `${parentPointer}/${index}`;

      for (
        const [paramName, objectSpec] of Object.entries(
          objectSpecValue.properties,
        )
      ) {
        const internalName = getInternalName({
          paramName,
          specValue: objectSpec,
        });

        if (!isPopulatedObject<JSONValue>(value)) {
          appendProblemDetailsParam({
            status: STATUS_CODE.BadRequest,
            param: {
              name: paramName,
              reason: `Object expected`,
              pointer,
            },
          });

          continue;
        } else {
          sanitizedValue[internalName] = handleSpecValue({
            paramName,
            value: value[paramName],
            specValue: objectSpec,
            pointer: `${pointer}/${internalName}`,
          });
        }
      }

      sanitizedArrayValue.push(sanitizedValue);
    }

    return sanitizedArrayValue;
  }

  function handleSpecValue({
    paramName,
    pointer,
    value,
    specValue,
  }: {
    paramName: string;
    pointer: string;
    value: JSONValue;
    // deno-lint-ignore no-explicit-any
    specValue: PropertySpec<any, 'STOP'>;
  }): unknown | Array<unknown> | Record<string, unknown> | null {
    if (isObjectArraySpec(specValue)) {
      return handleObjectArraySpecValue({
        paramName,
        pointer,
        value,
        specValue,
      });
    } else if (isObjectSpec(specValue)) {
      return handleObjectSpecValue({
        paramName,
        pointer,
        value,
        specValue,
      });
    } else if (isArraySpec(specValue)) {
      return handleArraySpecValue({
        paramName,
        pointer,
        value,
        specValue,
      });
    }

    return handleValueSpecValue({
      paramName,
      pointer,
      value,
      specValue,
    });
  }

  if (hasRequiredFields(spec) && !isPopulatedObject(mergedValues)) {
    throw new ProblemDetailsError(
      httpStatus || STATUS_CODE.BadRequest,
      {
        title: `This action requires a request body`,
      },
    );
  } else if (!isPopulatedObject(mergedValues)) {
    return {
      params,
      query,
      payload: payload as unknown as ActionPayload<Spec>,
    };
  }

  for (
    const [paramName, specItem] of Object.entries(
      spec as unknown as Record<string, SpecValue>,
    )
  ) {
    if (specItem.valueRequired && isObject(mergedValues) && isNil(mergedValues[paramName])) {
      appendProblemDetailsParam({
        param: {
          name: paramName,
          reason: `Value required`,
          pointer: `#/${paramName}`,
        },
        status: STATUS_CODE.BadRequest,
      });
    }
  }

  for (const [paramName, value] of Object.entries(mergedValues)) {
    if (!Object.hasOwn(spec, paramName)) {
      throw new ProblemDetailsError(
        httpStatus || STATUS_CODE.BadRequest,
        {
          title: `Invalid request`,
          errors: [
            {
              name: paramName,
              reason: 'Unexpected value',
              pointer: `#/${paramName}`,
            },
          ],
        },
      );
    }

    const specValue = spec[paramName];

    if (specValue.readonlyValue) {
      continue;
    }
    const internalName = getInternalName({
      paramName,
      specValue,
    });

    payload[internalName as keyof ActionPayload<Spec>] = handleSpecValue({
      paramName,
      pointer: `#/${internalName}`,
      value,
      specValue,
    }) as ActionPayload<Spec>[keyof ActionPayload<Spec>];
  }

  const promises: Array<Promise<void>> = [];

  if (refs.problemDetails) {
    throw new ProblemDetailsError(
      refs.httpStatus || STATUS_CODE.BadRequest,
      refs.problemDetails,
    );
  }

  for (const [pointer, transformer] of Object.entries(transformers)) {
    promises.push(
      // deno-lint-ignore no-async-promise-executor
      new Promise<void>(async (resolve) => {
        try {
          const value = await transformer;

          JsonPointer.set(payload, pointer, value, true);
          // deno-lint-ignore no-empty
        } catch {}

        resolve();
      }),
    );
  }

  await Promise.all(promises);

  if (refs.problemDetails) {
    throw new ProblemDetailsError(
      refs.httpStatus || STATUS_CODE.BadRequest,
      refs.problemDetails,
    );
  }

  return {
    params,
    query,
    payload: payload as unknown as ActionPayload<Spec>,
  };
}
