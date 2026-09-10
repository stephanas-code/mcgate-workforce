import React, { useState, useMemo } from 'react';
import {
  Globe,
  MapPin,
  Search,
  Check,
  Clock,
  Navigation,
  Compass,
  X,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useTimezone } from '../context/TimezoneContext.tsx';
import { REGIONAL_TIMEZONES, TimezoneOption, getTimezoneDetails } from '../utils/timezone.ts';

interface TimezoneSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RegionFilter = 'ALL' | 'Arab World' | 'Asia' | 'China' | 'Africa' | 'UK & Europe' | 'US & Americas' | 'Australia & Pacific';

export const TimezoneSelectorModal: React.FC<TimezoneSelectorModalProps> = ({ isOpen, onClose }) => {
  const { timezone, locationName, setTimezone, requestBrowserLocation, isDetecting } = useTimezone();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<RegionFilter>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredTimezones = useMemo(() => {
    let list = REGIONAL_TIMEZONES;
    if (selectedRegion !== 'ALL') {
      list = list.filter((t) => t.region === selectedRegion);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.city.toLowerCase().includes(q) ||
          t.country.toLowerCase().includes(q) ||
          t.value.toLowerCase().includes(q) ||
          t.label.toLowerCase().includes(q)
      );
    }
    return list;
  }, [selectedRegion, searchQuery]);

  if (!isOpen) return null;

  const handleDetect = async () => {
    setStatusMessage('Requesting GPS location & browser timezone...');
    const result = await requestBrowserLocation();
    setStatusMessage(result.message);
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const handleSelect = (tz: TimezoneOption) => {
    setTimezone(tz.value, `${tz.city}, ${tz.country}`);
    onClose();
  };

  const currentDetails = getTimezoneDetails(timezone);

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">Location & Timezone Hub</h2>
              <p className="text-xs text-slate-300">
                Global workforce time synchronization for Asia, Arab World, China, US, UK, Africa & beyond
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Location Bar & Auto-Detect Button */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Punch Location</div>
              <div className="text-sm font-bold text-slate-900 truncate">
                {locationName} <span className="text-xs font-normal text-slate-500">({timezone})</span>
              </div>
              <div className="text-xs text-emerald-700 font-mono flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Local Time: {currentDetails.currentTime}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {currentDetails.offset}
                </span>
              </div>
            </div>
          </div>

          <button
            id="detect-location-btn"
            type="button"
            onClick={handleDetect}
            disabled={isDetecting}
            className="flex items-center justify-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold rounded-xl shadow-xs transition shrink-0 cursor-pointer"
          >
            <Navigation className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Detecting Location...' : 'Detect My Location'}</span>
          </button>
        </div>

        {statusMessage && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-900 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Region Filter Tabs */}
        <div className="p-3 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-thin">
            {[
              { id: 'ALL', label: 'All Regions' },
              { id: 'Arab World', label: 'Arab World' },
              { id: 'China', label: 'China' },
              { id: 'Asia', label: 'Asia' },
              { id: 'Africa', label: 'Africa' },
              { id: 'UK & Europe', label: 'UK & Europe' },
              { id: 'US & Americas', label: 'US & Americas' },
              { id: 'Australia & Pacific', label: 'Australia & Pacific' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRegion(tab.id as RegionFilter)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition whitespace-nowrap cursor-pointer text-xs ${
                  selectedRegion === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative mt-2.5">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city, country, or timezone (e.g. Dubai, Beijing, London, Lagos, New York)..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Timezone List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
          {filteredTimezones.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Compass className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No matching timezones found for "{searchQuery}".
            </div>
          ) : (
            filteredTimezones.map((item) => {
              const isSelected = timezone === item.value;
              const details = getTimezoneDetails(item.value);

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left p-3 rounded-xl flex items-center justify-between gap-3 transition cursor-pointer ${
                    isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.city}, {item.country}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {item.region}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {item.value} • {details.offset}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold font-mono text-slate-800">{details.currentTime}</div>
                    <div className="text-[10px] text-slate-400 font-semibold">{details.abbreviation}</div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Note */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Clock-ins and working hours will adjust to your local solar schedule.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
