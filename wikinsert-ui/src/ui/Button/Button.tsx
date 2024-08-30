import React from "react";
import classnames from "classnames";

const styles = require("./button.scss");

const Button: React.FunctionComponent<React.PropsWithChildren<
  React.ButtonHTMLAttributes<HTMLButtonElement>
>> = (
  props: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>
) => {
  const { children, disabled } = props;
  // classes should only be applied to the div inside the button
  const { className, ...buttonProps } = props;
  const wrapperClassNames = [styles.button, className];
  if (disabled) {
    wrapperClassNames.push(styles.disabled);
  }
  return (
    <div className={styles.wrapper}>
      <button type="button" {...buttonProps}>
        <div tabIndex={-1} className={classnames(wrapperClassNames)}>
          {children}
        </div>
      </button>
    </div>
  );
};

export default Button;
