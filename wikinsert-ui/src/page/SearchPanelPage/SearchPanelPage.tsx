import React from "react";
import { RouteComponentProps } from "react-router-dom";
import Loader from "src/ui/Loader";
import BasicMode from "./BasicMode";

import { connect, ConnectedProps } from "react-redux";
import classNames from "classnames";
import { getDateRange, getMissingDataPeriod, getSpeakerAttrs } from "src/api";
import {
  parseQueryParams,
  convertValueToQuery,
  composePermalink,
} from "src/page/utils";
import Footer from "src/ui/Footer";
import {
  ISearchAppState,
  setDateRange,
  setLoading,
  setMissingDataPeriod,
  setSearchQuery,
  setSearchOptions,
} from "src/reducer/resultReducer";
import { batchActions } from "redux-batched-actions";
import HelpIcon from "src/ui/icons/help_outline_18dp.svg";
import { Col, Container, Row } from "react-bootstrap";

const styles = require("./searchpanel.scss");
const connector = connect((state: ISearchAppState) => ({
  loading: state.loading,
  searchParams: state.searchParams,
  searchQuery: state.searchQuery,
  dateRange: state.dateRange,
  misc: state.speakerAttrs,
}));

type ISearchPanelProps = ConnectedProps<typeof connector>;

interface ISearchPanelState {
  advancedMode: boolean;
}

class SearchPanelPage extends React.Component<
  RouteComponentProps & ISearchPanelProps,
  ISearchPanelState
> {
  constructor(props: RouteComponentProps & ISearchPanelProps) {
    super(props);
    this.state = {
      advancedMode: false,
    };
  }

  componentDidMount() {
    const { values } = parseQueryParams(this.props.location.search);
    const query = convertValueToQuery(values);
    if (!this.props.dateRange || !this.props.misc) {
      Promise.all([getDateRange(), getSpeakerAttrs()]).then(
        ([dateRange, attrs]) => {
          this.props.dispatch(
            batchActions([
              setDateRange(dateRange),
              setSearchOptions(attrs),
              setSearchQuery(query, composePermalink(values)),
              setLoading(false),
            ])
          );
        }
      );
    } else {
      this.props.dispatch(
        batchActions([
          setSearchQuery(query, composePermalink(values)),
          setLoading(false),
        ])
      );
    }
  }

  submitHandler(): void {
    getMissingDataPeriod().then((res) => {
      this.props.dispatch(setMissingDataPeriod(res));
      const url = this.props.location;
      url.search = this.props.searchParams?.toString() || "";
      url.pathname = "/search";
      this.props.history.push(url);
    });
  }

  render(): JSX.Element {
    let loaderClassName = "";
    let containerClassName = classNames(styles.container, styles.fadeOut);
    if (!this.props.loading) {
      loaderClassName = styles.fadeOut;
      containerClassName = classNames(styles.container, styles.fadeIn);
    }

    return (
      <>
        <Container className={classNames(containerClassName, 'h-100')}>
          <Row className={classNames('h-100', 'justify-content-center', 'align-items-center')}>
            <Row className={styles.alignUp}>
              <Row>
                <Col className={classNames(styles.title, "text-center")}>
                Quotebank<span className={styles.dot}>.</span>
                <a
                    className={styles.help}
                    title="What is Quotebank?"
                    target="_blank"
                    rel="noreferrer"
                    href="https://epfl-dlab.github.io/quotebank-es/"
                  >
                    <HelpIcon style={{ verticalAlign: "super" }} />
                  </a>
                </Col>
              </Row>
              <Row>
                <Col>
                  <BasicMode
                      location={this.props.location}
                      history={this.props.history}
                      changeModeHandler={() => this.setState({ advancedMode: true })}
                      onSubmit={() => this.submitHandler()}
                  />
                </Col>
                </Row>
              </Row>
            </Row>
        </Container>
        <div className={loaderClassName}>
          <Loader />
        </div>
        {!this.props.loading && <Footer abs={!this.state.advancedMode} />}
      </>
    );
  }
}

export default connector(SearchPanelPage);
