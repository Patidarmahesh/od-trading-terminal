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
import PaperTradeDashboard from './components/PaperTradeDashboard';

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
  const [isPaperDashboardOpen, setIsPaperDashboardOpen] = useState(false);

  // Dynamic Panels States
  const [screenerItems, setScreenerItems] = useState([]);
  const [dataRows, setDataRows] = useState([]);
  const [ribbonBlocks, setRibbonBlocks] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const API_BASE = `${API_URL}/api/config`;
  const socketRef = useRef(null);
  const isServerDown = useRef(false);
  const lastTickTime = useRef(Date.now());
  const [isDisconnected, setIsDisconnected] = useState(false);

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
      lastTickTime.current = Date.now();
      if (isDisconnected) setIsDisconnected(false);
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

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      if (Date.now() - lastTickTime.current > 10000) {
        setIsDisconnected(true);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleSwitchAsset = (assetKey) => {
    const symbolMap = {
      'NIFTY': 'NSE:NIFTY50-INDEX',
      'BANKNIFTY': 'NSE:NIFTYBANK-INDEX',
      'FINNIFTY': 'NSE:FINNIFTY-INDEX',
      'MIDCAPNIFTY': 'NSE:MIDCPNIFTY-INDEX'
    };

    const newBrokerSymbol = symbolMap[assetKey];
    const oldBrokerSymbol = symbolMap[activeAsset?.symbol || 'NIFTY'];

    if (socketRef.current && socketRef.current.connected) {
      // 1. Unsubscribe from old live stream
      if (oldBrokerSymbol) {
        socketRef.current.emit('unsubscribe', oldBrokerSymbol);
      }
      
      // 2. Subscribe to new live stream
      if (newBrokerSymbol) {
        socketRef.current.emit('subscribe', newBrokerSymbol);
      }
      
      // Keep legacy emit to trigger historical fetch on backend if needed
      socketRef.current.emit('SWITCH_ASSET', assetKey);
      
      // 3. State Refresh - clear canvas for seamless loading state
      setChartData(null);

      // Pre-emptively switch the UI activeAsset to avoid lag
      const availableAssets = [
        { key: 'NIFTY', name: 'NIFTY 50 INDEX', badge: '5 • NSE', decimals: 2, volMultiplier: 3 },
        { key: 'BANKNIFTY', name: 'NIFTY BANK INDEX', badge: '15 • NSE', decimals: 2, volMultiplier: 5 },
        { key: 'FINNIFTY', name: 'NIFTY FIN SERVICE', badge: '5 • NSE', decimals: 2, volMultiplier: 4 },
        { key: 'MIDCAPNIFTY', name: 'NIFTY MIDCAP 100', badge: '5 • NSE', decimals: 2, volMultiplier: 4 }
      ];
      
      const newAssetMeta = availableAssets.find(a => a.key === assetKey);
      if (newAssetMeta) {
        setActiveAsset({ ...newAssetMeta, symbol: assetKey });
      }
    }
  };

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
    } else if (isAbsoluteBullish) {
      ribbonBgClass = 'bg-[#00e676] text-black font-bold shadow-[0_-4px_10px_rgba(0,230,118,0.3)]';
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
      
      {isDisconnected && (
        <div className="absolute top-0 left-0 w-full bg-[#ff2a54] text-white text-center py-1.5 z-50 font-black tracking-widest text-xs uppercase shadow-[0_4px_10px_rgba(255,42,84,0.5)]">
          CONNECTION LOST! Live data stream interrupted.
        </div>
      )}
      
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
        <div className="pointer-events-auto bg-[#0c1013]/90 backdrop-blur-sm border border-gray-800 p-0 rounded-lg shadow-2xl">
          <TopLeftPanel 
            isVisible={isIndicatorVisible} 
            onToggleVisibility={() => setIsIndicatorVisible(!isIndicatorVisible)}
            onOpenSettings={() => setIsModalOpen(true)}
            onDelete={() => console.log('Delete active')}
            chartData={chartData}
            activeAsset={activeAsset}
            onSwitchAsset={handleSwitchAsset}
            isPaperTrading={config.isPaperTrading || false}
            onTogglePaperTrading={() => handleSaveSettings({ ...config, isPaperTrading: !config.isPaperTrading })}
            onOpenPaperDashboard={() => setIsPaperDashboardOpen(true)}
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
      <div className={`absolute bottom-0 left-0 right-0 h-[44px] z-30 border-t border-gray-800 ${ribbonBgClass}`}>
        <BottomRibbonPanel blocks={dynamicRibbonBlocks} chartData={chartData} />
      </div>

      <PaperTradeDashboard 
        isOpen={isPaperDashboardOpen} 
        onClose={() => setIsPaperDashboardOpen(false)} 
        currentPrice={chartData?.ohlcv?.length ? chartData.ohlcv[chartData.ohlcv.length - 1].close : (activeAsset?.basePrice || 25237.00)}
        activeAsset={activeAsset}
      />

      <SettingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentSettings={config}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
