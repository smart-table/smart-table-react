import node from 'rollup-plugin-node-resolve';
import commonjs from "rollup-plugin-commonjs";
import replace  from 'rollup-plugin-replace';
import buble from 'rollup-plugin-buble';

const env = process.env.NODE_ENV;

export default {
  entry: "./example/index.js",
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify(env),
      'preact': 'react',
      'const {h} = React;':''
    }),
    node({jsnext: true}),
    commonjs(),
    buble({
      target: {chrome: 52}
    })
  ],
  dest: "./example/bundle.js",
  moduleName: "bundle",
  format: "iife"
};