export type ShallowMerge<T1 extends object, T2 extends object> = {
    [K in keyof T1 & keyof T2]: T1[K] | T2[K];
} & ({
    [K in Exclude<keyof T1, keyof T2>]: T1[K];
}) & ({
    [K in Exclude<keyof T2, keyof T1>]: T2[K];
});
export type DeepMergeTwoTypes<T, U> = [
    T,
    U
] extends [any[], any[]] ? Zip_DeepMergeTwoTypes<T, U> : [T, U] extends [{
    [key: string]: unknown;
}, {
    [key: string]: unknown;
}] ? MergeTwoObjects<T, U> : T | U;
export type DeepMerge<T1, T2> = (T1 extends object ? (T2 extends object ? (MergeToOne<({
    [K in (keyof T2 & keyof T1 & RequiredKeys<T1 | T2>)]: DeepMerge<T1[K], T2[K]>;
} & {
    [K in (keyof T2 & keyof T1 & OptionalKeys<T1 | T2>)]?: DeepMerge<T1[K], T2[K]>;
} & {
    [K in Exclude<RequiredKeys<T1>, keyof T2>]: T1[K];
} & {
    [K in Exclude<OptionalKeys<T1>, keyof T2>]?: T1[K];
} & {
    [K in Exclude<RequiredKeys<T2>, keyof T1>]: T2[K];
} & {
    [K in Exclude<OptionalKeys<T2>, keyof T1>]?: T2[K];
})>) : (T1 extends object ? T2 : T1 | T2)) : (T2 extends object ? T1 : T1 | T2));
type Head<T> = T extends [infer I, ...infer _Rest] ? I : never;
type Tail<T> = T extends [infer _I, ...infer Rest] ? Rest : never;
type Zip_DeepMergeTwoTypes<T, U> = T extends [] ? U : U extends [] ? T : [
    DeepMergeTwoTypes<Head<T>, Head<U>>,
    ...Zip_DeepMergeTwoTypes<Tail<T>, Tail<U>>
];
/**
 * Take two objects T and U and create the new one with uniq keys for T a U objectI
 * helper generic for `DeepMergeTwoTypes`
 */
type GetObjDifferentKeys<T, U, T0 = Omit<T, keyof U> & Omit<U, keyof T>, T1 = {
    [K in keyof T0]: T0[K];
}> = T1;
/**
 * Take two objects T and U and create the new one with the same objects keys
 * helper generic for `DeepMergeTwoTypes`
 */
type GetObjSameKeys<T, U> = Omit<T | U, keyof GetObjDifferentKeys<T, U>>;
type MergeTwoObjects<T, U, T0 = Partial<GetObjDifferentKeys<T, U>> & {
    [K in keyof GetObjSameKeys<T, U>]: DeepMergeTwoTypes<T[K], U[K]>;
}, T1 = {
    [K in keyof T0]: T0[K];
}> = T1;
type MergeToOne<T> = (T extends object ? {
    [K in keyof T]: (K extends RequiredKeys<T> ? Exclude<T[K], undefined> : T[K]);
} : never);
type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];
type OptionalKeys<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];
export {};
