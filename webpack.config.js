//@ts-check

'use strict';

const webpack = require(`webpack`);

const path = require(`path`);

const npm_runner = process.env[`npm_lifecycle_script`];
const isProduction = (npm_runner && npm_runner.includes(`production`));

console.log(`Is production build: ${isProduction}`);

let exclude = undefined;

if (isProduction) {
  exclude = path.resolve(__dirname, `src`, `testing`)
}

/**@type {webpack.Configuration}*/
const config = {
  target: `node`, // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: `./src/extension.ts`, // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, `dist`),
    filename: `extension.js`,
    libraryTarget: `commonjs2`,
    devtoolModuleFilenameTemplate: `../[resource-path]`,
  },
  devtool: `nosources-source-map`,
  externals: {
    vscode: `commonjs vscode` // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: [`.ts`, `.js`, `.svg`],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.DEV': JSON.stringify(!isProduction),
    })
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude
      },
      {
        test: /\.js$/,
        include: path.resolve(__dirname, `node_modules/@bendera/vscode-webview-elements/dist`),
        type: `asset/source`
      },
      {
        test: /\.(ts|tsx)$/i,
        exclude: /node_modules/,
        use: [
          {
            loader: `esbuild-loader`
          }
        ]
      }
    ]
  }
};
module.exports = config;