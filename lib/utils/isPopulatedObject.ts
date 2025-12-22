import { isObject } from './isObject.ts';

/**
 * Returns true if the input value is a plain Javascript object with
 * at least one member.
 */
export function isPopulatedObject<ChildType>(value: unknown): value is Record<string, ChildType> {
  return isObject(value) && Object.keys(value).length > 0;
}
