import { select, event } from 'd3-selection';
import { scaleIdentity } from 'd3-scale';
import { seriesSvgLine } from 'd3fc-series';
import { axisBottom, axisRight, axisLeft, axisTop } from 'd3fc-axis';
import { dataJoin } from 'd3fc-data-join';
import { rebindAll, exclude, prefix, includeMap } from 'd3fc-rebind';

const functor = (v) =>
  typeof v === 'function' ? v : () => v;

export default (d3fcElementType, plotAreaDrawFunction) =>
    (xScale = scaleIdentity(), yScale = scaleIdentity()) => {

        let yLabel = functor('');
        let xLabel = functor('');
        let yOrient = functor('right');
        let xOrient = functor('bottom');
        let chartLabel = functor('');
        let plotArea = seriesSvgLine();
        let xTickFormat = null;
        let xTickArgs;
        let xTickSize;
        let xTickValues;
        let xDecorate = () => {};
        let yTickFormat = null;
        let yTickArgs;
        let yTickSize;
        let yTickValues;
        let yDecorate = () => {};
        let decorate = () => {};

        const axisForOrient = (orient) => {
            switch (orient) {
            case 'bottom':
                return axisBottom();
            case 'top':
                return axisTop();
            case 'left':
                return axisLeft();
            case 'right':
                return axisRight();
            case 'none':
                return null;
            }
        };

        const marginForOrient = (orient) => {
            switch (orient) {
            case 'left':
                return `margin-left: 4em`;
            case 'right':
                return `margin-right: 4em`;
            default:
                return '';
            }
        };

        const containerDataJoin = dataJoin('d3fc-group', 'cartesian-chart');

        const propagateTransition = maybeTransition => selection =>
            maybeTransition.selection ? selection.transition(maybeTransition) : selection;

        const cartesian = (selection) => {

            const transitionPropagator = propagateTransition(selection);

            selection.each((data, index, group) => {
                const container = containerDataJoin(select(group[index]), [data]);

                const xOrientValue = xOrient(data);
                const yOrientValue = yOrient(data);
                const xAxis = axisForOrient(xOrientValue);
                const yAxis = axisForOrient(yOrientValue);

                const xAxisMarkup = xAxis
                  ? `<d3fc-svg class='x-axis' style='height: 2em; margin-${yOrientValue}: 4em'></d3fc-svg>
                    <div class='x-axis-label' style='height: 1em; line-height: 1em; text-align: center; margin-${yOrientValue}: 4em'></div>`
                  : '';
                const yAxisMarkup = yAxis
                  ? `<d3fc-svg class='y-axis' style='width: 3em'></d3fc-svg>
                    <div style='width: 1em; display: flex; align-items: center; justify-content: center'>
                        <div class='y-axis-label' style='transform: rotate(-90deg)'></div>
                    </div>`
                  : '';

                container.enter()
                    .attr('style', 'display: flex; height: 100%; width: 100%; flex-direction: column')
                    .attr('auto-resize', '')
                    .html(`<div class='chart-label'
                                style='height: ${chartLabel ? 2 : 0}em; line-height: 2em; text-align: center; ${marginForOrient(yOrientValue)}'>
                          </div>
                          <div style='flex: 1; display: flex; flex-direction: ${xOrientValue === 'bottom' ? 'column' : 'column-reverse'}'>
                              <div style='flex: 1; display: flex; flex-direction: ${yOrientValue === 'right' ? 'row' : 'row-reverse'}'>
                                  <${d3fcElementType} class='plot-area' style='flex: 1; overflow: hidden'></${d3fcElementType}>
                                  ${yAxisMarkup}
                              </div>
                              ${xAxisMarkup}
                          </div>`);

                container.select('.y-axis-label')
                    .text(yLabel(data));

                container.select('.x-axis-label')
                    .text(xLabel(data));

                container.select('.chart-label')
                    .text(chartLabel(data));

                container.select('.y-axis')
                    .on('measure', (d, i, nodes) => {
                        if (yOrientValue === 'left') {
                            const { width, height } = event.detail;
                            select(nodes[i])
                              .select('svg')
                              .attr('viewBox', `${-width} 0 ${width} ${height}`);
                        }
                    })
                    .on('draw', (d, i, nodes) => {
                        yAxis.tickFormat(yTickFormat)
                          .decorate(yDecorate);
                        if (yTickArgs) {
                            yAxis.ticks(...yTickArgs);
                        }
                        if (yTickSize) {
                            yAxis.tickSize(yTickSize);
                        }
                        if (yTickValues) {
                            yAxis.tickValues(yTickValues);
                        }
                        transitionPropagator(select(nodes[i]))
                          .select('svg')
                          .call(yAxis.scale(yScale));
                    });

                container.select('.x-axis')
                    .on('measure', (d, i, nodes) => {
                        if (xOrientValue === 'top') {
                            const { width, height } = event.detail;
                            select(nodes[i])
                              .select('svg')
                              .attr('viewBox', `0 ${-height} ${width} ${height}`);
                        }
                    })
                    .on('draw', (d, i, nodes) => {
                        xAxis.tickFormat(xTickFormat)
                          .decorate(xDecorate);
                        if (xTickArgs) {
                            xAxis.ticks(...xTickArgs);
                        }
                        if (xTickSize) {
                            xAxis.tickSize(xTickSize);
                        }
                        if (xTickValues) {
                            xAxis.tickValues(xTickValues);
                        }
                        transitionPropagator(select(nodes[i]))
                          .select('svg')
                          .call(xAxis.scale(xScale));
                    });

                container.select('.plot-area')
                    .on('measure', () => {
                        const { width, height } = event.detail;
                        xScale.range([0, width]);
                        yScale.range([height, 0]);
                    })
                    .on('draw', (d, i, nodes) => {
                        plotArea.xScale(xScale)
                          .yScale(yScale);
                        plotAreaDrawFunction(d, nodes[i], plotArea, transitionPropagator);
                    });

                container.each((_, index, group) => group[index].requestRedraw());

                decorate(container, data, index);
            });
        };

        const scaleExclusions = exclude(
            /range\w*/,   // the scale range is set via the component layout
            /tickFormat/  // use axis.tickFormat instead (only present on linear scales)
        );
        rebindAll(cartesian, xScale, scaleExclusions, prefix('x'));
        rebindAll(cartesian, yScale, scaleExclusions, prefix('y'));

        cartesian.xTickFormat = (...args) => {
            if (!args.length) {
                return xTickFormat;
            }
            xTickFormat = args[0];
            return cartesian;
        };
        cartesian.xTicks = (...args) => {
            xTickArgs = args;
            return cartesian;
        };
        cartesian.xTickSize = (...args) => {
            xTickSize = args[0];
            return cartesian;
        };
        cartesian.xTickValues = (...args) => {
            xTickValues = args[0];
            return cartesian;
        };
        cartesian.xDecorate = (...args) => {
            if (!args.length) {
                return xDecorate;
            }
            xDecorate = args[0];
            return cartesian;
        };
        cartesian.yTickFormat = (...args) => {
            if (!args.length) {
                return yTickFormat;
            }
            yTickFormat = args[0];
            return cartesian;
        };
        cartesian.yTicks = (...args) => {
            yTickArgs = args;
            return cartesian;
        };
        cartesian.yTickSize = (...args) => {
            yTickSize = args[0];
            return cartesian;
        };
        cartesian.yTickValues = (...args) => {
            yTickValues = args[0];
            return cartesian;
        };
        cartesian.yDecorate = (...args) => {
            if (!args.length) {
                return yDecorate;
            }
            yDecorate = args[0];
            return cartesian;
        };
        cartesian.yOrient = (...args) => {
            if (!args.length) {
                return yOrient;
            }
            yOrient = functor(args[0]);
            return cartesian;
        };
        cartesian.xOrient = (...args) => {
            if (!args.length) {
                return xOrient;
            }
            xOrient = functor(args[0]);
            return cartesian;
        };
        cartesian.chartLabel = (...args) => {
            if (!args.length) {
                return chartLabel;
            }
            chartLabel = functor(args[0]);
            return cartesian;
        };
        cartesian.plotArea = (...args) => {
            if (!args.length) {
                return plotArea;
            }
            plotArea = args[0];
            return cartesian;
        };
        cartesian.xLabel = (...args) => {
            if (!args.length) {
                return xLabel;
            }
            xLabel = functor(args[0]);
            return cartesian;
        };
        cartesian.yLabel = (...args) => {
            if (!args.length) {
                return yLabel;
            }
            yLabel = functor(args[0]);
            return cartesian;
        };
        cartesian.decorate = (...args) => {
            if (!args.length) {
                return decorate;
            }
            decorate = args[0];
            return cartesian;
        };

        return cartesian;

    };
