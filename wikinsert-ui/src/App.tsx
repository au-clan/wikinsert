import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
//import MobileNotSupportedPage from "src/page/MobileNotSupportedPage";
import SearchPanelPage from "src/page/SearchPanelPage";
import ResultPage from "src/page/ResultPage";
import 'bootstrap/dist/css/bootstrap.min.css';

require("src/ui/common.scss");

export default function App(): JSX.Element {
  const token = localStorage.getItem("token");

  /*
  const mobile = /iphone|ipod|ipad|android|blackberry|mini|windows\sce|palm/i.test(
    navigator.userAgent.toLowerCase()
  );

  if (mobile) {
    //return <MobileNotSupportedPage />;
  }*/

  return (
    <Router>
      <Switch>
        <Route exact path="/" component={SearchPanelPage} />
        <Route exact path="/search" component={ResultPage} />
      </Switch>
    </Router>
  );
}
