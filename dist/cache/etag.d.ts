export declare class EtagConditions {
    headers: Headers;
    constructor(headers: Headers);
    /**
     * Returns true if the representation is not modified based of
     * conditional headers and the value of the current representation's
     * etag. True results should result in a 304 response.
     *
     * @param representationEtag - The current etag value for this representation.
     */
    isNotModified(representationEtag?: string): boolean;
    ifMatch(representationEtag?: string): boolean;
    ifNoneMatch(representationEtag?: string): boolean;
    ifModifiedSince(): never;
    ifUnmodifiedSince(): never;
    ifRange(): never;
}
