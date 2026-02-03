// https://datatracker.ietf.org/doc/html/rfc9457
export class ProblemDetailsError extends Error {
    status;
    problemDetails;
    parentErr;
    constructor(status, problemDetails, parentErr) {
        const message = typeof problemDetails === 'string'
            ? problemDetails
            : problemDetails.title;
        super(message);
        this.status = status;
        this.parentErr = parentErr;
        if (typeof problemDetails === 'string') {
            this.problemDetails = { title: problemDetails };
        }
        else {
            this.problemDetails = problemDetails;
        }
    }
    toContent(contentType = 'application/ld+json') {
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
export class BadRequestError extends ProblemDetailsError {
    constructor(title) {
        super(400, { title, type: 'bad-request' });
    }
}
export class NotFoundError extends ProblemDetailsError {
    constructor(title) {
        super(404, { title, type: 'not-found' });
    }
}
