import babel from "rollup-plugin-babel";
import node from 'rollup-plugin-node-resolve';
import commonjs from "rollup-plugin-commonjs";
import replace  from 'rollup-plugin-replace';

const env = process.env.NODE_ENV;

export default {
  entry: "./example/index.js",
  plugins: [
    node({jsnext: true, main:true}),
    replace({'process.env.NODE_ENV': JSON.stringify(env)}),
    commonjs(),
    babel({
      "presets": [["latest", {
        "es2015": {
          "modules": false
        }
      }]],
      "plugins": ["external-helpers", "transform-react-jsx"]
    })
  ],
  dest: "./example/bundle.js",
  moduleName: "bundle",
  format: "iife",
  sourceMap: 'inline'
};