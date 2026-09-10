export interface TimezoneOption {
  value: string; // e.g. 'Asia/Dubai'
  label: string; // e.g. 'Dubai, UAE (GST - UTC+4)'
  city: string;
  country: string;
  region: 'Arab World' | 'Asia' | 'China' | 'Africa' | 'UK & Europe' | 'US & Americas' | 'Australia & Pacific';
  offset?: string;
}

export const REGIONAL_TIMEZONES: TimezoneOption[] = [
  // Arab World & Middle East
  { value: 'Asia/Dubai', label: 'Dubai & Abu Dhabi, UAE (GST • UTC+4)', city: 'Dubai', country: 'United Arab Emirates', region: 'Arab World' },
  { value: 'Asia/Riyadh', label: 'Riyadh & Jeddah, Saudi Arabia (AST • UTC+3)', city: 'Riyadh', country: 'Saudi Arabia', region: 'Arab World' },
  { value: 'Africa/Cairo', label: 'Cairo & Alexandria, Egypt (EET • UTC+2)', city: 'Cairo', country: 'Egypt', region: 'Arab World' },
  { value: 'Asia/Doha', label: 'Doha, Qatar (AST • UTC+3)', city: 'Doha', country: 'Qatar', region: 'Arab World' },
  { value: 'Asia/Kuwait', label: 'Kuwait City, Kuwait (AST • UTC+3)', city: 'Kuwait City', country: 'Kuwait', region: 'Arab World' },
  { value: 'Asia/Muscat', label: 'Muscat, Oman (GST • UTC+4)', city: 'Muscat', country: 'Oman', region: 'Arab World' },
  { value: 'Asia/Bahrain', label: 'Manama, Bahrain (AST • UTC+3)', city: 'Manama', country: 'Bahrain', region: 'Arab World' },
  { value: 'Asia/Beirut', label: 'Beirut, Lebanon (EET • UTC+2)', city: 'Beirut', country: 'Lebanon', region: 'Arab World' },
  { value: 'Asia/Amman', label: 'Amman, Jordan (AST • UTC+3)', city: 'Amman', country: 'Jordan', region: 'Arab World' },
  { value: 'Asia/Baghdad', label: 'Baghdad, Iraq (AST • UTC+3)', city: 'Baghdad', country: 'Iraq', region: 'Arab World' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem (IST • UTC+2)', city: 'Jerusalem', country: 'Israel', region: 'Arab World' },

  // China
  { value: 'Asia/Shanghai', label: 'Beijing, Shanghai & Shenzhen, China (CST • UTC+8)', city: 'Beijing', country: 'China', region: 'China' },
  { value: 'Asia/Urumqi', label: 'Urumqi, Xinjiang, China (UTC+6)', city: 'Urumqi', country: 'China', region: 'China' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong SAR (HKT • UTC+8)', city: 'Hong Kong', country: 'China', region: 'China' },
  { value: 'Asia/Taipei', label: 'Taipei, Taiwan (CST • UTC+8)', city: 'Taipei', country: 'Taiwan', region: 'China' },

  // Asia
  { value: 'Asia/Tokyo', label: 'Tokyo & Osaka, Japan (JST • UTC+9)', city: 'Tokyo', country: 'Japan', region: 'Asia' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT • UTC+8)', city: 'Singapore', country: 'Singapore', region: 'Asia' },
  { value: 'Asia/Seoul', label: 'Seoul, South Korea (KST • UTC+9)', city: 'Seoul', country: 'South Korea', region: 'Asia' },
  { value: 'Asia/Kolkata', label: 'Mumbai & New Delhi, India (IST • UTC+5:30)', city: 'New Delhi', country: 'India', region: 'Asia' },
  { value: 'Asia/Bangkok', label: 'Bangkok, Thailand (ICT • UTC+7)', city: 'Bangkok', country: 'Thailand', region: 'Asia' },
  { value: 'Asia/Jakarta', label: 'Jakarta, Indonesia (WIB • UTC+7)', city: 'Jakarta', country: 'Indonesia', region: 'Asia' },
  { value: 'Asia/Manila', label: 'Manila, Philippines (PST • UTC+8)', city: 'Manila', country: 'Philippines', region: 'Asia' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur, Malaysia (MYT • UTC+8)', city: 'Kuala Lumpur', country: 'Malaysia', region: 'Asia' },
  { value: 'Asia/Karachi', label: 'Karachi & Islamabad, Pakistan (PKT • UTC+5)', city: 'Karachi', country: 'Pakistan', region: 'Asia' },
  { value: 'Asia/Dhaka', label: 'Dhaka, Bangladesh (BST • UTC+6)', city: 'Dhaka', country: 'Bangladesh', region: 'Asia' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City, Vietnam (ICT • UTC+7)', city: 'Ho Chi Minh City', country: 'Vietnam', region: 'Asia' },

  // Africa
  { value: 'Africa/Lagos', label: 'Lagos & Abuja, Nigeria (WAT • UTC+1)', city: 'Lagos', country: 'Nigeria', region: 'Africa' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg & Cape Town, South Africa (SAST • UTC+2)', city: 'Johannesburg', country: 'South Africa', region: 'Africa' },
  { value: 'Africa/Nairobi', label: 'Nairobi, Kenya (EAT • UTC+3)', city: 'Nairobi', country: 'Kenya', region: 'Africa' },
  { value: 'Africa/Accra', label: 'Accra, Ghana (GMT • UTC+0)', city: 'Accra', country: 'Ghana', region: 'Africa' },
  { value: 'Africa/Casablanca', label: 'Casablanca & Rabat, Morocco (WET • UTC+1)', city: 'Casablanca', country: 'Morocco', region: 'Africa' },
  { value: 'Africa/Addis_Ababa', label: 'Addis Ababa, Ethiopia (EAT • UTC+3)', city: 'Addis Ababa', country: 'Ethiopia', region: 'Africa' },
  { value: 'Africa/Kigali', label: 'Kigali, Rwanda (CAT • UTC+2)', city: 'Kigali', country: 'Rwanda', region: 'Africa' },
  { value: 'Africa/Algiers', label: 'Algiers, Algeria (CET • UTC+1)', city: 'Algiers', country: 'Algeria', region: 'Africa' },
  { value: 'Africa/Tunis', label: 'Tunis, Tunisia (CET • UTC+1)', city: 'Tunis', country: 'Tunisia', region: 'Africa' },
  { value: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam, Tanzania (EAT • UTC+3)', city: 'Dar es Salaam', country: 'Tanzania', region: 'Africa' },

  // United Kingdom & Europe
  { value: 'Europe/London', label: 'London & Edinburgh, UK (GMT/BST • UTC+0/+1)', city: 'London', country: 'United Kingdom', region: 'UK & Europe' },
  { value: 'Europe/Dublin', label: 'Dublin, Ireland (GMT/IST • UTC+0/+1)', city: 'Dublin', country: 'Ireland', region: 'UK & Europe' },
  { value: 'Europe/Berlin', label: 'Frankfurt & Berlin, Germany (CET/CEST • UTC+1/+2)', city: 'Frankfurt', country: 'Germany', region: 'UK & Europe' },
  { value: 'Europe/Paris', label: 'Paris, France (CET/CEST • UTC+1/+2)', city: 'Paris', country: 'France', region: 'UK & Europe' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam, Netherlands (CET/CEST • UTC+1/+2)', city: 'Amsterdam', country: 'Netherlands', region: 'UK & Europe' },
  { value: 'Europe/Madrid', label: 'Madrid & Barcelona, Spain (CET/CEST • UTC+1/+2)', city: 'Madrid', country: 'Spain', region: 'UK & Europe' },
  { value: 'Europe/Rome', label: 'Rome & Milan, Italy (CET/CEST • UTC+1/+2)', city: 'Rome', country: 'Italy', region: 'UK & Europe' },
  { value: 'Europe/Zurich', label: 'Zurich & Geneva, Switzerland (CET/CEST • UTC+1/+2)', city: 'Zurich', country: 'Switzerland', region: 'UK & Europe' },
  { value: 'Europe/Warsaw', label: 'Warsaw, Poland (CET/CEST • UTC+1/+2)', city: 'Warsaw', country: 'Poland', region: 'UK & Europe' },
  { value: 'Europe/Stockholm', label: 'Stockholm, Sweden (CET/CEST • UTC+1/+2)', city: 'Stockholm', country: 'Sweden', region: 'UK & Europe' },
  { value: 'Europe/Athens', label: 'Athens, Greece (EET/EEST • UTC+2/+3)', city: 'Athens', country: 'Greece', region: 'UK & Europe' },
  { value: 'Europe/Istanbul', label: 'Istanbul, Turkey (TRT • UTC+3)', city: 'Istanbul', country: 'Turkey', region: 'UK & Europe' },

  // United States & Americas
  { value: 'America/New_York', label: 'New York & Washington DC, USA (Eastern • UTC-5/-4)', city: 'New York', country: 'United States', region: 'US & Americas' },
  { value: 'America/Chicago', label: 'Chicago & Dallas, USA (Central • UTC-6/-5)', city: 'Chicago', country: 'United States', region: 'US & Americas' },
  { value: 'America/Denver', label: 'Denver & Phoenix, USA (Mountain • UTC-7/-6)', city: 'Denver', country: 'United States', region: 'US & Americas' },
  { value: 'America/Los_Angeles', label: 'Los Angeles & SF, USA (Pacific • UTC-8/-7)', city: 'Los Angeles', country: 'United States', region: 'US & Americas' },
  { value: 'America/Anchorage', label: 'Anchorage, Alaska, USA (AKST/AKDT • UTC-9/-8)', city: 'Anchorage', country: 'United States', region: 'US & Americas' },
  { value: 'Pacific/Honolulu', label: 'Honolulu, Hawaii, USA (HST • UTC-10)', city: 'Honolulu', country: 'United States', region: 'US & Americas' },
  { value: 'America/Toronto', label: 'Toronto & Montreal, Canada (Eastern • UTC-5/-4)', city: 'Toronto', country: 'Canada', region: 'US & Americas' },
  { value: 'America/Vancouver', label: 'Vancouver, Canada (Pacific • UTC-8/-7)', city: 'Vancouver', country: 'Canada', region: 'US & Americas' },
  { value: 'America/Mexico_City', label: 'Mexico City, Mexico (CST • UTC-6)', city: 'Mexico City', country: 'Mexico', region: 'US & Americas' },
  { value: 'America/Sao_Paulo', label: 'São Paulo & Rio, Brazil (BRT • UTC-3)', city: 'São Paulo', country: 'Brazil', region: 'US & Americas' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires, Argentina (ART • UTC-3)', city: 'Buenos Aires', country: 'Argentina', region: 'US & Americas' },
  { value: 'America/Bogota', label: 'Bogotá, Colombia (COT • UTC-5)', city: 'Bogotá', country: 'Colombia', region: 'US & Americas' },

  // Australia & Pacific
  { value: 'Australia/Sydney', label: 'Sydney & Melbourne, Australia (AEST/AEDT • UTC+10/+11)', city: 'Sydney', country: 'Australia', region: 'Australia & Pacific' },
  { value: 'Australia/Perth', label: 'Perth, Australia (AWST • UTC+8)', city: 'Perth', country: 'Australia', region: 'Australia & Pacific' },
  { value: 'Australia/Brisbane', label: 'Brisbane, Australia (AEST • UTC+10)', city: 'Brisbane', country: 'Australia', region: 'Australia & Pacific' },
  { value: 'Pacific/Auckland', label: 'Auckland & Wellington, New Zealand (NZST/NZDT • UTC+12/+13)', city: 'Auckland', country: 'New Zealand', region: 'Australia & Pacific' }
];

export function detectBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch (e) {
    console.warn('Unable to detect browser timezone', e);
  }
  return 'Europe/Berlin';
}

export function getAllAvailableTimezones(): TimezoneOption[] {
  try {
    // If Intl.supportedValuesOf exists (modern browsers)
    if (typeof (Intl as any).supportedValuesOf === 'function') {
      const all = (Intl as any).supportedValuesOf('timeZone') as string[];
      const mapped = all.map((tz) => {
        const existing = REGIONAL_TIMEZONES.find((r) => r.value === tz);
        if (existing) return existing;
        const parts = tz.split('/');
        const city = parts[parts.length - 1].replace(/_/g, ' ');
        const country = parts[0];
        let region: TimezoneOption['region'] = 'UK & Europe';
        if (tz.startsWith('Asia')) region = 'Asia';
        else if (tz.startsWith('Africa')) region = 'Africa';
        else if (tz.startsWith('America')) region = 'US & Americas';
        else if (tz.startsWith('Australia') || tz.startsWith('Pacific')) region = 'Australia & Pacific';
        return {
          value: tz,
          label: `${city} (${tz})`,
          city,
          country,
          region
        };
      });
      return mapped;
    }
  } catch (e) {}
  return REGIONAL_TIMEZONES;
}

export function formatInTimezone(
  dateOrIso: Date | string | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateOrIso) return '—';
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return '—';

  try {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone
    };
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(d);
  } catch (e) {
    // Fallback if timezone string is invalid
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

export function formatDateInTimezone(
  dateOrIso: Date | string | null | undefined,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateOrIso) return '—';
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  if (isNaN(d.getTime())) return '—';

  try {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone
    };
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(d);
  } catch (e) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function getTimezoneDetails(timeZone: string): {
  city: string;
  country: string;
  offset: string;
  abbreviation: string;
  currentTime: string;
} {
  const now = new Date();
  let city = 'Local';
  let country = '';

  const matched = REGIONAL_TIMEZONES.find((t) => t.value === timeZone);
  if (matched) {
    city = matched.city;
    country = matched.country;
  } else {
    const parts = timeZone.split('/');
    city = parts[parts.length - 1].replace(/_/g, ' ');
  }

  let offset = '';
  let abbreviation = '';
  let currentTime = '';

  try {
    currentTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone
    }).format(now);

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZoneName: 'short',
      timeZone
    }).formatToParts(now);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    abbreviation = tzPart?.value || '';

    // Calculate UTC offset
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone }));
    const diffHours = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
    const sign = diffHours >= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(diffHours));
    const absM = Math.round((Math.abs(diffHours) - absH) * 60);
    offset = `UTC${sign}${absH}${absM > 0 ? `:${absM < 10 ? '0' : ''}${absM}` : ''}`;
  } catch (e) {
    currentTime = now.toLocaleTimeString();
  }

  return {
    city,
    country,
    offset,
    abbreviation,
    currentTime
  };
}
