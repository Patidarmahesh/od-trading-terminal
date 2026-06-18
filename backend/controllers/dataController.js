import Config from "../models/configModel.js";
import crypto from "crypto";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fyersModel = require("fyers-api-v3").fyersModel;
const fyersDataSocket = require("fyers-api-v3").fyersDataSocket;

export const ASSETS = {
  NIFTY: {
    basePrice: 23200,
    volMultiplier: 5,
    decimals: 2,
    name: "NIFTY 50 INDEX",
    symbol: "NIFTY",
    badge: "5 • NSE",
    fyersSymbol: "NSE:NIFTY50-INDEX",
  },
  BANKNIFTY: {
    basePrice: 51600,
    volMultiplier: 25,
    decimals: 2,
    name: "NIFTY BANK INDEX",
    symbol: "BANKNIFTY",
    badge: "15 • NSE",
    fyersSymbol: "NSE:NIFTYBANK-INDEX",
  },
  FINNIFTY: {
    basePrice: 23800,
    volMultiplier: 8,
    decimals: 2,
    name: "NIFTY FIN SERVICE",
    symbol: "FINNIFTY",
    badge: "5 • NSE",
    fyersSymbol: "NSE:FINNIFTY-INDEX",
  },
  MIDCAPNIFTY: {
    basePrice: 12500,
    volMultiplier: 6,
    decimals: 2,
    name: "NIFTY MIDCAP 100",
    symbol: "MIDCAPNIFTY",
    badge: "5 • NSE",
    fyersSymbol: "NSE:MIDCPNIFTY-INDEX",
  },
};

const SCREENER_SYMBOLS = [
  { fyers: "NSE:BANKBARODA-EQ", name: "BANKBARODA" },
  { fyers: "NSE:BAJAJHLDNG-EQ", name: "BAJAJHLDNG" },
  { fyers: "NSE:BOSCHLTD-EQ", name: "BOSCHLTD" },
  { fyers: "NSE:RELIANCE-EQ", name: "RELIANCE" },
];

let activeConfig = {
  disclaimerChecked: true,
  strategyType: "OD SOFT",
  showSupportResistance: true,
  src: "Close",
  length: 50,
  filterType: "Type 1",
  movementSource: "Close",
  rangeSize: 3.5,
  rangeScale: "ATR",
  rangePeriod: 14,
  fyersAppId: "",
  fyersSecretId: "",
  fyersAccessToken: "",
};

let activeChartData = null;
let screenerDataMap = {}; // { 'NSE:RELIANCE-EQ': { ohlcv: [], signal: 'BULLISH' } }
let dbConnected = false;
let ioInstance = null;
let currentTrend = "SELL";
let activeAsset = ASSETS.NIFTY;
let fyersSocketInstance = null;

export const setDbConnected = (status) => {
  dbConnected = status;
};

export const setSocketIo = (io) => {
  ioInstance = io;

  ioInstance.on("connection", (socket) => {
    socket.on("SWITCH_ASSET", async (assetKey) => {
      if (ASSETS[assetKey]) {
        activeAsset = ASSETS[assetKey];
        await initializeFyersData();
      }
    });

    socket.on("UPDATE_SETTINGS", async (updatedSettings) => {
      activeConfig = { ...activeConfig, ...updatedSettings };

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

      if (activeChartData && activeChartData.ohlcv.length > 0) {
        activeChartData = applyIndicators(
          activeChartData.ohlcv,
          activeConfig,
          activeAsset,
        );
        ioInstance.emit("tick", {
          chartData: activeChartData,
          config: activeConfig,
          activeAsset,
        });
      }
    });
  });
};

const aggregateCandles = (data1m, intervalMinutes) => {
  if (!data1m || data1m.length === 0) return [];
  const aggregated = [];
  let currentCandle = null;

  for (let i = 0; i < data1m.length; i++) {
    const min = data1m[i];
    const intervalTime =
      Math.floor(min.time / (intervalMinutes * 60)) * (intervalMinutes * 60);

    if (!currentCandle || currentCandle.time !== intervalTime) {
      if (currentCandle) aggregated.push(currentCandle);
      currentCandle = {
        time: intervalTime,
        open: min.open,
        high: min.high,
        low: min.low,
        close: min.close,
        volume: min.volume || 0,
      };
    } else {
      currentCandle.high = Math.max(currentCandle.high, min.high);
      currentCandle.low = Math.min(currentCandle.low, min.low);
      currentCandle.close = min.close;
      currentCandle.volume += min.volume || 0;
    }
  }
  if (currentCandle) aggregated.push(currentCandle);
  return aggregated;
};

const getSentiment = (aggData, emaLength) => {
  if (!aggData || aggData.length < 2) return "NEUTRAL";
  const emaAlpha = 2 / (emaLength + 1);
  let currentEma = aggData[0].close;
  for (let i = 1; i < aggData.length - 1; i++) {
    currentEma = aggData[i].close * emaAlpha + currentEma * (1 - emaAlpha);
  }
  const lastClose = aggData[aggData.length - 1].close;
  return lastClose > currentEma ? "BULLISH" : "BEARISH";
};

const applyIndicators = (data, config, asset) => {
  if (!data || data.length === 0) return { ohlcv: [] };

  const emaLength = config?.length || 50;
  const emaAlpha = 2 / (emaLength + 1);
  let currentEma = data[0].close;
  const emaBullish = [];
  const emaBearish = [];

  for (let i = 0; i < data.length; i++) {
    currentEma = data[i].close * emaAlpha + currentEma * (1 - emaAlpha);
    const emaVal = parseFloat(currentEma.toFixed(asset.decimals));

    const isBullishTrend = data[i].close > emaVal;

    if (isBullishTrend) {
      emaBullish.push({ time: data[i].time, value: emaVal });
      emaBearish.push({ time: data[i].time });
    } else {
      emaBearish.push({ time: data[i].time, value: emaVal });
      emaBullish.push({ time: data[i].time });
    }
  }

  let signal = null;
  const triggerIndex = data.length - 1;
  const currentPrice = data[triggerIndex].close;

  const lastVol = data[triggerIndex].volume || 10000;

  const supplyZone = {
    top: currentPrice + asset.volMultiplier * 35,
    bottom: currentPrice + asset.volMultiplier * 25,
    vol: -(lastVol * 5),
    startTime: data[Math.max(0, data.length - 40)]?.time || data[0].time,
    endTime: data[data.length - 1].time + 3600,
  };
  const demandZone = {
    top: currentPrice - asset.volMultiplier * 20,
    bottom: currentPrice - asset.volMultiplier * 30,
    vol: lastVol * 8,
    startTime: data[Math.max(0, data.length - 80)]?.time || data[0].time,
    endTime: data[data.length - 1].time + 3600,
  };

  const dynamicTpDistance =
    asset.volMultiplier * 10 * (config.rangeSize / 3.5 || 1);
  const trend =
    data[triggerIndex].close > emaBullish[triggerIndex]?.value ? "BUY" : "SELL";

  if (trend === "SELL") {
    signal = {
      time: data[triggerIndex].time,
      label: "Sell",
      entry: parseFloat(currentPrice.toFixed(asset.decimals)),
      sl: parseFloat(
        (currentPrice + dynamicTpDistance).toFixed(asset.decimals),
      ),
      tp1: parseFloat(
        (currentPrice - dynamicTpDistance).toFixed(asset.decimals),
      ),
      tp2: parseFloat(
        (currentPrice - dynamicTpDistance * 2).toFixed(asset.decimals),
      ),
      tp3: parseFloat(
        (currentPrice - dynamicTpDistance * 3).toFixed(asset.decimals),
      ),
      tp4: parseFloat(
        (currentPrice - dynamicTpDistance * 4).toFixed(asset.decimals),
      ),
      high: data[triggerIndex].high,
    };
  } else {
    signal = {
      time: data[triggerIndex].time,
      label: "Buy",
      entry: parseFloat(currentPrice.toFixed(asset.decimals)),
      sl: parseFloat(
        (currentPrice - dynamicTpDistance).toFixed(asset.decimals),
      ),
      tp1: parseFloat(
        (currentPrice + dynamicTpDistance).toFixed(asset.decimals),
      ),
      tp2: parseFloat(
        (currentPrice + dynamicTpDistance * 2).toFixed(asset.decimals),
      ),
      tp3: parseFloat(
        (currentPrice + dynamicTpDistance * 3).toFixed(asset.decimals),
      ),
      tp4: parseFloat(
        (currentPrice + dynamicTpDistance * 4).toFixed(asset.decimals),
      ),
      high: data[triggerIndex].high,
    };
  }

  const isBullish = trend === "BUY";
  const mainColor = isBullish ? "#00E676" : "#FF1744";
  const mainLabel = isBullish ? "BULLISH" : "BEARISH";

  // Dynamic Screener logic based on screenerDataMap
  const screenerItems = SCREENER_SYMBOLS.map((sym) => {
    const sData = screenerDataMap[sym.fyers];
    const isBull = sData ? sData.signal === "BULLISH" : false;
    return {
      name: sym.name,
      signal: isBull ? "LONG SIGNAL" : "SHORT SIGNAL",
      color: isBull ? "#00E676" : "#FF1744",
    };
  });

  // Local Candle Aggregation for Multi-Timeframe Data
  const agg15m = aggregateCandles(data, 15);
  const agg30m = aggregateCandles(data, 30);
  const agg1h = aggregateCandles(data, 60);

  const m15Sent = getSentiment(agg15m, emaLength);
  const m30Sent = getSentiment(agg30m, emaLength);
  const h1Sent = getSentiment(agg1h, emaLength);

  const dataRows = [
    { label: "CURRENT", s1: mainLabel, s2: mainLabel },
    { label: "15M", s1: m15Sent, s2: m15Sent },
    { label: "30M", s1: m30Sent, s2: m30Sent },
    { label: "1H", s1: h1Sent, s2: h1Sent },
  ];

  // Generate granular high-frequency ribbon blocks based on recent candle data
  const ribbonBlocks = data.slice(-100).map((candle) => {
    // Determine micro-trend for each candle
    const isCandleBullish = candle.close >= candle.open;
    // Add micro-fluctuation noise based on volume or price action
    const volatility = (candle.high - candle.low) / candle.open;
    const widthPercent = Math.max(0.2, Math.min(3, volatility * 1000));
    
    return {
      color: isCandleBullish ? "#00E676" : "#FF1744",
      styleWidth: `${widthPercent}%`
    };
  });

  return {
    ohlcv: data,
    emaBullish,
    emaBearish,
    signal,
    srZones: { supply: supplyZone, demand: demandZone },
    currentTrend: trend,
    asset,
    showSupportResistance: config.showSupportResistance,
    screenerItems,
    dataRows,
    ribbonBlocks,
  };
};

const fetchFyersHistory = async (symbol) => {
  if (!activeConfig.fyersAppId || !activeConfig.fyersAccessToken) return [];
  const fyers = new fyersModel({ path: "./logs", enableLogging: false });
  fyers.setAppId(activeConfig.fyersAppId);
  fyers.setAccessToken(activeConfig.fyersAccessToken);

  const now = new Date();
  const dateStr =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");

  const reqBody = {
    symbol: symbol,
    resolution: "1",
    date_format: "1",
    range_from: dateStr,
    range_to: dateStr,
    cont_flag: "1",
  };

  try {
    const response = await fyers.getHistory(reqBody);
    if (response.s === "ok" && response.candles) {
      return response.candles.map((c) => ({
        time: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
        isSideways: false,
      }));
    } else {
      console.warn(`No history for ${symbol}:`, response);
      return [];
    }
  } catch (err) {
    console.error(`History API error for ${symbol}:`, err);
    return [];
  }
};

let reconnectTimer = null;
let reconnectAttempts = 0;
let pingInterval = null;
let isReconnecting = false;

const startFyersSocket = () => {
  if (!activeConfig.fyersAppId || !activeConfig.fyersAccessToken) {
    console.warn("Fyers AppId or AccessToken missing. Socket won't start.");
    return;
  }

  try {
    const fds = fyersDataSocket.getInstance(
      `${activeConfig.fyersAppId}:${activeConfig.fyersAccessToken}`,
    );

    fds.on("connect", () => {
      console.log("Connected to Fyers Data Socket");
      
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectAttempts = 0;
      
      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        console.log("[WebSocket] Heartbeat Ping");
      }, 10000);

      if (isReconnecting) {
        if (ioInstance) {
          ioInstance.emit("socket_status", "connected");
        }
        console.log("[WebSocket] Reconnected. Backfilling missing data...");
        initializeFyersData().catch(err => console.error("Backfill failed:", err));
        isReconnecting = false;
      }

      const symbolsToSub = [
        activeAsset.fyersSymbol,
        ...SCREENER_SYMBOLS.map((s) => s.fyers),
      ];
      fds.subscribe(symbolsToSub);
    });

    fds.on("message", (message) => {
      // 👇 YEH VALI LINE ADD KARO
      console.log("🔥 LIVE TICK RECEIVED:", JSON.stringify(message, null, 2));
      const ticks = Array.isArray(message) ? message : [message];

      let chartUpdated = false;

      ticks.forEach((tick) => {
        const currentTime = Math.floor(Date.now() / 1000);

        if (
          tick.symbol === activeAsset.fyersSymbol &&
          tick.ltp &&
          activeChartData &&
          activeChartData.ohlcv.length > 0
        ) {
          const ltp = tick.ltp;
          const data = activeChartData.ohlcv;
          const lastCandle = data[data.length - 1];

          const lastMinute = Math.floor(lastCandle.time / 60) * 60;
          const currentMinute = Math.floor(currentTime / 60) * 60;

          if (currentMinute > lastMinute) {
            data.push({
              time: currentMinute,
              open: lastCandle.close,
              high: ltp,
              low: ltp,
              close: ltp,
              volume: 0,
              isSideways: false,
            });
          } else {
            lastCandle.close = ltp;
            lastCandle.high = Math.max(lastCandle.high, ltp);
            lastCandle.low = Math.min(lastCandle.low, ltp);
          }
          chartUpdated = true;
        }

        // Check if it's a screener symbol
        const screenerSym = SCREENER_SYMBOLS.find(
          (s) => s.fyers === tick.symbol,
        );
        if (screenerSym && tick.ltp) {
          const sData = screenerDataMap[tick.symbol];
          if (sData && sData.ohlcv.length > 0) {
            const lastCandle = sData.ohlcv[sData.ohlcv.length - 1];
            const currentMinute = Math.floor(currentTime / 60) * 60;
            const lastMinute = Math.floor(lastCandle.time / 60) * 60;
            if (currentMinute > lastMinute) {
              sData.ohlcv.push({
                time: currentMinute,
                open: lastCandle.close,
                high: tick.ltp,
                low: tick.ltp,
                close: tick.ltp,
                volume: 0,
              });
            } else {
              lastCandle.close = tick.ltp;
              lastCandle.high = Math.max(lastCandle.high, tick.ltp);
              lastCandle.low = Math.min(lastCandle.low, tick.ltp);
            }
            sData.signal = getSentiment(sData.ohlcv, 50);
            chartUpdated = true;
          }
        }
      });

      if (chartUpdated && ioInstance) {
        activeChartData = applyIndicators(
          activeChartData.ohlcv,
          activeConfig,
          activeAsset,
        );
        ioInstance.emit("tick", {
          chartData: activeChartData,
          config: activeConfig,
          activeAsset,
        });
      }
    });

    const handleDisconnect = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (!isReconnecting) {
        isReconnecting = true;
        if (ioInstance) {
          ioInstance.emit("socket_status", "connection_lost");
        }
      }

      if (reconnectTimer) clearTimeout(reconnectTimer);
      const delay = Math.min(2000 * Math.pow(2, reconnectAttempts), 10000);
      reconnectAttempts++;
      console.log(`[WebSocket] Connection lost. Attempting reconnect #${reconnectAttempts} in ${delay}ms...`);
      
      reconnectTimer = setTimeout(() => {
        startFyersSocket();
      }, delay);
    };

    fds.on("error", (err) => {
      console.error("Fyers WebSocket Error:", err);
      handleDisconnect();
    });

    fds.on("close", () => {
      console.log("Fyers WebSocket Closed");
      handleDisconnect();
    });

    fds.connect();
    fyersSocketInstance = fds;
  } catch (err) {
    console.error("Failed to initialize Fyers Socket:", err);
  }
};

const initializeFyersData = async () => {
  // 1. Fetch Main Asset
  const historyData = await fetchFyersHistory(activeAsset.fyersSymbol);

  // 2. Fetch Screener Symbols
  for (const sym of SCREENER_SYMBOLS) {
    const sHist = await fetchFyersHistory(sym.fyers);
    if (sHist.length > 0) {
      screenerDataMap[sym.fyers] = {
        ohlcv: sHist,
        signal: getSentiment(sHist, 50),
      };
    } else {
      screenerDataMap[sym.fyers] = {
        ohlcv: [{ time: Math.floor(Date.now() / 1000), close: 100 }],
        signal: "NEUTRAL",
      };
    }
  }

  if (historyData.length > 0) {
    activeChartData = applyIndicators(historyData, activeConfig, activeAsset);
  } else {
    console.warn("No historical data returned. Using empty array.");
    activeChartData = applyIndicators(
      [
        {
          time: Math.floor(Date.now() / 1000),
          open: activeAsset.basePrice,
          high: activeAsset.basePrice,
          low: activeAsset.basePrice,
          close: activeAsset.basePrice,
          volume: 0,
          isSideways: false,
        },
      ],
      activeConfig,
      activeAsset,
    );
  }

  if (ioInstance) {
    ioInstance.emit("tick", {
      chartData: activeChartData,
      config: activeConfig,
      activeAsset,
    });
  }

  if (fyersSocketInstance) {
    try {
      fyersSocketInstance.unsubscribe([
        ASSETS.NIFTY.fyersSymbol,
        ASSETS.BANKNIFTY.fyersSymbol,
        ASSETS.FINNIFTY.fyersSymbol,
        ASSETS.MIDCAPNIFTY.fyersSymbol,
        ...SCREENER_SYMBOLS.map((s) => s.fyers),
      ]);
      const symbolsToSub = [
        activeAsset.fyersSymbol,
        ...SCREENER_SYMBOLS.map((s) => s.fyers),
      ];
      fyersSocketInstance.subscribe(symbolsToSub);
    } catch (e) {
      console.error("Failed to resubscribe socket", e);
    }
  } else {
    startFyersSocket();
  }
};

export const initializeData = async () => {
  try {
    if (dbConnected) {
      let config = await Config.findOne();
      if (!config) {
        config = await Config.create(activeConfig);
        console.log("Seeded default configuration to MongoDB.");
      } else {
        activeConfig = { ...activeConfig, ...config.toObject() };
      }
    }
  } catch (err) {
    console.error("Error loading config from DB:", err);
  }

  await initializeFyersData();
};

export const getConfig = (req, res) => {
  res.json({
    config: activeConfig,
    chartData: activeChartData,
    activeAsset,
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

    if (activeChartData && activeChartData.ohlcv.length > 0) {
      activeChartData = applyIndicators(
        activeChartData.ohlcv,
        activeConfig,
        activeAsset,
      );
    }

    if (ioInstance) {
      ioInstance.emit("tick", {
        chartData: activeChartData,
        config: activeConfig,
        activeAsset,
      });
    }

    res.json({
      success: true,
      config: activeConfig,
      chartData: activeChartData,
      activeAsset,
    });
  } catch (err) {
    console.error("Error in POST /api/config:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
};

export const updateBrokerConfig = async (req, res) => {
  try {
    const { fyersAppId, fyersSecretId } = req.body;

    activeConfig.fyersAppId = fyersAppId;
    activeConfig.fyersSecretId = fyersSecretId;

    if (dbConnected) {
      const config = await Config.findOne();
      if (config) {
        config.fyersAppId = fyersAppId;
        config.fyersSecretId = fyersSecretId;
        await config.save();
      } else {
        await Config.create({ ...activeConfig, fyersAppId, fyersSecretId });
      }
    }

    res.json({
      success: true,
      message: "Broker configuration saved.",
      fyersAppId,
      fyersSecretId,
    });
  } catch (err) {
    console.error("Error in POST /api/broker/config:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
};

export const fyersAuth = async (req, res) => {
  try {
    let appId = activeConfig.fyersAppId;
    if (!appId && dbConnected) {
      const config = await Config.findOne();
      appId = config?.fyersAppId;
    }

    if (!appId) {
      return res
        .status(400)
        .send(
          "Fyers App ID not found in configuration. Please configure it first.",
        );
    }

    const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const redirectUri = `${backendBaseUrl}/api/auth/fyers/callback`;
    const fyersUrl = `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&state=auth`;

    res.redirect(fyersUrl);
  } catch (err) {
    console.error("Error generating Fyers Auth URL:", err);
    res.status(500).send("Internal Server Error");
  }
};

export const fyersAuthCallback = async (req, res) => {
  try {
    const { auth_code, state } = req.query;
    if (!auth_code) {
      return res.status(400).send("Authentication code missing from Fyers.");
    }

    let config = dbConnected ? await Config.findOne() : null;
    const appId = config?.fyersAppId || activeConfig.fyersAppId;
    const secretId = config?.fyersSecretId || activeConfig.fyersSecretId;

    if (!appId || !secretId) {
      return res
        .status(400)
        .send("Fyers App ID or Secret ID not found in configuration.");
    }

    const appIdHash = crypto
      .createHash("sha256")
      .update(`${appId}:${secretId}`)
      .digest("hex");
    const backendBaseUrl = process.env.BACKEND_URL || "http://localhost:5000";
    const redirectUri = `${backendBaseUrl}/api/auth/fyers/callback`;

    const response = await fetch(
      "https://api-t1.fyers.in/api/v3/validate-authcode",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          appIdHash: appIdHash,
          code: auth_code,
        }),
      },
    );

    const data = await response.json();

    if (data.s === "ok" && data.access_token) {
      activeConfig.fyersAccessToken = data.access_token;

      if (dbConnected && config) {
        config.fyersAccessToken = data.access_token;
        await config.save();
      }

      await initializeFyersData();

      const frontendUrl =
        process.env.VITE_FRONTEND_URL || "http://localhost:5173";
      return res.redirect(frontendUrl);
    } else {
      return res
        .status(400)
        .send(
          `Failed to validate auth code: ${data.message || JSON.stringify(data)}`,
        );
    }
  } catch (err) {
    console.error("Error in Fyers Callback:", err);
    res.status(500).send("Internal Server Error");
  }
};
