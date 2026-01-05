import {describe, it} from 'node:test';
import assert from "node:assert";
import { Path } from "../../lib/actions/path.ts";

const rootURL = 'https://example.com';

describe('Path', () => {
  it('URI template style path creates valid URL Pattern', () => {
    const path = new Path(
      '/api/recipes/{recipeUUID}/ingredients/{ingredientUUID}/units'
        + '{?search,page,pageSize}'
        + '{#sliceStart,sliceEnd}',
      rootURL,
      false,
      false,
    );
  
    assert(path.pattern.test('https://example.com/api/recipes/xxxx-xxxx-xxxx-xxxx/ingredients/xxxx-xxxx-xxxx-xxxx/units'));
  });
  
  
  it('Auto adds language code and file extension parameters if setting enabled', () => {
    const route = '/foo/{xxx}/baa{?search,page}{#sliceStart,sliceEnd}';
    const path = new Path(
      route,
      rootURL,
      false,    
      false,
    );
    const path2 = new Path(
      route,
      rootURL,
      true,    
      false,
    );
    const path3 = new Path(
      route,
      rootURL,
      false,    
      true,
    );
    const path4 = new Path(
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
      { xxx: '123', languageCode: undefined, fileExtension: undefined },
    );
    assert.deepEqual(
      path4.regexp.exec('/foo/123/baa.en-NZ')?.groups,
      { xxx: '123', languageCode: undefined, fileExtension: 'en-NZ' },
    );
    assert.deepEqual(
      path4.regexp.exec('/foo/123/baa.html')?.groups,
      { xxx: '123' , languageCode: undefined, fileExtension: 'html' },
    );
    assert.deepEqual(
      path4.regexp.exec('/foo/123/baa.en-NZ.html')?.groups,
      { xxx: '123' , languageCode: 'en-NZ', fileExtension: 'html' },
    );
  });
  
  it('Does not conflict with other dot separated values when matching language code and file extension parameters', () => {
    const route = '/foo/{xxx}{.rev}{?search,page}{#sliceStart,sliceEnd}';
    const path = new Path(
      route,
      rootURL,
      true,    
      true,
    );
  
    assert.deepEqual(
      path.regexp.exec('/foo/doc.42341.en-NZ.html')?.groups,
      { xxx: 'doc', rev: '42341', languageCode: 'en-NZ', fileExtension: 'html' },
    );
  });
});
