/**
 * @param name -
 * @internal
 */
export function testme(name: string) {
  console.log('Foo bar', name);
}

/**
 * Test function with multiple empty params
 *
 * @param name -
 * @param id -
 * @param options -
 * @internal
 */
export function multipleParams(name: string, id: number, options: object) {
  console.log('Foo bar', name, id, options);
}

/**
 * Test function with mixed params
 *
 * @param name -
 * @param id - User identifier
 * @param options -
 * @internal
 */
export function mixedParams(name: string, id: number, options: object) {
  console.log('Foo bar', name, id, options);
}

/**
 * @typeParam T -
 * @internal
 */
export function genericFunc<T>(value: T) {
  console.log('Generic', value);
}
