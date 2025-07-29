/**
 * This is one of the comments we would like to have formatted and we create a
 * long line that the formatter should wrap for us.
 *
 * We can also try a list that should be formatted using the markdown formatter:
 *
 * - This is the first item
 * - This is the second one
 * - This is the third item and I hope that this very long line will be wrapped by
 *   the plugin and then it will continue on the next line
 * Here is one example, now let see what happens to the parameters
 *
 * @param name - The name param should receive a and maybe it should also be
 *   formatted over multiple lines.
 * @param second - The second thing
 * @internal
 *
 * @example This is an example
 * ```typescript
 * const a = internal()
 * ```
 *
 * And does this text now become part of the example?
 */
export function long_line_test(name: string, second: string) {
  console.log(`Hello ${name} ${second}`);
}

/**
 * Well this is just a small function that we have in place for internal usage
 * only. The point here is that this line should be split into two.
 *
 * The other thing that we are going to add to this function is an example with
 * some TypeScript code. But before we do this lets try a {@link http://verylongurls.that.goes.way.over.com | long link} that
 * should not be split.
 *
 * @example This is an example
 * ```typescript
 * const a = internal()
 * ```
 */
function internal() {
  console.log('This is an internal function');
}
/**
 * This is a function that renders HTML such as:
 *
 * @example This HTML example
 * ```html
 * <html>
 *   <head>
 *   </head>
 *   <body>
 *     <p>
 *       Hello
 *     </p>
 *   </body>
 * </html>
 * ```
 */
function internal_html() {
  console.log('This is an internal function that does HTML');
}

/**
 * This is a class that:
 *
 * - is a thing
 * - with a nested list
 *
 * @internal
 */
export class Thing {
  private name: string;

  /**
   * This class has a constructor
   *
   * @param name - The name
   */
  constructor(name: string) {
    this.name = name;
    internal();
    internal_html();
  }

  /**
   * This function returns something.
   *
   * @param who - The name
   * @returns The result
   */
  public hello(who: string): string {
    return this.name + ' ' + who;
  }
}
