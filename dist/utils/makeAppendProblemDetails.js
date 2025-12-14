export function makeAppendProblemDetails(refs) {
    function appendProblemDetails({ title, detail, status, param, }) {
        if (refs.httpStatus == null) {
            refs.httpStatus = status;
        }
        else if (refs.httpStatus !== status &&
            refs.httpStatus < 400) {
            refs.httpStatus = status;
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
            }
            else {
                refs.problemDetails.errors.push(param);
            }
        }
    }
    return appendProblemDetails;
}
