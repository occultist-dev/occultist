import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {Registry} from '../../lib/registry.ts';

const registry = new Registry({
  rootIRI: 'https://example.com',
});

 registry.http.get('/')
   .public()
   .hint({
     link: {
       href: 'http://example.com/messages.json',
       type: 'application/json',
       preload: true,
     },
   })
   .handle('text/plain', (ctx) => {
     ctx.body = `Hello, world!`;
   })
   .handle('application/json', (ctx) => {
     ctx.body = JSON.stringify({
       foo: 'bar',
     });
   });
 
registry.http.post('/posty/post')
  .public()
  .handle('text/html', async (ctx) => {
    ctx.body = await Promise.resolve(`
      <!doctype html>
      <html>
        <body>Got it</body>
      </html>
    `);
  });

function checkPayloadTypesMap(args: {
  foo: string;
  fee: number;
  foe: Array<{ bar: boolean }>;
  baz: string[],
}) {
  return args;
}

registry.http.post('/foo/{fee}/bar{?baz}')
  .public()
  .define({
    spec: {
      foo: {
        dataType: 'string',
      },
      fee: {
        dataType: 'number',
        valueName: 'fee',
      },
      foe: {
        multipleValues: true,
        properties: {
          bar: {
            dataType: 'boolean',
            valueRequired: true,
          },
        },
      },
      baz: {
        dataType: 'string',
        multipleValues: true,
        valueName: 'baz',
      },
    },
  })
  .handle('application/json', (ctx) => {
    ctx.body = JSON.stringify(checkPayloadTypesMap(ctx.payload))
  });

registry.finalize();


test('It responds to request objects', async () => {
  const res = await registry.handleRequest(
    new Request('https://example.com'),
  );

  assert(await res.text() === 'Hello, world!');
});

test('It responds to node incoming messages', async () => {
  const res = await new Promise<Response>((resolve, reject) => {
    const server = createServer();

    server.on('request', async (req, res) => {
      await registry.handleRequest(req, res);
    });

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(0, '127.0.0.1', async () => {
      const { port, address } = server.address() as AddressInfo;
      const res = await fetch(`http://${address}:${port}`);

      server.close();

      resolve(res);
    });
  });

  assert(await res.text() === 'Hello, world!');
});

test('It uses the correct handler for the accepted content type', async () => {
  const res = await registry.handleRequest(
    new Request('https://example.com', {
      headers: { 'Accept': 'application/*' }
    }),
  );

  assert((await res.json()).foo === 'bar');
});

test('It responds to other HTTP methods', async () => {
  const res = await registry.handleRequest(
    new Request('https://example.com/posty/post', {
      method: 'POST',
      headers: { 'Accept': 'text/html' },
    })
  );

  assert((await res.text()).includes('<body>Got it</body>'))
});

test('It handles request payloads for application/json requests', {only:true}, async () => {
  const res = await registry.handleRequest(
    new Request('https://example.com/foo/1234/bar?baz=foo&baz=bar&baz=baz', {
      method: 'POST',
      body: JSON.stringify({
        foo: 'bar',
        foe: [
          { bar: true }, { bar: false },
        ],
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    }),
  );

  const body = await res.json();

  assert.deepEqual(body, {
    fee: 1234,
    foo: 'bar',
    foe: [{ bar: true }, { bar: false }],
    baz: ['foo', 'bar', 'baz'],
  });
});

test('It fires beforefinalize and after finalize events', () => {
  const called: string[] = [];
  const registry = new Registry({ rootIRI: 'https://example.com' });

  registry.addEventListener('beforefinalize', () => called.push('beforefinalize'));
  registry.addEventListener('afterfinalize', () => called.push('afterfinalize'))
  registry.finalize();

  assert(called[0] === 'beforefinalize');
  assert(called[1] === 'afterfinalize');
});

