import globals from "globals";

export default [
  {
    files: ["**/*.js"],
    ignores: ["__tests__/**", "__mocks__/**"],
    languageOptions: {
      globals: {
        ...globals.commonjs,
        ...globals.node,
        ...globals.mocha,
      },
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-const-assign": "warn",
      "no-this-before-super": "warn",
      "no-undef": "warn",
      "no-unreachable": "warn",
      "no-unused-vars": "warn",
      "constructor-super": "warn",
      "valid-typeof": "warn",
    },
  },
  {
    files: ["__tests__/**/*.js", "__mocks__/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      ecmaVersion: 2022,
      sourceType: "commonjs",
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "warn",
    },
  },
];
