import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ResponseWriter } from './writer.js';
test('Writer writes hints', () => {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.on('request', async (_req, res) => {
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
                        href: 'https://example.com/main.js',
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
            const res = await fetch(`http://${address}:${port}`);
            await res.text();
            assert(res.headers.get('link'), `</https://example.com/main.css>; rel=preload; as=stylesheet; fetchpriority=high, `
                + `</https://example.com/main.js>; rel=preload; as=script; fetchpriority=low`);
            server.close();
            resolve();
        });
    });
});
