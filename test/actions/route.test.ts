import {describe, it} from 'node:test';
import assert from "node:assert";
import { Route } from "../../lib/actions/route.ts";

const rootURL = 'https://example.com';

describe('Route', () => {
  it('URI template style path creates valid RegExp', () => {
    const path = new Route(
      '/api/recipes/{recipeUUID}/ingredients/{ingredientUUID}/units'
        + '{?search,page,pageSize}'
        + '{#sliceStart,sliceEnd}',
      rootURL,
      false,
      false,
    );
  
    assert(path.regexp.test('/api/recipes/xxxx-xxxx-xxxx-xxxx/ingredients/xxxx-xxxx-xxxx-xxxx/units'));
  });
  
  it('Matches route path params and query params', () => {
    const template = '/foo/{xxx}/bar{?search,page}';
    const route = new Route(template, rootURL, true, true);
    const match = route.match('https://example.com/foo/123/bar.en-NZ.html?search=foo&page=10');

    assert.deepEqual(match, {
      path: { xxx: '123', languageTag: 'en-NZ', fileExtension: 'html' },
      query: { search: 'foo', page: '10' },
    });
  });
  
  it('Auto adds language tag and file extension parameters if setting enabled', () => {
    const route = '/foo/{xxx}/baa{?search,page}{#sliceStart,sliceEnd}';
    const path = new Route(
      route,
      rootURL,
      false,    
      false,
    );
    const path2 = new Route(
      route,
      rootURL,
      true,    
      false,
    );
    const path3 = new Route(
      route,
      rootURL,
      false,    
      true,
    );
    const path4 = new Route(
      route,
      rootURL,
      true,    
      true,
    );
  
    assert.deepEqual(
      path.regexp.exec('/foo/123/baa')?.groups,
      { xxx: '123' },
    );
    assert.deepEqual(
      path.regexp.exec('/foo/123/baa.en-NZ')?.groups,
      undefined,
    );
    assert.deepEqual(
      path.regexp.exec('/foo/123/baa.html')?.groups,
      undefined,
    );
    assert.deepEqual(
      path.regexp.exec('/foo/123/baa.en-NZ.html')?.groups,
      undefined,
    );
  
    assert.deepEqual(
      path2.regexp.exec('/foo/123/baa')?.groups,
      { xxx: '123' },
    );
    assert.deepEqual(
      path2.regexp.exec('/foo/123/baa.en-NZ')?.groups,
      undefined,
    );
    assert.deepEqual(
      path2.regexp.exec('/foo/123/baa.html')?.groups,
      undefined,
    );
    assert.deepEqual(
      path2.regexp.exec('/foo/123/baa.en-NZ.html')?.groups,
      undefined,
    );
  
    assert.deepEqual(
      path3.regexp.exec('/foo/123/baa')?.groups,
      { xxx: '123', fileExtension: undefined },
    );
    assert.deepEqual(
      path3.regexp.exec('/foo/123/baa.en-NZ')?.groups,
      { xxx: '123', fileExtension: 'en-NZ' },
    );
    assert.deepEqual(
      path3.regexp.exec('/foo/123/baa.html')?.groups,
      { xxx: '123', fileExtension: 'html' },
    );
    assert.deepEqual(
      path3.regexp.exec('/foo/123/baa.en-NZ.html')?.groups,
      undefined,
    );
  
    assert.deepEqual(
      path4.regexp.exec('/foo/123/baa')?.groups,
      { xxx: '123', languageTag: undefined, fileExtension: undefined },
    );
    assert.deepEqual(
      path4.regexp.exec('/foo/123/baa.en-NZ')?.groups,
      { xxx: '123', languageTag: undefined, fileExtension: 'en-NZ' },
    );
    assert.deepEqual(
      path4.regexp.exec('/foo/123/baa.html')?.groups,
      { xxx: '123' , languageTag: undefined, fileExtension: 'html' },
    );
    assert.deepEqual(
      path4.regexp.exec('/foo/123/baa.en-NZ.html')?.groups,
      { xxx: '123' , languageTag: 'en-NZ', fileExtension: 'html' },
    );
  });
  
  it('Does not conflict with other dot separated values when matching language tag and file extension parameters', () => {
    const route = '/foo/{xxx}{.rev}{?search,page}{#sliceStart,sliceEnd}';
    const path = new Route(
      route,
      rootURL,
      true,    
      true,
    );
  
    assert.deepEqual(
      path.regexp.exec('/foo/doc.42341.en-NZ.html')?.groups,
      { xxx: 'doc', rev: '42341', languageTag: 'en-NZ', fileExtension: 'html' },
    );
  });
});
