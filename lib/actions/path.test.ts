import test from 'node:test';
import assert from "node:assert";
import { Path } from "./path.ts";


test('URI template style path creates valid URL Pattern', () => {
  const path = new Path(
    '/api/recipes/{recipeUUID}/ingredients/{ingredientUUID}/units'
      + '{?search,page,pageSize}'
      + '{#sliceStart,sliceEnd}',
    'https://example.com',
  );

  assert(path.pattern.test('https://example.com/api/recipes/xxxx-xxxx-xxxx-xxxx/ingredients/xxxx-xxxx-xxxx-xxxx/units'));
});
