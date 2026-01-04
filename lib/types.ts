import type { Scope } from "./scopes.ts";

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

export interface StaticAssetExtension {

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

export type MethodArgs = {

  /**
   * A unique key for this action.
   */
  key?: string;

  /**
   * An array of tags to query this action by.
   */
  tags?: string | string[];

  /**
   * Enables language and file extension handling
   * if not already enabled.
   */
  autoRouteParams?: boolean;

  /**
   * Adds optional language code handling to
   * the route parameters if not otherwise specified. 
   */
  autoLanguageCodes?: boolean;

  /**
   * Adds optional file extension handling to
   * the route parameters if not otherwise specified. 
   */
  autoFileExtensions?: boolean;
}