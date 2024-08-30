module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    sourceType: "module",
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
  settings: {
    "import/resolver": {
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        moduleDirectory: ["node_modules", "."],
      },
    },
    react: {
      version: "detect",
    },
  },
  env: {
    node: true,
    browser: true,
  },
  extends: [
    "eslint:recommended",
    "prettier",
    "prettier/@typescript-eslint",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:jest/recommended",
    "plugin:cypress/recommended",
  ],
  ignorePatterns: [
    "webpack.config.js",
    "build/",
    "node_modules/",
    "coverage/",
    "dist/",
  ],
  rules: {
    quotes: ["error", "double", { avoidEscape: true }],
    "react/jsx-props-no-spreading": "off",
    "no-continue": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/ban-ts-comment": [
      "error",
      {
        "ts-ignore": "allow-with-description",
        minimumDescriptionLength: 2,
      },
    ],
    "react/prop-types": "off",
  },
};
