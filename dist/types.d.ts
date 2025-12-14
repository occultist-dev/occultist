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
