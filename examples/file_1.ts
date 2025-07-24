/**
 * This is one of the comments we would like to have formatted and we create a long line that the formatter should wrap for us.
 *
 * We can also try a list that should be formatted using the markdown formatter:
 *
 * - This is the first item
 *  - This is the second one
 * - This is the third item and I hope that this very long line will be wrapped by the plugin and then it will continue on the next line
 *
 * @param name The name param should receive a `-` and maybe it should also be formatted over multiple lines.
 */
export function long_line_test(name: string) {
  console.log(`Hello ${name}`);
}
