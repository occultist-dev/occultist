
export class EtagConditions {

  headers: Headers;
  
  constructor(headers: Headers) {
    this.headers = headers;
  }

  public ifMatch(
    representationEtag?: string,
  ): boolean {
    let etag: string;
    const header = this.headers.get('If-Match');

    if (header == null) {
      return true;
    } else if (header.trim() === '*') {
      return representationEtag != null;
    }

    const etags = header.split?.(',');

    if (etags.length === 0) {
      return true;
    } else if (representationEtag == null) {
      return false;
    }

    for (let i = 0; i < etags.length; i++) {
      etag = etags[i].trim();

      // If-Match ignores weak etags
      if (etag.startsWith('W\/')) {
        continue;
      } else if (etag === representationEtag) {
        return true;
      }
    }

    return false;
  }

  public ifNoneMatch(
    representationEtag?: string,
  ): boolean {
    let etag: string;
    const header = this.headers.get('If-None-Match');

    if (header == null || representationEtag == null) {
      return true;
    }

    const etags = header.split?.(',');

    if (etags.length === 0) {
      return true;
    }

    if (etags[0] === '*') {
      return representationEtag == null;
    }

    for (let i = 0; i < etags.length; i++) {
      etag = etags[i].trim();

      if (!etag.startsWith('W\/')) {
        continue;
      } else if (etag === representationEtag) {
        return false;
      }
    }

    return true;
  }

  public ifModifiedSince(): never {
    throw new Error('Not implemented');
  }
  
  public ifUnmodifiedSince(): never {
    throw new Error('Not implemented');
  }

  public ifRange(): never {
    throw new Error('Not implemented');
  }

}
