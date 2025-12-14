import { makeTypeDef, makeTypeDefs } from "../makeTypeDefs.js";
import { contextBuilder } from "./contextBuilder.js";
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
export function getActionContext({ spec, vocab, aliases, }) {
    const typeDefs = Object.values(defaultTypeDefs);
    function searchAndAssignContextValues(term, propertySpec) {
        if (propertySpec.typeDef != null) {
            typeDefs.push(propertySpec.typeDef);
            typeDefs.push(makeTypeDef({
                term: `${term}-input`,
                type: `${propertySpec.typeDef.type}-input`,
            }));
        }
        else if (propertySpec.type === 'string') {
            typeDefs.push(makeTypeDef({ term, type: propertySpec.type }));
            typeDefs.push(makeTypeDef({
                term: `${term}-input`,
                type: `${propertySpec.type}-input`,
            }));
        }
        if (propertySpec.properties != null) {
            for (const [term, childPropertySpec] of Object.entries(propertySpec.properties)) {
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
