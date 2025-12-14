export function getParamLocation(valueName, urlPattern) {
    if (urlPattern.pathname.includes(`:${valueName}`)) {
        return 'path';
    }
    return 'search';
}
