
export interface StaticAsset {
  alias: string;
  contentType: string;
  url: string;
  integrity?: string;
};

export interface StaticContext {
  link(alias: string, as: string): string;
}

export interface Extension {
  name: string;
  setup?(): ReadableStream;
  getAsset?(): StaticAsset | undefined;
  staticAliases?: string[];
};

export interface StaticAssetExtension {

  /**
   * The name of the static extension.
   */
  name: string;

  /**
   * Root level aliases the extension uses to identify
   * assets it manages.
   */
  staticAliases: string[];

  /**
   * Retrieves a static assets from the extension.
   *
   * @param assetAlias The alias for the asset.
   */
  getAsset(assetAlias: string): StaticAsset | undefined;

}

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

export type EndpointArgs = {

  /**
   * The name of the endpoint.
   */
  name?: string;

  /**
   * Enables language and file extension handling
   * if not already enabled.
   */
  autoRouteParams?: boolean;

  /**
   * Adds optional language tag handling to
   * the route parameters if not otherwise specified. 
   */
  autoLanguageTags?: boolean;

  /**
   * Adds optional file extension handling to
   * the route parameters if not otherwise specified. 
   */
  autoFileExtensions?: boolean;
}
