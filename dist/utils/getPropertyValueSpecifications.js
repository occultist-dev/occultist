import { isNil } from "./isNil.js";
import { isObject } from "./isObject.js";
// deno-lint-ignore no-explicit-any
export async function getPropertyValueSpecifications(spec) {
    async function splitSpecAndValue(propertySpec) {
        let options = null;
        const specValue = {};
        const inputSpec = {
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
        }
        else if (!isNil(propertySpec.options)) {
            options = propertySpec.options;
        }
        if (!isObject(propertySpec.properties)) {
            return [inputSpec, options];
        }
        for (const [term, childPropertySpec] of Object.entries(propertySpec.properties)) {
            const [childInputSpec, childSpecValue] = await splitSpecAndValue(childPropertySpec);
            specValue[`${term}-input`] = childInputSpec;
            if (childSpecValue != null) {
                specValue[term] = childSpecValue;
            }
        }
        return [inputSpec, specValue];
    }
    const specValue = {};
    for (const [term, propertySpec] of Object.entries(spec)) {
        const [childInputSpec, childSpecValue] = await splitSpecAndValue(propertySpec);
        specValue[`${term}-input`] = childInputSpec;
        if (childSpecValue != null) {
            specValue[term] = childSpecValue;
        }
    }
    return specValue;
}
