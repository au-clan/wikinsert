import React from "react";
const loaderStyles = require("./loader.scss");

const Loader = (): JSX.Element => (
  <div className={loaderStyles.loader}>
    <div className={loaderStyles.ldsEllipsis}>
      <div />
      <div />
      <div />
      <div />
    </div>
  </div>
);

export default Loader;
