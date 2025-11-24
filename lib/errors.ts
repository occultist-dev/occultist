
import { STATUS_CODE } from '@std/http/status';
import { stringify } from '@libs/xml';

export type ProblemDetails = {
  status?: number;
  type?: string;
  instance?: string;
  title?: string;
  detail?: string;
  reason?: string;
  errors?: Array<{
    name: string;
    reason: string;
  }>;
};

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
    } else if (
      contentType === 'application/problem+xml' ||
      contentType === 'application/xml'
    ) {
      return stringify({
        '@version': '1.0',
        '@encoding': 'UTF-8',
        problem: {
          '@xmlns': 'urn:ietf:rfc:7807',
          ...this.problemDetails,
        },
      });
    }

    return JSON.stringify(this.problemDetails);
  }
}

export class InvalidActionParamsError extends ProblemDetailsError {
  constructor(title: string) {
    super(STATUS_CODE.BadRequest, { title, type: 'invalid-param' });
  }
}
