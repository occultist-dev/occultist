import { JsonPointer } from 'json-ptr';
import { getInternalName } from "./utils/getInternalName.js";
import { getRequestBodyValues } from "./utils/getRequestBodyValues.js";
import { getRequestIRIValues } from "./utils/getRequestIRIValues.js";
import { isNil } from "./utils/isNil.js";
import { isObject } from "./utils/isObject.js";
import { isPopulatedObject } from "./utils/isPopulatedObject.js";
import { makeAppendProblemDetails } from "./utils/makeAppendProblemDetails.js";
import { failsRequiredRequirement, failsTypeRequirement, failsContentTypeRequirement, failsMaxValue, failsMinValue, failValueMinLength, failValueMaxLength, failsStepValue, failsPatternValue, failsValidator, isObjectArraySpec, isObjectSpec, isArraySpec } from "./validators.js";
import { InvalidActionParamsError, ProblemDetailsError } from "./errors.js";
import { alwaysArray } from "./utils/alwaysArray.js";
export async function processAction({ iri, req, spec, state, action, }) {
    let httpStatus = null;
    const payload = {};
    const transformers = {};
    const refs = {};
    const appendProblemDetailsParam = makeAppendProblemDetails(refs);
    console.log('SPEC', spec);
    let params;
    let query;
    let iriValues;
    let bodyValues;
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
    function hasRequiredFields(specObject) {
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
    function handleValueSpecValue({ paramName, pointer, value, specValue, }) {
        if (typeof value === 'undefined' && !specValue.valueRequired) {
            return;
        }
        else if (value === null && !specValue.valueRequired) {
            return;
        }
        if (failsRequiredRequirement(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value required`,
                    pointer,
                },
            });
            return null;
        }
        else if (failsTypeRequirement(value, specValue)) {
            if (specValue.dataType === 'boolean' ||
                specValue.dataType === 'number' ||
                specValue.dataType === 'file') {
                appendProblemDetailsParam({
                    status: 400,
                    param: {
                        name: paramName,
                        reason: `Invalid datatype provided when a ${specValue.dataType} is expected`,
                        pointer,
                    },
                });
            }
            else {
                appendProblemDetailsParam({
                    status: 400,
                    param: {
                        name: paramName,
                        reason: `Invalid datatype provided`,
                        pointer,
                    },
                });
            }
            return null;
        }
        else if (failsContentTypeRequirement(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `File does not meet content type requirements for upload`,
                    pointer,
                },
            });
        }
        else if (failsMaxValue(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value too large`,
                    pointer,
                },
            });
            return null;
        }
        else if (failsMinValue(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value too small`,
                    pointer,
                },
            });
            return null;
        }
        else if (failValueMinLength(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value's length too small`,
                    pointer,
                },
            });
            return null;
        }
        else if (failValueMaxLength(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value's length too large`,
                    pointer,
                },
            });
            return null;
        }
        else if (failsStepValue(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value does not meet step requirements`,
                    pointer,
                },
            });
            return null;
        }
        else if (failsPatternValue(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value does not meet pattern requirements`,
                    pointer,
                },
            });
            return null;
        }
        else if (failsValidator(value, specValue)) {
            appendProblemDetailsParam({
                status: 400,
                param: {
                    name: paramName,
                    reason: `Value is not valid`,
                    pointer,
                },
            });
            return null;
        }
        const transformer = specValue.transformer;
        if (typeof transformer !== 'undefined') {
            // deno-lint-ignore no-async-promise-executor
            transformers[pointer] = new Promise(async (resolve, reject) => {
                try {
                    resolve(await transformer(value, state));
                }
                catch (err) {
                    if (err instanceof InvalidActionParamsError) {
                        if (typeof httpStatus !== 'number') {
                            httpStatus = err.status;
                        }
                        else if (httpStatus !== err.status) {
                            httpStatus = 400;
                        }
                        appendProblemDetailsParam({
                            param: {
                                name: paramName,
                                reason: err.message,
                                pointer,
                            },
                            status: 400,
                        });
                    }
                    else {
                        appendProblemDetailsParam({
                            param: {
                                name: paramName,
                                reason: `Failed to cast value`,
                                pointer,
                            },
                            status: 400,
                        });
                    }
                    reject(err);
                }
            });
            return null;
        }
        return value;
    }
    function handleArraySpecValue({ paramName, pointer, value: parentValue, specValue, }) {
        if (typeof parentValue === 'undefined' && !specValue.valueRequired) {
            return [];
        }
        else if (parentValue === null && !specValue.valueRequired) {
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
                status: 400,
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
                status: 400,
            });
            return null;
        }
        else if (failValueMaxLength(arrayValue, specValue)) {
            appendProblemDetailsParam({
                param: {
                    name: paramName,
                    reason: `Value's length too large`,
                    pointer,
                },
                status: 400,
            });
            return null;
        }
        const sanitizedValue = [];
        const childSpecValue = {
            ...specValue,
            multipleValues: undefined,
        };
        for (let index = 0; index < arrayValue.length; index++) {
            const value = arrayValue[index];
            sanitizedValue.push(handleValueSpecValue({
                paramName,
                value,
                specValue: childSpecValue,
                pointer: `${pointer}/${index}`,
            }));
        }
        return sanitizedValue;
    }
    function handleObjectSpecValue({ paramName, pointer, value: parentValue, specValue: parentSpecValue, }) {
        if (failsTypeRequirement(parentValue, parentSpecValue)) {
            appendProblemDetailsParam({
                param: {
                    name: paramName,
                    reason: `Value required`,
                    pointer,
                },
                status: 400,
            });
            return null;
        }
        else if (!isObject(parentValue)) {
            appendProblemDetailsParam({
                param: {
                    name: paramName,
                    reason: `Object expected`,
                    pointer,
                },
                status: 400,
            });
            return null;
        }
        for (const [paramName, specValue] of Object.entries(parentSpecValue.properties)) {
            if (specValue.valueRequired && isNil(parentValue[paramName])) {
                appendProblemDetailsParam({
                    param: {
                        name: paramName,
                        reason: `Value required`,
                        pointer: `${pointer}/${paramName}`,
                    },
                    status: 400,
                });
            }
        }
        const sanitizedValue = {};
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
    function handleObjectArraySpecValue({ paramName, pointer: parentPointer, value: parentValue, specValue, }) {
        if (failsTypeRequirement(parentValue, specValue)) {
            appendProblemDetailsParam({
                param: {
                    name: paramName,
                    reason: `Value required`,
                    pointer: parentPointer,
                },
                status: 400,
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
                status: 400,
            });
            return null;
        }
        else if (failValueMaxLength(arrayValue, specValue)) {
            appendProblemDetailsParam({
                param: {
                    name: paramName,
                    reason: `Value's length too large`,
                    pointer: parentPointer,
                },
                status: 400,
            });
            return null;
        }
        const objectSpecValue = {
            ...specValue,
            multipleValues: undefined,
        };
        const sanitizedArrayValue = [];
        for (let index = 0; index < arrayValue.length; index++) {
            const value = arrayValue[index];
            // deno-lint-ignore no-explicit-any
            const sanitizedValue = {};
            const pointer = `${parentPointer}/${index}`;
            for (const [paramName, objectSpec] of Object.entries(objectSpecValue.properties)) {
                const internalName = getInternalName({
                    paramName,
                    specValue: objectSpec,
                });
                if (!isPopulatedObject(value)) {
                    appendProblemDetailsParam({
                        status: 400,
                        param: {
                            name: paramName,
                            reason: `Object expected`,
                            pointer,
                        },
                    });
                    continue;
                }
                else {
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
    function handleSpecValue({ paramName, pointer, value, specValue, }) {
        if (isObjectArraySpec(specValue)) {
            return handleObjectArraySpecValue({
                paramName,
                pointer,
                value,
                specValue,
            });
        }
        else if (isObjectSpec(specValue)) {
            return handleObjectSpecValue({
                paramName,
                pointer,
                value,
                specValue,
            });
        }
        else if (isArraySpec(specValue)) {
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
        throw new ProblemDetailsError(httpStatus || 400, {
            title: `This action requires a request body`,
        });
    }
    else if (!isPopulatedObject(mergedValues)) {
        return {
            params,
            query,
            payload: payload,
        };
    }
    for (const [paramName, specItem] of Object.entries(spec)) {
        if (specItem.valueRequired && isObject(mergedValues) && isNil(mergedValues[paramName])) {
            appendProblemDetailsParam({
                param: {
                    name: paramName,
                    reason: `Value required`,
                    pointer: `#/${paramName}`,
                },
                status: 400,
            });
        }
    }
    for (const [paramName, value] of Object.entries(mergedValues)) {
        if (!Object.hasOwn(spec, paramName)) {
            console.log(spec);
            throw new ProblemDetailsError(httpStatus || 400, {
                title: `Invalid request`,
                errors: [
                    {
                        name: paramName,
                        reason: 'Unexpected value',
                        pointer: `#/${paramName}`,
                    },
                ],
            });
        }
        const specValue = spec[paramName];
        if (specValue.readonlyValue) {
            continue;
        }
        const internalName = getInternalName({
            paramName,
            specValue,
        });
        payload[internalName] = handleSpecValue({
            paramName,
            pointer: `#/${internalName}`,
            value,
            specValue,
        });
    }
    const promises = [];
    if (refs.problemDetails) {
        throw new ProblemDetailsError(refs.httpStatus || 400, refs.problemDetails);
    }
    for (const [pointer, transformer] of Object.entries(transformers)) {
        promises.push(
        // deno-lint-ignore no-async-promise-executor
        new Promise(async (resolve) => {
            try {
                const value = await transformer;
                JsonPointer.set(payload, pointer, value, true);
                // deno-lint-ignore no-empty
            }
            catch { }
            resolve();
        }));
    }
    await Promise.all(promises);
    if (refs.problemDetails) {
        throw new ProblemDetailsError(refs.httpStatus || 400, refs.problemDetails);
    }
    return {
        params,
        query,
        payload: payload,
    };
}
