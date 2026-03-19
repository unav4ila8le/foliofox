type ProjectedSeriesYAxisDomain = [number, number] | ["auto", "auto"];

const roundToNiceInterval = (value: number, roundUp: boolean): number => {
  if (value === 0) {
    return 0;
  }

  const sign = value < 0 ? -1 : 1;
  const absValue = Math.abs(value);
  const magnitude = Math.pow(10, Math.floor(Math.log10(absValue)));

  let interval: number;
  if (magnitude >= 100000) {
    interval = 20000;
  } else if (magnitude >= 10000) {
    interval = 10000;
  } else if (magnitude >= 1000) {
    interval = 5000;
  } else if (magnitude >= 100) {
    interval = 500;
  } else if (magnitude >= 10) {
    interval = 50;
  } else {
    interval = 5;
  }

  const rounded = roundUp
    ? Math.ceil(absValue / interval) * interval
    : Math.floor(absValue / interval) * interval;

  return sign * rounded;
};

const computeProjectedSeriesYAxisDomain = (
  projectedValues: number[],
  options?: { roundToNice?: boolean },
): ProjectedSeriesYAxisDomain => {
  if (projectedValues.length === 0) {
    return ["auto", "auto"];
  }

  const minProjectedValue = Math.min(...projectedValues);
  const maxProjectedValue = Math.max(...projectedValues);
  const range = maxProjectedValue - minProjectedValue;
  const padding =
    range === 0 ? Math.abs(minProjectedValue) * 0.2 || 1000 : range * 0.2;

  const rawDomain: [number, number] = [
    minProjectedValue - padding,
    maxProjectedValue + padding,
  ];

  if (!options?.roundToNice) {
    return rawDomain;
  }

  return [
    roundToNiceInterval(rawDomain[0], false),
    roundToNiceInterval(rawDomain[1], true),
  ];
};

export { computeProjectedSeriesYAxisDomain, type ProjectedSeriesYAxisDomain };
