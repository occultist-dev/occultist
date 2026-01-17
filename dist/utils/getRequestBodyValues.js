import { ProblemDetailsError } from "../errors.js";
import { expand } from '@occultist/mini-jsonld';
export async function getRequestBodyValues({ req, action, }) {
    let bodyValues = Object.create(null);
    const contentType = req.headers.get('content-type');
    const mappedTypes = Object.entries(action.spec)
        .reduce((acc, [term, propertySpec]) => {
        if (propertySpec.typeDef == null)
            return acc;
        return {
            ...acc,
            [propertySpec.typeDef.term]: {
                term,
                propertySpec,
            },
            [propertySpec.type || propertySpec.typeDef?.type]: {
                term,
                propertySpec,
            },
        };
    }, {});
    if (contentType?.startsWith('multipart/form-data')) {
        // multipart should be sent using expanded types which get normalized
        // into the compact terms for each type.
        // otherwise json requests would need to also need to use
        // expanded terms.
        const formData = await req.formData();
        for (const [name, part] of formData.entries()) {
            if (typeof name !== 'string') {
                throw new ProblemDetailsError(400, {
                    title: 'Unnamed parameter in request multipart body',
                });
            }
            let term;
            let propertySpec;
            if (typeof part !== 'string' && (part.type && !part.type.startsWith('text/plain'))) {
                term = mappedTypes[name].term;
                propertySpec = mappedTypes[name].propertySpec;
                if (!term || !propertySpec) {
                    continue;
                }
                if (propertySpec.dataType !== 'file') {
                    throw new ProblemDetailsError(400, {
                        title: `Unexpected content '${name}' in request multipart body`,
                    });
                }
                //bodyValues[term] = part;
                bodyValues[term] = null;
                continue;
            }
            if (typeof part === 'string' || part.type === 'text/plain' || part.type == null) {
                term = mappedTypes[name].term;
                propertySpec = mappedTypes[name].propertySpec;
            }
            else if (part.name) {
                term = mappedTypes[name].term;
                propertySpec = mappedTypes[name].propertySpec;
            }
            else {
                throw new ProblemDetailsError(400, {
                    title: `Unexpected content '${name}' in request multipart body`,
                });
            }
            if (!term || !propertySpec) {
                continue;
            }
            const textValue = typeof part === 'string' ? part : await part.text();
            if (!textValue) {
                continue;
            }
            if (propertySpec.dataType === 'number' && /\d+(\.\d+)?/.test(textValue)) {
                bodyValues[term] = Number(textValue);
            }
            else if (propertySpec.dataType === 'boolean') {
                bodyValues[term] = textValue === 'true';
            }
            else {
                bodyValues[term] = textValue;
            }
        }
    }
    else if (contentType?.startsWith('application/json')) {
        try {
            bodyValues = await req.json();
        }
        catch {
            throw new ProblemDetailsError(400, {
                title: 'Failed to parse JSON body',
            });
        }
    }
    else if (contentType?.startsWith('application/ld+json')) {
        let source;
        try {
            source = await req.json();
        }
        catch {
            throw new ProblemDetailsError(400, {
                title: 'Failed to parse JSON body',
            });
        }
        try {
            bodyValues = await expand(source);
        }
        catch {
            throw new ProblemDetailsError(400, {
                title: 'Failed to expand JSON-LD body',
            });
        }
    }
    Object.freeze(bodyValues);
    return { bodyValues };
}
