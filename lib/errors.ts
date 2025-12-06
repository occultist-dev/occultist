import {ProblemDetails} from "./types.js";

// https://datatracker.ietf.org/doc/html/rfc9457
export class ProblemDetailsError extends Error {
  status: number;
  problemDetails: ProblemDetails;
  parentErr?: unknown;

  constructor(
    status: number,
    problemDetails: string | ProblemDetails,
    parentErr?: unknown,
  ) {
    const message = typeof problemDetails === 'string'
      ? problemDetails
      : problemDetails.title;

    super(message);

    this.status = status;
    this.parentErr = parentErr;

    if (typeof problemDetails === 'string') {
      this.problemDetails = { title: problemDetails };
    } else {
      this.problemDetails = problemDetails;
    }
  }

  toContent(contentType: string = 'application/ld+json') {
    if (contentType === 'text/html') {
      return `
        <!doctype html>
        <html lang="en">
        <head>
          <title>${this.problemDetails.title}</title>
        </head>
        <body>
          <h1>${this.problemDetails.title}</h1>

          <dl>
            ${this.problemDetails?.errors?.map((error) => {
              return `
                <dt>
                  <code>${error.name}</code>
                </dt>
                <dd>
                  ${error.reason}
                </dd>
              `;
            })}
          </dl>
        </body>
        </html>
      `;
    }

    return JSON.stringify(this.problemDetails);
  }
}

export class InvalidActionParamsError extends ProblemDetailsError {
  constructor(title: string) {
    super(400, { title, type: 'invalid-param' });
  }
}
