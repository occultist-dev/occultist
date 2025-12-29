/**
 * Takes an object with string or array of string values
 * and returns a fetch headers instance.
 *
 * @param headersObj Object of header values.
 * @returns Header values
 */
export function headersObjToHeaders(headersObj) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(headersObj)) {
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                headers.append(name, value[i]);
            }
        }
        else {
            headers.set(name, value);
        }
    }
    return headers;
}
