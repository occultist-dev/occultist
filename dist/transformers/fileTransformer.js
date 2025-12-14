export async function fileTransformer(value) {
    if (typeof value === 'string') {
        return fetch(value)
            .then((res) => res.blob())
            .catch(() => Promise.reject('Invalid data url'));
    }
    return value;
}
