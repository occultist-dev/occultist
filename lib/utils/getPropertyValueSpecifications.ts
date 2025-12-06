import type { OrArray, JSONValue } from "../jsonld.js";
import type { ActionSpec, PropertySpec, ResponseInputSpec, SpecValue, ActionOption } from "../actions/spec.js";
import { isNil } from "./isNil.js";
import { isObject } from "./isObject.js";


// deno-lint-ignore no-explicit-any
export async function getPropertyValueSpecifications(spec: ActionSpec<any>) {
  async function splitSpecAndValue(
    propertySpec: PropertySpec,
  ): Promise<
    [ResponseInputSpec, SpecValue | OrArray<ActionOption<JSONValue>> | null]
  > {
    let options: OrArray<ActionOption<JSONValue>> | null = null;

    const specValue: SpecValue = {};
    const inputSpec: ResponseInputSpec = {
      '@type': 'https://schema.org/PropertyValueSpecification',
      defaultValue: propertySpec.defaultValue,
      maxValue: propertySpec.maxValue,
      minValue: propertySpec.minValue,
      readonlyValue: propertySpec.readonlyValue,
      stepValue: propertySpec.stepValue,
      valueName: propertySpec.valueName,
      valueRequired: propertySpec.valueRequired,
      multipleValues: propertySpec.multipleValues,
      valueMinLength: propertySpec.valueMinLength,
      valueMaxLength: propertySpec.valueMaxLength,
      valuePatern: propertySpec.valuePattern,
    };

    if (typeof propertySpec.options === 'function') {
      options = await propertySpec.options();
    } else if (!isNil(propertySpec.options)) {
      options = propertySpec.options;
    }

    if (!isObject(propertySpec.properties)) {
      return [inputSpec, options];
    }

    for (
      const [term, childPropertySpec] of Object.entries(
        propertySpec.properties,
      )
    ) {
      const [childInputSpec, childSpecValue] = await splitSpecAndValue(
        childPropertySpec,
      );

      specValue[`${term}-input`] = childInputSpec;

      if (childSpecValue != null) {
        specValue[term] = childSpecValue;
      }
    }

    return [inputSpec, specValue];
  }

  const specValue: SpecValue = {};

  for (const [term, propertySpec] of Object.entries(spec)) {
    const [childInputSpec, childSpecValue] = await splitSpecAndValue(
      propertySpec,
    );

    specValue[`${term}-input`] = childInputSpec;

    if (childSpecValue != null) {
      specValue[term] = childSpecValue;
    }
  }

  return specValue;
}
