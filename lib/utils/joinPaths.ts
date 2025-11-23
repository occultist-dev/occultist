export function joinPaths(...paths: Array<string | number>): string {
  let fullPath: string = '';

  if (paths[0] == null || paths[0] == '') {
    throw new Error(
      'The first path must be a populated string when joining paths',
    );
  }

  for (const pathSrc of paths) {
    let path: string | null = null;

    if (typeof pathSrc === 'number') {
      path = `${pathSrc}`;
    } else if (typeof pathSrc === 'string') {
      path = pathSrc;
    }

    if (path == null || path == '') {
      continue;
    }

    if (fullPath === '') {
      fullPath = path;
    } else if (fullPath.endsWith('/') && path.startsWith('/')) {
      fullPath += path.replace(/^\//, '');
    } else if (fullPath.endsWith('/') || path.startsWith('/')) {
      fullPath += path;
    } else {
      fullPath += `/${path}`;
    }
  }

  return fullPath;
}

