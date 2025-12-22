import { isPopulatedString } from "./isPopulatedString.ts";

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
