import React, { FC } from "react";
import { FieldProps } from "formik";
import HelpIcon from "src/ui/icons/help_outline_18dp.svg";
import classNames from "classnames";
import { OverlayTrigger, Tooltip } from "react-bootstrap";

const styles = require("./field.scss");

interface ICheckboxFieldProps {
  label: string;
  tooltip?: string;
  disabled?: boolean;
  compact?: boolean;
}

const CheckboxField: FC<FieldProps & ICheckboxFieldProps> = ({
  label,
  tooltip,
  disabled,
  field,
  compact,
  form: { setFieldValue, errors, touched, setFieldTouched },
}) => {
  return (
    <div
      className={
        compact
          ? classNames(styles.fieldWrapper, styles.compact)
          : styles.fieldWrapper
      }
    >
      <div className={'row'}>
        <div className={classNames('col-9', 'col-md-6', 'my-auto')}>
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
        <div className={classNames('col-3', 'col-md-6', 'my-auto')}>
          <input
            className={'w-100'}
            type="checkbox"
            disabled={disabled}
            checked={field.value}
            onChange={(e) => {
              setFieldTouched(field.name, true, false);
              setFieldValue(field.name, e.target.checked, false);
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

export default CheckboxField;
