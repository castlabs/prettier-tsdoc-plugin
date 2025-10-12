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
export function multipleParams(_name: string, _id: number, _options: object) {}

/**
 * Test function with mixed params
 *
 * @param name -
 * @param id - User identifier
 * @param options -
 * @internal
 */
export function mixedParams(_name: string, _id: number, _options: object) {}

/**
 * @typeParam T -
 * @internal
 */
export function genericFunc<T>(_value: T) {}
