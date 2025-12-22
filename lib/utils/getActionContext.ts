import type { JSONLDContext, TypeDef } from "../jsonld.ts";
import { makeTypeDef, makeTypeDefs } from "../makeTypeDefs.ts";
import { contextBuilder } from "./contextBuilder.ts";
import type { ActionSpec, PropertySpec } from '../actions/spec.ts';

const defaultTypeDefs = makeTypeDefs([
  makeTypeDef({ schema: 'https://schema.org/', term: 'Entrypoint' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'target' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'httpMethod' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'urlTemplate' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'PropertyValueSpecification' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'maxValue' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'minValue' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'readonlyValue' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'stepValue' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'valueName' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'valueRequired' }),
  makeTypeDef({ schema: 'https://schema.org/', term: 'multipleValues' }),
]);

export function getActionContext({
  spec,
  vocab,
  aliases,
}: {
  vocab?: string;
  aliases?: Record<string, string>;
  // deno-lint-ignore no-explicit-any
  spec: ActionSpec
}): JSONLDContext {
  const typeDefs: TypeDef[] = Object.values(defaultTypeDefs);

  function searchAndAssignContextValues(
    term: string,
    propertySpec: PropertySpec,
  ) {
    if (propertySpec.typeDef != null) {
      typeDefs.push(propertySpec.typeDef);
      typeDefs.push(
        makeTypeDef({
          term: `${term}-input`,
          type: `${propertySpec.typeDef.type}-input`,
        }),
      );
    } else if (propertySpec.type === 'string') {
      typeDefs.push(makeTypeDef({ term, type: propertySpec.type }));
      typeDefs.push(
        makeTypeDef({
          term: `${term}-input`,
          type: `${propertySpec.type}-input`,
        }),
      );
    }

    if (propertySpec.properties != null) {
      for (
        const [term, childPropertySpec] of Object.entries(
          propertySpec.properties,
        )
      ) {
        searchAndAssignContextValues(term, childPropertySpec);
      }
    }
  }

  for (const [term, propertySpec] of Object.entries(spec)) {
    searchAndAssignContextValues(term, propertySpec);
  }


  return contextBuilder({
    vocab,
    aliases,
    typeDefs,
  });
}
