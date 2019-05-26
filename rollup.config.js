import node from 'rollup-plugin-node-resolve';

export default {
  input: './index',
  output: {
    file: './dist/smart-table-react.js',
    format: 'umd',
    name: 'smart-table-react'
  },
  plugins: [
    node(),
  ],
};