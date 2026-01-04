
export function urlToIRI(value: string, rootURL: string) {
  const url = new URL(value);
  const iri = new URL(rootURL);

  iri.pathname = url.pathname;
  iri.search = url.search;
  iri.hash = url.hash;

  return iri.toString();
}
