export function isBodyInit(value) {
    return value instanceof ReadableStream ||
        value instanceof Blob ||
        value instanceof DataView ||
        value instanceof ArrayBuffer ||
        value instanceof Int8Array ||
        value instanceof Uint8Array ||
        value instanceof Uint8ClampedArray ||
        value instanceof Int16Array ||
        value instanceof Uint16Array ||
        value instanceof Int32Array ||
        value instanceof Uint32Array ||
        value instanceof Float16Array ||
        value instanceof Float32Array ||
        value instanceof Float64Array ||
        value instanceof BigInt64Array ||
        value instanceof BigUint64Array ||
        value instanceof FormData ||
        value instanceof URLSearchParams ||
        typeof value === 'string';
}
