import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  detectBrowserTimezone,
  formatInTimezone,
  formatDateInTimezone,
  getTimezoneDetails,
  REGIONAL_TIMEZONES,
  TimezoneOption
} from '../utils/timezone.ts';

interface TimezoneContextType {
  timezone: string;
  locationName: string;
  setTimezone: (tz: string, locName?: string) => void;
  requestBrowserLocation: () => Promise<{ success: boolean; message: string; timezone?: string; location?: string }>;
  isDetecting: boolean;
  formatTime: (dateOrIso: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatDate: (dateOrIso: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (dateOrIso: Date | string | null | undefined) => string;
  details: {
    city: string;
    country: string;
    offset: string;
    abbreviation: string;
    currentTime: string;
  };
  now: Date;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

const STORAGE_TZ_KEY = 'mcgate_user_timezone';
const STORAGE_LOC_KEY = 'mcgate_user_location';

export const TimezoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timezone, setTimezoneState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_TZ_KEY);
    return saved || detectBrowserTimezone();
  });

  const [locationName, setLocationName] = useState<string>(() => {
    const savedLoc = localStorage.getItem(STORAGE_LOC_KEY);
    if (savedLoc) return savedLoc;
    const initialTz = localStorage.getItem(STORAGE_TZ_KEY) || detectBrowserTimezone();
    const matched = REGIONAL_TIMEZONES.find((r) => r.value === initialTz);
    return matched ? `${matched.city}, ${matched.country}` : initialTz.replace(/_/g, ' ');
  });

  const [isDetecting, setIsDetecting] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  // Ticking clock for accurate live seconds display
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const setTimezone = useCallback((newTz: string, customLocationName?: string) => {
    setTimezoneState(newTz);
    localStorage.setItem(STORAGE_TZ_KEY, newTz);

    const loc = customLocationName || (() => {
      const matched = REGIONAL_TIMEZONES.find((r) => r.value === newTz);
      if (matched) return `${matched.city}, ${matched.country}`;
      const parts = newTz.split('/');
      return parts[parts.length - 1].replace(/_/g, ' ');
    })();

    setLocationName(loc);
    localStorage.setItem(STORAGE_LOC_KEY, loc);
  }, []);

  const requestBrowserLocation = useCallback(async (): Promise<{
    success: boolean;
    message: string;
    timezone?: string;
    location?: string;
  }> => {
    setIsDetecting(true);

    try {
      // First, get high accuracy browser timezone
      const browserTz = detectBrowserTimezone();
      let resolvedCity = '';
      let resolvedCountry = '';

      const matchedTz = REGIONAL_TIMEZONES.find((t) => t.value === browserTz);
      if (matchedTz) {
        resolvedCity = matchedTz.city;
        resolvedCountry = matchedTz.country;
      }

      // If geolocation is available, request user's GPS coordinates
      if ('geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition | null>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            (err) => {
              console.warn('Geolocation prompt was rejected or unavailable:', err.message);
              resolve(null);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
          );
        });

        if (position) {
          const { latitude, longitude } = position.coords;
          // Attempt reverse geocoding via public reverse geocoder if online
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
              { headers: { 'User-Agent': 'McGateWorkforceOS/1.0' } }
            );
            if (res.ok) {
              const geoData = await res.json();
              const addr = geoData.address || {};
              const city = addr.city || addr.town || addr.municipality || addr.state || resolvedCity;
              const country = addr.country || resolvedCountry;
              if (city) resolvedCity = city;
              if (country) resolvedCountry = country;
            }
          } catch (e) {
            // Reverse geocode network fetch might be blocked by CSP or offline; fallback to browser timezone heuristic
          }
        }
      }

      const finalTz = browserTz;
      const finalLoc = resolvedCity
        ? `${resolvedCity}${resolvedCountry ? `, ${resolvedCountry}` : ''}`
        : matchedTz
        ? `${matchedTz.city}, ${matchedTz.country}`
        : browserTz.replace(/_/g, ' ');

      setTimezone(finalTz, finalLoc);
      setIsDetecting(false);

      return {
        success: true,
        message: `Location detected: ${finalLoc} (${finalTz})`,
        timezone: finalTz,
        location: finalLoc
      };
    } catch (err: any) {
      setIsDetecting(false);
      const fallbackTz = detectBrowserTimezone();
      setTimezone(fallbackTz);
      return {
        success: true,
        message: `Set to browser timezone: ${fallbackTz}`,
        timezone: fallbackTz
      };
    }
  }, [setTimezone]);

  const formatTime = useCallback(
    (dateOrIso: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      return formatInTimezone(dateOrIso, timezone, options);
    },
    [timezone]
  );

  const formatDate = useCallback(
    (dateOrIso: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
      return formatDateInTimezone(dateOrIso, timezone, options);
    },
    [timezone]
  );

  const formatDateTime = useCallback(
    (dateOrIso: Date | string | null | undefined) => {
      if (!dateOrIso) return '—';
      const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
      if (isNaN(d.getTime())) return '—';
      const datePart = formatDateInTimezone(d, timezone, { month: 'short', day: 'numeric', year: 'numeric' });
      const timePart = formatInTimezone(d, timezone, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      return `${datePart} at ${timePart}`;
    },
    [timezone]
  );

  const details = getTimezoneDetails(timezone);

  return (
    <TimezoneContext.Provider
      value={{
        timezone,
        locationName,
        setTimezone,
        requestBrowserLocation,
        isDetecting,
        formatTime,
        formatDate,
        formatDateTime,
        details,
        now
      }}
    >
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = (): TimezoneContextType => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};
