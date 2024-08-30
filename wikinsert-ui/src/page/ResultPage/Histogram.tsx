import React from "react";
import * as d3 from "d3";
import {
  DateHistogramData,
  DateHistogramBucket,
  DateHistogramInterval,
  QueryTarget,
} from "src/api";
import { formatDate } from "src/page/utils";
import classNames from "classnames";

const styles = require("./histogram.scss");

interface BucketWithMissingDataFlag {
  fromDate: string;
  docCount: number;
  overlapMissingDataPeriod: boolean;
}

const Histogram = (props: {
  type: QueryTarget;
  queryFromDate: string;
  queryToDate: string;
  hist: DateHistogramData;
  width: number;
  missingDataPeriod: Date[];
}): JSX.Element => {
  const queryFromDateStr = props.queryFromDate;
  const queryToDateStr = props.queryToDate;
  const data = extendData(
    props.hist.buckets,
    props.hist.interval,
    queryFromDateStr,
    queryToDateStr,
    props.missingDataPeriod
  );
  const d3Container = React.useRef(null);
  // Use this to decide the position of the tooltip. We don't want the tooltip
  // to overflow.
  const estimatedTooltipWidth = 200;
  // Estimate how much space should be reserved for the y-axis labels by the
  // number of digits of the max y value.
  const maxDocCount = Math.max(...data.map((d) => d.docCount));
  const estimatedYAxisWidth = maxDocCount.toString().length * 10 + 30;
  const margin = { top: 20, right: 40, bottom: 40, left: estimatedYAxisWidth },
    width = props.width - margin.left - margin.right,
    height = 200 - margin.top - margin.bottom;

  React.useEffect(() => {
    if (d3Container.current) {
      // Tooltip
      const tooltip = d3
        .select(`.${styles.wrapper}`)
        .append("div")
        .attr("class", classNames(styles.histogram, styles.tooltip))
        .style("opacity", 0);

      // Plot base
      d3.select(d3Container.current).html("");
      const wrapper = d3
        .select(d3Container.current)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
      const svg = wrapper
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Axes
      const x = d3.scaleBand().range([0, width]).padding(0.1);
      x.domain(data.map((d) => d.fromDate)).padding(
        Math.min(1 / data.length, 0.5)
      );
      const y = d3
        .scaleLinear()
        .domain([0, 1.2 * (d3.max(data, (d) => d.docCount) || 0)])
        .range([height, 0]);
      const tickValuesX = [data[0].fromDate];
      if (data.length > 1) {
        tickValuesX.push(data[data.length - 1].fromDate);
      }
      svg
        .append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(tickValuesX))
        .selectAll("text")
        .attr("dy", "1em");

      const yTickCount =
        maxDocCount > 5 ? Math.min(props.hist.buckets.length, 5) : maxDocCount;
      svg.append("g").call(d3.axisLeft(y).ticks(yTickCount));

      // Bars
      const bars = svg.selectAll("rect").data(data);
      const newBars = bars.enter();
      newBars
        .append("rect")
        .attr("x", (d) => x(d.fromDate) || true)
        .attr("y", (d) => y(d.docCount))
        .attr("width", x.bandwidth())
        .attr("height", (d) => height - y(d.docCount))
        .attr("fill", "#f2e8cb");

      newBars
        .append("rect")
        .attr("x", (d) => x(d.fromDate) || true)
        .attr("y", height)
        .attr("width", x.bandwidth())
        .attr("height", (d) => (d.overlapMissingDataPeriod ? 1 : 0))
        .attr("fill", "#f9f9f9")
        .attr("stroke", "black")
        .attr("stroke-dasharray", "1,6")
        .attr("stroke-width", "1")
        .attr("stroke-linecap", "round");

      newBars
        .append("rect")
        .attr("x", (d) => x(d.fromDate) || true)
        .attr("y", 0)
        .attr("width", x.bandwidth())
        .attr("height", height)
        .style("opacity", 0)
        .on("mouseover", (event, d) => {
          const left =
            event.pageX + estimatedTooltipWidth > window.innerWidth
              ? event.pageX - estimatedTooltipWidth
              : event.pageX;
          const toDate = formatDate(getToDate(d.fromDate, props.hist.interval));
          d3.select(event.target).attr("fill", "#e8d08b");
          tooltip.style("opacity", 0.9);
          tooltip
            .html(`${d.fromDate} - ${toDate}<br />count: ${d.docCount}`)
            .style("left", `${left}px`)
            .style("top", `${event.pageY - 28}px`);
        })
        .on("mousemove", (event) => {
          const left =
            event.pageX + estimatedTooltipWidth > window.innerWidth
              ? event.pageX - estimatedTooltipWidth
              : event.pageX;
          tooltip
            .style("left", `${left}px`)
            .style("top", `${event.pageY - 28}px`);
        })
        .on("mouseout", (event) => {
          d3.select(event.target).attr("fill", "#f2e8cb");
          tooltip.style("opacity", 0);
        });

      /*
      const barLabels = svg.selectAll(".text").data(props.data);
      barLabels
        .enter()
        .append("text")
        .text((d) => d.doc_count)
        .attr("text-anchor", "middle")
        .attr("x", (d) => (x(d.key_as_string) || 0) + x.bandwidth() / 2)
        .attr("y", (d) => y(d.doc_count) - 10);
      */
    }
  }, [d3Container.current, data]);

  return (
    <div className={styles.wrapper}>
      <div>{`Number of ${props.type}s published between ${queryFromDateStr} and ${queryToDateStr}:`}</div>
      <div className={styles.note}>
        Note: Some time periods were affected by data outages and have missing
        data. Such periods are marked with a dotted line on the horizontal
        timeline.
      </div>
      <div className="w-100">
      <svg
        className={classNames("d3-component", "w-100")}
        //width={width}
        //height={height + margin.top + margin.bottom}
        viewBox={"0 0 " + (width + margin.left + margin.right) + " " + (height + margin.top + margin.bottom)}
        ref={d3Container}
        preserveAspectRatio="xMidYMid meet"
      />
      </div>
    </div>
  );
};

const getToDate = (
  fromDate: string,
  interval: DateHistogramInterval,
  reverse?: boolean
): Date => {
  const date = new Date(fromDate);
  const sign = reverse ? -1 : 1;
  if (interval === DateHistogramInterval.MONTH) {
    // This has a bug with day in general, but in our use case, when
    // interval is month, elasticsearch always returns day = 1
    let y = date.getUTCFullYear();
    let m = date.getUTCMonth();
    const d = date.getUTCDate();
    m = m + sign;
    if (m >= 12) {
      y += 1;
    } else if (m < 0) {
      y -= 1;
    }
    m = m % 12;
    const newDate = new Date(y, m, d);
    newDate.setDate(newDate.getDate() - 1);
    return newDate;
  } else if (interval === DateHistogramInterval.WEEK) {
    date.setDate(date.getDate() + sign * 7 - 1);
    return date;
  } else if (interval === DateHistogramInterval.DAY) {
    date.setDate(date.getDate() + sign * 1 - 1);
    return date;
  }
  return date;
};

const checkOverlapMissingDataPeriod = (
  fromDateString: string,
  toDateString: string,
  missingDateStringPrefix: string[]
) => {
  const fromDateStringPrefix = fromDateString.split("-").slice(0, 2).join("-");
  const toDateStringPrefix = toDateString.split("-").slice(0, 2).join("-");
  return (
    missingDateStringPrefix.indexOf(fromDateStringPrefix) !== -1 ||
    missingDateStringPrefix.indexOf(toDateStringPrefix) !== -1
  );
};

const extendData = (
  data: DateHistogramBucket[],
  interval: DateHistogramInterval,
  queryFromDate: string,
  queryToDate: string,
  missingDataPeriod: Date[]
) => {
  const missingDataPeriodPrefix = missingDataPeriod.map((d) =>
    formatDate(d).split("-").slice(0, 2).join("-")
  );
  const fromDate = new Date(queryFromDate);
  const toDate = new Date(queryToDate);
  let firstDate = new Date(data[0].from_date);
  let lastDate = new Date(data[data.length - 1].from_date);
  let newBuckets: BucketWithMissingDataFlag[] = [];
  while (firstDate > fromDate) {
    const fromDateString = formatDate(firstDate);
    firstDate = getToDate(fromDateString, interval, true);
    newBuckets.push({
      fromDate: fromDateString,
      docCount: 0,
      overlapMissingDataPeriod: checkOverlapMissingDataPeriod(
        fromDateString,
        formatDate(firstDate),
        missingDataPeriodPrefix
      ),
    });
    firstDate.setDate(firstDate.getDate() + 1);
  }
  const fromDateString = formatDate(firstDate);
  firstDate = getToDate(fromDateString, interval, true);
  newBuckets.push({
    fromDate: fromDateString,
    docCount: 0,
    overlapMissingDataPeriod: checkOverlapMissingDataPeriod(
      fromDateString,
      formatDate(firstDate),
      missingDataPeriodPrefix
    ),
  });

  newBuckets = newBuckets.reverse().concat(
    data.map((d) => {
      const toDate = getToDate(d.from_date, interval);
      return {
        fromDate: d.from_date,
        docCount: d.doc_count,
        overlapMissingDataPeriod: checkOverlapMissingDataPeriod(
          d.from_date,
          formatDate(toDate),
          missingDataPeriodPrefix
        ),
      };
    })
  );
  while (new Date(lastDate.getDate() + interval) < toDate) {
    console.log('From'  + lastDate);
    const fromDateString = formatDate(lastDate);
    lastDate = getToDate(fromDateString, interval);
    newBuckets.push({
      fromDate: fromDateString,
      docCount: 0,
      overlapMissingDataPeriod: checkOverlapMissingDataPeriod(
        fromDateString,
        formatDate(lastDate),
        missingDataPeriodPrefix
      ),
    });
    lastDate.setDate(lastDate.getDate() + 1);
  }
  return newBuckets;
};

export default Histogram;
