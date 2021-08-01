export function exhaustiveCheck(bottom: never): never {
  throw new Error('Exhaustive check failed.');
}
