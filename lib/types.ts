
export interface StaticContext {
  link(alias: string, as: string): string;
}

export interface Extension {
  name: string;
  setup?(): ReadableStream;
  createStaticContext?(): StaticContext;
};

export type ProblemDetailsParam = {
  name: string;
  reason: string;
  pointer?: string;
};

export type ProblemDetails = {
  title: string;
  type?: string;
  detail?: string;
  instance?: string;
  errors?: Array<ProblemDetailsParam>;
};
