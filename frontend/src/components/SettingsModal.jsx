import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, currentSettings, onSave }) {
  const [activeTab, setActiveTab] = useState('Inputs');
  const [settings, setSettings] = useState({ ...currentSettings });

  if (!isOpen) return null;

  const tabs = ['Inputs', 'Properties', 'Style', 'Visibility'];

  const handleChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm font-sans select-none">
      <div className="bg-[#131722] text-white shadow-2xl rounded-none w-[640px] max-w-full flex flex-col border border-[#2a2e39] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2e39]">
          <span className="text-sm font-black text-[#00e5ff] tracking-widest uppercase">
            OD SOFTWARE CONFIGURATION
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 hover:bg-red-500/10 p-1.5 transition-colors cursor-pointer rounded-none"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-5 bg-[#131722] border-b border-[#2a2e39]">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 font-bold relative transition-all uppercase tracking-wider text-xs cursor-pointer ${
                activeTab === tab
                  ? 'text-[#2962FF]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#2962FF]" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-6 max-h-[440px] overflow-y-auto bg-[#131722]">
          {activeTab === 'Inputs' ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[11px]">
              {/* Disclaimer */}
              <div className="col-span-2 flex items-start gap-3 p-3 bg-[#1c2030] border border-[#2a2e39]">
                <input
                  type="checkbox"
                  id="disclaimer"
                  checked={settings.disclaimerChecked || false}
                  onChange={(e) => handleChange('disclaimerChecked', e.target.checked)}
                  className="mt-0.5 w-4 h-4 border-[#363c4e] bg-[#2a2e39] text-[#2962FF] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="disclaimer" className="text-[11px] text-gray-400 leading-normal font-medium cursor-pointer">
                  Disclaimer - This Indicator is Intended for Informational and Educational Purposes Only and should not be considered as Financial Advice. Past performance does not guarantee future results.
                </label>
              </div>

              {/* General Settings Section Header */}
              <div className="col-span-2 border-b border-[#2a2e39] pb-1 mt-1 text-[11px] font-black text-[#00e5ff] uppercase tracking-widest">
                General Settings
              </div>

              {/* Strategy Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Strategy Type
                </label>
                <select
                  value={settings.strategyType || 'OD SOFT'}
                  onChange={(e) => handleChange('strategyType', e.target.value)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] cursor-pointer transition-all"
                >
                  <option value="OD SOFT">OD SOFT</option>
                  <option value="OD SOFT 2">OD SOFT 2</option>
                </select>
              </div>

              {/* Show S&R */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Support & Resistance
                </label>
                <label htmlFor="showSupportResistance" className="flex items-center gap-2 text-[12px] text-white font-medium cursor-pointer bg-[#2a2e39] border border-[#363c4e] px-3 py-2 h-[38px] transition-all">
                  <input
                    id="showSupportResistance"
                    type="checkbox"
                    checked={settings.showSupportResistance || false}
                    onChange={(e) => handleChange('showSupportResistance', e.target.checked)}
                    className="w-4 h-4 bg-[#131722] border border-[#363c4e] rounded-none text-[#2962FF] focus:ring-0 cursor-pointer"
                  />
                  <span>Show S&R Zones</span>
                </label>
              </div>

              {/* EMA Settings Section Header */}
              <div className="col-span-2 border-b border-[#2a2e39] pb-1 mt-2 text-[11px] font-black text-[#00e5ff] uppercase tracking-widest">
                EMA Filter Settings
              </div>

              {/* EMA Src */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Source (Src)
                </label>
                <select
                  value={settings.src || 'Close'}
                  onChange={(e) => handleChange('src', e.target.value)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] cursor-pointer transition-all"
                >
                  <option value="Close">Close</option>
                  <option value="Open">Open</option>
                  <option value="High">High</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {/* EMA Length */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  EMA Length
                </label>
                <input
                  type="number"
                  value={settings.length || 0}
                  onChange={(e) => handleChange('length', parseInt(e.target.value) || 0)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] transition-all"
                />
              </div>

              {/* Filter Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Filter Type
                </label>
                <select
                  value={settings.filterType || 'Type 1'}
                  onChange={(e) => handleChange('filterType', e.target.value)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] cursor-pointer transition-all"
                >
                  <option value="Type 1">Type 1</option>
                  <option value="Type 2">Type 2</option>
                </select>
              </div>

              {/* Movement Source */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Movement Source
                </label>
                <select
                  value={settings.movementSource || 'Close'}
                  onChange={(e) => handleChange('movementSource', e.target.value)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] cursor-pointer transition-all"
                >
                  <option value="Close">Close</option>
                  <option value="Open">Open</option>
                </select>
              </div>

              {/* Range Settings Section Header */}
              <div className="col-span-2 border-b border-[#2a2e39] pb-1 mt-2 text-[11px] font-black text-[#00e5ff] uppercase tracking-widest">
                Range Filter Settings
              </div>

              {/* Range Size */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Range Size
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.rangeSize || 0}
                  onChange={(e) => handleChange('rangeSize', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] transition-all"
                />
              </div>

              {/* Range Scale */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Range Scale
                </label>
                <select
                  value={settings.rangeScale || 'Average Change'}
                  onChange={(e) => handleChange('rangeScale', e.target.value)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] cursor-pointer transition-all"
                >
                  <option value="Average Change">Average Change</option>
                  <option value="ATR">ATR</option>
                  <option value="Standard Deviation">Standard Deviation</option>
                </select>
              </div>

              {/* Range Period */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">
                  Range Period
                </label>
                <input
                  type="number"
                  value={settings.rangePeriod || 0}
                  onChange={(e) => handleChange('rangePeriod', parseInt(e.target.value) || 0)}
                  className="w-full bg-[#2a2e39] border border-[#363c4e] text-white rounded-none px-3 py-2 text-[12px] font-medium outline-none focus:border-[#2962FF] focus:ring-1 focus:ring-[#2962FF] transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm font-semibold tracking-wider italic bg-[#131722]">
              {activeTab} parameters are fully optimized for OD SOFTWARE.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2a2e39] flex items-center justify-end gap-3 bg-[#131722]">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-transparent text-gray-400 hover:text-gray-200 transition-colors uppercase tracking-wider text-xs font-bold cursor-pointer rounded-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[#2962FF] hover:bg-[#1a56db] text-white rounded-none font-bold transition-all uppercase tracking-wider text-xs cursor-pointer shadow-md"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
