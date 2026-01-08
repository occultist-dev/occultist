import { ServerResponse } from 'node:http';
function isHintLink(hint) {
    return hint.href != null;
}
;
export class ResponseWriter {
    #res;
    #hints;
    #status;
    #statusText;
    #headers = new Headers();
    #body;
    constructor(res) {
        this.#res = res;
    }
    /**
     * Writes early hints to the request.
     *
     * Runtimes which do not support writing early hints will have the
     * headers added to the headers of the main response instead.
     */
    writeEarlyHints(args) {
        const links = [];
        if (Array.isArray(args)) {
            for (let i = 0; i < args.length; i++) {
                links.push(this.#formatEarlyHint(args[i]));
            }
        }
        else if (typeof args === 'function') {
            const res = args();
            if (Array.isArray(res)) {
                for (let i = 0; i < res.length; i++) {
                    links.push(this.#formatEarlyHint(res[i]));
                }
            }
            else if (isHintLink(res)) {
                links.push(this.#formatEarlyHint(res));
            }
            else if (Array.isArray(res.link)) {
                for (let i = 0; i < res.link.length; i++) {
                    links.push(this.#formatEarlyHint(res.link[i]));
                }
            }
            else {
                links.push(this.#formatEarlyHint(res.link));
            }
        }
        else if (isHintLink(args)) {
            links.push(this.#formatEarlyHint(args));
        }
        else if (Array.isArray(args.link)) {
            for (let i = 0; i < args.link.length; i++) {
                links.push(this.#formatEarlyHint(args.link[i]));
            }
        }
        else {
            links.push(this.#formatEarlyHint(args.link));
        }
        if (this.#res == null) {
            this.#headers.append('Link', links.join(', '));
        }
        else {
            this.#res.writeEarlyHints({ 'Link': links.join(', ') });
        }
    }
    mergeHeaders(headersInit) {
        this.#setHeaders(new Headers(headersInit));
    }
    writeHead(status, headers) {
        const res = this.#res;
        this.#status = status;
        if (headers != null) {
            this.#setHeaders(headers);
        }
        if (res instanceof ServerResponse && this.#hints != null) {
            res.writeHead(status, this.#hints);
        }
        else if (res instanceof ServerResponse) {
            res.writeHead(status);
        }
    }
    writeBody(body) {
        if (this.#res instanceof ServerResponse) {
            this.#res.write(body);
        }
        else {
            this.#body = body;
        }
    }
    response() {
        if (this.#res instanceof ServerResponse) {
            this.#res.end();
            return this.#res;
        }
        if (this.#body instanceof Uint8Array) {
        }
        return new Response(this.#body, {
            status: this.#status,
            statusText: this.#statusText,
            headers: this.#headers,
        });
    }
    #setHeaders(headers) {
        for (const [header, value] of headers.entries()) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    this.#headers.append(header, item);
                }
            }
            else {
                this.#headers.append(header, value);
            }
        }
    }
    #formatEarlyHint(hint) {
        let link = `<${encodeURI(hint.href)}>`;
        if (hint.preload) {
            link += `; rel=preload`;
        }
        if (Array.isArray(hint.rel)) {
            link += '; ' + hint.rel.map((rel) => `rel=${rel}`)
                .join('; ') + '';
        }
        else if (hint.rel != null) {
            link += `; rel=${hint.rel}`;
        }
        if (hint.as != null) {
            link += `; as=${hint.as}`;
        }
        if (hint.fetchPriority != null) {
            link += `; fetchpriority=${hint.fetchPriority}`;
        }
        if (hint.crossOrigin != null) {
            link += `; crossorigin=${hint.crossOrigin}`;
        }
        return link;
    }
}
