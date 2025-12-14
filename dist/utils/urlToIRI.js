export function urlToIRI(value, rootIRI) {
    const url = new URL(value);
    const iri = new URL(rootIRI);
    iri.pathname = url.pathname;
    iri.search = url.search;
    iri.hash = url.hash;
    return iri.toString();
}
