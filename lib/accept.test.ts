import test from 'node:test';
import assert from 'node:assert';
import { Accept, ContentTypeCache } from "./accept.ts";

const cache = new ContentTypeCache([
  'text/html',
  'application/ld+json',
  'application/json',
]);

test('Matches with no accepts header', () => {
  const accept = Accept.from(new Request('https://example.com'));

  assert(accept.negotiate(cache) === 'text/html');
});

test('Matches with specific accepts header', () => {
  const accept = Accept.from(new Request('https://example.com', {
    headers: {
      accept: 'application/ld+json',
    },
  }));
  
  assert(accept.negotiate(cache) === 'application/ld+json');
});

test('Matches with glob header', () => {
  const accept = Accept.from(new Request('https://example.com', {
    headers: {
      accept: '*/*',
    },
  }));
  
  assert(accept.negotiate(cache) === 'text/html');
});

test('Matches with glob subtype header', () => {
  const accept = Accept.from(new Request('https://example.com', {
    headers: {
      accept: 'application/*',
    },
  }));
  
  assert(accept.negotiate(cache) === 'application/ld+json');
});

test('Matches q prioritizing in header', () => {
  const accept = Accept.from(new Request('https://example.com', {
    headers: {
      accept: 'text/html; q=0.5, application/json; q=1, text/cvs; q=.7',
    },
  }));

  assert(accept.negotiate(cache) === 'application/json');
});
