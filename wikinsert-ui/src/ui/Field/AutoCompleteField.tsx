import React, { FC } from "react";
import { FieldProps } from "formik";
import classNames from "classnames";
import { Entity } from "src/api";
import HelpIcon from "src/ui/icons/help_outline_18dp.svg";
import { OverlayTrigger, Tooltip } from "react-bootstrap";

const styles = require("./field.scss");
const MAX_DESCRIPTION_LENGTH = 10;

type AutoCompleteOption = Entity;

const NIL_OPTION: AutoCompleteOption = {
  id: "",
  name: "",
  description: "",
};

const PLACEHOLDER_OPTION: AutoCompleteOption = {
  id: "",
  name: "No matching entry :(",
  description: "",
};

const AutoCompleteField: FC<
  FieldProps & {
    label: string;
    placeholder?: string;
    tooltip?: string;
    disabled?: boolean;
    compact?: boolean;
    searchHandler: (v: string) => Promise<AutoCompleteOption[]>;
  }
> = ({
  label,
  placeholder,
  tooltip,
  disabled,
  searchHandler,
  field,
  compact,
  form: { setFieldValue, errors, touched, setFieldTouched },
}) => {
  const [options, setOptions] = React.useState<AutoCompleteOption[]>([]);
  const [selectedOptionIdx, setSelectedOptionIdx] = React.useState(0);
  const [dropdownVisible, setDropdownVisible] = React.useState(false);
  const [timer, setTimer] = React.useState<NodeJS.Timeout>(
    (0 as unknown) as NodeJS.Timeout
  );
  const inputRef: React.RefObject<HTMLInputElement> = React.useRef<
    HTMLInputElement
  >(null);
  const dropdownRef: React.RefObject<HTMLDivElement> = React.useRef<
    HTMLDivElement
  >(null);

  React.useEffect(() => {
    // Hide the dropdown list if clicked on outside of the input bar
    const handleClickOutside = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        inputRef.current &&
        !inputRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setDropdownVisible(false);
        setFieldTouched(field.name, true);
      }
    };
    const defaultValue = field.value.name;
    if (inputRef.current) {
      inputRef.current.value = defaultValue;
    }

    // Bind the event listener
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Unbind the event listener on clean up
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [inputRef, dropdownRef, field.value]);

  return (
    <div
      className={
        compact
          ? classNames(styles.fieldWrapper, styles.compact)
          : styles.fieldWrapper
      }
    >
      <div className={classNames('row')}>
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
            placeholder={placeholder || "Search for a name"}
            data-cy={`field-${field.name}`}
            ref={inputRef}
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (selectedOptionIdx > 0) {
                  setSelectedOptionIdx(selectedOptionIdx - 1);
                }
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                if (selectedOptionIdx < options.length - 1) {
                  setSelectedOptionIdx(selectedOptionIdx + 1);
                }
              } else if (event.key === "Enter") {
                event.preventDefault();
                const op = options[selectedOptionIdx];
                if (op.id !== "") {
                  if (inputRef.current) {
                    inputRef.current.value = op.name;
                    setFieldValue(field.name, op);
                    setFieldTouched(field.name, true, false);
                    inputRef.current.blur();
                  }
                  setDropdownVisible(false);
                }
              } else if (
                event.key !== "ArrowRight" &&
                event.key !== "ArrowLeft"
              ) {
                setDropdownVisible(false);
                if (selectedOptionIdx !== 0) {
                  setSelectedOptionIdx(0);
                }
              }
            }}
            onChange={() => {
              if (!inputRef.current || !inputRef.current.value) {
                setFieldValue(field.name, NIL_OPTION);
                setFieldTouched(field.name, true);
                return;
              }
              clearTimeout(timer);
              const t: ReturnType<typeof setTimeout> = setTimeout(() => {
                if (!inputRef.current || !inputRef.current.value) {
                  setDropdownVisible(false);
                } else {
                  searchHandler(inputRef.current.value).then(
                    (results: AutoCompleteOption[]) => {
                      if (results.length === 0) {
                        results.push(PLACEHOLDER_OPTION);
                      }
                      setOptions(results.slice(0, 8));
                      setDropdownVisible(true);
                    }
                  );
                }
              }, 1000);
              setTimer(t);
            }}
          />
          {dropdownVisible && (
            <div
              className={styles.dropdown}
              data-cy={`${field.name}-dropdown`}
              ref={dropdownRef}
            >
              {options.map((op, idx) => {
                let description = op.description;
                if (description) {
                  const tokens = description.split(" ");
                  if (tokens.length > MAX_DESCRIPTION_LENGTH) {
                    description =
                      tokens.slice(0, MAX_DESCRIPTION_LENGTH).join(" ") + "...";
                  }
                }

                let optionStyle = classNames(
                  styles.dropdownOption,
                  styles.clickable
                );
                if (op.id === "") {
                  optionStyle = styles.dropdownOption;
                } else {
                  if (inputRef.current && op.name === inputRef.current.value) {
                    optionStyle = classNames(
                      styles.dropdownOption,
                      styles.clickable,
                      styles.matchOption
                    );
                  }
                  if (idx === selectedOptionIdx) {
                    optionStyle = classNames(optionStyle, styles.selected);
                  }
                }

                return (
                  <div
                    className={optionStyle}
                    key={op.id}
                    onClick={() => {
                      if (op.id === "") {
                        return;
                      }

                      if (inputRef.current) {
                        inputRef.current.value = op.name;
                        setFieldValue(field.name, op);
                        setFieldTouched(field.name, true, false);
                        inputRef.current.blur();
                      }
                      setDropdownVisible(false);
                    }}
                  >
                    <div>{op.name}</div>
                    {(description && (
                      <div className={styles.description}>{description}</div>
                    )) ||
                      null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {(field.value.id === "" && errors[field.name] && touched[field.name] && (
        <div className={styles.fieldError}>{errors[field.name]}</div>
      )) || <div>&nbsp;</div>}
    </div>
  );
};

export default AutoCompleteField;
