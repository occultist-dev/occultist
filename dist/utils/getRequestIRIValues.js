import { ProblemDetailsError } from "../errors.js";
import { getParamLocation } from "./getParamLocation.js";
export function getRequestIRIValues({ iri, action, }) {
    const pathValues = {};
    const queryValues = {};
    // deno-lint-ignore no-explicit-any
    const iriValues = {};
    const urlPatternResult = action.pattern.exec(iri);
    const pathParams = urlPatternResult?.pathname.groups || {};
    const searchParams = new URL(iri).searchParams;
    const valueNames = Object.values(action.spec)
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
    for (const [term, specItem] of Object.entries(action.spec)) {
        if (typeof specItem.valueName !== 'string') {
            continue;
        }
        let value;
        const valueName = specItem.valueName;
        const multipleValues = Boolean(specItem.multipleValues);
        const paramLocation = getParamLocation(valueName, action.pattern);
        if (paramLocation === 'path') {
            value = pathParams[valueName];
        }
        else {
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
        }
        else if (!multipleValues && Array.isArray(value)) {
            value = value[0];
        }
        if (typeof value === 'undefined') {
            continue;
        }
        else if (!specItem.valueRequired && Array.isArray(value) && value.length === 0) {
            continue;
        }
        if (specItem.dataType === 'boolean' && typeof value === 'string') {
            iriValues[term] = parseBoolean({
                term,
                value,
                pointer: `#${term}`,
            });
        }
        else if (specItem.dataType === 'boolean' && Array.isArray(value)) {
            iriValues[term] = value.map((value, index) => parseBoolean({
                term,
                value,
                pointer: `#${term}[${index}]`,
            }));
        }
        else if (specItem.dataType === 'number' && typeof value === 'string') {
            iriValues[term] = parseNumber({
                term,
                value,
                pointer: `#${term}`,
            });
        }
        else if (specItem.dataType === 'number' && Array.isArray(value)) {
            iriValues[term] = value.map((value, index) => parseNumber({
                term,
                value,
                pointer: `#${term}[${index}]`,
            }));
        }
        else {
            // string values don't require parsing
            iriValues[term] = value;
        }
        if (paramLocation === 'path') {
            pathValues[term] = iriValues[term];
        }
        else {
            queryValues[term] = iriValues[term];
        }
    }
    return {
        pathValues,
        queryValues,
        iriValues,
    };
}
function parseBoolean({ term, value, pointer, }) {
    if (!['', 'true', 'false'].includes(value)) {
        throw new ProblemDetailsError(400, {
            title: `Invalid request`,
            errors: [{
                    name: term,
                    pointer,
                    reason: `Boolean values must be "", "true" or "false"`,
                }],
        });
    }
    return value === '' || value === 'true';
}
function parseNumber({ term, value, pointer, }) {
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
