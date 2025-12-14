export type UnauthenticatedAuthContext = {
    authenticated: false;
    authKey: undefined;
};
export type AuthenticatedAuthContext = {
    authenticated: true;
    authKey: string;
};
export type AuthState = Record<string, any>;
export type AuthMiddlewareResponse<State extends AuthState = AuthState> = {
    authKey?: string;
    allowPublic?: boolean;
    state: State;
};
