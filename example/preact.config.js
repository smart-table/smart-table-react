import node from 'rollup-plugin-node-resolve';
import commonjs from "rollup-plugin-commonjs";
import replace  from 'rollup-plugin-replace';
import buble from 'rollup-plugin-buble';

const env = process.env.NODE_ENV;

export default {
  input: './example/index.js',
  output: {
    file: './example/bundle.js',
    format: 'iife',
    name: 'bundle',
    sourcemap: 'inline',
  },
  plugins: [
    replace({
      'onChange': 'onInput',
      'process.env.NODE_ENV': JSON.stringify(env),
      'react': 'preact',
      'react-dom': 'preact',
    }),
    node(),
    buble({
      target: {chrome: 71}
    }),
    commonjs(),
  ],
};