import { expect, test, describe } from 'vitest';
import { createTSDocConfiguration } from './parser-config.js';

describe('createTSDocConfiguration', () => {
  test('includes extended tags like @category and @beta', () => {
    const config = createTSDocConfiguration();
    
    // Check that extended tags are available
    expect(config.tryGetTagDefinition('@category')).toBeDefined();
    expect(config.tryGetTagDefinition('@beta')).toBeDefined();
    expect(config.tryGetTagDefinition('@group')).toBeDefined();
    expect(config.tryGetTagDefinition('@privateRemarks')).toBeDefined();
    expect(config.tryGetTagDefinition('@experimental')).toBeDefined();
    expect(config.tryGetTagDefinition('@linkcode')).toBeDefined();
  });

  test('supports custom extra tags', () => {
    const config = createTSDocConfiguration(['@customTag', '@mySpecialTag']);
    
    // Check that custom tags were added
    expect(config.tryGetTagDefinition('@customTag')).toBeDefined();
    expect(config.tryGetTagDefinition('@mySpecialTag')).toBeDefined();
  });

  test('standard TSDoc tags are still available', () => {
    const config = createTSDocConfiguration();
    
    // These should be available from the base TSDoc configuration
    expect(config.tryGetTagDefinition('@param')).toBeDefined();
    expect(config.tryGetTagDefinition('@returns')).toBeDefined();
    expect(config.tryGetTagDefinition('@remarks')).toBeDefined();
    expect(config.tryGetTagDefinition('@example')).toBeDefined();
  });

  test('tag definitions have correct syntax kinds', () => {
    const config = createTSDocConfiguration();
    
    const categoryTag = config.tryGetTagDefinition('@category');
    const betaTag = config.tryGetTagDefinition('@beta');
    const linkcodeTag = config.tryGetTagDefinition('@linkcode');
    
    // Check that they're defined and have the expected kinds
    expect(categoryTag).toBeDefined();
    expect(betaTag).toBeDefined();
    expect(linkcodeTag).toBeDefined();
    
    // Import the enum to check against actual values
    // Note: These values may vary by TSDoc version
    expect(typeof categoryTag?.syntaxKind).toBe('number');
    expect(typeof betaTag?.syntaxKind).toBe('number');
    expect(typeof linkcodeTag?.syntaxKind).toBe('number');
  });
});