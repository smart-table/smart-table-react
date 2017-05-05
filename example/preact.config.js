import node from 'rollup-plugin-node-resolve';
import commonjs from "rollup-plugin-commonjs";
import buble from 'rollup-plugin-buble';
import replace  from 'rollup-plugin-replace';

export default {
  entry: "./example/index.js",
  plugins: [
    replace({"import reactDom from 'react-dom'":'const reactDom = React'}),
    node({jsnext: true}),
    commonjs(),
    buble({
      target: {chrome: 52},
      jsx: 'h'
    })
  ],
  dest: "./example/bundle.js",
  moduleName: "bundle",
  format: "iife",
  sourceMap: 'inline'
};