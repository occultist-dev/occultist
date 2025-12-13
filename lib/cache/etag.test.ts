import assert from 'node:assert/strict';
import test from 'node:test';
import {EtagConditions} from './etag.ts';


test.describe('conditions.ifMatch()', () => {
  test('returns true when the header has the value of "*" and an etag is present', () => {
    const conditions = new EtagConditions(new Headers({
      'If-Match': '*',
    }));
  
    assert(conditions.ifMatch('"xxxx"'));
  });

  test('returns false when the header has the value of "*" and an etag is not present', () => {
    const conditions = new EtagConditions(new Headers({
      'If-Match': '*',
    }));
  
    assert(!conditions.ifMatch());
  });

  test('returns false when the header provides an etag and an etag is not present', () => {
    const conditions = new EtagConditions(new Headers({
      'If-Match': '"xxxx"',
    }));
  
    assert(!conditions.ifMatch());
  });

  test('returns false when the header provides an etag and a different etag is present', () => {
    const conditions = new EtagConditions(new Headers({
      'If-Match': '"xxxx"',
    }));
  
    assert(!conditions.ifMatch('"yyyy"'));
  });

  test('returns false when the header provides a matching but weak etag', () => {
    const conditions = new EtagConditions(new Headers({
      'If-Match': 'W\/"xxxx"',
    }));
  
    assert(!conditions.ifMatch('W\/"xxxx"'));
  });

  test('returns true when the header provides a matching etag', () => {
    const conditions = new EtagConditions(new Headers({
      'If-Match': '"xxxx"',
    }));
  
    assert(conditions.ifMatch('"xxxx"'));
  });

  test('returns true when the header provides a list containing a matching etag', () => {
    const conditions = new EtagConditions(new Headers({
      'If-Match': '"xxxx", "yyyy", "zzzz"',
    }));
  
    assert(conditions.ifMatch('"yyyy"'));
  });
});


test.describe('conditions.ifNoneMatch()', () => {
  test('returns true when the header has the value of "*" and an etag is not present', () => {
    const conditions = new EtagConditions(new Headers({
      'If-None-Match': '*',
    }));
  
    assert(conditions.ifNoneMatch());
  });

  test('returns false when the header has the value of "*" and an etag is present', () => {
    const conditions = new EtagConditions(new Headers({
      'If-None-Match': '*',
    }));
  
    assert(!conditions.ifNoneMatch('W\/"xxxx"'));
  });

  test('returns true when the header provides an etag and no representation etag is present', () => {
    const conditions = new EtagConditions(new Headers({
      'If-None-Match': 'W\/"xxxx"',
    }));
  
    assert(conditions.ifNoneMatch());
  });

  test('returns true when the header provides a non-matching etag', () => {
    const conditions = new EtagConditions(new Headers({
      'If-None-Match': 'W\/"xxxx"',
    }));
  
    assert(conditions.ifNoneMatch('W\/"yyyy"'));
  });

  test('returns true when the header provides a non-matching but strong etag', () => {
    const conditions = new EtagConditions(new Headers({
      'If-None-Match': '"yyyy"',
    }));
  
    assert(conditions.ifNoneMatch('"xxxx"'));
  });

  test('returns false when the header provides a matching etag', () => {
    const conditions = new EtagConditions(new Headers({
      'If-None-Match': 'W\/"xxxx"',
    }));
  
    assert(!conditions.ifNoneMatch('W\/"xxxx"'));
  });

  test('returns false when the header provides a list containing a matching etag', () => {
    const conditions = new EtagConditions(new Headers({
      'If-None-Match': 'W\/"xxxx", W\/"yyyy", W\/"zzzz"',
    }));
  
    assert(!conditions.ifNoneMatch('W\/"yyyy"'));
  });
});

