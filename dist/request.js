import { Readable } from "node:stream";
export class WrappedRequest {
    #url;
    #req;
    #stream;
    #bodyUsed = false;
    #headers = new Headers();
    constructor(rootIRI, req) {
        this.#req = req;
        this.#url = new URL(req.url, rootIRI).toString();
        if (req instanceof Request) {
            this.#stream = req.body;
            this.#headers = req.headers;
        }
        else {
            this.#stream = Readable.toWeb(req);
            for (const [key, value] of Object.entries(req.headers)) {
                if (Array.isArray(value)) {
                    for (let i = 0; i < value.length; i++) {
                        this.#headers.append(key, value[i]);
                    }
                }
                else {
                    this.#headers.set(key, value);
                }
            }
        }
    }
    get body() {
        if (this.#bodyUsed) {
            throw new Error('Body has already been consumed');
        }
        this.#bodyUsed = true;
        return this.#stream;
    }
    arrayBuffer() {
        return new Response(this.body).arrayBuffer();
    }
    blob() {
        return new Response(this.body).blob();
    }
    bytes() {
        return new Response(this.body).bytes();
    }
    clone() {
        if (this.#bodyUsed) {
            throw new Error('Body has already been consumed');
        }
        const [a, b] = this.#stream.tee();
        this.#stream = a;
        return new Request(this.url, {
            ...this,
            body: b,
        });
    }
    async formData() {
        return new Request(this.url, {
            method: this.method,
            body: await this.arrayBuffer(),
            headers: this.headers,
        }).formData();
    }
    json() {
        return new Response(this.body).json();
    }
    text() {
        return new Response(this.body).text();
    }
    get bodyUsed() {
        return this.#bodyUsed;
    }
    get cache() {
        return 'default';
    }
    get credentials() {
        return 'same-origin';
    }
    get destination() {
        return '';
    }
    get duplex() {
        return undefined;
    }
    get headers() {
        return this.#headers;
    }
    get integrity() {
        return '';
    }
    get isHistoryNavigation() {
        return false;
    }
    get keepalive() {
        return false;
    }
    get method() {
        return this.#req.method ?? 'GET';
    }
    get mode() {
        return 'cors';
    }
    get redirect() {
        return 'follow';
    }
    get referrer() {
        return this.#headers.get('Referrer') ?? 'no-referrer';
    }
    get referrerPolicy() {
        const referrerPolicy = this.#headers.get('Referrer-Policy');
        if (Array.isArray(referrerPolicy)) {
            return referrerPolicy[0] ?? '';
        }
        return referrerPolicy ?? '';
    }
    get signal() {
        return undefined;
    }
    get url() {
        return this.#url;
    }
}
