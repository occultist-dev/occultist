
export async function fileTransformer(value: File | string): Promise<File | Blob> {
  if (typeof value === 'string') {
    return fetch(value)
      .then((res) => res.blob())
      .catch(() => Promise.reject('Invalid data url'))
  }

  return value;
}
