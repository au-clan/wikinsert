import React from "react";
import Footer from "src/ui/Footer";

import config from "src/config.json";

const styles = require("./mobilenotsupportedpage.scss");
const commonStyles = require("src/ui/common.scss");

const MobileNotSupportedPage = (): JSX.Element => (
  <div className={styles.wrapper}>
    <div className={styles.title}>
      Quotebank<span className={styles.dot}>.</span>
    </div>
    <div className={styles.content}>
      <p>
        Welcome to Quotebank. It seems that you are visiting our website on a
        mobile device. We are still working on the mobile design to provide a
        better user experience. If you are keen on the mobile version, please
        let us know through the{" "}
        <a
          className={commonStyles.underline}
          href={config.FEEDBACK_FORM_URL}
          target="_blank"
          rel="noreferrer"
        >
          feedback form
        </a>
        .
      </p>
      <p>
        For now, please visit Quotebank on your laptop or desktop. Thank you!
      </p>
    </div>
    <div> </div>
    <Footer />
  </div>
);

export default MobileNotSupportedPage;
