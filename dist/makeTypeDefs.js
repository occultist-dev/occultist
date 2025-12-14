import { joinPaths } from "./utils/joinPaths.js";
import { isPopulatedObject } from "./utils/isPopulatedObject.js";
import { isPopulatedString } from "./utils/isPopulatedString.js";
export function makeTypeDef(arg1, arg2) {
    let contextDefinition = {};
    let protect = false;
    let args;
    if (typeof arg1 === 'string') {
        args = {
            term: arg1,
            schema: arg2,
        };
    }
    else {
        args = arg1;
        if (typeof arg1.protect === 'boolean') {
            protect = arg1.protect;
        }
    }
    if (args.isIRI || isPopulatedString(args.container) ||
        isPopulatedObject(args.context)) {
        contextDefinition = {};
        if (args.isIRI) {
            contextDefinition['@type'] = '@id';
        }
        if (isPopulatedString(args.container)) {
            contextDefinition['@container'] = args.container;
        }
        if (isPopulatedObject(args.context)) {
            contextDefinition['@context'] = args.context;
        }
        if (protect) {
            contextDefinition['@protected'] = true;
        }
        if (isPopulatedString(args.schema)) {
            return {
                term: args.term,
                type: joinPaths(args.schema, args.term),
                contextDefinition,
            };
        }
        return {
            term: args.term,
            type: args.type,
            contextDefinition,
        };
    }
    if (protect) {
        contextDefinition = { '@protected': true };
    }
    if (isPopulatedString(args.schema)) {
        return {
            term: args.term,
            type: joinPaths(args.schema, args.term),
            contextDefinition,
        };
    }
    return {
        term: args.term,
        type: args.type,
        contextDefinition,
    };
}
export function makeTypeDefs(typeDefs) {
    const result = typeDefs.reduce((acc, typeDef) => ({
        ...acc,
        [typeDef.term]: typeDef,
    }), {});
    return result;
}
