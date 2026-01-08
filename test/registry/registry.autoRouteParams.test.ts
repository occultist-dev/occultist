import assert from 'node:assert/strict';
import {it, describe} from 'node:test';
import {Registry} from '../../lib/registry.ts';
import {type HandlerFn} from '../../lib/mod.ts';


const textEn = `\
Hello, World!
`;
const textFr = `\
Salut tout le monde
`;

const htmlEn = `\
<!doctype html>
<html>
  <head>
    <title>Hello, World!</title>
  </head>
  <body>
    <h1>Hello, World!</h1>
  </body>
</html>
`;
const htmlFr= `\
<!doctype html>
<html>
  <head>
    <title>Salut tout le monde!</title>
  </head>
  <body>
    <h1>Salut tout le monde!</h1>
  </body>
</html>
`;


const javascriptEn = `\
console.log('Hello, World!');
`;
const javascriptFr = `\
console.log('Salut tout le monde!');
`;

const xmlEn = `\
<?xml version="1.0" encoding="UTF-8"?>
<message>
  Hello, World!
</message>
`;
const xmlFr = `\
<?xml version="1.0" encoding="UTF-8"?>
<message>
  Salut tout le monde!
</message>
`;

function enOrFr(enValue: string, frValue: string): HandlerFn {
  return (ctx) => {
    if (ctx.languageCode === 'en-NZ' || ctx.languageCode === 'en') {
      ctx.body = enValue;
    } else if (ctx.languageCode === 'fr') {
      ctx.body = frValue;
    } else {
      ctx.body = enValue;
    }
  }
}

function makeRegistry() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
    autoRouteParams: true,
  });


  registry.http.get('/hello')
    .public()
    .handle('text/plain', enOrFr(textEn, textFr))
    .handle('text/html', enOrFr(htmlEn, htmlFr))
    .handle('application/javascript', enOrFr(javascriptEn, javascriptFr))
    .handle('application/xml', enOrFr(xmlEn, xmlFr));

  return { registry };
}

describe('Registry({ autoRouteParams })', () => {
  
  it('Responds with the content type for the file extension if provided', async () => {
    const { registry } = makeRegistry();

    const [
      r1,
      r2,
      r3,
      r4,
      r5,
    ] = await Promise.all([
      registry.handleRequest(new Request('https://example.com/hello')),
      registry.handleRequest(new Request('https://example.com/hello.txt')),
      registry.handleRequest(new Request('https://example.com/hello.html')),
      registry.handleRequest(new Request('https://example.com/hello.js')),
      registry.handleRequest(new Request('https://example.com/hello.xml')),
    ]);

    assert.equal(r1.headers.get('content-type'), 'text/plain');
    assert.equal(await r1.text(), textEn);
    assert.equal(r2.headers.get('content-type'), 'text/plain');
    assert.equal(await r2.text(), textEn);
    assert.equal(r3.headers.get('content-type'), 'text/html');
    assert.equal(await r3.text(), htmlEn);
    assert.equal(r4.headers.get('content-type'), 'application/javascript');
    assert.equal(await r4.text(), javascriptEn);
    assert.equal(r5.headers.get('content-type'), 'application/xml');
    assert.equal(await r5.text(), xmlEn);
  });
  
  it('Favours the file extension over the accept header', async () => {
    const { registry } = makeRegistry();

    const requestInit = { headers: { 'Accept': 'text/html' } };
    const [
      r1,
      r2,
      r3,
      r4,
      r5,
    ] = await Promise.all([
      registry.handleRequest(new Request('https://example.com/hello', requestInit)),
      registry.handleRequest(new Request('https://example.com/hello.txt', requestInit)),
      registry.handleRequest(new Request('https://example.com/hello.html', requestInit)),
      registry.handleRequest(new Request('https://example.com/hello.js', requestInit)),
      registry.handleRequest(new Request('https://example.com/hello.xml', requestInit)),
    ]);

    assert.equal(r1.headers.get('content-type'), 'text/html');
    assert.equal(await r1.text(), htmlEn);
    assert.equal(r2.headers.get('content-type'), 'text/plain');
    assert.equal(await r2.text(), textEn);
    assert.equal(r3.headers.get('content-type'), 'text/html');
    assert.equal(await r3.text(), htmlEn);
    assert.equal(r4.headers.get('content-type'), 'application/javascript');
    assert.equal(await r4.text(), javascriptEn);
    assert.equal(r5.headers.get('content-type'), 'application/xml');
    assert.equal(await r5.text(), xmlEn);
  });

  it('Adds the language code to the context if the language param is used', async () => {
    const { registry } = makeRegistry();

    const [
      r1,
      r2,
      r3,
      r4,
      r5,
      r6,
      r7,
      r8,
      r9,
    ] = await Promise.all([
      registry.handleRequest(new Request('https://example.com/hello')),
      registry.handleRequest(new Request('https://example.com/hello.en.txt')),
      registry.handleRequest(new Request('https://example.com/hello.fr.txt')),
      registry.handleRequest(new Request('https://example.com/hello.en.html')),
      registry.handleRequest(new Request('https://example.com/hello.fr.html')),
      registry.handleRequest(new Request('https://example.com/hello.en.js')),
      registry.handleRequest(new Request('https://example.com/hello.fr.js')),
      registry.handleRequest(new Request('https://example.com/hello.en.xml')),
      registry.handleRequest(new Request('https://example.com/hello.fr.xml')),
    ]);

    assert.equal(r1.headers.get('content-type'), 'text/plain');
    assert.equal(await r1.text(), textEn);
    assert.equal(r2.headers.get('content-type'), 'text/plain');
    assert.equal(await r2.text(), textEn);
    assert.equal(r3.headers.get('content-type'), 'text/plain');
    assert.equal(await r3.text(), textFr);
    assert.equal(r4.headers.get('content-type'), 'text/html');
    assert.equal(await r4.text(), htmlEn);
    assert.equal(r5.headers.get('content-type'), 'text/html');
    assert.equal(await r5.text(), htmlFr);
    assert.equal(r6.headers.get('content-type'), 'application/javascript');
    assert.equal(await r6.text(), javascriptEn);
    assert.equal(r7.headers.get('content-type'), 'application/javascript');
    assert.equal(await r7.text(), javascriptFr);
    assert.equal(r8.headers.get('content-type'), 'application/xml');
    assert.equal(await r8.text(), xmlEn);
    assert.equal(r9.headers.get('content-type'), 'application/xml');
    assert.equal(await r9.text(), xmlFr);
  });
});
