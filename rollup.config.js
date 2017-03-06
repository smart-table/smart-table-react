import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./index.js",
  plugins: [
    node({jsnext: true, main: true, skip: 'react'}),
  ],
  dest: "./dist/smart-table-react.js",
  moduleName: "smart-table-react.js",
  format: "es"
};