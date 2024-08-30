import React from "react";

import classNames from "classnames";
import config from "src/config.json";
const styles = require("./footer.scss");
const commonStyles = require("src/ui/common.scss");

import DlabIcon from "src/ui/icons/dlab.svg";

const Footer = (props: { abs?: boolean }): JSX.Element => {
  const footerStyle = props.abs
    ? classNames(styles.footer, styles.abs)
    : styles.footer;
  return (
    <div className={footerStyle}>
      <div>
      <DlabIcon /> <a href={config.LAB_PAGE_URL} target="_blank" rel="noreferrer">
          DLAB @ EPFL
        </a>
      </div>
      <a
        className={commonStyles.underline}
        href={config.FEEDBACK_FORM_URL}
        target="_blank"
        rel="noreferrer"
      >Any feedback or comment?</a>&nbsp;
      Thank you!
    </div>
  );
};

export default Footer;
