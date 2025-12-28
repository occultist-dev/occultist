import assert from 'node:assert';
import { describe, it } from 'node:test';
import {makeCacheKey} from '../../lib/mod.ts';

describe('makeCacheKey', () => {
  const httpMethod = 'GET';
  const requestURL = 'https://example.com';
  const contentType = 'text/plain';
  const languageCode = 'en';
  const encoding: string | null = null;
  const requestHeaders = new Headers();
  const actionName = 'test';
  const authKey = null;
  const publicWhenAuthenticated = false;
  const cacheVersion = null;
  const cacheVary = null;

  it('Gives GET, HEAD, POST, PUT and DELETE the same cache key', () => {
    const keys = [
      makeCacheKey('GET', requestURL, contentType, languageCode, encoding, requestHeaders, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary),
      makeCacheKey('head', requestURL, contentType, languageCode, encoding, requestHeaders, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary),
      makeCacheKey('PoSt', requestURL, contentType, languageCode, encoding, requestHeaders, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary),
      makeCacheKey('Put', requestURL, contentType, languageCode, encoding, requestHeaders, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary),
      makeCacheKey('delete', requestURL, contentType, languageCode, encoding, requestHeaders, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary),
    ];

    for (let i = 1; i < keys.length; i++) {
      assert.equal(keys[0], keys[i]);
    }
  });

  it('Gives QUERY a different cache key', () => {
    const getKey = makeCacheKey('get', requestURL, contentType, languageCode, encoding, requestHeaders, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary);
    const queryKey = makeCacheKey('QUERY', requestURL, contentType, languageCode, encoding, requestHeaders, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary);

    assert.notEqual(getKey, queryKey);
  });

  it('Varies on the vary value', () => {
    const cacheVary = 'Foo bar FEE';
    const headers1 = new Headers({
      'foo': '1',
      'bar': '2',
      'fee': '3',
    });
    const headers2 = new Headers({
      'FOO': '1',
      'BAR': '2',
      'Fee': '3',
    });
    const headers3 = new Headers({
      'foo': '1',
      'bar': '2',
      'fee': '4',
    });

    const key1 = makeCacheKey(httpMethod, requestURL, contentType, languageCode, encoding, headers1, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary);
    const key2 = makeCacheKey(httpMethod, requestURL, contentType, languageCode, encoding, headers2, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary);
    const key3 = makeCacheKey(httpMethod, requestURL, contentType, languageCode, encoding, headers3, actionName, authKey, publicWhenAuthenticated, cacheVersion, cacheVary);

    assert.equal(key1, key2);
    assert.notEqual(key1, key3);
  });


});
