const path = require('path');
const glob = require('glob');
const CopyPlugin = require('copy-webpack-plugin');

// Create an entry object with all .ts files in the src directory
// Using path.join instead of path.resolve with multiple arguments for better cross-platform compatibility
const srcDir = path.join(__dirname, "..", "src");
// Use path.join for pattern construction to ensure proper path separators
const pattern = path.join(srcDir, "*.ts").replace(/\\/g, '/');
const tsFiles = glob.sync(pattern);

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
         patterns: [{
            from: ".",
            to: ".",
            context: path.resolve(__dirname, "../public")
         }]
      }),
   ],
};