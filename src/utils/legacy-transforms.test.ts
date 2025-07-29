/**
 * Test suite for legacy Closure Compiler annotation transformations.
 */

import { describe, it, expect } from 'vitest';
import { applyLegacyTransformations } from './legacy-transforms.js';

describe('applyLegacyTransformations', () => {
  describe('with closureCompilerCompat disabled', () => {
    it('should not transform anything when disabled', () => {
      const input = `
 * Creates a new widget.
 * @constructor
 * @param {string} id - The unique identifier.
 * @export
`;
      const result = applyLegacyTransformations(input, {
        closureCompilerCompat: false,
      });
      expect(result).toBe(input);
    });
  });

  describe('visibility and export tags', () => {
    it('should transform @export to @public', () => {
      const input = `
 * Creates a new widget.
 * @export
`;
      const expected = `
 * Creates a new widget.
 * @public
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should transform @protected to @internal', () => {
      const input = `
 * A protected method.
 * @protected
`;
      const expected = `
 * A protected method.
 * @internal
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should transform @private to @internal', () => {
      const input = `
 * A private method.
 * @private
`;
      const expected = `
 * A private method.
 * @internal
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should handle multiple visibility tags', () => {
      const input = `
 * Various items.
 * @export
 * @protected
 * @private
`;
      const expected = `
 * Various items.
 * @public
 * @internal
 * @internal
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });
  });

  describe('typed tags', () => {
    it('should strip types from @param tags', () => {
      const input = `
 * Creates a widget.
 * @param {string} id - The identifier.
 * @param {object} options - Configuration options.
`;
      const expected = `
 * Creates a widget.
 * @param id - The identifier.
 * @param options - Configuration options.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should strip types from @throws tags when type is only content', () => {
      const input = `
 * Might throw an error.
 * @throws {Error}
`;
      // The whitespace handling removes the trailing newline
      const expected = `
 * Might throw an error.
 * @throws`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should preserve @throws with description after type', () => {
      const input = `
 * Might throw an error.
 * @throws {Error} When something goes wrong.
`;
      const expected = `
 * Might throw an error.
 * @throws {Error} When something goes wrong.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should strip types from @this tags', () => {
      const input = `
 * A method.
 * @this {Widget}
`;
      const expected = `
 * A method.
 * @this
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should handle complex type expressions', () => {
      const input = `
 * A complex function.
 * @param {Array<string>} items - The items.
 * @param {Map<string, number>} mapping - The mapping.
`;
      const expected = `
 * A complex function.
 * @param items - The items.
 * @param mapping - The mapping.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });
  });

  describe('class heritage tags', () => {
    it('should remove @extends with type', () => {
      const input = `
 * A special widget.
 * @extends {BaseWidget}
 * @param id - The identifier.
`;
      const expected = `
 * A special widget.
 * @param id - The identifier.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should remove @implements with type', () => {
      const input = `
 * A widget implementation.
 * @implements {IWidget}
 * @param id - The identifier.
`;
      const expected = `
 * A widget implementation.
 * @param id - The identifier.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should preserve @extends without braces (TypeDoc override)', () => {
      const input = `
 * A special widget.
 * @extends BaseWidget
 * @param id - The identifier.
`;
      const expected = `
 * A special widget.
 * @extends BaseWidget
 * @param id - The identifier.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should handle both heritage tags together', () => {
      const input = `
 * A complex class.
 * @extends {BaseClass}
 * @implements {IInterface}
 * @param data - The data.
`;
      const expected = `
 * A complex class.
 * @param data - The data.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });
  });

  describe('redundant tags', () => {
    it('should remove @constructor', () => {
      const input = `
 * Creates a widget.
 * @constructor
 * @param id - The identifier.
`;
      const expected = `
 * Creates a widget.
 * @param id - The identifier.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should remove @const', () => {
      const input = `
 * A constant value.
 * @const
 * @type {string}
`;
      const expected = `
 * A constant value.
 * @type {string}
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should remove all redundant tags', () => {
      const input = `
 * A complex declaration.
 * @constructor
 * @const
 * @define
 * @noalias
 * @nosideeffects
 * @param id - The identifier.
`;
      const expected = `
 * A complex declaration.
 * @param id - The identifier.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });
  });

  describe('@see tag normalization', () => {
    it('should wrap URLs in @link', () => {
      const input = `
 * See documentation.
 * @see http://example.com/docs
 * @see https://api.example.com
`;
      const expected = `
 * See documentation.
 * @see {@link http://example.com/docs}
 * @see {@link https://api.example.com}
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should wrap single words (code constructs) in @link', () => {
      const input = `
 * Related information.
 * @see MyClass
 * @see MyNamespace.MyClass
 * @see someFunction
 * @see hello
`;
      const expected = `
 * Related information.
 * @see {@link MyClass}
 * @see {@link MyNamespace.MyClass}
 * @see {@link someFunction}
 * @see {@link hello}
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should preserve descriptive text', () => {
      const input = `
 * Related information.
 * @see Also check out the official documentation.
 * @see For more details, visit the wiki.
`;
      const expected = `
 * Related information.
 * @see Also check out the official documentation.
 * @see For more details, visit the wiki.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should not transform @see with common English words', () => {
      const input = `
 * Related information.
 * @see First reference.
 * @see Second item here.
`;
      const expected = `
 * Related information.
 * @see First reference.
 * @see Second item here.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should not transform already linked content', () => {
      const input = `
 * Related information.
 * @see {@link MyClass}
 * @see {@link http://example.com}
`;
      const expected = `
 * Related information.
 * @see {@link MyClass}
 * @see {@link http://example.com}
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });
  });

  describe('comprehensive transformation examples', () => {
    it('should handle the first specification example', () => {
      const input = `
 * Creates a new widget.
 * @constructor
 * @param {string} id - The unique identifier for the widget.
 * @param {object} [options] - Configuration options.
 * @export
`;
      const expected = `
 * Creates a new widget.
 * @param id - The unique identifier for the widget.
 * @param [options] - Configuration options.
 * @public
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should handle the second specification example', () => {
      const input = `
 * A special kind of widget.
 * @extends {BaseWidget}
 * @implements {IWidget}
 * @protected
`;
      const expected = `
 * A special kind of widget.
 * @internal
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should handle the third specification example', () => {
      const input = `
 * See the following for more information.
 * @see http://example.com/docs
 * @see MyOtherClass
 * @see Also check out the official documentation.
`;
      const expected = `
 * See the following for more information.
 * @see {@link http://example.com/docs}
 * @see {@link MyOtherClass}
 * @see Also check out the official documentation.
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });
  });

  describe('edge cases and whitespace handling', () => {
    it('should handle various whitespace patterns', () => {
      const input = `
 *   Creates a widget.  
 *   @constructor   
 *     @param   {string}   id   -   The identifier.  
 *  @export
`;
      const expected = `
 *   Creates a widget.  
 *     @param id   -   The identifier.  
 *  @public
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should handle indented comment blocks', () => {
      const input = `
  * Creates a widget.
  * @constructor
  * @param {string} id - The identifier.
  * @export
`;
      const expected = `
  * Creates a widget.
  * @param id - The identifier.
  * @public
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });

    it('should not transform tags in code blocks', () => {
      const input = `
 * Example usage:
 * \`\`\`javascript
 * @constructor
 * @param {string} id
 * \`\`\`
 * @constructor
`;
      const expected = `
 * Example usage:
 * \`\`\`javascript
 * @constructor
 * @param {string} id
 * \`\`\`
`;
      const result = applyLegacyTransformations(input);
      expect(result).toBe(expected);
    });
  });

  describe('idempotence', () => {
    it('should be idempotent - running twice produces same result', () => {
      const input = `
 * Creates a widget.
 * @constructor
 * @param {string} id - The identifier.
 * @export
 * @see MyClass
`;
      const firstPass = applyLegacyTransformations(input);
      const secondPass = applyLegacyTransformations(firstPass);
      expect(firstPass).toBe(secondPass);
    });

    it('should not modify already modern TSDoc comments', () => {
      const modernComment = `
 * Creates a widget.
 * @param id - The identifier.
 * @param options - Configuration options.
 * @returns The created widget.
 * @public
 * @see {@link MyClass}
`;
      const result = applyLegacyTransformations(modernComment);
      expect(result).toBe(modernComment);
    });
  });
});
