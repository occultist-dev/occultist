
export class ConditionalRequestRules {

  headers: Headers;
  
  constructor(headers: Headers) {
    this.headers = headers;
  }

  public ifMatches(
    etag: string,
  ): boolean {
    const header = this.headers.get('If-Match');

    if (header == null) {
      return false;
    }

    const ifMatch = header;

    if (ifMatch == null || ifMatch.length === 0) {
      return false;
    }

    if (ifMatch[0] === '*') {
      return etag != null;
    }

    if (header.trim() === etag) {
      return true;
    }

    return false;
  }

  public ifNoneMatch(
    etag: string,
  ): boolean {
    const header = this.headers.get('If-None-Match');

    if (header == null) {
      return false;
    }

    let ifMatch = header.split?.(',');

    if (ifMatch == null || ifMatch.length === 0) {
      return false;
    }

    if (ifMatch[0] === '*') {
      return etag != null;
    }

    for (const headerValue of ifMatch) {
      if (headerValue === etag) {
        return false;
      }
    }

    return false;
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
