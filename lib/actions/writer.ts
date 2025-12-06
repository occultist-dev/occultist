import { ServerResponse } from 'node:http';
import type { HintLink, HintArgs, HintObj } from './types.js';
import {Context} from './context.js';
import {ContextState} from './spec.js';
import {ReadStream} from 'node:fs';


function isHintLink(hint: HintObj | HintLink): hint is HintLink {
  return hint.href != null;
}

export type ResponseTypes =
  | ServerResponse
  | Response
;

export type ResponseBody =
  | null
  | string
  | Blob
  | Uint8Array
  | ReadStream
;

export interface HTTPWriter {
  writeEarlyHints(args: HintArgs): void;
  writeHead(status: number, headers?: Headers): void;
  writeBody(body: ResponseBody): void;
  response(): ResponseTypes;
};

export class FetchResponseWriter implements HTTPWriter {
  #res?: ServerResponse;
  #hints?: {
    link: string | string[];
  };
  #status?: number;
  #statusText?: string;
  #headers: Headers = new Headers();
  #body?: ResponseBody;

  constructor(
    res?: ServerResponse,
  ) {
    this.#res = res;
  }

  /**
   * Writes early hints to the request.
   *
   * Runtimes which do not support writing early hints will have the
   * headers added to the headers of the main response instead.
   */
  writeEarlyHints(args: HintArgs): Promise<void> {
    const links: string[] = []
    
    if (Array.isArray(args)) {
      for (let i = 0; i < args.length; i++) {
        links.push(this.#formatEarlyHint(args[i]));
      }
    } else if (typeof args === 'function') {
      const res = args();

      if (Array.isArray(res)) {
        for (let i = 0; i < res.length; i++) {
          links.push(this.#formatEarlyHint(res[i]))
        }
      } else if (isHintLink(res)) {
        links.push(this.#formatEarlyHint(res));
      } else if (Array.isArray(res.link)) {
        for (let i = 0; i < res.link.length; i++) {
          links.push(this.#formatEarlyHint(res.link[i]));
        }
      } else {
        links.push(this.#formatEarlyHint(res.link));
      }
    } else if (isHintLink(args)) {
      links.push(this.#formatEarlyHint(args));
    } else if (Array.isArray(args.link)) {
      for (let i = 0; i < args.link.length; i++) {
        links.push(this.#formatEarlyHint(args.link[i]));
      }
    } else {
      links.push(this.#formatEarlyHint(args.link));
    }

    if (this.#res == null) {
      this.#headers.append('Link', links.join(', '));
    } else {
      return new Promise((resolve) => {
        this.#res.writeEarlyHints({ 'Link': links.join(', ') }, resolve);
      });
    }
  }

  writeHead(status: number, headers?: Headers) {
    const res = this.#res;

    this.#status = status;
   
    if (headers != null) {
      this.#setHeaders(headers);
    }

    if (res instanceof ServerResponse && this.#hints != null) {
      res.writeHead(status, this.#hints);
    } else if (res instanceof ServerResponse) {
      res.writeHead(status);
    }
  }

  writeBody(body: ResponseBody): void {
    if (this.#res instanceof ServerResponse) {
      this.#res.write(body);
    } else {
      this.#body = body;
    }
  }

  response(): Response | ServerResponse {
    if (this.#res instanceof ServerResponse) {
      this.#res.end();
      
      return this.#res;
    }

    return new Response(this.#body, {
      status: this.#status,
      statusText: this.#statusText,
      headers: this.#headers,
    });
  }

  #setHeaders(headers: Headers): void {
    for (const [header, value] of headers.entries()) {
      if (Array.isArray(value)) {
        for (const item of value) {
          this.#headers.append(header, item);
        }
      } else {
        this.#headers.append(header, value);
      }
    }
  }

  #formatEarlyHint(hint: HintLink): string {
    let link: string = `</${hint.href}>`;

    if (hint.preload) {
      link += `; rel=preload`;
    }

    if (Array.isArray(hint.rel)) {
      link += '; ' + hint.rel.map((rel) => `rel=${rel}`)
        .join('; ') + '';
    } else if (hint.rel != null) {
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
