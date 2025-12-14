import { isObject } from './utils/isObject.js';
import { preferredMediaTypes } from './utils/preferredMediaTypes.js';
// deno-lint-ignore no-explicit-any
export function isFileData(value) {
    if (typeof value === 'string' && value.startsWith('data:')) {
        return true;
    }
    else if (value instanceof File) {
        return true;
    }
    return false;
}
export function isObjectArraySpec(spec) {
    return isObject(spec.properties) && Boolean(spec.multipleValues);
}
export function isObjectSpec(spec) {
    return isObject(spec.properties) && !spec.multipleValues;
}
export function isArraySpec(spec) {
    return !isObject(spec.properties) && Boolean(spec.multipleValues);
}
export function failsRequiredRequirement(value, specValue) {
    return specValue.valueRequired && (typeof value === 'undefined' || value === null);
}
export function failsTypeRequirement(value, specValue) {
    const dataType = specValue.dataType;
    if (dataType == null) {
        return false;
    }
    else if (specValue.dataType === 'file' && isFileData(value)) {
        return false;
    }
    else if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const item = value[index];
            // deno-lint-ignore valid-typeof
            if (typeof item !== dataType) {
                return true;
            }
        }
        return false;
    }
    // deno-lint-ignore valid-typeof
    return typeof value !== specValue.dataType;
}
export function failsContentTypeRequirement(value, specValue) {
    if (specValue.type !== 'file' ||
        specValue.contentType == null ||
        !isFileData(value)) {
        return false;
    }
    let contentType;
    if (typeof value === 'string') {
        contentType = value.replace(/^data\:/, '').split(';')[0];
    }
    else {
        contentType = value.type;
    }
    if (contentType == null) {
        return true;
    }
    else if (typeof specValue.contentType === 'string') {
        return !preferredMediaTypes(contentType, [specValue.contentType]);
    }
    return !preferredMediaTypes(contentType, specValue.contentType);
}
export function failsMinValue(value, specValue) {
    if (!specValue.valueRequired && value == null) {
        return false;
    }
    if (typeof specValue.minValue !== 'number') {
        return false;
    }
    else if (typeof value !== 'number') {
        return true;
    }
    return value < specValue.minValue;
}
export function failsMaxValue(value, specValue) {
    if (!specValue.valueRequired && value == null) {
        return false;
    }
    if (typeof specValue.maxValue !== 'number') {
        return false;
    }
    else if (typeof value !== 'number') {
        return true;
    }
    return value > specValue.maxValue;
}
export function failsStepValue(value, specValue) {
    if (typeof specValue.stepValue !== 'number') {
        return false;
    }
    else if (typeof value !== 'number') {
        return true;
    }
    return value % specValue.stepValue !== 0;
}
export function failsPatternValue(value, specValue) {
    if (typeof specValue.valuePattern !== 'string') {
        return false;
    }
    else if (typeof value !== 'string') {
        return true;
    }
    const regexp = new RegExp(specValue.valuePattern);
    return !regexp.test(value);
}
export function failValueMinLength(value, specValue) {
    if (typeof specValue.valueMinLength !== 'number') {
        return false;
    }
    if (typeof value === 'string' || Array.isArray(value)) {
        return value.length < specValue.valueMinLength;
    }
    return true;
}
export function failValueMaxLength(value, specValue) {
    if (typeof specValue.valueMaxLength !== 'number') {
        return false;
    }
    if (typeof value === 'string' || Array.isArray(value)) {
        return value.length > specValue.valueMaxLength;
    }
    return true;
}
export function failsValidator(value, specValue) {
    if (typeof specValue.validator !== 'function') {
        return false;
    }
    const validator = specValue.validator;
    return !validator(value);
}
