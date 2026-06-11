import Config from '../models/configModel.js';

export const ASSETS = {
  NIFTY: { basePrice: 23200, volMultiplier: 5, decimals: 2, name: 'NIFTY 50 INDEX', symbol: 'NIFTY', badge: '5 • NSE' },
  BANKNIFTY: { basePrice: 51600, volMultiplier: 25, decimals: 2, name: 'NIFTY BANK INDEX', symbol: 'BANKNIFTY', badge: '15 • NSE' },
  FINNIFTY: { basePrice: 23800, volMultiplier: 8, decimals: 2, name: 'NIFTY FIN SERVICE', symbol: 'FINNIFTY', badge: '5 • NSE' },
  MIDCAPNIFTY: { basePrice: 12500, volMultiplier: 6, decimals: 2, name: 'NIFTY MIDCAP 100', symbol: 'MIDCAPNIFTY', badge: '5 • NSE' },
  XAUUSD: { basePrice: 2655, volMultiplier: 0.75, decimals: 3, name: 'GOLD SPOT', symbol: 'XAUUSD', badge: '1 • FX' }
};

let activeConfig = {
  disclaimerChecked: true,
  strategyType: 'OD SOFT',
  showSupportResistance: true,
  src: 'Close',
  length: 50,
  filterType: 'Type 1',
  movementSource: 'Close',
  rangeSize: 3.5,
  rangeScale: 'ATR',
  rangePeriod: 14
};

let activeChartData = null;
let dbConnected = false;
let ioInstance = null;
let simulatorInterval = null;

let currentTrend = 'SELL';
let trendCounter = 0;
let candleCounter = 0;
let activeAsset = ASSETS.NIFTY;

export const setDbConnected = (status) => {
  dbConnected = status;
};

export const setSocketIo = (io) => {
  ioInstance = io;
  
  ioInstance.on('connection', (socket) => {
    
    socket.on('SWITCH_ASSET', (assetKey) => {
      if (ASSETS[assetKey]) {
        activeAsset = ASSETS[assetKey];
        trendCounter = 0;
        candleCounter = 0;
        activeChartData = generateDataForAsset(activeConfig, activeAsset, currentTrend);
        ioInstance.emit('tick', { chartData: activeChartData, config: activeConfig, activeAsset });
      }
    });

    socket.on('UPDATE_SETTINGS', async (updatedSettings) => {
      activeConfig = { ...activeConfig, ...updatedSettings };
      
      // Optionally save to DB
      if (dbConnected) {
        try {
          const config = await Config.findOne();
          if (config) {
            Object.assign(config, updatedSettings);
            await config.save();
          } else {
            await Config.create(updatedSettings);
          }
        } catch (e) {
          console.error("DB config save error", e);
        }
      }

      // Re-anchor the calculator using new EMA Length and Range Size
      activeChartData = generateDataForAsset(activeConfig, activeAsset, currentTrend);
      
      // Push updated tick payload instantly
      ioInstance.emit('tick', { chartData: activeChartData, config: activeConfig, activeAsset });
    });

  });
};

function generateDataForAsset(config, asset, trend) {
  const count = 130;
  const data = [];
  let currentPrice = asset.basePrice;
  let baseTime = new Date('2026-05-10');

  // Dynamically impact the internal wave logic based on EMA length and range size
  const volatilityDamping = (config.length || 50) / 50; 
  const currentVolMultiplier = asset.volMultiplier * (config.rangeSize / 3.5 || 1) * volatilityDamping;

  for (let i = 0; i < count; i++) {
    let change = (Math.random() - 0.5) * currentVolMultiplier * 4;
    
    if (i < 40) change -= (currentVolMultiplier * 0.8);
    else if (i >= 40 && i < 60) change += (Math.random() - 0.5) * currentVolMultiplier * 2;
    else if (i >= 60 && i < 90) change += (currentVolMultiplier * 1.8);
    else if (i >= 90 && i < 115) change -= (currentVolMultiplier * 2.4);
    else change += (currentVolMultiplier * 0.6);

    const open = currentPrice;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * currentVolMultiplier;
    const low = Math.min(open, close) - Math.random() * currentVolMultiplier;
    
    currentPrice = close;
    // 30 minute intervals per candle
    const timestamp = Math.floor(baseTime.getTime() / 1000) + (i * 30 * 60);

    data.push({
      time: timestamp,
      open: parseFloat(open.toFixed(asset.decimals)),
      high: parseFloat(high.toFixed(asset.decimals)),
      low: parseFloat(low.toFixed(asset.decimals)),
      close: parseFloat(close.toFixed(asset.decimals)),
      volume: Math.floor(Math.random() * 3000000) + 1000000,
      isSideways: false
    });
  }

  // Calculate EMAs using configurable length
  const emaLength = config?.length || 50;
  const emaAlpha = 2 / (emaLength + 1);
  let currentEma = data[0].close;
  const emaBullish = [];
  const emaBearish = [];

  // Recalculate transition points if length/range differs significantly
  const shiftIndexBull = Math.min(62 + Math.floor(config.rangeSize - 3.5), 85);

  for (let i = 0; i < data.length; i++) {
    currentEma = data[i].close * emaAlpha + currentEma * (1 - emaAlpha);
    const emaVal = parseFloat(currentEma.toFixed(asset.decimals));
    const isBullishTrend = (i >= shiftIndexBull && i <= 90);

    if (isBullishTrend) {
      emaBullish.push({ time: data[i].time, value: emaVal });
      if (i === shiftIndexBull || i === 90) emaBearish.push({ time: data[i].time, value: emaVal });
      else emaBearish.push({ time: data[i].time });
    } else {
      emaBearish.push({ time: data[i].time, value: emaVal });
      if (i === (shiftIndexBull - 1) || i === 91) emaBullish.push({ time: data[i].time, value: emaVal });
      else emaBullish.push({ time: data[i].time });
    }
  }

  // Target Calculator Anchoring
  const triggerIndex = 90;
  let signal = null;
  
  // Dummy SR Zones
  const supplyZone = {
    top: asset.basePrice + asset.volMultiplier * 35,
    bottom: asset.basePrice + asset.volMultiplier * 25,
    vol: -5147824,
    startTime: data[Math.max(0, count - 40)].time,
    endTime: data[count - 1].time
  };
  const demandZone = {
    top: asset.basePrice - asset.volMultiplier * 20,
    bottom: asset.basePrice - asset.volMultiplier * 30,
    vol: 11618865,
    startTime: data[Math.max(0, count - 80)].time,
    endTime: data[count - 1].time
  };

  if (data[triggerIndex]) {
    const entry = data[triggerIndex].close;
    // Scale TPs dynamically based on rangeSize settings
    const dynamicTpDistance = asset.volMultiplier * 10 * (config.rangeSize / 3.5 || 1);
    
    if (trend === 'SELL') {
      signal = {
        time: data[triggerIndex].time,
        label: 'Sell',
        entry: parseFloat(entry.toFixed(asset.decimals)),
        sl: parseFloat((entry + dynamicTpDistance).toFixed(asset.decimals)),
        tp1: parseFloat((entry - dynamicTpDistance).toFixed(asset.decimals)),
        tp2: parseFloat((entry - dynamicTpDistance * 2).toFixed(asset.decimals)),
        tp3: parseFloat((entry - dynamicTpDistance * 3).toFixed(asset.decimals)),
        tp4: parseFloat((entry - dynamicTpDistance * 4).toFixed(asset.decimals)),
        high: data[triggerIndex].high
      };
    } else {
      signal = {
        time: data[triggerIndex].time,
        label: 'Buy',
        entry: parseFloat(entry.toFixed(asset.decimals)),
        sl: parseFloat((entry - dynamicTpDistance).toFixed(asset.decimals)),
        tp1: parseFloat((entry + dynamicTpDistance).toFixed(asset.decimals)),
        tp2: parseFloat((entry + dynamicTpDistance * 2).toFixed(asset.decimals)),
        tp3: parseFloat((entry + dynamicTpDistance * 3).toFixed(asset.decimals)),
        tp4: parseFloat((entry + dynamicTpDistance * 4).toFixed(asset.decimals)),
        high: data[triggerIndex].high
      };
    }
  }

  return {
    ohlcv: data,
    emaBullish,
    emaBearish,
    signal,
    srZones: { supply: supplyZone, demand: demandZone },
    currentTrend: trend,
    asset,
    showSupportResistance: config.showSupportResistance
  };
}

export const initializeData = async () => {
  try {
    if (dbConnected) {
      let config = await Config.findOne();
      if (!config) {
        config = await Config.create(activeConfig);
        console.log('Seeded default configuration to MongoDB.');
      }
      activeConfig = config.toObject();
    }
  } catch (err) {
    console.error('Error loading config from DB:', err);
  }
  
  activeChartData = generateDataForAsset(activeConfig, activeAsset, currentTrend);
  startLiveSimulator();
};

const startLiveSimulator = () => {
  if (simulatorInterval) clearInterval(simulatorInterval);

  // Live ticker simulator: runs every 1 second
  simulatorInterval = setInterval(() => {
    if (!activeChartData || activeChartData.ohlcv.length === 0) return;

    trendCounter++;
    candleCounter++;

    // Alternation Cycle based on dynamic EMA threshold shift rules
    const cycleLength = 240 + Math.floor((activeConfig.length - 50) * 0.5);

    if (trendCounter >= cycleLength) {
      trendCounter = 0;
      currentTrend = currentTrend === 'SELL' ? 'BUY' : 'SELL';
      activeChartData = generateDataForAsset(activeConfig, activeAsset, currentTrend);
    } else {
      const data = activeChartData.ohlcv;
      const lastIndex = data.length - 1;
      const lastCandle = { ...data[lastIndex] };

      if (candleCounter >= 15) {
        candleCounter = 0;
        // Advance by 30 minutes in seconds (1800s)
        const nextTime = lastCandle.time + 1800;

        data.shift(); 
        data.push({
          time: nextTime,
          open: lastCandle.close,
          high: lastCandle.close,
          low: lastCandle.close,
          close: lastCandle.close,
          volume: Math.floor(Math.random() * 2000000) + 1000000,
          isSideways: false
        });
      } else {
        const bias = currentTrend === 'SELL' ? -0.3 : 0.3;
        const noise = (Math.random() - 0.5) * 1.5;
        const dynamicVolScale = activeAsset.volMultiplier * (activeConfig.rangeSize / 3.5 || 1);
        const tickChange = (bias + noise) * dynamicVolScale;
        
        lastCandle.close = parseFloat((lastCandle.close + tickChange).toFixed(activeAsset.decimals));
        lastCandle.high = parseFloat(Math.max(lastCandle.high, lastCandle.close).toFixed(activeAsset.decimals));
        lastCandle.low = parseFloat(Math.min(lastCandle.low, lastCandle.close).toFixed(activeAsset.decimals));
        
        data[lastIndex] = lastCandle;
      }
    }

    const isBullish = currentTrend === 'BUY';
    const mainColor = isBullish ? '#00E676' : '#FF1744';
    const mainLabel = isBullish ? 'BULLISH' : 'BEARISH';
    const sigLabel = isBullish ? 'LONG SIGNAL' : 'SHORT SIGNAL';

    activeChartData.screenerItems = [
      { name: 'BANKBARODA', signal: sigLabel, color: mainColor },
      { name: 'BAJAJHLDNG', signal: 'SHORT SIGNAL', color: '#FF1744' },
      { name: 'BOSCHLTD', signal: 'SHORT SIGNAL', color: '#FF1744' },
      { name: 'RELIANCE', signal: 'LONG SIGNAL', color: '#00E676' }
    ];

    activeChartData.dataRows = [
      { label: 'CURRENT', s1: mainLabel, s2: mainLabel },
      { label: '15M', s1: 'BEARISH', s2: 'BEARISH' },
      { label: '30M', s1: 'BULLISH', s2: 'BEARISH' },
      { label: '1H', s1: 'BULLISH', s2: 'BULLISH' }
    ];

    activeChartData.ribbonBlocks = [
      { color: mainColor, styleWidth: '40%' },
      { color: isBullish ? '#FF1744' : '#00E676', styleWidth: '15%' },
      { color: mainColor, styleWidth: '45%' }
    ];

    if (ioInstance) {
      ioInstance.emit('tick', { chartData: activeChartData, config: activeConfig, activeAsset });
    }
  }, 1000);
};

export const getConfig = (req, res) => {
  res.json({
    config: activeConfig,
    chartData: activeChartData,
    activeAsset
  });
};

export const updateConfig = async (req, res) => {
  try {
    const updatedSettings = req.body;
    activeConfig = { ...activeConfig, ...updatedSettings };

    if (dbConnected) {
      const config = await Config.findOne();
      if (config) {
        Object.assign(config, updatedSettings);
        await config.save();
      } else {
        await Config.create(updatedSettings);
      }
    }

    activeChartData = generateDataForAsset(activeConfig, activeAsset, currentTrend);
    
    if (ioInstance) {
      ioInstance.emit('tick', { chartData: activeChartData, config: activeConfig, activeAsset });
    }

    res.json({
      success: true,
      config: activeConfig,
      chartData: activeChartData,
      activeAsset
    });
  } catch (err) {
    console.error('Error in POST /api/config:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
