import {
  ArraySpec,
  ObjectArraySpec,
  ObjectSpec,
  PropertySpec,
} from './actions/spec.js';
import { isObject } from './utils/isObject.js';
import { preferredMediaTypes } from './utils/preferredMediaTypes.js';
import { JSONValue } from "./jsonld.js";


// deno-lint-ignore no-explicit-any
export function isFileData(value: JSONValue | File): value is string | File {
  if (typeof value === 'string' && value.startsWith('data:')) {
    return true;
  } else if (value instanceof File) {
    return true;
  }

  return false;
}

export function isObjectArraySpec(spec: PropertySpec): spec is ObjectArraySpec {
  return isObject(spec.properties) && Boolean(spec.multipleValues);
}

export function isObjectSpec(spec: PropertySpec): spec is ObjectSpec {
  return isObject(spec.properties) && !spec.multipleValues;
}

export function isArraySpec(spec: PropertySpec): spec is ArraySpec {
  return !isObject(spec.properties) && Boolean(spec.multipleValues);
}

export function failsRequiredRequirement(
  value: JSONValue,
  specValue: PropertySpec,
) {
  return specValue.valueRequired && (typeof value === 'undefined' || value === null);
}

export function failsTypeRequirement(
  value: JSONValue | File,
  specValue: PropertySpec,
) {
  const dataType = specValue.dataType;

  if (dataType == null) {
    return false;
  } else if (specValue.dataType === 'file' && isFileData(value)) {
    return false;
  } else if (Array.isArray(value)) {
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


export function failsContentTypeRequirement(
  value: JSONValue | File,
  specValue: PropertySpec
) {
  if (
    specValue.type !== 'file' ||
    specValue.contentType == null ||
    !isFileData(value)
  ) {
    return false;
  }

  let contentType: string | null;

  if (typeof value === 'string') {
    contentType = value.replace(/^data\:/, '').split(';')[0];
  } else {
    contentType = value.type;
  }

  if (contentType == null) {
    return true;
  } else if (typeof specValue.contentType === 'string') {
    return !preferredMediaTypes(contentType, [specValue.contentType]);
  }

  return !preferredMediaTypes(contentType, specValue.contentType);
}

export function failsMinValue(value: JSONValue, specValue: PropertySpec) {
  if (!specValue.valueRequired && value == null) {
    return false;
  }

  if (typeof specValue.minValue !== 'number') {
    return false;
  } else if (typeof value !== 'number') {
    return true;
  }

  return value < specValue.minValue;
}

export function failsMaxValue(value: JSONValue, specValue: PropertySpec) {
  if (!specValue.valueRequired && value == null) {
    return false;
  }

  if (typeof specValue.maxValue !== 'number') {
    return false;
  } else if (typeof value !== 'number') {
    return true;
  }

  return value > specValue.maxValue;
}

export function failsStepValue(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.stepValue !== 'number') {
    return false;
  } else if (typeof value !== 'number') {
    return true;
  }

  return value % specValue.stepValue !== 0;
}

export function failsPatternValue(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.valuePattern !== 'string') {
    return false;
  } else if (typeof value !== 'string') {
    return true;
  }

  const regexp = new RegExp(specValue.valuePattern);

  return !regexp.test(value);
}

export function failValueMinLength(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.valueMinLength !== 'number') {
    return false;
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length < specValue.valueMinLength;
  }

  return true;
}

export function failValueMaxLength(value: JSONValue, specValue: PropertySpec) {
  if (typeof specValue.valueMaxLength !== 'number') {
    return false;
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length > specValue.valueMaxLength;
  }

  return true;
}

export function failsValidator(
  value: JSONValue | File,
  specValue: PropertySpec,
) {
  if (typeof specValue.validator !== 'function') {
    return false;
  }

  const validator = specValue.validator as (
    value: JSONValue | File,
  ) => boolean;

  return !validator(value);
}
