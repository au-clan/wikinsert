const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  output: {
    path: path.resolve(__dirname, "build"),
    filename: "bundle.js",
    publicPath: "/",
  },
  entry: {
    app: path.join(__dirname, "src", "index.tsx"),
  },
  resolve: {
    modules: [path.join(__dirname, "src"), "node_modules"],
    alias: {
      react: path.join(__dirname, "node_modules", "react"),
      src: path.join(__dirname, "src"),
    },
    extensions: [".ts", ".tsx", ".js", ".scss"],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
        },
      },
      {
        test: [/react-datepicker.css/],
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
        ],
        exclude: /src/,
      },
      {
        test: [/bootstrap.min.css/],
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
        ],
        exclude: /src/,
      },
      {
        test: /\.s[ac]ss$/i,
        use: [
          {
            // Adds CSS to the DOM by injecting a `<style>` tag.
            loader: "style-loader",
            options: {
              esModule: false,
            },
          },
          {
            // Interprets `@import` and `url()` like `import/require()` and will resolve them.
            loader: "css-loader",
            options: {
              modules: true,
              importLoaders: 1,
              esModule: false,
            },
          },
          {
            // Loads a SASS/SCSS file and compiles it to CSS.
            loader: "sass-loader",
          },
        ],
      },
      {
        test: /\.svg$/,
        use: [
          {
            loader: "@svgr/webpack",
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "index.html"),
    }),
  ],
};
