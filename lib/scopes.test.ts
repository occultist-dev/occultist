import assert from 'node:assert/strict';
import test from 'node:test';
import { Registry } from "./registry.js";
import { makeTypeDef, makeTypeDefs } from "./makeTypeDefs.js";


const typeDefs = makeTypeDefs([
  makeTypeDef('GetThing', 'https://schema.example.com/'),
  makeTypeDef('name', 'https://schema.org/'),
  makeTypeDef('description', 'https://schema.org/'),
]);

const registry = new Registry({
  rootIRI: 'https://example.com',
});

const scope = registry.scope('/actions')
  .public();

scope.http.get('get-thing', '/thing')
  .public()
  .define({
    typeDef: typeDefs.GetThing,
    spec: {
      name: {
        typeDef: typeDefs.name,
        valueMinLength: 3,
        valueRequired: true,
      },
      description: {
        type: 'https://schema.org/description',
        valueRequired: false,
      },
    },
  });

registry.finalize();

test('It responds with actions partials as a jsonld type map', async () => {
  const res = await registry.handleRequest(
    new Request('https://example.com/actions'),
  )
  const body = await res.json();

  assert.deepEqual(body[typeDefs.GetThing.type], {
    '@type': typeDefs.GetThing.type,
    '@id': 'https://example.com/actions/get-thing',
  });
});

test('It responds with actions partials as a jsonld type map', async () => {
  const res = await registry.handleRequest(
    new Request('https://example.com/actions/get-thing'),
  )
  const body = await res.json();
  
  // compacted representation is returned
  assert.equal(body['@id'], 'https://example.com/actions/get-thing');
  assert.equal(body['@type'], typeDefs.GetThing.term);
  assert.deepEqual(body[`${typeDefs.name.term}-input`], {
    '@type': 'https://schema.org/PropertyValueSpecification',
    valueRequired: true,
    valueMinLength: 3,
  });
  assert.deepEqual(body[`${typeDefs.description.term}-input`], {
    '@type': 'https://schema.org/PropertyValueSpecification',
    valueRequired: false,
  });
});

