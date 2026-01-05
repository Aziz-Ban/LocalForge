/**
 * Example Jest test file
 * Contains one passing test and one failing test to demonstrate CI/CD blocking
 */

describe('Example Test Suite', () => {
  test('should pass - basic addition', () => {
    expect(1 + 1).toBe(2);
  });

  test('should fail - intentional failure for CI/CD demo', () => {
    // This test will fail to demonstrate CI/CD blocking
    expect(2 + 2).toBe(4);
  });
});
