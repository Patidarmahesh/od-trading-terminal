import React, { useState, useEffect } from 'react';
import { X, Search, Trash2, Calendar, TrendingUp, Briefcase, Activity } from 'lucide-react';

export default function PaperTradeDashboard({ isOpen, onClose, currentPrice, activeAsset }) {
  const [positions, setPositions] = useState([]);
  const [filterSymbol, setFilterSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('All Time');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [walletBalance, setWalletBalance] = useState(() => {
    const saved = localStorage.getItem('paperWalletBalance');
    return saved ? parseFloat(saved) : 1000000;
  });

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('paperWalletBalance');
      if (saved) setWalletBalance(parseFloat(saved));
      fetchPositions();
    }
  }, [isOpen]);

  const fetchPositions = async () => {
    setIsRefreshing(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/paper/positions`);
      const data = await res.json();
      setPositions(data.positions || []);
    } catch (err) {
      console.error('Failed to fetch positions:', err);
    }
    setIsRefreshing(false);
  };

  const handleClosePosition = async (id, pos, realizedPnl) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      await fetch(`${API_URL}/api/paper/order/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realizedPnl })
      });
      
      // Release Margin + Add PnL to Wallet Balance
      const marginReleased = pos.entryPrice * pos.quantity;
      const newBalance = walletBalance + marginReleased + realizedPnl;
      setWalletBalance(newBalance);
      localStorage.setItem('paperWalletBalance', newBalance.toString());

      fetchPositions();
    } catch (err) {
      console.error('Failed to close position:', err);
    }
  };

  if (!isOpen) return null;

  // Analytics Calculations
  const totalTrades = positions.length;
  const closedTrades = positions.filter(p => p.status === 'CLOSED');
  const profitableTrades = closedTrades.filter(p => p.pnl > 0).length;
  const winRate = closedTrades.length > 0 ? ((profitableTrades / closedTrades.length) * 100).toFixed(1) : '0.0';
  const netRealizedPnl = closedTrades.reduce((acc, curr) => acc + curr.pnl, 0);

  // Filtering
  const filteredPositions = positions.filter(p => p.symbol.toLowerCase().includes(filterSymbol.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#08090c]/80 backdrop-blur-md font-sans text-white p-4">
      <div className="w-full max-w-6xl h-[85vh] bg-[#131722] border border-[#2a2e39] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2e39] bg-[#0c0d14]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#2962ff]/20 flex items-center justify-center text-[#2962ff]">
              <Activity size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-widest uppercase">Paper Trade Analytics</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Virtual Trading Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-[#2a2e39] rounded-lg transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-6 bg-gradient-to-b from-[#0c0d14] to-[#131722]">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-4 shrink-0">
            <div className="bg-[#1a1e29] border border-[#2a2e39] rounded-lg p-4 flex flex-col gap-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><Briefcase size={40} /></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Trades</span>
              <span className="text-2xl font-black">{totalTrades}</span>
            </div>
            
            <div className="bg-[#1a1e29] border border-[#2a2e39] rounded-lg p-4 flex flex-col gap-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><TrendingUp size={40} /></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Win Rate %</span>
              <span className="text-2xl font-black text-[#2962ff]">{winRate}%</span>
            </div>

            <div className="bg-[#1a1e29] border border-[#2a2e39] rounded-lg p-4 flex flex-col gap-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><Activity size={40} /></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Realized P&L</span>
              <span className={`text-2xl font-black ${netRealizedPnl >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]'}`}>
                {netRealizedPnl >= 0 ? '+' : ''}{netRealizedPnl.toFixed(2)}
              </span>
            </div>

            <div className="bg-[#1a1e29] border border-[#2a2e39] rounded-lg p-4 flex flex-col gap-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><Briefcase size={40} /></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Virtual Balance</span>
              <span className="text-2xl font-black text-[#ff9800]">
                ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Filters & Controls */}
          <div className="flex items-center justify-between shrink-0 bg-[#0c0d14] p-3 rounded-lg border border-[#2a2e39]">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text"
                  placeholder="SEARCH SYMBOL..."
                  value={filterSymbol}
                  onChange={(e) => setFilterSymbol(e.target.value)}
                  className="bg-[#1a1e29] border border-[#2a2e39] rounded-md pl-9 pr-4 py-2 text-xs font-bold text-white placeholder-gray-600 outline-none focus:border-[#2962ff] focus:ring-1 focus:ring-[#2962ff] transition-all w-64 uppercase tracking-wider"
                />
              </div>
              <button 
                onClick={fetchPositions}
                disabled={isRefreshing}
                className="bg-[#2a2e39] hover:bg-[#3a3f4e] text-white px-4 py-2 rounded-md text-xs font-black tracking-widest uppercase transition-all disabled:opacity-50 cursor-pointer"
              >
                {isRefreshing ? 'SYNCING...' : 'REFRESH'}
              </button>
            </div>
            <div className="flex items-center gap-2 relative">
              <Calendar size={14} className="text-gray-500" />
              <select 
                value={timeframe} 
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-[#1a1e29] border border-[#2a2e39] rounded-md px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#2962ff] uppercase tracking-wider cursor-pointer appearance-none pr-8"
              >
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="All Time">All Time</option>
              </select>
            </div>
          </div>

          {/* Positions Table */}
          <div className="flex-1 overflow-auto border border-[#2a2e39] rounded-lg bg-[#0c0d14]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#1a1e29] z-10 shadow-md">
                <tr>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39]">Symbol</th>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39]">Side</th>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39]">Qty</th>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39]">Entry Price</th>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39]">Current Price</th>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39]">Live P&L</th>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39]">Timestamp</th>
                  <th className="p-3 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-[#2a2e39] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-500 font-bold text-xs uppercase tracking-widest">
                      No matching positions found.
                    </td>
                  </tr>
                ) : (
                  filteredPositions.map((pos) => {
                    // Calculate Live P&L only for the active symbol, or use 0 if mismatched
                    // In a real multi-asset environment, we'd need live prices mapped by symbol
                    const isMatchingSymbol = pos.symbol === (activeAsset?.name || 'NIFTY 50 INDEX');
                    const livePrice = isMatchingSymbol ? currentPrice : pos.entryPrice; 
                    
                    let livePnl = 0;
                    if (pos.status === 'OPEN') {
                      livePnl = (livePrice - pos.entryPrice) * (pos.side === 'BUY' ? 1 : -1) * pos.quantity;
                    } else {
                      livePnl = pos.pnl; // If closed, use realized P&L
                    }

                    let displayPrice = '-';
                    if (pos.status === 'OPEN') {
                      displayPrice = isMatchingSymbol ? livePrice.toFixed(2) : '-';
                    } else {
                      if (pos.exitPrice !== undefined && pos.exitPrice !== null) {
                        displayPrice = pos.exitPrice.toFixed(2);
                      } else {
                        const exitCalc = pos.side === 'BUY' 
                          ? pos.entryPrice + (pos.pnl / pos.quantity)
                          : pos.entryPrice - (pos.pnl / pos.quantity);
                        displayPrice = exitCalc.toFixed(2);
                      }
                    }

                    return (
                      <tr key={pos._id} className="border-b border-[#2a2e39]/50 hover:bg-[#1a1e29]/50 transition-colors">
                        <td className="p-3 font-extrabold text-[11px] text-white tracking-wider">{pos.symbol}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-sm text-[9px] font-black tracking-widest uppercase ${pos.side === 'BUY' ? 'bg-[#2962ff]/20 text-[#2962ff]' : 'bg-[#ef5350]/20 text-[#ef5350]'}`}>
                            {pos.side}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] font-black">{pos.quantity}</td>
                        <td className="p-3 text-[11px] font-black">{pos.entryPrice.toFixed(2)}</td>
                        <td className="p-3 text-[11px] font-black">
                          {displayPrice}
                        </td>
                        <td className="p-3">
                          <span className={`font-black text-[12px] tracking-wider ${livePnl >= 0 ? 'text-[#00e676]' : 'text-[#ff1744]'}`}>
                            {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 text-[10px] font-bold text-gray-400">
                          {new Date(pos.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 text-right">
                          {pos.status === 'OPEN' ? (
                            <button 
                              onClick={() => handleClosePosition(pos._id, pos, livePnl)}
                              className="bg-[#ef5350] hover:bg-[#d32f2f] text-white px-3 py-1.5 rounded-sm text-[9px] font-black tracking-widest uppercase transition-all cursor-pointer"
                            >
                              CLOSE
                            </button>
                          ) : (
                            <span className="px-3 py-1.5 bg-[#2a2e39]/50 text-gray-500 rounded-sm text-[9px] font-black tracking-widest uppercase">
                              CLOSED
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
