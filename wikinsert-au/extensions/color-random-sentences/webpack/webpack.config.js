const path = require('path');
const glob = require('glob');
const CopyPlugin = require('copy-webpack-plugin');

// Create an entry object with all .ts files in the src directory
const tsFiles = glob.sync(path.resolve(__dirname, "..", "src", "*.ts"));
const entries = {};
tsFiles.forEach((file) => {
  const name = path.basename(file, '.ts');
  entries[name] = file;
});

module.exports = {
   mode: "production",
   entry: entries,
   output: {
      path: path.join(__dirname, "../dist"),
      filename: "[name].js",
   },
   resolve: {
      extensions: [".ts", ".js"],
   },
   module: {
      rules: [
         {
            test: /\.tsx?$/,
            loader: "ts-loader",
            exclude: /node_modules/,
         },
      ],
   },
   plugins: [
      new CopyPlugin({
         patterns: [{ from: ".", to: ".", context: "public" }]
      }),
   ],
};