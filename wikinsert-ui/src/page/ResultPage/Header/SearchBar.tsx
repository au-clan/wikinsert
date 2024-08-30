import classNames from "classnames";
import React from "react";
import MenuIcon from "src/ui/icons/menu_black_24dp.svg";
import ClearIcon from "src/ui/icons/clear_black_24dp.svg";
import Button from "src/ui/Button";
import { Formik, Form } from "formik";
import { RouteComponentProps } from "react-router-dom";
import { connect, ConnectedProps } from "react-redux";
import {
  ISearchAppState,
  setSearchOptions,
  setSearchQuery,
  setResult,
  getSpeaker as getSpeakerAction,
  setSpeaker,
} from "src/reducer/resultReducer";
import {
  QueryTarget,
  FullFormValues,
  submitSearchArticleQuery,
  submitSearchQuotationQuery,
  SearchResult,
  NilFormValues,
  getSpeakerAttrs,
  IAttrCandidates,
  NIL_ENTITY,
  getSpeaker,
} from "src/api";
import {
  composePermalink,
  convertValueToQuery,
  getAttrsFromMisc,
  parseQueryParams,
} from "src/page/utils";
import DropdownMenu from "./DropdownMenu";
import { batchActions } from "redux-batched-actions";

const styles = require("./searchbar.scss");

const connector = connect((state: ISearchAppState) => ({
  misc: state.speakerAttrs,
  query: state.searchParams,
  dateRange: state.dateRange,
  loading: state.loading,
  speakerCache: state.speakerCache,
}));
interface ISearchBarProps extends ConnectedProps<typeof connector> {
  history: RouteComponentProps["history"];
  location: RouteComponentProps["location"];
  isCenterted?: boolean; 
  nextPathName?: string;
  placeholder?: string;
  preSubmit?: (submitedText?:string) => void;
}

interface ISearchBarState {
  textTouched: boolean;
  searchBarFocused: boolean;
  inputFocused: boolean;
  dropdownVisible: boolean;
  submitted: boolean;
  values: FullFormValues;
  attrCandidates?: IAttrCandidates;
  textValue: string;
  barError: string;
  showError: boolean; // Whether the error message is visible
  hideError: boolean; // Whether the error message element should be rendered
}

class SearchBar extends React.Component<ISearchBarProps, ISearchBarState> {
  inputRef = React.createRef<HTMLInputElement>();
  searchBarRef = React.createRef<HTMLDivElement>();
  buttonRef = React.createRef<HTMLButtonElement>();

  constructor(props: ISearchBarProps) {
    super(props);
    this.state = {
      textValue: "",
      textTouched: false,
      searchBarFocused: false,
      inputFocused: false,
      dropdownVisible: false,
      submitted: false,
      values: NilFormValues,
      barError: "",
      showError: false,
      hideError: true,
    };
  }

  componentDidMount() {
    document.addEventListener("mousedown", (e) => this.handleClickOutside(e));
    this.setFormValues();
  }

  componentDidUpdate(prevProps: ISearchBarProps) {
    if (prevProps.query?.toString() !== this.props.query?.toString()) {
      // Params are parsed slightly late after the component is mounted
      // if a user lands at the result page directly with a link,
      // so set params here instead in componentDidMount
      this.setFormValues();
    }
  }

  render() {
    const disabled = this.props.loading || this.state.submitted;
    const placeholder =
      this.props.placeholder ||
      (this.state.values.text ? "" : this.createPlaceholder(this.state.values));
    const textInputStyle = this.inputRef.current?.textContent
      ? styles.inputWrapper
      : classNames(styles.inputWrapper, styles.placeholder);
    return (
      <Formik
        enableReinitialize
        initialValues={this.state.values}
        onSubmit={(newValues) => {
          if (!this.inputRef || !this.inputRef.current) {
            return;
          }
          newValues.text = this.state.textValue;
          this.inputRef.current.blur();
          this.submitForm(newValues);
        }}
        validate={(v) => this.validateForm(v)}
      >
        <Form>
          <div
            ref={this.searchBarRef}
            className={
              this.state.searchBarFocused
                ? classNames(styles.container, styles.focused)
                : styles.container
            }
          >
            <div className={styles.searchBarWrapper}>
              <div
                className={
                  disabled
                    ? classNames(styles.searchBar, styles.disabled)
                    : styles.searchBar
                }
              >
                <div
                  className={
                    disabled
                      ? classNames(textInputStyle, styles.disabled)
                      : textInputStyle
                  }
                >
                  {!this.state.inputFocused &&
                    ((!this.state.textTouched && !this.state.values.text) ||
                      (this.state.textTouched && !this.state.textValue)) && (
                      <div
                        className={styles.placeholder}
                        data-cy="search-bar-placeholder"
                      >
                        {placeholder}
                      </div>
                    )}
                  <input
                    data-cy="searchBarInput"
                    disabled={disabled}
                    value={this.state.textValue}
                    suppressContentEditableWarning={true}
                    ref={this.inputRef}
                    className={styles.input}
                    onFocus={() =>
                      this.setState({
                        searchBarFocused: true,
                        inputFocused: true,
                      })
                    }
                    onBlur={() => this.setState({ inputFocused: false })}
                    onKeyUp={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        this.buttonRef.current?.click();
                      }
                    }}
                    onChange={() => {
                      if (!this.state.textTouched) {
                        this.setState({
                          textTouched: true,
                          textValue: this.inputRef.current?.value || "",
                        });
                      } else {
                        this.setState({
                          textValue: this.inputRef.current?.value || "",
                        });
                      }
                    }}
                  />
                </div>
                <span
                  className={
                    this.state.searchBarFocused && this.state.textValue ? 
                    styles.menuButton : classNames(styles.menuButton, styles.menuButtonHidden)
                  }
                  onClick={() => {
                    if (this.inputRef && this.inputRef.current) {
                      this.inputRef.current.textContent = "";
                      this.setState({ textValue: "" });
                      this.inputRef.current.focus();
                    }
                  }}
                >
                  <ClearIcon
                    fill="#aaa"
                    height="18"
                    width="18"
                    viewBox="0 0 24 24"
                  />
                </span>
                <span
                  data-cy="menu"
                  className={
                    disabled
                      ? classNames(styles.menuButton, styles.disabled)
                      : styles.menuButton
                  }
                  onClick={() =>
                    !disabled &&
                    this.setState({
                      dropdownVisible: !this.state.dropdownVisible,
                    })
                  }
                >
                  <MenuIcon fill="#aaa" />
                </span>
              </div>
              {!this.state.hideError && (
                <div
                  className={
                    this.state.showError
                      ? styles.error
                      : classNames(styles.error, styles.hidden)
                  }
                >
                  {this.state.barError}
                </div>
              )}
              {this.state.dropdownVisible && (
                <DropdownMenu
                  attrCandidates={this.state.attrCandidates}
                  isCentered={this.props.isCenterted}
                  getSpeakerAttrs={() => {
                    getSpeakerAttrs().then((misc) => {
                      if (!this.props.dateRange) {
                        return;
                      }
                      this.props.dispatch(setSearchOptions(misc));
                      this.setState({
                        attrCandidates: getAttrsFromMisc(misc),
                      });
                    });
                  }}
                />
              )}
            </div>
            <button
              className={styles.dummyButton}
              ref={this.buttonRef}
              type="submit"
            />
            <Button
              type="submit"
              data-cy="submit"
              className={
                disabled
                  ? classNames(styles.submit, styles.disabled)
                  : styles.submit
              }
              disabled={disabled}
            >
              Go
            </Button>
          </div>
        </Form>
      </Formik>
    );
  }

  createPlaceholder(values: FullFormValues): string {
    const mapping: Record<string, string> = {
      speaker: "speaker",
      domain: "URL domain",
      numOccurrences: "occurrences",
      speakerNationality: "nationality",
      speakerGender: "gender",
      speakerOccupation: "occupation",
      withContext: "with context",
      exactMatch: "exact match",
    };

    const placeholder = [];

    for (const [key, value] of Object.entries(values)) {
      if (mapping[key]) {
        if (typeof value === "object" && value.id) {
          placeholder.push(`${mapping[key]}: ${value.name}`);
        } else if (typeof value !== "object" && value) {
          placeholder.push(`${mapping[key]}: ${value}`);
        }
      }
    }
    return placeholder.join(", ");
  }

  handleClickOutside(e: MouseEvent) {
    if (
      e.target instanceof Element &&
      !this.state.submitted &&
      !this.props.loading
    ) {
      let element = e.target;
      let found = false;
      while (element.parentElement) {
        if (
          this.searchBarRef &&
          this.searchBarRef.current &&
          element === this.searchBarRef.current
        ) {
          if (!this.state.searchBarFocused) {
            this.setState({ searchBarFocused: true });
          }
          found = true;
          break;
        }
        element = element.parentElement;
      }
      if (
        this.searchBarRef &&
        this.searchBarRef.current &&
        element === this.searchBarRef.current
      ) {
        if (!this.state.searchBarFocused) {
          this.setState({ searchBarFocused: true });
        }
        found = true;
      }

      if (!found) {
        if (this.state.dropdownVisible) {
          this.setState({ dropdownVisible: false, searchBarFocused: false });
        } else {
          this.setState({ searchBarFocused: false });
        }
      }
    }
  }

  setFormValues() {
    const attrCandidates: IAttrCandidates | undefined = this.props.misc
      ? getAttrsFromMisc(this.props.misc)
      : undefined;

    const { ok, values } = parseQueryParams(
      (this.props.query && this.props.query.toString()) || ""
    );
    if (!ok[0] || !ok[1]) {
      values.fromDate =
        (ok[0] && values.fromDate) ||
        (this.props.dateRange && this.props.dateRange.fromDate) ||
        new Date();
      values.toDate =
        (ok[1] && values.toDate) ||
        (this.props.dateRange && this.props.dateRange.toDate) ||
        new Date();
    }
    if (values.fromDate > values.toDate) {
      values.fromDate = values.toDate;
    }

    const matchedGender = this.props.misc
      ? Object.entries(this.props.misc.gender).filter(
          (pair) => pair[1] === values.speakerGender.id
        )
      : [];
    if (matchedGender.length > 0) {
      values.speakerGender.name = matchedGender[0][0];
    } else {
      values.speakerGender = { ...NIL_ENTITY };
    }
    const matchedCountry = this.props.misc
      ? Object.entries(this.props.misc.country).filter(
          (pair) => pair[1] === values.speakerNationality.id
        )
      : [];
    if (matchedCountry.length > 0) {
      values.speakerNationality.name = matchedCountry[0][0];
    } else {
      values.speakerNationality = { ...NIL_ENTITY };
    }
    const matchedOccupation = this.props.misc
      ? Object.entries(this.props.misc.occupation).filter(
          (pair) => pair[1] === values.speakerOccupation.id
        )
      : [];
    if (matchedOccupation.length > 0) {
      values.speakerOccupation.name = matchedOccupation[0][0];
    } else {
      values.speakerOccupation = { ...NIL_ENTITY };
    }

    if (values.speaker.id) {
      const speakerName = this.props.speakerCache.get(values.speaker.id);
      let promise: Promise<FullFormValues>;
      if (speakerName) {
        values.speaker.name = speakerName;
        promise = Promise.resolve(values);
      } else {
        promise = getSpeaker(values.speaker.id).then((speaker) => {
          values.speaker.name = speaker.name;
          return values;
        });
      }
      promise
        .then((values) =>
          this.setState({ values, attrCandidates, textValue: values.text })
        )
        .then(() => {
          if (speakerName) {
            this.props.dispatch(getSpeakerAction(this.state.values.speaker.id));
          } else {
            this.props.dispatch(
              setSpeaker(
                this.state.values.speaker.id,
                this.state.values.speaker.name
              )
            );
          }
        })
        .catch(() => {
          values.speaker = { ...NIL_ENTITY };
          this.setState({ values, attrCandidates, textValue: values.text });
        });
    } else {
      values.speaker = { ...NIL_ENTITY };
      this.setState({ values, attrCandidates, textValue: values.text });
    }
  }

  validateForm(values: FullFormValues): Record<string, string> {
    const errors: Record<string, string> = {};
    if (
      values.target === QueryTarget.QUOTATION &&
      !this.state.textValue &&
      values.exactMatch
    ) {
      errors.text = "Text cannot be empty if exact match is selected.";
      errors.exactMatch = errors.text;
    } else if (
      values.target === QueryTarget.QUOTATION &&
      !this.state.textValue &&
      values.speaker.id === "" &&
      values.domain === "" &&
      values.speakerNationality.id === "" &&
      values.speakerGender.id === "" &&
      values.speakerOccupation.id === "" &&
      values.numOccurrences === ""
    ) {
      errors.speaker = "Please enter at least one search field.";
      errors.domain = errors.speaker;
      errors.speakerNationality = errors.speaker;
      errors.speakerGender = errors.speaker;
      errors.speakerOccupation = errors.speaker;
      errors.numOccurrences = errors.speaker;
      errors.exactMatch = errors.speaker;
      if (!this.state.dropdownVisible) {
        errors.text = errors.speaker;
      }
    } else if (values.target === QueryTarget.ARTICLE && !this.state.textValue) {
      errors.text = "Text cannot be empty.";
    }

    if (!this.props.dateRange) {
      if (!values.fromDate) {
        errors.fromDate = "Date is required.";
      }
      if (!values.toDate) {
        errors.toDate = "Date is required.";
      }
    }

    if (
      values.numOccurrences &&
      (isNaN(+values.numOccurrences) ||
        !Number.isInteger(+values.numOccurrences))
    ) {
      errors.numOccurrences = "Must be an integer.";
    }

    if (errors.text) {
      this.setState({
        barError: errors.text,
        showError: true,
        hideError: false,
      });
      setTimeout(() => this.setState({ showError: false }), 500);
      // Wait for extra 600ms for the fadeout transition
      setTimeout(() => this.setState({ hideError: true }), 1100);
    }
    return errors;
  }

  submitForm(newValues: FullFormValues): void {
    if (this.state.submitted || this.props.loading) {
      return;
    }

    if (this.props.dateRange) {
      if (!newValues.fromDate) {
        newValues.fromDate = this.props.dateRange.fromDate;
      }
      if (!newValues.toDate) {
        newValues.toDate = this.props.dateRange.toDate;
      }
    } else {
      // This branch should never be hit. Just in case anything goes wrong.
      const today = new Date();
      if (!newValues.fromDate) {
        newValues.fromDate = today;
      }
      if (!newValues.toDate) {
        newValues.toDate = today;
      }
    }

    const searchParams = composePermalink(newValues);
    if (
      this.props.query &&
      searchParams.toString() === this.props.query.toString()
    ) {
      return;
    }

    let newTextValue = this.createPlaceholder(newValues);
    if (this.inputRef.current && this.inputRef.current.value) {
      newTextValue = this.inputRef.current.value;
    }

    this.setState({
      submitted: true,
      values: newValues,
      dropdownVisible: false,
      searchBarFocused: false,
      textValue: "Searching... " + newTextValue,
      textTouched: true
    });
    if (this.props.preSubmit) {
      this.props.preSubmit(newValues.text);
    }
    const call =
      newValues.target === QueryTarget.ARTICLE
        ? submitSearchArticleQuery
        : submitSearchQuotationQuery;
    const query = convertValueToQuery(newValues);
    call(query).then((res: SearchResult) => {
      this.props.dispatch(
        batchActions([setResult(res), setSearchQuery(query, searchParams)])
      );
      this.setState({ submitted: false });

      const url = this.props.location;
      if (this.props.nextPathName) {
        url.pathname = this.props.nextPathName;
      }
      url.search = searchParams.toString();
      this.props.history.push(url);
    });
  }
}

export default connector(SearchBar);
