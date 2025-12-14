/**
 * Returns true if the input value is a plain Javascript object with
 * at least one member.
 */
export declare function isPopulatedObject<ChildType>(value: unknown): value is Record<string, ChildType>;
