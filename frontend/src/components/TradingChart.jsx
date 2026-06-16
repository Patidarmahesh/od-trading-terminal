import React, { useEffect, useRef, useState } from 'react';
import { createChart, LineStyle, CandlestickSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';

export default function TradingChart({ chartData, isVisible }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  
  const candlestickSeriesRef = useRef(null);
  const emaBullishSeriesRef = useRef(null);
  const emaBearishSeriesRef = useRef(null);
  const markersApiRef = useRef(null);

  const [srStyles, setSrStyles] = useState({
    supply: { display: 'none' },
    demand: { display: 'none' }
  });

  const [signalStyle, setSignalStyle] = useState({ display: 'none' });
  const [priceBadgeStyle, setPriceBadgeStyle] = useState({ display: 'none' });
  const [targetLevels, setTargetLevels] = useState({
    sl: { line: { display: 'none' }, badge: { display: 'none' } },
    entry: { line: { display: 'none' }, badge: { display: 'none' } },
    tp1: { line: { display: 'none' }, badge: { display: 'none' } },
    tp2: { line: { display: 'none' }, badge: { display: 'none' } },
    tp3: { line: { display: 'none' }, badge: { display: 'none' } },
    tp4: { line: { display: 'none' }, badge: { display: 'none' } }
  });

  const lastCandle = chartData?.ohlcv && chartData.ohlcv.length > 0
    ? chartData.ohlcv[chartData.ohlcv.length - 1]
    : null;

  const updateOverlays = () => {
    if (!candlestickSeriesRef.current || !chartRef.current || !chartContainerRef.current) return;
    const series = candlestickSeriesRef.current;
    const chart = chartRef.current;

    // 1. Position Support & Resistance overlays with start/end time bounds
    const showSRZones = chartData?.showSupportResistance ?? true;
    if (showSRZones && chartData?.srZones && isVisible) {
      const { supply, demand } = chartData.srZones;
      
      const supplyTopY = series.priceToCoordinate(supply.top);
      const supplyBottomY = series.priceToCoordinate(supply.bottom);
      const demandTopY = series.priceToCoordinate(demand.top);
      const demandBottomY = series.priceToCoordinate(demand.bottom);

      const supplyLeftX = chart.timeScale().timeToCoordinate(supply.startTime);
      const supplyRightX = chart.timeScale().timeToCoordinate(supply.endTime);
      const demandLeftX = chart.timeScale().timeToCoordinate(demand.startTime);
      const demandRightX = chart.timeScale().timeToCoordinate(demand.endTime);
      
      setSrStyles({
        supply: supplyTopY !== null && supplyBottomY !== null && supplyLeftX !== null && supplyRightX !== null ? {
          top: `${Math.min(supplyTopY, supplyBottomY)}px`,
          height: `${Math.abs(supplyBottomY - supplyTopY)}px`,
          left: `${supplyLeftX}px`,
          width: `${supplyRightX - supplyLeftX}px`,
          display: 'block'
        } : { display: 'none' },
        demand: demandTopY !== null && demandBottomY !== null && demandLeftX !== null && demandRightX !== null ? {
          top: `${Math.min(demandTopY, demandBottomY)}px`,
          height: `${Math.abs(demandBottomY - demandTopY)}px`,
          left: `${demandLeftX}px`,
          width: `${demandRightX - demandLeftX}px`,
          display: 'block'
        } : { display: 'none' }
      });
    } else {
      setSrStyles({ supply: { display: 'none' }, demand: { display: 'none' } });
    }

    // 2. Position Floating Sell Pill overlay
    if (chartData?.signal && isVisible) {
      const sig = chartData.signal;
      const x = chart.timeScale().timeToCoordinate(sig.time);
      const y = series.priceToCoordinate(sig.high || 25300);
      if (x !== null && y !== null) {
        setSignalStyle({
          left: `${x}px`,
          top: `${y - 32}px`, // Offset above candle high
          display: 'block'
        });
      } else {
        setSignalStyle({ display: 'none' });
      }
    } else {
      setSignalStyle({ display: 'none' });
    }

    // 3. Position the Right Scale Current Price Badge with countdown
    const currentPrice = lastCandle ? lastCandle.close : 25233.80;
    const priceY = series.priceToCoordinate(currentPrice);
    if (priceY !== null && isVisible) {
      setPriceBadgeStyle({
        top: `${priceY - 13}px`, // Center badge vertically
        right: '0px',
        width: '70px', // Matches the 70px scale width
        display: 'block'
      });
    } else {
      setPriceBadgeStyle({ display: 'none' });
    }

    // 4. Calculate coordinates for custom target lines & floating badges
    if (chartData?.signal && isVisible) {
      const sig = chartData.signal;
      const sigX = chart.timeScale().timeToCoordinate(sig.time);
      const chartWidth = chartContainerRef.current.clientWidth - 70; // 70px right scale column is excluded

      const calculateLevelStyle = (price) => {
        const y = series.priceToCoordinate(price);
        if (y === null || sigX === null) {
          return { line: { display: 'none' }, badge: { display: 'none' } };
        }

        let lineLeft = 0;
        let lineWidth = 0;
        let showLine = true;

        if (sigX < 0) {
          lineLeft = 0;
          lineWidth = chartWidth;
        } else if (sigX < chartWidth) {
          lineLeft = sigX;
          lineWidth = chartWidth - sigX;
        } else {
          showLine = false;
        }

        return {
          line: showLine ? {
            left: `${lineLeft}px`,
            width: `${lineWidth}px`,
            top: `${y}px`,
            display: 'block'
          } : { display: 'none' },
          badge: {
            top: `${y - 24}px`, // Sitting strictly on top of the line height
            display: 'flex'
          }
        };
      };

      setTargetLevels({
        sl: calculateLevelStyle(sig.sl),
        entry: calculateLevelStyle(sig.entry),
        tp1: calculateLevelStyle(sig.tp1),
        tp2: calculateLevelStyle(sig.tp2),
        tp3: calculateLevelStyle(sig.tp3),
        tp4: calculateLevelStyle(sig.tp4)
      });
    } else {
      const hidden = { line: { display: 'none' }, badge: { display: 'none' } };
      setTargetLevels({ sl: hidden, entry: hidden, tp1: hidden, tp2: hidden, tp3: hidden, tp4: hidden });
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Initialize Chart Canvas with locked zoom configurations
    const chart = createChart(chartContainerRef.current, {
      localization: {
        locale: 'en-IN',
        priceFormatter: price => price.toFixed(2),
      },
      layout: {
        background: { color: '#0c0d14' },
        textColor: '#a3a6af',
        fontSize: 12,
        fontFamily: "Segoe UI, Arial, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0)' },
        horzLines: { color: 'rgba(0,0,0,0)' }
      },
      crosshair: {
        mode: 1, // Magnet mode
        vertLine: {
          color: '#444',
          width: 1.5,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: '#444',
          width: 1.5,
          style: LineStyle.Dashed,
        },
      },
      rightPriceScale: {
        borderColor: '#1e222d',
        borderVisible: true,
        alignLabels: true,
      },
      timeScale: {
        visible: true,
        timeVisible: true, // Crucial: forces the engine to display hours and minutes
        secondsVisible: false,
        borderColor: '#1e222d',
        barSpacing: 10,
        rightOffset: 5,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseDrag: true,
        touchDrag: true,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    chartRef.current = chart;

    // Add Candlestick Series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: true,
      wickVisible: true,
      borderColor: '#378658',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // Initialize Markers Plugin
    const markersApi = createSeriesMarkers(candlestickSeries);
    markersApiRef.current = markersApi;

    // Add Bullish EMA Series (Cyan)
    const emaBullishSeries = chart.addSeries(LineSeries, {
      color: '#00e6ff',
      lineWidth: 2,
      priceLineVisible: false,
      lastPriceVisible: false,
      crosshairMarkerVisible: false,
    });
    emaBullishSeriesRef.current = emaBullishSeries;

    // Add Bearish EMA Series (Pink/Magenta)
    const emaBearishSeries = chart.addSeries(LineSeries, {
      color: '#e040fb',
      lineWidth: 2,
      priceLineVisible: false,
      lastPriceVisible: false,
      crosshairMarkerVisible: false,
    });
    emaBearishSeriesRef.current = emaBearishSeries;

    // Subscriptions
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateOverlays);
    chart.timeScale().subscribeVisibleTimeRangeChange(updateOverlays);
    chart.subscribeCrosshairMove(updateOverlays);

    // Resize handlers
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      chart.resize(width, height);
      setTimeout(updateOverlays, 50);
    });
    resizeObserver.observe(chartContainerRef.current);

    setTimeout(updateOverlays, 150);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Sync dataset updates
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current || !chartData) return;

    const candlestickSeries = candlestickSeriesRef.current;
    const emaBullishSeries = emaBullishSeriesRef.current;
    const emaBearishSeries = emaBearishSeriesRef.current;

    // Helper for time token sanitization
    const sanitizeDataArray = (incomingData) => incomingData.map(item => {
      let rawTime = item.time;
      if (typeof rawTime === 'string') {
        rawTime = Math.floor(new Date(rawTime).getTime() / 1000);
      }
      if (typeof rawTime === 'number' && rawTime > 10000000000) {
        rawTime = Math.floor(rawTime / 1000);
      }
      return {
        ...item,
        time: rawTime
      };
    });

    const sanitizedOhlcv = sanitizeDataArray(chartData.ohlcv);
    const sanitizedEmaBullish = sanitizeDataArray(chartData.emaBullish || []);
    const sanitizedEmaBearish = sanitizeDataArray(chartData.emaBearish || []);

    // Force default visible range to show 50-60 candles on initial load
    if (isInitialLoadRef.current) {
      const total = sanitizedOhlcv.length;
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: total - 55,
        to: total + 3
      });
      isInitialLoadRef.current = false;
    }

    if (!isVisible) {
      candlestickSeries.setData(sanitizedOhlcv.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        color: d.close >= d.open ? '#26a69a' : '#ef5350',
        borderColor: d.close >= d.open ? '#26a69a' : '#ef5350',
        wickColor: d.close >= d.open ? '#26a69a' : '#ef5350',
      })));
      emaBullishSeries.setData([]);
      emaBearishSeries.setData([]);

      if (markersApiRef.current) {
        markersApiRef.current.setMarkers([]);
      }
      setSrStyles({ supply: { display: 'none' }, demand: { display: 'none' } });
      setSignalStyle({ display: 'none' });
      setPriceBadgeStyle({ display: 'none' });

      const hidden = { line: { display: 'none' }, badge: { display: 'none' } };
      setTargetLevels({ sl: hidden, entry: hidden, tp1: hidden, tp2: hidden, tp3: hidden, tp4: hidden });
      return;
    }

    // Set candlesticks (Solid Royal Blue for sideways, normal Red/Green elsewhere)
    const formattedCandles = sanitizedOhlcv.map((candle) => {
      if (candle.isSideways) {
        return {
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          color: '#2962FF', // Royal Blue
          borderColor: '#2962FF',
          wickColor: '#2962FF',
        };
      }
      const isUp = candle.close >= candle.open;
      const color = isUp ? '#26a69a' : '#ef5350';
      return {
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        color: color,
        borderColor: color,
        wickColor: color,
      };
    });
    candlestickSeries.setData(formattedCandles);

    // Apply segmented EMAs datasets
    emaBullishSeries.setData(sanitizedEmaBullish);
    emaBearishSeries.setData(sanitizedEmaBearish);

    // Set markers using the lightweight-charts v5 createSeriesMarkers plugin API
    const markers = [];
    if (chartData.buyArrow) {
      markers.push({
        time: chartData.buyArrow.time,
        position: 'belowBar',
        color: '#2962FF', // Royal Blue arrow
        shape: 'arrowUp',
        size: 1.3
      });
    }
    if (chartData.signal) {
      markers.push({
        time: chartData.signal.time,
        position: 'aboveBar',
        color: '#FF1744', // Red square diamond
        shape: 'square',
        size: 0.8
      });
    }
    
    if (markersApiRef.current) {
      markersApiRef.current.setMarkers(markers);
    }

    // Force update overlays coordinate triggers
    setTimeout(updateOverlays, 100);
  }, [chartData, isVisible]);

  return (
    <div className="relative w-full h-full font-sans select-none overflow-hidden">
      {/* S&R Zones (Top supply / Bottom demand) absolute canvas overlays with 20% opacity */}
      {isVisible && (chartData?.showSupportResistance ?? true) && chartData?.srZones && (
        <>
          {/* Supply/Resistance Zone (Top) */}
          <div
            className="absolute bg-[#EF5350]/20 border-y border-[#EF5350]/30 pointer-events-none transition-all duration-300 z-10 flex items-center justify-center text-xs font-semibold whitespace-nowrap right-[70px]"
            style={srStyles.supply}
          >
            <span className="text-[12px] font-black text-white bg-[#0c0d14]/70 px-2 py-0.5 rounded-xs tracking-wider uppercase">
              Vol: {chartData?.srZones?.supply?.vol || -5147824}
            </span>
          </div>

          {/* Demand/Support Zone (Bottom) */}
          <div
            className="absolute bg-[#26A69A]/20 border-y border-[#26A69A]/30 pointer-events-none transition-all duration-300 z-10 flex items-center justify-center text-xs font-semibold whitespace-nowrap right-[70px]"
            style={srStyles.demand}
          >
            <span className="text-[12px] font-black text-white bg-[#0c0d14]/70 px-2 py-0.5 rounded-xs tracking-wider uppercase">
              Vol: {chartData?.srZones?.demand?.vol || 11618865}
            </span>
          </div>
        </>
      )}

      {/* Floating Signal Sell/Buy Pill Overlay positioned directly over the wick */}
      {isVisible && chartData?.signal && (
        <div
          className={`absolute text-white text-[12px] font-black px-3 py-1 rounded-sm shadow-xl z-20 pointer-events-none transform -translate-x-1/2 tracking-wider uppercase border whitespace-nowrap ${chartData.signal.label === 'Buy' ? 'bg-[#00E676] border-[#00E676]' : 'bg-[#FF1744] border-[#FF1744]'}`}
          style={signalStyle}
        >
          {chartData.signal.label}
          <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] ${chartData.signal.label === 'Buy' ? 'border-t-[#00E676]' : 'border-t-[#FF1744]'}`} />
        </div>
      )}

      {/* Right Axis Current Price Scale Badge with countdown timer 01:11 */}
      {isVisible && (
        <div
          className="absolute bg-[#00E676] text-black font-extrabold text-[9.5px] text-center flex flex-col justify-center py-1.5 rounded-xs z-30 select-none pointer-events-none border-l border-[#00E676]"
          style={priceBadgeStyle}
        >
          <span className="leading-tight text-[#0c0d14] font-black text-[10.5px]">
            {(lastCandle ? lastCandle.close : 25233.80).toFixed(2)}
          </span>
          <span className="text-[8.5px] text-[#0c0d14] font-bold leading-none tracking-tighter opacity-80 mt-0.5">01:11</span>
        </div>
      )}

      {/* Custom Target Level Overlay Lines and Badges Floating inside the Chart Canvas */}
      {isVisible && chartData?.signal && (
        <>
          {/* Horizontal lines starting at 'Sell' candle and terminating at the right boundary */}
          <div
            className="absolute h-[1.5px] bg-[#FF1744] pointer-events-none z-20"
            style={targetLevels.sl.line}
          />
          <div
            className="absolute h-[1.5px] bg-[#FFC400] pointer-events-none z-20"
            style={targetLevels.entry.line}
          />
          <div
            className="absolute h-[1.5px] bg-[#00E676] pointer-events-none z-20"
            style={targetLevels.tp1.line}
          />
          <div
            className="absolute h-[1.5px] bg-[#00E676] pointer-events-none z-20"
            style={targetLevels.tp2.line}
          />
          <div
            className="absolute h-[1.5px] bg-[#00E676] pointer-events-none z-20"
            style={targetLevels.tp3.line}
          />
          <div
            className="absolute h-[1.5px] bg-[#00E676] pointer-events-none z-20"
            style={targetLevels.tp4.line}
          />

          {/* Floating Badges stacked directly ON TOP of the horizontal lines */}
          <div
            className="absolute right-[74px] bg-[#FF1744] text-white font-black text-[12px] px-2.5 py-0.5 rounded-md z-30 select-none pointer-events-none h-[22px] flex items-center justify-center shadow-lg whitespace-nowrap leading-none border border-[#FF1744]/20"
            style={targetLevels.sl.badge}
          >
            SL : {chartData.signal.sl.toFixed(2)}
          </div>
          <div
            className="absolute right-[74px] bg-[#FFC400] text-black font-black text-[12px] px-2.5 py-0.5 rounded-md z-30 select-none pointer-events-none h-[22px] flex items-center justify-center shadow-lg whitespace-nowrap leading-none border border-[#FFC400]/20"
            style={targetLevels.entry.badge}
          >
            Entry : {chartData.signal.entry.toFixed(2)}
          </div>
          <div
            className="absolute right-[74px] bg-[#00E676] text-black font-black text-[12px] px-2.5 py-0.5 rounded-md z-30 select-none pointer-events-none h-[22px] flex items-center justify-center shadow-lg whitespace-nowrap leading-none border border-[#00E676]/20"
            style={targetLevels.tp1.badge}
          >
            TP1 : {chartData.signal.tp1.toFixed(2)}
          </div>
          <div
            className="absolute right-[74px] bg-[#00E676] text-black font-black text-[12px] px-2.5 py-0.5 rounded-md z-30 select-none pointer-events-none h-[22px] flex items-center justify-center shadow-lg whitespace-nowrap leading-none border border-[#00E676]/20"
            style={targetLevels.tp2.badge}
          >
            TP2 : {chartData.signal.tp2.toFixed(2)}
          </div>
          <div
            className="absolute right-[74px] bg-[#00E676] text-black font-black text-[12px] px-2.5 py-0.5 rounded-md z-30 select-none pointer-events-none h-[22px] flex items-center justify-center shadow-lg whitespace-nowrap leading-none border border-[#00E676]/20"
            style={targetLevels.tp3.badge}
          >
            TP3 : {chartData.signal.tp3.toFixed(2)}
          </div>
          <div
            className="absolute right-[74px] bg-[#00E676] text-black font-black text-[12px] px-2.5 py-0.5 rounded-md z-30 select-none pointer-events-none h-[22px] flex items-center justify-center shadow-lg whitespace-nowrap leading-none border border-[#00E676]/20"
            style={targetLevels.tp4.badge}
          >
            TP4 : {chartData.signal.tp4.toFixed(2)}
          </div>
        </>
      )}

      {/* Main Chart Container */}
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
}
