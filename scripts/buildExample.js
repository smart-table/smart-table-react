const rollup = require('rollup').rollup;
const path = require('path');
const node = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const babel = require('rollup-plugin-babel');
const replace = require('rollup-plugin-replace');

const env = process.env.NODE_ENV || 'development';

rollup({
  entry: path.join(process.cwd(), './src/index.js'),
  plugins: [
    node({jsnext: true}),
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
  ]
})
  .then(bundle => {
    return bundle.write({
      format: 'iife',
      dest: path.join(process.cwd(), './src/bundle.js'),
      moduleName: 'react'
    });
  })
  .catch(err => {
    console.log(err);
    process.exit(1);
  });

