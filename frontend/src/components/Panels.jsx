import React, { useState } from 'react';
import { Eye, EyeOff, Settings, Trash2, Search, X } from 'lucide-react';

export function TopLeftPanel({ isVisible, onToggleVisibility, onOpenSettings, onDelete, chartData, activeAsset, onSwitchAsset, isPaperTrading, onTogglePaperTrading, onOpenPaperDashboard }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activePosition, setActivePosition] = useState(null);

  const availableAssets = [
    { key: 'NIFTY', name: 'NIFTY 50 INDEX', desc: 'Nifty 50 Index', badge: '5 • NSE' },
    { key: 'BANKNIFTY', name: 'NIFTY BANK INDEX', desc: 'Nifty Bank Index', badge: '15 • NSE' },
    { key: 'FINNIFTY', name: 'NIFTY FIN SERVICE', desc: 'Nifty Financial Services', badge: '5 • NSE' },
    { key: 'MIDCAPNIFTY', name: 'NIFTY MIDCAP 100', desc: 'Nifty Midcap 100', badge: '5 • NSE' }
  ];

  const currentPrice = chartData?.ohlcv?.length ? chartData.ohlcv[chartData.ohlcv.length - 1].close : (activeAsset?.basePrice || 25237.00);
  const prevClose = chartData?.ohlcv?.length > 1 ? chartData.ohlcv[chartData.ohlcv.length - 2].close : currentPrice;
  const change = (currentPrice - prevClose).toFixed(activeAsset?.decimals || 2);
  const changePercent = prevClose !== 0 ? ((change / prevClose) * 100).toFixed(2) : "0.00";

  const isPositive = change >= 0;
  const changeColorClass = isPositive ? 'text-[#00e676]' : 'text-[#ef5350]';
  const changeSign = isPositive ? '+' : '';

  const sellPrice = chartData?.currentTrend === 'SELL' && chartData?.signal?.entry 
    ? chartData.signal.entry.toFixed(activeAsset?.decimals || 2) 
    : (currentPrice - (activeAsset?.volMultiplier || 3)).toFixed(activeAsset?.decimals || 2);
    
  const buyPrice = chartData?.currentTrend === 'BUY' && chartData?.signal?.entry 
    ? chartData.signal.entry.toFixed(activeAsset?.decimals || 2) 
    : (currentPrice + (activeAsset?.volMultiplier || 3)).toFixed(activeAsset?.decimals || 2);

  const handleTrade = async (side) => {
    if (isPaperTrading) {
      const sideStr = side === 1 ? 'BUY' : 'SELL';
      const entryPriceVal = parseFloat(currentPrice);
      const qty = 50;
      const marginRequired = entryPriceVal * qty;

      // Check & Deduct from Virtual Wallet Balance
      let currentBal = localStorage.getItem('paperWalletBalance');
      currentBal = currentBal ? parseFloat(currentBal) : 1000000;
      
      if (currentBal < marginRequired) {
        console.warn('Insufficient Virtual Balance!');
        // Proceeding anyway for dummy testing, or could halt
      }
      
      const newBal = currentBal - marginRequired;
      localStorage.setItem('paperWalletBalance', newBal.toString());

      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        await fetch(`${API_URL}/api/paper/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: activeAsset?.name || 'NIFTY 50 INDEX',
            side: sideStr,
            entryPrice: parseFloat(currentPrice),
            quantity: 50
          })
        });
        
        // Temporarily set active position for visual feedback
        setActivePosition({
          symbol: activeAsset?.name || 'NIFTY 50 INDEX',
          entryPrice: parseFloat(currentPrice),
          side: side,
          qty: 50
        });
        
        console.log(`[SUCCESS] ${sideStr} paper order saved to DB.`);
      } catch (err) {
        console.error('Failed to post paper trade:', err);
      }
    } else {
      console.log('LIVE TRADING order triggered');
    }
  };

  const handleExit = () => {
    setActivePosition(null);
  };

  let pnl = 0;
  if (activePosition) {
    pnl = (parseFloat(currentPrice) - activePosition.entryPrice) * activePosition.side * activePosition.qty;
  }

  return (
    <div className={`w-full bg-[#131722] border border-[#2a2e39] rounded-none shadow-2xl font-sans overflow-hidden select-none pointer-events-auto flex flex-col transition-all`}>
      
      {/* Symbol Search Modal Overlay */}
      {isSearchOpen && (
        <div className="absolute top-0 left-0 w-full h-full bg-[#131722] z-50 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2e39] bg-[#0c0d14]">
            <span className="text-xs font-black text-white tracking-wider uppercase">Symbol Search</span>
            <button onClick={() => setIsSearchOpen(false)} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col overflow-y-auto flex-1">
            {availableAssets.map((asset) => (
              <div 
                key={asset.key}
                onClick={() => {
                  onSwitchAsset(asset.key);
                  setIsSearchOpen(false);
                }}
                className={`flex flex-col px-3 py-2 cursor-pointer border-b border-[#2a2e39]/50 hover:bg-[#2962ff]/20 transition-colors ${activeAsset?.symbol === asset.key ? 'bg-[#2a2e39]' : ''}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-extrabold text-[11px] text-white tracking-wider">{asset.key}</span>
                  <span className="text-[9px] font-bold text-gray-500">{asset.badge}</span>
                </div>
                <span className="text-[10px] text-gray-400 font-semibold">{asset.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROW 1: Ticker Meta (Clickable for Symbol Search) */}
      <div 
        className="flex items-center gap-2 px-3 py-2 border-b border-[#2a2e39] cursor-pointer hover:bg-[#2a2e39]/50 transition-colors"
        onClick={() => setIsSearchOpen(true)}
        title="Click to search symbols"
      >
        <div className="w-5 h-5 rounded-full bg-[#2962ff]/10 flex items-center justify-center text-[10px] font-black text-[#2962FF] border border-[#2962ff]/30 shrink-0">
          <Search size={10} />
        </div>
        <div className="flex items-baseline gap-1 leading-none overflow-hidden truncate">
          <span className="font-extrabold text-[12px] text-white tracking-wider uppercase">
            {activeAsset?.name || 'NIFTY 50 INDEX'}
          </span>
          <span className="text-gray-400 font-bold text-[10px] shrink-0">
            {activeAsset?.badge || '5 • NSE'}
          </span>
          <div className="w-2 h-2 rounded-full bg-[#ff9800] border border-black ml-1 shrink-0" />
          <span className="text-[#ff9800] font-black text-[8px] leading-none shrink-0">D</span>
        </div>
      </div>

      {/* ROW 2: Live Price & Change */}
      <div className="flex items-baseline justify-between px-3 py-2 border-b border-[#2a2e39] bg-[#0c0d14]/20">
        <span className="font-black text-[15px] text-white tracking-wide">
          {Number(currentPrice).toLocaleString('en-US', { minimumFractionDigits: activeAsset?.decimals || 2, maximumFractionDigits: activeAsset?.decimals || 2 })}
        </span>
        <span className={`${changeColorClass} font-black text-[11px]`}>
          {changeSign}{change} ({changeSign}{changePercent}%)
        </span>
      </div>

      {/* ROW 2.5: Paper Trading Mode & P&L */}
      <div className="flex flex-col border-b border-[#2a2e39] bg-[#0c0d14]">
        <div 
          onClick={onTogglePaperTrading}
          className={`w-full py-1.5 text-center text-[10px] font-black tracking-widest cursor-pointer transition-colors ${
            isPaperTrading 
              ? 'bg-[#00e676]/20 text-[#00e676] border-b border-[#00e676]/30' 
              : 'bg-[#ff1744]/20 text-[#ff1744] border-b border-[#ff1744]/30'
          }`}
        >
          MODE: {isPaperTrading ? 'PAPER TRADING' : 'LIVE TRADING'}
        </div>

        {activePosition && (
          <div className="flex items-center justify-between px-3 py-2 bg-[#1a1e29]">
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                {activePosition.side === 1 ? 'LONG' : 'SHORT'} • {activePosition.qty} QTY
              </span>
              <span className="text-[10px] text-white font-black">
                Avg: {activePosition.entryPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-black text-[12px] tracking-wider ${pnl >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]'}`}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
              </span>
              <button 
                onClick={handleExit}
                className="bg-[#ff1744] hover:bg-[#d32f2f] text-white px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors"
              >
                EXIT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ROW 3: Action Split-Cells */}
      <div className="flex w-full h-[36px] border-b border-[#2a2e39] overflow-hidden">
        <button 
          onClick={() => handleTrade(-1)}
          className="w-1/2 h-full bg-[#ef5350] hover:bg-[#d32f2f] text-white font-black text-[10px] tracking-wider flex flex-col justify-center items-center gap-0.5 leading-none cursor-pointer border-none rounded-none"
        >
          <span>{Number(sellPrice).toLocaleString('en-US', { minimumFractionDigits: activeAsset?.decimals || 2, maximumFractionDigits: activeAsset?.decimals || 2 })}</span>
          <span className="text-[8px] font-black tracking-widest text-[#ffdcdb]">SELL</span>
        </button>
        <button 
          onClick={() => handleTrade(1)}
          className="w-1/2 h-full bg-[#2962ff] hover:bg-[#1a56db] text-white font-black text-[10px] tracking-wider flex flex-col justify-center items-center gap-0.5 leading-none cursor-pointer border-l border-[#2a2e39] rounded-none"
        >
          <span>{Number(buyPrice).toLocaleString('en-US', { minimumFractionDigits: activeAsset?.decimals || 2, maximumFractionDigits: activeAsset?.decimals || 2 })}</span>
          <span className="text-[8px] font-black tracking-widest text-[#d6e4ff]">BUY</span>
        </button>
      </div>

      {/* ROW 4: Utility Toolbar Row */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#131722]/95 min-h-[32px] flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-[10px] tracking-wider text-gray-200 uppercase leading-none truncate">
            OD SOFTWARE 2026
          </span>
        </div>
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={onOpenPaperDashboard}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#2962ff]/20 transition-all cursor-pointer rounded-none flex items-center gap-1"
            title="View Paper Trade Analytics"
          >
            <span className="text-[9px] font-black tracking-widest uppercase">View Paper Trade 📊</span>
          </button>
          <button
            onClick={onToggleVisibility}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-all cursor-pointer rounded-none"
            title={isVisible ? "Hide" : "Show"}
          >
            {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#2a2e39] transition-all cursor-pointer rounded-none"
            title="Settings"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#ef5350]/10 transition-all cursor-pointer rounded-none"
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TopRightPanel({ items }) {
  const defaultItems = [
    { name: 'BANKBARODA', signal: 'LONG SIGNAL', color: '#00E676' },
    { name: 'BAJAJHLDNG', signal: 'SHORT SIGNAL', color: '#FF1744' },
    { name: 'BOSCHLTD', signal: 'SHORT SIGNAL', color: '#FF1744' },
    { name: 'RELIANCE', signal: 'LONG SIGNAL', color: '#00E676' }
  ];

  const activeItems = items || defaultItems;

  return (
    <div className={`w-full bg-[#131722] border border-[#2a2e39] rounded-none shadow-2xl font-sans overflow-hidden select-none`}>
      <div className="bg-[#E0E3EB] py-2 text-center font-black text-xs text-[#0c0d14] tracking-wider uppercase border-b border-[#2a2e39]">
        OD SCREENER
      </div>
      <div className="grid grid-cols-2 bg-[#2a2e39]/60 gap-0">
        {activeItems.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col items-center justify-center py-3.5 px-1.5 text-center transition-all duration-300 border-[0.5px] border-[#2a2e39]/30"
            style={{
              color: item.color === '#FFC400' || item.color === '#00E676' ? '#000000' : '#ffffff',
              backgroundColor: item.color
            }}
          >
            <span className="font-black text-[10px] tracking-wide w-full uppercase leading-tight truncate">
              {item.name || 'ASSET'}
            </span>
            <span className="font-black text-[9px] tracking-wider mt-0.5 leading-none uppercase">
              {item.signal || item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BottomRightPanel({ rows }) {
  const defaultRows = [
    { label: 'CURRENT', s1: 'BEARISH', s2: 'BULLISH' },
    { label: '15M', s1: 'BEARISH', s2: 'BEARISH' },
    { label: '30M', s1: 'BULLISH', s2: 'BEARISH' },
    { label: '1H', s1: 'BULLISH', s2: 'BULLISH' }
  ];

  const activeRows = rows || defaultRows;

  return (
    <div className={`w-full bg-[#131722] border border-[#2a2e39] rounded-none shadow-2xl font-sans overflow-hidden select-none`}>
      <div className="bg-[#00E676] py-2 text-center font-black text-xs text-[#0c0d14] tracking-wider uppercase border-b border-[#2a2e39]/60">
        OD DATA
      </div>
      <table className="w-full text-center border-collapse border border-[#2a2e39]/60 border-none">
        <tbody>
          {activeRows.map((row, index) => (
            <tr key={index} className="h-8 border-b border-[#2a2e39]/60 last:border-b-0">
              <td className="p-0 font-black bg-[#00E676] text-black w-1/3 text-[10px] tracking-wider border-none uppercase">
                {row.label}
              </td>
              <td className="p-0 w-1/3 h-full border-none">
                <div
                  className={`w-full h-full flex items-center justify-center font-black text-[10px] tracking-wider uppercase transition-colors duration-300 ${
                    row.s1.toUpperCase() === 'BULLISH' ? 'bg-[#2e7d32] text-white' : 'bg-[#c62828] text-white'
                  }`}
                >
                  {row.s1}
                </div>
              </td>
              <td className="p-0 w-1/3 h-full border-none">
                <div
                  className={`w-full h-full flex items-center justify-center font-black text-[10px] tracking-wider uppercase transition-colors duration-300 ${
                    row.s2.toUpperCase() === 'BULLISH' ? 'bg-[#2e7d32] text-white' : 'bg-[#c62828] text-white'
                  }`}
                >
                  {row.s2}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BottomRibbonPanel({ blocks, chartData }) {
  let activeBlocks = [];

  const candles = chartData?.ohlcv || [];
  const currentTrend = chartData?.currentTrend || 'BUY';
  const backendBlocks = blocks || [];

  if (candles.length > 0) {
    const totalCandles = candles.length;
    const latestTrendColor = currentTrend === 'BUY' ? '#00E676' : '#FF1744';

    activeBlocks = candles.map((candle, idx) => {
      // 1. Rightmost block represents the live active candle trend
      if (idx === totalCandles - 1) {
        return { color: latestTrendColor, flex: 1 };
      }

      // 2. Trend Smoothing Filter
      // Only turn RED if the overall EMA trend flips, not on minor retracements.
      let isSmoothedBullish = true;
      if (chartData?.emaBullish && chartData.emaBullish[idx]) {
        isSmoothedBullish = chartData.emaBullish[idx].value !== undefined;
      } else {
        isSmoothedBullish = currentTrend === 'BUY';
      }

      const color = isSmoothedBullish ? '#00E676' : '#FF1744';

      return { color, flex: 1 };
    });
  } else {
    // Fallback if no chart data is available yet
    activeBlocks = backendBlocks.length > 0 ? backendBlocks.map(b => ({ ...b, flex: 1 })) : Array.from({ length: 100 }).map(() => ({
      color: Math.random() > 0.5 ? '#00E676' : '#FF1744',
      flex: 1
    }));
  }

  return (
    <div className="w-full flex flex-col bg-[#0c0d14] overflow-hidden select-none border-t border-[#2a2e39]/80 relative shrink-0">
      
      {/* Refined Text Labels: Time scale above the ribbon */}
      <div className="w-full h-[18px] flex justify-between items-center px-4 md:px-24 text-[9px] font-black tracking-widest text-[#5c667b] uppercase border-b border-[#131722]/80 bg-[#08090c]">
        <span>09:15</span>
        <span>10:00</span>
        <span>11:00</span>
        <span>12:00</span>
        <span>13:00</span>
        <span>14:00</span>
        <span>15:00</span>
        <span>15:30</span>
      </div>

      {/* Intricately Segmented Granular Ribbon */}
      <div className="w-full h-[26px] relative flex">
        
        {/* OD TREND NEW Title Badge */}
        <div className="absolute left-0 top-0 bottom-0 bg-[#FF1744] text-white text-[11px] font-black px-3 flex items-center justify-center tracking-wider leading-none z-20 uppercase shadow-[4px_0_12px_rgba(0,0,0,0.8)] border-r border-[#ff5252]/30">
          OD TREND NEW
        </div>

        {/* High-density micro-blocks container */}
        <div className="w-full h-full flex items-stretch ml-[110px] bg-[#131722]">
          {activeBlocks.map((block, idx) => (
            <div
              key={idx}
              className="h-full transition-all duration-75"
              style={{ 
                backgroundColor: block.color, 
                flex: block.flex || 1, // Dynamically scales to align perfectly with the candles above
                borderRight: '1px solid rgba(0,0,0,0.15)', // Creates the granular segmentation effect
                boxShadow: `inset 0 1px 2px rgba(255,255,255,0.1), inset 0 -1px 2px rgba(0,0,0,0.2)` // 3D micro-block look
              }}
            />
          ))}
        </div>
        
      </div>
    </div>
  );
}
