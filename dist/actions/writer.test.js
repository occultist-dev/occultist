import { createServer, request } from 'node:http';
import test from 'node:test';
import { ResponseWriter } from "./writer.js";
test('Writer writes hints', { only: true }, async () => {
    await new Promise((resolve, reject) => {
        const server = createServer();
        server.on('request', async (_req, res) => {
            console.log('REQ', _req);
            const writer = new ResponseWriter(res);
            await writer.writeEarlyHints({
                link: [
                    {
                        href: 'https://example.com/main.css',
                        as: 'stylesheet',
                        preload: true,
                        fetchPriority: 'high',
                    },
                    {
                        href: 'https://example.com/main.ts',
                        as: 'script',
                        preload: true,
                        fetchPriority: 'low',
                    }
                ],
            });
            writer.writeHead(200);
            res.end();
        });
        server.on('error', (err) => {
            reject(err);
        });
        server.listen(0, '127.0.0.1', async () => {
            const { port, address } = server.address();
            console.log('ADDRESS', address);
            const options = {
                port,
                host: address,
                method: 'GET',
                path: 'http://example.com:80',
            };
            const req = request(options);
            req.end();
            req.on('connect', (res, socket, head) => {
                console.log('got connected!');
                // Make a request over an HTTP tunnel
                socket.write('GET / HTTP/1.1\r\n' +
                    'Host: www.google.com:80\r\n' +
                    'Connection: close\r\n' +
                    '\r\n');
                socket.on('data', (chunk) => {
                    console.log(chunk.toString());
                });
                socket.on('end', () => {
                    server.close();
                    resolve();
                });
            });
            //const res = await fetch(`http://${address}:${port}`);
            //console.log('GOT RES', res);
            //console.log('TEXT', await res.text());
            //// await res.text();
            //console.log('GOT HEADERS', res.headers)
            //try {
            //assert(
            //  res.headers.get('link'),
            //  `</https://example.com/main.css>; rel=preload; as=stylesheet; fetchpriority=high, `
            //  + `</https://example.com/main.js>; rel=preload; as=script; fetchpriority=low`,
            //);
            //} catch (err) {
            //  console.log('ASSERTION FAILED', err);
            //  reject(err);
            //  return;
            //}
            //  console.log('CLOSING SERVER');
            //server.close();
            //console.log('RESOLVING');
            //resolve();
        });
    });
    console.log('DONE');
});
