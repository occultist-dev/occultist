import {IncomingMessage} from "node:http";
import {Readable} from "node:stream";
import {normalizeURL} from "./utils/normalizeURL.ts";


export class WrappedRequest implements Request {

  #url: string;
  #req: Request | IncomingMessage;
  #stream: ReadableStream;
  #bodyUsed: boolean = false;
  #headers: Headers = new Headers();

  constructor(rootIRI: string, req: Request | IncomingMessage) {
    this.#req = req;
    this.#url = normalizeURL(rootIRI, req.url);

    if (req instanceof Request) {
      this.#stream = req.body;
      this.#headers = req.headers;
    } else {
      this.#stream = Readable.toWeb(req) as ReadableStream;
    
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            this.#headers.append(key, value[i]);
          }
        } else {
          this.#headers.set(key, value);
        }
      }
    }
  }

  get body(): ReadableStream {
    if (this.#bodyUsed) {
      throw new Error('Body has already been consumed');
    }

    this.#bodyUsed = true;
    return this.#stream;
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    return new Response(this.body).arrayBuffer();
  }

  blob(): Promise<Blob> {
    return new Response(this.body).blob();
  }

  bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return new Response(this.body).bytes();
  }

  clone(): Request {
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

  formData(): Promise<FormData> {
    return new Response(this.body).formData();
  }

  json(): Promise<unknown> {
    return new Response(this.body).json();
  }

  text(): Promise<string> {
    return new Response(this.body).text();
  }

  get bodyUsed(): boolean {
    return this.#bodyUsed;
  }

  get cache(): RequestCache {
    return 'default';
  }

  get credentials(): RequestCredentials {
    return 'same-origin';
  }

  get destination(): RequestDestination {
    return '';
  }

  get duplex(): undefined | 'half' {
    return undefined;
  }

  get headers(): Headers {
    return this.#headers;
  }

  get integrity(): string {
    return '';
  }
  
  get isHistoryNavigation(): boolean {
    return false;
  }
  
  get keepalive(): boolean {
    return false;
  }

  get method(): string {
    return this.#req.method ?? 'GET';
  }

  get mode(): RequestMode {
    return 'cors';
  }

  get redirect(): RequestRedirect {
    return 'follow';
  }

  get referrer(): string {
    return this.#headers.get('Referrer') ?? 'no-referrer';
  }

  get referrerPolicy(): ReferrerPolicy {
    const referrerPolicy = this.#headers.get('Referrer-Policy');

    if (Array.isArray(referrerPolicy)) {
      return referrerPolicy[0] as ReferrerPolicy ?? '';
    }

    return referrerPolicy as ReferrerPolicy ?? '';
  }

  get signal(): AbortSignal | undefined {
    return undefined;
  }

  get url(): string {
    return this.#url;
  }
}
