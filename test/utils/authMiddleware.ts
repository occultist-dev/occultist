import type {AuthMiddleware, AuthState} from "../../lib/mod.ts";


const cookieRe = /^auth\s*=\s*(.+)/;

export type AuthStateGenerator =
  | AuthState
  | ((authKey: string) => AuthState)
;

/**
 * Creates an auth middleware for testing purposes. An auth state generator
 * function can be passed in to customize assignment of the resolved auth state.
 *
 * Auth keys can be provided headers, cookies or query strings to simulate
 * some realworld authentication options.
 *  Authorization: Bearer authKey
 *  Cookie: auth=authKey
 *  ?single-use-token=authKey
 *
 * In production systems the authentication key should be the result of querying
 * a database or identity system after identitying the requester via secury means.
 *
 * To force an authentication failure set the value of the auth key to 'BADBADBAD'.
 * 
 * @param generator An auth state generator which can be a static object
 *                  or a function returning a object.
 */
export function makeAuthMiddleware(generator?: AuthStateGenerator): AuthMiddleware {
  return  (req) => {
    let authKey: string;
    const authorization = req.headers.get('Authorization');
    const cookies = req.headers.get('Cookie');
    const singleUseToken = new URL(req.url).searchParams.get('single-use-token');
  
    if (singleUseToken != null) {
      authKey = singleUseToken;
    }
    
    if (authKey == null && cookies != null) {
      const values = cookies.split(';');
  
      let cookie: string;
      for (let i = 0; i < values.length; i++) {
        cookie = values[i].trim();
  
        if (cookieRe.test(cookie)) {
          cookieRe.lastIndex = 0;
          authKey = cookieRe.exec(cookie)[1].trim();
        }
      }
    }
    
    if (authKey == null && authorization != null) {
      authKey = authorization.replace('Bearer ', '');
    }
  
    if (typeof authKey !== 'string' || authKey.length === 0) {
      return;
    } else if (authKey === 'BADBADBAD') {
      return;
    }
  
    let authState: AuthState | undefined;

    if (typeof generator === 'function') {
      authState = generator(authKey);
    } else {
      authState = generator;
    }

    return [authKey, authState];
  };
}

/**
 * Middleware for testing purposes only.
 *
 * Auth keys can be provided headers, cookies or query strings to simulate
 * some realworld authentication options.
 *  Authorization: Bearer authKey
 *  Cookie: auth=authKey
 *  ?single-use-token=authKey
 *
 * In production systems the authentication key should be the result of querying
 * a database or identity system after identitying the requester via secury means.
 *
 * To force an authentication failure set the value of the auth key to 'BADBADBAD'.
 */
export const testAuthMiddleware = makeAuthMiddleware();

