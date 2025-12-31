
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

  /**
   * The name of the extension.
   */
  name: string;

  /**
   * Setup method which can perform async setup tasks
   * and report status via a readable stream.
   */
  setup?(): ReadableStream;

  /**
   * Retrieves a static assets from the extension.
   *
   * @param assetAlias The alias for the asset.
   */
  getAsset?(assetAlias: string): StaticAsset | undefined;

  /**
   * Root level aliases the extension uses to identify
   * the assets it manages.
   */
  staticAliases?: string[];

};

export interface StaticExtension {

  /**
   * The name of the extension.
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
