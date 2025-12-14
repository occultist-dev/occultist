import { isPopulatedString } from "./isPopulatedString.js";
export function getInternalName({ paramName, specValue, }) {
    if (isPopulatedString(specValue.internalTerm)) {
        return specValue.internalTerm;
    }
    return paramName;
}
