import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
    // Global ignores
    {
        ignores: [
            ".webpack/**",
            "out/**",
            "node_modules/**",
            "coverage/**",
            "dist/**",
            "build/**",
            "*.config.js",
            "*.config.mjs",
            "webpack.*.js",
            "oauth-server.js"
        ]
    },
    
    // Base JavaScript configuration
    js.configs.recommended,
    
    // TypeScript configuration
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module"
            },
            globals: {
                ...globals.node,
                ...globals.browser,
                ...globals.es2021
            }
        },
        plugins: {
            "@typescript-eslint": typescript,
            "import": importPlugin
        },
        rules: {
            // TypeScript rules
            "@typescript-eslint/no-unused-vars": "error",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-expressions": "error",
            "@typescript-eslint/no-var-requires": "off", // Allow require() in Electron app
            
            // Import rules
            "import/no-unresolved": "off", // Handled by TypeScript
            "import/named": "off",
            "import/default": "off",
            "import/namespace": "off",
            
            // General rules
            "no-undef": "off", // TypeScript handles this
            "no-unused-vars": "off" // Use TypeScript version instead
        }
    },

    // JavaScript/JSX configuration
    {
        files: ["**/*.{js,jsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.browser,
                ...globals.es2021
            }
        },
        plugins: {
            "import": importPlugin
        },
        rules: {
            "no-unused-vars": "error",
            "import/no-unresolved": "off"
        }
    }
];