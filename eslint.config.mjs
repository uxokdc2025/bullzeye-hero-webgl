import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // react-three-fiber animates by mutating three.js objects, uniforms and
    // refs inside useFrame every frame. The experimental react-hooks
    // "immutability" rule flags this standard, intended R3F pattern, so we
    // turn it off for this WebGL project.
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
