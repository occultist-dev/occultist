export type ParamLocation = 'path' | 'search';
export declare function getParamLocation(valueName: string, urlPattern: URLPattern): ParamLocation;
