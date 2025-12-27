
export type HeadersObj = Record<string, string | string[]>;

/**
 * Takes an object with string or array of string values
 * and returns a fetch headers instance.
 *
 * @param headersObj Object of header values.
 * @returns Header values
 */
export function headersObjToHeaders(headersObj: HeadersObj): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(headersObj)) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        headers.append(name, value[i]);
      }
    } else {
      headers.set(name, value);
    }
  }

  return headers;
}
