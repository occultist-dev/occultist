import type {ProblemDetailsParam, ProblemDetails} from '../types.ts';

export type AppendProblemDetails = (args: {
  status: number;
  title?: string,
  detail?: string,
  param?: ProblemDetailsParam;
}) => void;

export type ProblemDetailsParamsRefs = {
  title?: string;
  detail?: string;
  httpStatus?: number;
  problemDetails?: ProblemDetails;
};

export function makeAppendProblemDetails(
  refs: ProblemDetailsParamsRefs
): AppendProblemDetails {
  function appendProblemDetails({
    title,
    detail,
    status,
    param,
  }: {
    status: number;
    title?: string,
    detail?: string,
    param?: ProblemDetailsParam;
  }) {
    if (refs.httpStatus == null) {
      refs.httpStatus = status;
    } else if (
      refs.httpStatus !== status &&
      refs.httpStatus < 400
    ) {
      refs.httpStatus = status
    }

    if (!refs.problemDetails) {
      refs.problemDetails = {
        title: title ??= "Bad request",
        detail: detail ??= "Invalid parameters",
      };
    }
    
    if (param) {
      if (!Array.isArray(refs.problemDetails.errors)) {
        refs.problemDetails.errors = [param];
      } else {
        refs.problemDetails.errors.push(param);
      }
    }
  }

  return appendProblemDetails;
}
