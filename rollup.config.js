import node from 'rollup-plugin-node-resolve';

const globals = {
  'smart-table-core': 'smartTableCore',
  'smart-table-json-pointer': 'smartTableJsonPointer',
};
export default {
  external: Object.keys(globals),
  input: './index',
  output: {
    file: './dist/smart-table-react.js',
    format: 'umd',
    globals,
    name: 'smart-table-react'
  },
  plugins: [
    node(),
  ],
};