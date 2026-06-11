import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import TradingChart from './components/TradingChart';
import SettingsModal from './components/SettingsModal';
import {
  TopLeftPanel,
  TopRightPanel,
  BottomRightPanel,
  BottomRibbonPanel
} from './components/Panels';

// Local math generator fallback matching backend exactly (active if server down)
function generateLocalFallbackData(config) {
  const count = 130;
  const data = [];
  let currentPrice = 25280;
  let baseTime = new Date('2026-05-10');

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
    const timestamp = Math.floor(baseTime.getTime() / 1000) + (i * 30 * 60);

    data.push({
      time: timestamp,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 3000000) + 1000000,
      isSideways: false
    });
  }

  const triggerIndex = 90;
  if (data[triggerIndex]) {
    data[triggerIndex].open = 25290.00;
    data[triggerIndex].high = 25305.00;
    data[triggerIndex].low = 25260.00;
    data[triggerIndex].close = 25273.75;
  }

  const buyArrowIndex = 68;
  if (data[buyArrowIndex]) {
    data[buyArrowIndex].open = 25160.00;
    data[buyArrowIndex].close = 25195.00;
  }

  const lastIndex = count - 1;
  if (data[lastIndex]) {
    data[lastIndex].close = 25233.80;
  }

  const rangeSize = config.rangeSize || 3.5;
  for (let i = 0; i < data.length; i++) {
    const isSidewaysZone = (i >= 32 && i <= 58);
    if (isSidewaysZone && rangeSize > 2.0) {
      data[i].isSideways = true;
    }
  }

  const emaLength = config.length || 50;
  const emaAlpha = 2 / (emaLength + 1);
  let currentEma = data[0].close;
  const emaBullish = [];
  const emaBearish = [];

  for (let i = 0; i < data.length; i++) {
    const val = data[i][config.src.toLowerCase()] || data[i].close;
    currentEma = val * emaAlpha + currentEma * (1 - emaAlpha);
    const emaVal = parseFloat(currentEma.toFixed(2));
    const isBullish = (i >= 62 && i <= 90);

    if (isBullish) {
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

  const supplyZone = {
    top: 25390,
    bottom: 25345,
    vol: -5147824,
    startTime: data[88].time,
    endTime: data[112].time
  };
  const demandZone = {
    top: 25215,
    bottom: 25165,
    vol: 11618865,
    startTime: data[48].time,
    endTime: data[112].time
  };

  return {
    ohlcv: data,
    emaBullish,
    emaBearish,
    srZones: { supply: supplyZone, demand: demandZone },
    signal: {
      time: data[triggerIndex].time,
      entry: 25273.75,
      sl: 25324.30,
      tp1: 25223.20,
      tp2: 25172.65,
      tp3: 25122.10,
      tp4: 25071.55,
      high: data[triggerIndex].high
    },
    buyArrow: {
      time: data[buyArrowIndex].time,
      price: data[buyArrowIndex].low
    }
  };
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Layout mode state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [config, setConfig] = useState({
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
  });

  const [chartData, setChartData] = useState(null);
  const [activeAsset, setActiveAsset] = useState({ name: 'NIFTY 50 INDEX', symbol: 'NIFTY', badge: '5 • NSE' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIndicatorVisible, setIsIndicatorVisible] = useState(true);

  // Dynamic Panels States
  const [screenerItems, setScreenerItems] = useState([]);
  const [dataRows, setDataRows] = useState([]);
  const [ribbonBlocks, setRibbonBlocks] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_BASE = `${API_URL}/api/config`;
  const socketRef = useRef(null);
  const isServerDown = useRef(false);

  // Handle window resize dynamically to strictly separate laptop and mobile DOM trees
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Only connect WebSocket after authentication
    if (!isAuthenticated) return;

    socketRef.current = io(API_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to backend WebSocket');
      isServerDown.current = false;
      
      // Fetch initial state once connected
      fetch(API_BASE)
        .then(res => res.json())
        .then(result => {
          setConfig(result.config);
          setChartData(result.chartData);
          if (result.activeAsset) setActiveAsset(result.activeAsset);
        })
        .catch(err => console.warn('API fetch failed on connect', err));
    });

    socketRef.current.on('tick', (payload) => {
      if (payload.chartData) setChartData(payload.chartData);
      if (payload.config) setConfig(payload.config);
      if (payload.activeAsset) setActiveAsset(payload.activeAsset);
    });

    socketRef.current.on('connect_error', () => {
      if (!isServerDown.current) {
        console.warn('Backend server unreachable. Running fallback live simulation loop.');
        isServerDown.current = true;
      }
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [isAuthenticated]);

  const handleSwitchAsset = (assetKey) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('SWITCH_ASSET', assetKey);
      setChartData(null); // Trigger loading screen momentarily while canvas wipes
    }
  };

  const fallbackTrendCounter = useRef(0);
  const fallbackCandleCounter = useRef(0);
  const fallbackTrend = useRef('SELL');

  // Continuous fallback loop: updates locally every 1 second if server is down
  useEffect(() => {
    if (!isAuthenticated) return;

    const fallbackInterval = setInterval(() => {
      if (isServerDown.current) {
        setChartData(prev => {
          if (prev) {
            const ohlcv = [...prev.ohlcv];
            const lastIdx = ohlcv.length - 1;
            const lastCandle = { ...ohlcv[lastIdx] };
            
            fallbackTrendCounter.current++;
            fallbackCandleCounter.current++;

            if (fallbackTrendCounter.current >= 240) {
              fallbackTrendCounter.current = 0;
              fallbackTrend.current = fallbackTrend.current === 'SELL' ? 'BUY' : 'SELL';
            }

            if (fallbackCandleCounter.current >= 15) {
              fallbackCandleCounter.current = 0;
              const nextTime = lastCandle.time + 1800;

              ohlcv.shift();
              ohlcv.push({
                time: nextTime,
                open: lastCandle.close,
                high: lastCandle.close,
                low: lastCandle.close,
                close: lastCandle.close,
                volume: Math.floor(Math.random() * 2000000) + 1000000,
                isSideways: false
              });
            } else {
              const bias = fallbackTrend.current === 'SELL' ? -1.8 : 1.8;
              const noise = (Math.random() - 0.5) * 8;
              const tickChange = bias + noise;
              
              lastCandle.close = parseFloat((lastCandle.close + tickChange).toFixed(2));
              lastCandle.high = parseFloat(Math.max(lastCandle.high, lastCandle.close).toFixed(2));
              lastCandle.low = parseFloat(Math.min(lastCandle.low, lastCandle.close).toFixed(2));
              ohlcv[lastIdx] = lastCandle;
            }

            return { ...prev, ohlcv, currentTrend: fallbackTrend.current };
          }
          return generateLocalFallbackData(config);
        });
      }
    }, 1000);

    return () => clearInterval(fallbackInterval);
  }, [config, isAuthenticated]);

  const activeScreenerItems = chartData?.screenerItems || screenerItems;
  const activeDataRows = chartData?.dataRows || dataRows;
  const activeRibbonBlocks = chartData?.ribbonBlocks || ribbonBlocks;

  // DYNAMIC BOTTOM RIBBON SENTIMENT LOGIC
  let ribbonBgClass = 'bg-[#12161a]';
  let dynamicRibbonBlocks = activeRibbonBlocks;

  if (chartData) {
    const signalLabel = chartData.signal?.label?.toUpperCase();
    const trend = chartData.currentTrend?.toUpperCase();
    const isSell = signalLabel === 'SELL' || trend === 'SELL';
    const isBuy = signalLabel === 'BUY' || trend === 'BUY';
    
    // Evaluate absolute state from OD DATA side trends
    const currentRow = activeDataRows?.[0] || {};
    const callSentiment = currentRow.s1?.toUpperCase();
    const putSentiment = currentRow.s2?.toUpperCase();

    const isAbsoluteBullish = isBuy && callSentiment === 'BULLISH' && putSentiment === 'BULLISH';
    const isAbsoluteBearish = isSell && callSentiment === 'BEARISH' && putSentiment === 'BEARISH';

    if (isAbsoluteBearish) {
      ribbonBgClass = 'bg-[#ff2a54] text-white shadow-[0_-4px_10px_rgba(255,42,84,0.3)]';
      // Completely override any mixed array data with a single solid red block
      dynamicRibbonBlocks = [{ color: '#ff2a54', styleWidth: '100%' }];
    } else if (isAbsoluteBullish) {
      ribbonBgClass = 'bg-[#00e676] text-black font-bold shadow-[0_-4px_10px_rgba(0,230,118,0.3)]';
      // Completely override any mixed array data with a single solid green block
      dynamicRibbonBlocks = [{ color: '#00e676', styleWidth: '100%' }];
    }
  }

  const handleSaveSettings = (updatedSettings) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('UPDATE_SETTINGS', updatedSettings);
    } else {
      console.warn('Backend server unreachable on save. Applying configuration changes locally.');
      setConfig(updatedSettings);
    }
  };

  const handleDeleteIndicator = () => {
    if (window.confirm("Are you sure you want to remove the OD SOFTWARE 2026 indicator?")) {
      setIsIndicatorVisible(false);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginUsername === 'admin' && loginPassword === 'admin123') {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="w-screen h-screen bg-[#0b0e11] text-white flex items-center justify-center font-sans overflow-hidden select-none">
        <div className="w-[360px] bg-[#161a1e]/90 backdrop-blur-md border border-[#2962ff]/30 shadow-[0_0_40px_rgba(41,98,255,0.1)] rounded p-8 flex flex-col relative overflow-hidden">
          {/* Subtle glow effect behind card */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-[#2962ff] shadow-[0_0_20px_#2962ff]"></div>
          
          <div className="text-center mb-8">
            <h1 className="text-xl font-black tracking-widest text-[#00e5ff] uppercase mb-1">OD SOFTWARE</h1>
            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">Secured Terminal Access</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Username</label>
              <input 
                type="text" 
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                autoComplete="off"
                className="w-full bg-[#0b0e11] border border-[#2a2e39] text-white rounded-none px-3 py-2.5 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] transition-all placeholder-gray-600"
                placeholder="Enter admin username"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="off"
                className="w-full bg-[#0b0e11] border border-[#2a2e39] text-white rounded-none px-3 py-2.5 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] transition-all placeholder-gray-600"
                placeholder="Enter secure key"
              />
            </div>

            {loginError && (
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/30 text-[#ef5350] text-[11px] font-bold py-2 px-3 text-center tracking-wider uppercase mt-1">
                Invalid Administrator Credentials
              </div>
            )}

            <button 
              type="submit"
              className="w-full mt-2 py-3 bg-[#2962FF] hover:bg-[#1a56db] text-white rounded-none font-black transition-all uppercase tracking-widest text-xs shadow-md cursor-pointer hover:brightness-110"
            >
              LOGIN TO TERMINAL
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-[#0b0e11] overflow-hidden font-sans select-none text-white">
      
      {/* 100% FULL-SCREEN CHART CANVAS WRAPPER */}
      <div className="absolute inset-0 w-full h-full z-10">
        {chartData ? (
          <TradingChart chartData={chartData} isVisible={isIndicatorVisible} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-500 tracking-wider">
            Loading OD SOFTWARE Canvas...
          </div>
        )}
      </div>

      {/* LEFT-SIDE FLOATING WIDGETS OVERLAY (MATCH SCREENSHOT 86 FOR LAPTOP) */}
      <div className="absolute top-4 left-4 z-30 w-[280px] flex flex-col gap-4 pointer-events-none">
        
        {/* NiftyFifty Panel Wrapper */}
        <div className="pointer-events-auto bg-[#0c1013]/90 backdrop-blur-sm border border-gray-800 p-3 rounded-lg shadow-2xl">
          <TopLeftPanel
            isVisible={isIndicatorVisible}
            onToggleVisibility={() => setIsIndicatorVisible(!isIndicatorVisible)}
            onOpenSettings={() => setIsModalOpen(true)}
            onDelete={handleDeleteIndicator}
            chartData={chartData}
            activeAsset={activeAsset}
            onSwitchAsset={handleSwitchAsset}
          />
        </div>

        {/* OD SCREENER Wrapper */}
        <div className="pointer-events-auto bg-[#0c1013]/90 backdrop-blur-sm border border-gray-800 p-3 rounded-lg shadow-2xl">
          <TopRightPanel items={activeScreenerItems} />
        </div>

        {/* OD DATA Wrapper */}
        <div className="pointer-events-auto bg-[#0c1013]/90 backdrop-blur-sm border border-gray-800 p-3 rounded-lg shadow-2xl">
          <BottomRightPanel rows={activeDataRows} />
        </div>

      </div>

      {/* LIVE BOTTOM RIBBON SENTIMENT CONDITIONAL COLOR */}
      <div className={`absolute bottom-0 left-0 right-0 h-9 z-30 border-t border-gray-800 ${ribbonBgClass}`}>
        <BottomRibbonPanel blocks={dynamicRibbonBlocks} />
      </div>

      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentSettings={config}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
