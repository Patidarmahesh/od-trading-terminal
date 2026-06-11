// Data algorithms extracted from server.js

export function generateInitialChartData(activeConfig) {
  const count = 130;
  const data = [];
  let currentPrice = 25280;
  let baseTime = new Date('2026-05-10');

  // Generate initial mock price history
  for (let i = 0; i < count; i++) {
    let change = (Math.random() - 0.5) * 20;
    if (i < 40) change -= 4;
    else if (i >= 40 && i < 60) change += (Math.random() - 0.5) * 10;
    else if (i >= 60 && i < 90) change += 9;
    else if (i >= 90 && i < 115) change -= 12;
    else change += 3;

    const open = currentPrice;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 8;
    const low = Math.min(open, close) - Math.random() * 8;
    
    currentPrice = close;
    const dateStr = new Date(baseTime.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    data.push({
      time: dateStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 3000000) + 1000000,
      isSideways: false
    });
  }

  // Set default buy arrow index
  const buyArrowIndex = 68;
  if (data[buyArrowIndex]) {
    data[buyArrowIndex].open = 25160.00;
    data[buyArrowIndex].close = 25195.00;
  }

  // Peak trigger index for Sell Signal
  const triggerIndex = 90;
  if (data[triggerIndex]) {
    data[triggerIndex].open = 25290.00;
    data[triggerIndex].high = 25305.00;
    data[triggerIndex].low = 25260.00;
    data[triggerIndex].close = 25273.75;
  }

  return runCalculationsOnArray(data, activeConfig);
}

export function runCalculationsOnArray(data, activeConfig, currentTrend = 'SELL') {
  // 1. Calculate EMAs (Cyan Bullish / Magenta Bearish)
  const emaLength = activeConfig?.length || 50;
  const srcProp = activeConfig?.src || 'Close';
  const emaAlpha = 2 / (emaLength + 1);
  let currentEma = data[0].close;
  
  const emaBullish = [];
  const emaBearish = [];

  for (let i = 0; i < data.length; i++) {
    const val = data[i][srcProp.toLowerCase()] || data[i].close;
    currentEma = val * emaAlpha + currentEma * (1 - emaAlpha);
    const emaVal = parseFloat(currentEma.toFixed(2));
    const isBullishTrend = (i >= 62 && i <= 90);

    if (isBullishTrend) {
      emaBullish.push({ time: data[i].time, value: emaVal });
      if (i === 62 || i === 90) {
        emaBearish.push({ time: data[i].time, value: emaVal });
      } else {
        emaBearish.push({ time: data[i].time });
      }
    } else {
      emaBearish.push({ time: data[i].time, value: emaVal });
      if (i === 61 || i === 91) {
        emaBullish.push({ time: data[i].time, value: emaVal });
      } else {
        emaBullish.push({ time: data[i].time });
      }
    }
  }

  // 2. Sideways Flag Channel Logic based on Range Size
  const rangePeriod = activeConfig?.rangePeriod || 14;
  const rangeSize = activeConfig?.rangeSize || 3.5;
  
  for (let i = rangePeriod; i < data.length; i++) {
    const isSidewaysZone = (i >= 32 && i <= 58);
    if (isSidewaysZone && rangeSize > 2.0) {
      data[i].isSideways = true;
    }
  }

  // 3. Support & Resistance Zones
  const showSR = activeConfig?.showSupportResistance ?? true;
  const supplyZone = {
    top: 25390,
    bottom: 25345,
    vol: -5147824,
    startTime: data[88]?.time || data[0].time,
    endTime: data[112]?.time || data[data.length - 1].time
  };
  const demandZone = {
    top: 25215,
    bottom: 25165,
    vol: 11618865,
    startTime: data[48]?.time || data[0].time,
    endTime: data[112]?.time || data[data.length - 1].time
  };

  // 4. Breakout Targets based on currentTrend
  const triggerIndex = 90;
  let signal = null;
  if (data[triggerIndex]) {
    if (currentTrend === 'SELL') {
      signal = {
        time: data[triggerIndex].time,
        label: 'Sell',
        entry: 25273.75,
        sl: 25324.30,
        tp1: 25223.20,
        tp2: 25172.65,
        tp3: 25122.10,
        tp4: 25071.55,
        high: data[triggerIndex].high
      };
    } else {
      signal = {
        time: data[triggerIndex].time,
        label: 'Buy',
        entry: 25180.00,
        sl: 25120.00,
        tp1: 25220.00,
        tp2: 25270.00,
        tp3: 25320.00,
        tp4: 25370.00,
        high: data[triggerIndex].high // render badge in the same place
      };
    }
  }

  const buyArrowIndex = 68;
  let buyArrow = null;
  if (data[buyArrowIndex]) {
    buyArrow = {
      time: data[buyArrowIndex].time,
      price: data[buyArrowIndex].low
    };
  }

  return {
    ohlcv: data,
    emaBullish,
    emaBearish,
    srZones: showSR ? { supply: supplyZone, demand: demandZone } : null,
    signal,
    currentTrend,
    buyArrow
  };
}
