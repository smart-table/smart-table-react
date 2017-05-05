import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./index",
  plugins: [
    node({jsnext: true}),
  ],
  dest: `./dist/smart-table-react.js`,
  format: "umd",
  moduleName: `smart-table-react`
};