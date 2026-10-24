import { createRequire } from 'node:module';

/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').options} */
const config = {
  // Prettier resolves a bare plugin name against process.cwd(), which fails whenever it
  // runs from anywhere but this directory - Orval then silently emits unformatted output.
  plugins: [createRequire(import.meta.url).resolve('prettier-plugin-tailwindcss')],
  singleQuote: true,
  printWidth: 100,
};

export default config;
