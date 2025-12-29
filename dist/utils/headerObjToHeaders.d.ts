export type HeadersObj = Record<string, string | string[]>;
/**
 * Takes an object with string or array of string values
 * and returns a fetch headers instance.
 *
 * @param headersObj Object of header values.
 * @returns Header values
 */
export declare function headersObjToHeaders(headersObj: HeadersObj): Headers;
