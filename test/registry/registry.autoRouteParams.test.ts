import assert from 'node:assert/strict';
import { it, describe } from 'node:test';
import {Registry} from '../../lib/registry.ts';


const text = `\
Hello, World!
`;

const html = `\
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

const javascript = `\
console.log('Hello, World!');
`;

const xml = `\
<?xml version="1.0" encoding="UTF-8"?>
<message>
  Hello, World!
</message>
`;

function makeRegistry() {
  const registry = new Registry({
    rootIRI: 'https://example.com',
    autoRouteParams: true,
  });


  registry.http.get('/hello')
    .public()
    .handle('text/plain', text)
    .handle('text/html', html)
    .handle('application/javascript', javascript)
    .handle('application/xml', xml);

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
    assert.equal(await r1.text(), text);
    assert.equal(r2.headers.get('content-type'), 'text/plain');
    assert.equal(await r2.text(), text);
    assert.equal(r3.headers.get('content-type'), 'text/html');
    assert.equal(await r3.text(), html);
    assert.equal(r4.headers.get('content-type'), 'application/javascript');
    assert.equal(await r4.text(), javascript);
    assert.equal(r5.headers.get('content-type'), 'application/xml');
    assert.equal(await r5.text(), xml);
  });
  
  it('Favours the file extension over the accept header', async () => {
    const { registry } = makeRegistry();

    const requestInit = { headers: { 'Accept': 'text/plain' } };
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

    assert.equal(r1.headers.get('content-type'), 'text/plain');
    assert.equal(await r1.text(), text);
    assert.equal(r2.headers.get('content-type'), 'text/plain');
    assert.equal(await r2.text(), text);
    assert.equal(r3.headers.get('content-type'), 'text/html');
    assert.equal(await r3.text(), html);
    assert.equal(r4.headers.get('content-type'), 'application/javascript');
    assert.equal(await r4.text(), javascript);
    assert.equal(r5.headers.get('content-type'), 'application/xml');
    assert.equal(await r5.text(), xml);
  });

});
