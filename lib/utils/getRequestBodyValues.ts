import { ProblemDetailsError } from "../errors.ts";
import type { JSONValue, JSONObject } from "../jsonld.ts";
import type { ContextState, ActionSpec, PropertySpec } from "../actions/spec.ts";
import jsonld, {type ContextDefinition} from 'jsonld';
import type { ImplementedAction } from "../actions/types.ts";


// export type BodyValue = Record<string, FileInput | FileInput[] | JSONValue>;
export type BodyValue = Record<string, JSONValue>;


export type RequestBodyResult = {
  bodyValues: BodyValue;
};

export async function getRequestBodyValues<
  State extends ContextState = ContextState,
  Spec extends ActionSpec<ContextState> = ActionSpec<ContextState>,
>({
  req,
  action,
}: {
  req: Request,
  action: ImplementedAction<State, Spec>,
}): Promise<RequestBodyResult> {
  let bodyValues: BodyValue = Object.create(null);
  const contentType = req.headers.get('content-type');
  const mappedTypes: Record<string, {
    term: string;
    propertySpec: PropertySpec;
  }> = Object.entries<PropertySpec>(action.spec)
    .reduce((acc, [term, propertySpec]) => {
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

      let term: string | undefined;
      let propertySpec: PropertySpec | undefined;

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
      } else if (part.name) {
        term = mappedTypes[name].term;
        propertySpec = mappedTypes[name].propertySpec;
      } else {
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
      } else if (propertySpec.dataType === 'boolean') {
        bodyValues[term] = textValue === 'true';
      } else {
        bodyValues[term] = textValue;
      }
    }
  } else if (contentType?.startsWith('application/json')) {
    try {
      bodyValues = await req.json();
    } catch {
      throw new ProblemDetailsError(400, {
        title: 'Failed to parse JSON body',
      });
    }
  } else if (contentType?.startsWith('application/ld+json')) {
    let source: JSONValue;
    let expanded: jsonld.JsonLdDocument;
    let compacted: jsonld.NodeObject | undefined;

    try {
      source = await req.json();
    } catch {
      throw new ProblemDetailsError(400, {
        title: 'Failed to parse JSON body',
      });
    }

    try {
      expanded = await jsonld.expand(source as jsonld.JsonLdDocument);
    } catch {
      throw new ProblemDetailsError(400, {
        title: 'Failed to expand JSON-LD body',
      });
    }

    try {
      compacted = await jsonld.compact(expanded, action.context as ContextDefinition)
    } catch {
      throw new ProblemDetailsError(400, {
        title: 'Failed to compact JSON-LD body',
      });
    }

    delete compacted['@context'];

    bodyValues = compacted as JSONObject;
  }

  Object.freeze(bodyValues);

  return { bodyValues };
}
