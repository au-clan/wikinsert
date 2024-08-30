import classNames from "classnames";
import React from "react";
import { connect } from "react-redux";
import { ISearchAppState } from "src/reducer/resultReducer";
import InfoIcon from "src/ui/icons/info_black_18dp.svg";

const styles = require("./loadinganimation.scss");

const connector = connect((state: ISearchAppState) => ({
    searchQuery: state.searchQuery,
}));

interface ILoadingAnimationProps {
  tick: number;
  slides : string[];
}

interface ILoadingAnimationState {
  current : number;
}

class LoadingAnimation extends React.Component<ILoadingAnimationProps, ILoadingAnimationState> {
  animation_duration_style: { animationDuration: string; };
  interval!: NodeJS.Timeout;

  constructor(props: ILoadingAnimationProps) {
    super(props);

    this.state = {
        current : 0
    };

    this.animation_duration_style = {
        animationDuration : this.props.tick + 'ms'
    }
  }

  tick() {
      this.setState({
        current : (this.state.current+1) % this.props.slides.length
      });
  }

  componentDidMount() {
    this.interval = setInterval(() => this.tick(), this.props.tick);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    let generated_slides: JSX.Element[] = []
    this.props.slides.forEach((s,i) => {
        generated_slides.push(
            <div key={"sentence"+i} className={this.state.current == i ? styles.animate : classNames(styles.animate, styles.hidden)} style={this.animation_duration_style}>
                {s}
            </div>
        )
    });
    return (<div className={styles.loadingAnimation}>{generated_slides}</div>)
  }
}

export default connector(LoadingAnimation);
