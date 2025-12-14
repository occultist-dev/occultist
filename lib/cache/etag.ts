
export class EtagConditions {

  headers: Headers;
  
  constructor(headers: Headers) {
    this.headers = headers;
  }

  /**
   * Returns true if the representation is not modified based of
   * conditional headers and the value of the current representation's
   * etag. True results should result in a 304 response.
   *
   * @param representationEtag - The current etag value for this representation.
   */
  public isNotModified(representationEtag?: string): boolean {
    if (this.headers.has('If-Match')) {
      return this.ifMatch(representationEtag);
    } else if (this.headers.has('If-None-Match')) {
      return !this.ifNoneMatch(representationEtag);
    }

    return false;
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
