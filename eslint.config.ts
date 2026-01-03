import eslint from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin"
import tseslint from "typescript-eslint"

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    plugins: {
      "@stylistic": stylistic
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    rules: {
      // Require braces for all control statements
      curly: ["error", "all"],

      // Require blank line before block comments, except at start of blocks/interfaces
      "@stylistic/lines-around-comment": [
        "error",
        {
          beforeBlockComment: true,
          allowBlockStart: true,
          allowObjectStart: true,
          allowArrayStart: true,
          allowClassStart: true,
          allowInterfaceStart: true,
          allowTypeStart: true,
          allowEnumStart: true
        }
      ],

      // Allow console for this CLI-oriented package
      "no-console": "off",

      // Slightly relaxed rules for practical usage
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],

      // Require explicit return types for better API documentation
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true
        }
      ],

      // Enforce consistent type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports"
        }
      ]
    }
  },
  {
    ignores: ["dist/", "build/", "node_modules/", "*.mjs", "*.cjs"]
  }
)
