import { isPopulatedString } from "./isPopulatedString.js";

export function getInternalName({
  paramName,
  specValue,
}: {
  paramName: string;
  specValue: { internalTerm?: string };
}): string {
  if (isPopulatedString(specValue.internalTerm)) {
    return specValue.internalTerm;
  }

  return paramName;
}
