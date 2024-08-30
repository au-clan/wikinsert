import classNames from "classnames";
import React from "react";
import { Col, Container, Row } from "react-bootstrap";
import { Link, RouteComponentProps } from "react-router-dom";
import SearchBar from "./SearchBar";

const styles = require("./header.scss");

const Header = (props: {
  history: RouteComponentProps["history"];
  location: RouteComponentProps["location"];
}): JSX.Element => (
  <div className={styles.header}>
    <Container className={styles.headerWrapper}>
      <div className={classNames(styles.title)}>
        <Link to="/">
          Q<span className={classNames('d-none', 'd-md-inline')}>uotebank</span><span className={styles.dot}>.</span>
        </Link>
      </div>
      <div className={classNames(styles.searchBar)}>
        <SearchBar history={props.history} location={props.location} />
      </div>
    </Container>
  </div>
);

export default Header;
