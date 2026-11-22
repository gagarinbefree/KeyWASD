import tseslint from 'typescript-eslint'

export default [
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts', 'tests/**/*.mjs'], rules: {
    'no-debugger': 'error', 'no-constant-condition': 'error', 'no-self-compare': 'error'
  } }
]
