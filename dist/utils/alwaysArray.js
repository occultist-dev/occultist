export function alwaysArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value !== 'undefined' && value !== null) {
        return [value];
    }
    return [];
}
