import React, { FC } from "react";
import { FieldProps } from "formik";
import classNames from "classnames";
import HelpIcon from "src/ui/icons/help_outline_18dp.svg";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";

const styles = require("./field.scss");

interface ITextFieldProps {
  label: string;
  tooltip?: string;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

const TextField: FC<FieldProps & ITextFieldProps> = ({
  label,
  tooltip,
  placeholder,
  disabled,
  field,
  compact,
  form: { setFieldValue, errors, touched, setFieldTouched },
}) => {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.value = field.value;
    }
  });
  return (
    <div
      className={
        compact
          ? classNames(styles.fieldWrapper, styles.compact)
          : styles.fieldWrapper
      }
    >
      <div className={'row'}>
        <div className={classNames('col-12', 'col-md-6', 'my-auto')}>
          {label}
          {tooltip && (
            <OverlayTrigger
            key={'top'}
            placement={'top'}
            overlay={
              <Tooltip id={`tooltip-top`}>
                {tooltip}
              </Tooltip>
            }
            >
              <span className={styles.tooltip}>
              <HelpIcon />
              </span>
            </OverlayTrigger>
          )}
        </div>
        <div className={classNames('col-12', 'col-md-6', 'my-auto')}>
          <input
            className={'w-100'}
            type="text"
            ref={ref}
            disabled={disabled}
            data-cy={`field-${field.name}`}
            placeholder={placeholder || "Input some text"}
            onBlur={() => {
              setFieldValue(field.name, ref.current?.value);
              setFieldTouched(field.name, true, false);
            }}
          />
        </div>
      </div>
      {(errors[field.name] && touched[field.name] && (
        <div className={styles.fieldError}>{errors[field.name]}</div>
      )) || <div>&nbsp;</div>}
    </div>
  );
};

export default TextField;
