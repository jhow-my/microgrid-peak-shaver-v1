import * as XLSX from 'xlsx';
import {
  ChargingStrategy,
  DEFAULT_PARAMS,
  DaySimulationResult,
  INTERVALS_PER_DAY,
  LoadedDayProfile,
  MeterDatasetMetadata,
  SimulationParams,
  TimeConvention,
  formatIntervalLabel,
} from './bessEngine';

export const DEFAULT_CRITICAL_DAYS_JSON_URL =
  `${import.meta.env.BASE_URL}assets/aistudio/816701093-30min-peak-shaving_29fcbc07.json`;

export interface ParsedMeterImport {
  metadata: MeterDatasetMetadata;
  days: LoadedDayProfile[];
  parameters?: Partial<SimulationParams>;
}

interface RawParsedRecord {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // 0..24
  minute: number; // 0..59
  kwImport: number;
  kwExport: number;
  kvarExport: number;
  kvarImport: number;
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    if (!cleaned) return 0;
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeYear(y: number): number {
  if (y < 100) return y >= 70 ? 1900 + y : 2000 + y;
  return y;
}

function roundToNearest30Min(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): { year: number; month: number; day: number; hour: number; minute: number } {
  // Handle Excel serial float rounding (e.g. 0:29:59 -> 0:30:00, 23:59:59 -> next day 0:00)
  const totalSec = hour * 3600 + minute * 60 + second;
  const roundedSlots = Math.round(totalSec / 1800);
  const roundedMinutes = roundedSlots * 30;

  if (roundedMinutes >= 1440) {
    // 24:00 exact
    if (hour === 24 && minute === 0 && second === 0) {
      return { year, month, day, hour: 24, minute: 0 };
    }
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    return {
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hour: 0,
      minute: 0,
    };
  }

  return {
    year,
    month,
    day,
    hour: Math.floor(roundedMinutes / 60),
    minute: roundedMinutes % 60,
  };
}

function parseDateTimeCell(
  val: unknown
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  if (typeof val === 'number' && Number.isFinite(val) && val > 20000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return roundToNearest30Min(
        parsed.y,
        parsed.m,
        parsed.d,
        parsed.H ?? 0,
        parsed.M ?? 0,
        parsed.S ?? 0
      );
    }
  }

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return roundToNearest30Min(
      val.getFullYear(),
      val.getMonth() + 1,
      val.getDate(),
      val.getHours(),
      val.getMinutes(),
      val.getSeconds()
    );
  }

  const str = String(val ?? '').trim();
  if (!str) return null;

  // Match DD-MM-YY H:MM or DD/MM/YYYY HH:MM(:SS)
  const dmyMatch = str.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i
  );
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const p3 = normalizeYear(parseInt(dmyMatch[3], 10));
    let hour = dmyMatch[4] !== undefined ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] !== undefined ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] !== undefined ? parseInt(dmyMatch[6], 10) : 0;
    const ampm = dmyMatch[7]?.toUpperCase();

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    let day = p1;
    let month = p2;
    if (p2 > 12 && p1 <= 12) {
      month = p1;
      day = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return roundToNearest30Min(p3, month, day, hour, minute, second);
    }
  }

  // Match YYYY-MM-DD HH:MM(:SS)
  const isoMatch = str.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (isoMatch) {
    return roundToNearest30Min(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10),
      parseInt(isoMatch[3], 10),
      isoMatch[4] !== undefined ? parseInt(isoMatch[4], 10) : 0,
      isoMatch[5] !== undefined ? parseInt(isoMatch[5], 10) : 0,
      isoMatch[6] !== undefined ? parseInt(isoMatch[6], 10) : 0
    );
  }

  const native = new Date(str);
  if (!Number.isNaN(native.getTime())) {
    return roundToNearest30Min(
      native.getFullYear(),
      native.getMonth() + 1,
      native.getDate(),
      native.getHours(),
      native.getMinutes(),
      native.getSeconds()
    );
  }

  return null;
}

function makeDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function makeDisplayDate(year: number, month: number, day: number): string {
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year).slice(-2)}`;
}

function getPreviousCalendarDay(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(year, month - 1, day - 1));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function toFiniteNumberStrict(val: unknown): number | null {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null;
  }
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const VALID_CHARGING_STRATEGIES: readonly ChargingStrategy[] = [
  'cap_aware',
  'offpeak_solar',
  'excess_solar',
];

function sanitizeJsonParameters(rawParams: unknown): Partial<SimulationParams> | undefined {
  if (!isPlainObject(rawParams)) return undefined;

  const patch: Partial<SimulationParams> = {};
  const numericBounds: Array<{
    key: keyof Omit<
      SimulationParams,
      'chargingStrategy' | 'offPeakChargeToTransformer' | 'baseLoadProfileKw' | 'basePvNormalized'
    >;
    min: number;
    max: number;
  }> = [
    { key: 'targetCapKw', min: 0, max: 100000 },
    { key: 'transformerLimitKw', min: 1, max: 200000 },
    { key: 'bessPowerKw', min: 0, max: 100000 },
    { key: 'bessCapacityKwh', min: 0, max: 500000 },
    { key: 'roundTripEfficiencyPct', min: 50, max: 99.9 },
    { key: 'socMinPct', min: 0, max: 95 },
    { key: 'socMaxPct', min: 5, max: 100 },
    { key: 'initialSocPct', min: 0, max: 100 },
    { key: 'solarPeakKw', min: 0, max: 100000 },
    { key: 'irradiancePct', min: 0, max: 200 },
    { key: 'loadScalePct', min: 1, max: 500 },
    { key: 'demandChargeRate', min: 0, max: 1000 },
    { key: 'peakStartMinutes', min: 0, max: 1410 },
    { key: 'peakEndMinutes', min: 30, max: 1440 },
  ];

  for (const { key, min, max } of numericBounds) {
    const num = toFiniteNumberStrict(rawParams[key]);
    if (num !== null) {
      patch[key] = Math.min(max, Math.max(min, num));
    }
  }

  if (typeof rawParams.offPeakChargeToTransformer === 'boolean') {
    patch.offPeakChargeToTransformer = rawParams.offPeakChargeToTransformer;
  }

  const strat = rawParams.chargingStrategy;
  if (
    typeof strat === 'string' &&
    VALID_CHARGING_STRATEGIES.includes(strat as ChargingStrategy)
  ) {
    patch.chargingStrategy = strat as ChargingStrategy;
  }

  // Keep SOC bounds coherent if partially provided
  const effMin = patch.socMinPct ?? DEFAULT_PARAMS.socMinPct;
  const effMax = patch.socMaxPct ?? DEFAULT_PARAMS.socMaxPct;
  if (effMin >= effMax) {
    delete patch.socMinPct;
    delete patch.socMaxPct;
  }

  return Object.keys(patch).length > 0 ? patch : undefined;
}

function parseTimeLabelSlot(
  timeLabel: unknown,
  convention: TimeConvention
): number | null {
  if (typeof timeLabel !== 'string') return null;
  const m = timeLabel.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 24 || (mm !== 0 && mm !== 30)) return null;
  const mins = hh * 60 + mm;

  if (convention === 'end_time') {
    if (hh === 0 && mm === 0) return 47;
    const slot = Math.round(mins / 30) - 1;
    return slot >= 0 && slot < INTERVALS_PER_DAY ? slot : null;
  }

  const slot = Math.round(mins / 30);
  return slot >= 0 && slot < INTERVALS_PER_DAY ? slot : null;
}

export function findHighestPeakLocation(days: LoadedDayProfile[]): {
  dayIndex: number;
  intervalIndex: number;
} {
  let dayIndex = 0;
  let intervalIndex = 38;
  let maxKw = -Infinity;

  for (let d = 0; d < days.length; d++) {
    const loads = days[d].loadKw;
    for (let s = 0; s < loads.length; s++) {
      const val = loads[s] ?? 0;
      if (val > maxKw) {
        maxKw = val;
        dayIndex = d;
        intervalIndex = s;
      }
    }
  }

  return { dayIndex, intervalIndex };
}

export function parseExportedDispatchJson(
  rawInput: string | unknown,
  options?: { isImported?: boolean; fallbackFileName?: string }
): ParsedMeterImport {
  let parsedJson: unknown = rawInput;
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) {
      throw new Error('Critical Days JSON file is empty.');
    }
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      throw new Error('Critical Days JSON file contains malformed JSON syntax.');
    }
  }

  if (!isPlainObject(parsedJson)) {
    throw new Error('Critical Days JSON root must be a JSON object.');
  }

  const rawDays = parsedJson.days;
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    throw new Error('Critical Days JSON must contain a non-empty "days" array.');
  }

  const rawMeta = isPlainObject(parsedJson.metadata) ? parsedJson.metadata : {};
  let timeConvention: TimeConvention =
    rawMeta.timeConvention === 'end_time' || rawMeta.timeConvention === 'start_time'
      ? rawMeta.timeConvention
      : 'end_time';

  // Infer convention if metadata omitted it
  if (rawMeta.timeConvention !== 'end_time' && rawMeta.timeConvention !== 'start_time') {
    const firstDay = rawDays[0];
    const firstIntervals = isPlainObject(firstDay) && Array.isArray(firstDay.intervals)
      ? firstDay.intervals
      : [];
    const firstLabel =
      isPlainObject(firstIntervals[0]) && typeof firstIntervals[0].timeLabel === 'string'
        ? firstIntervals[0].timeLabel.trim()
        : '';
    const has24 = firstIntervals.some(
      (iv) => isPlainObject(iv) && typeof iv.timeLabel === 'string' && iv.timeLabel.trim() === '24:00'
    );
    timeConvention = has24 || firstLabel === '00:30' ? 'end_time' : 'start_time';
  }

  const days: LoadedDayProfile[] = [];
  let totalValidRecords = 0;

  for (let dIdx = 0; dIdx < rawDays.length; dIdx++) {
    const rawDay = rawDays[dIdx];
    if (!isPlainObject(rawDay) || !Array.isArray(rawDay.intervals) || rawDay.intervals.length === 0) {
      throw new Error(`Day entry at index ${dIdx} is missing half-hourly "intervals".`);
    }

    const loadKw = new Array(INTERVALS_PER_DAY).fill(0);
    const kwExport = new Array(INTERVALS_PER_DAY).fill(0);
    const kvarExport = new Array(INTERVALS_PER_DAY).fill(0);
    const kvarImport = new Array(INTERVALS_PER_DAY).fill(0);

    let derivedYear: number | null = null;
    let derivedMonth: number | null = null;
    let derivedDay: number | null = null;
    let dayRecordCount = 0;

    for (let i = 0; i < rawDay.intervals.length; i++) {
      const iv = rawDay.intervals[i];
      if (!isPlainObject(iv)) continue;

      const kwImportVal = toFiniteNumberStrict(iv.kwImport);
      if (kwImportVal === null) continue;

      let slot = parseTimeLabelSlot(iv.timeLabel, timeConvention);

      if (iv.dateEndTime !== undefined) {
        const dt = parseDateTimeCell(iv.dateEndTime);
        if (dt) {
          if (derivedYear === null && !(dt.hour === 0 && dt.minute === 0)) {
            derivedYear = dt.year;
            derivedMonth = dt.month;
            derivedDay = dt.day;
          }
          if (slot === null) {
            if (timeConvention === 'end_time') {
              if (dt.hour === 24 && dt.minute === 0) slot = 47;
              else if (dt.hour === 0 && dt.minute === 0) slot = 47;
              else {
                const mins = dt.hour * 60 + dt.minute;
                slot = Math.min(47, Math.max(0, Math.round(mins / 30) - 1));
              }
            } else {
              const mins = dt.hour * 60 + dt.minute;
              slot = Math.min(47, Math.max(0, Math.round(mins / 30)));
            }
          }
        }
      }

      if (slot === null && rawDay.intervals.length === INTERVALS_PER_DAY) {
        slot = i;
      }

      if (slot === null || slot < 0 || slot >= INTERVALS_PER_DAY) continue;

      const kwExportVal = toFiniteNumberStrict(iv.kwExport);
      const kvarExportVal = toFiniteNumberStrict(iv.kvarExport);
      const kvarImportVal = toFiniteNumberStrict(iv.kvarImport);

      loadKw[slot] = Math.max(0, kwImportVal);
      kwExport[slot] = kwExportVal !== null ? Math.max(0, kwExportVal) : 0;
      kvarExport[slot] = kvarExportVal ?? 0;
      kvarImport[slot] = kvarImportVal ?? 0;
      dayRecordCount++;
    }

    if (dayRecordCount === 0) {
      throw new Error(`Day entry at index ${dIdx} contains no valid kW Import interval values.`);
    }

    const rawDateKey = typeof rawDay.dateKey === 'string' ? rawDay.dateKey.trim() : '';
    const rawDisplayDate =
      typeof rawDay.displayDate === 'string' ? rawDay.displayDate.trim() : '';

    const dateKey =
      rawDateKey ||
      (derivedYear !== null && derivedMonth !== null && derivedDay !== null
        ? makeDateKey(derivedYear, derivedMonth, derivedDay)
        : '');
    const displayDate =
      rawDisplayDate ||
      (derivedYear !== null && derivedMonth !== null && derivedDay !== null
        ? makeDisplayDate(derivedYear, derivedMonth, derivedDay)
        : dateKey);

    if (!dateKey || !displayDate) {
      throw new Error(`Day entry at index ${dIdx} is missing valid date identifiers.`);
    }

    days.push({
      dateKey,
      displayDate,
      loadKw,
      kwExport,
      kvarExport,
      kvarImport,
    });
    totalValidRecords += dayRecordCount;
  }

  days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  const device =
    typeof rawMeta.device === 'string' && rawMeta.device.trim()
      ? rawMeta.device.trim()
      : 'Utility Meter';
  const meterType =
    typeof rawMeta.meterType === 'string' && rawMeta.meterType.trim()
      ? rawMeta.meterType.trim()
      : 'Half-Hourly Interval';
  const sourceFile =
    typeof rawMeta.sourceFile === 'string' && rawMeta.sourceFile.trim()
      ? rawMeta.sourceFile.trim()
      : options?.fallbackFileName ?? 'Default Critical Days JSON';

  const parameters = sanitizeJsonParameters(parsedJson.parameters);

  return {
    metadata: {
      device,
      meterType,
      fileName: sourceFile,
      totalRecords: totalValidRecords,
      isImported: options?.isImported ?? false,
      timeConvention,
    },
    days,
    parameters,
  };
}

export async function parseUtilityMeterFile(file: File): Promise<ParsedMeterImport> {
  if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
    const text = await file.text();
    return parseExportedDispatchJson(text, {
      isImported: true,
      fallbackFileName: file.name,
    });
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The selected file contains no readable worksheets.');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
  });

  if (rows.length < 4) {
    throw new Error('File must include utility metadata headers and half-hourly interval rows.');
  }

  // Locate column header row (Row 3 in standard utility format, or search first 10 rows)
  let headerRowIdx = -1;
  let dateCol = -1;
  let kwImportCol = -1;
  let kwExportCol = -1;
  let kvarExportCol = -1;
  let kvarImportCol = -1;
  let dateHeaderText = '';

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r] ?? [];
    const normalized = row.map((c) => String(c ?? '').trim().toLowerCase());
    const foundDate = normalized.findIndex(
      (h) => h.includes('date') || h.includes('end time') || h === 'time'
    );
    const foundImport = normalized.findIndex(
      (h) => h.includes('kw import') || h === 'kw_import' || h === 'import kw'
    );

    if (foundDate !== -1 && foundImport !== -1) {
      headerRowIdx = r;
      dateCol = foundDate;
      dateHeaderText = normalized[foundDate] ?? '';
      kwImportCol = foundImport;
      kwExportCol = normalized.findIndex(
        (h) => h.includes('kw export') || h === 'kw_export'
      );
      kvarExportCol = normalized.findIndex(
        (h) => h.includes('kvar export') || h === 'kvar_export'
      );
      kvarImportCol = normalized.findIndex(
        (h) => h.includes('kvar import') || h === 'kvar_import'
      );
      break;
    }
  }

  if (headerRowIdx === -1 || dateCol === -1 || kwImportCol === -1) {
    throw new Error(
      'Could not find required columns ("Date / End Time" and "kW Import") in the header row.'
    );
  }

  // Extract metadata from rows before headerRowIdx (e.g. Rows 1-2: Device, Meter Type)
  let device = 'Utility Meter';
  let meterType = 'Half-Hourly Interval';

  for (let r = 0; r < headerRowIdx; r++) {
    const row = (rows[r] ?? []).map((c) => String(c ?? '').trim()).filter(Boolean);
    if (row.length === 0) continue;

    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const lower = cell.toLowerCase();
      if (lower.startsWith('device')) {
        const inline = cell.split(/[:=]/).slice(1).join(':').trim();
        const nextVal = row[c + 1] ?? '';
        if (inline) device = inline;
        else if (nextVal) device = nextVal;
      } else if (lower.startsWith('meter type') || lower === 'type') {
        const inline = cell.split(/[:=]/).slice(1).join(':').trim();
        const nextVal = row[c + 1] ?? '';
        if (inline) meterType = inline;
        else if (nextVal) meterType = nextVal;
      }
    }
  }

  // Parse all half-hourly records strictly by Date / End Time timestamp
  const records: RawParsedRecord[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const dt = parseDateTimeCell(row[dateCol]);
    if (!dt) continue;

    records.push({
      year: dt.year,
      month: dt.month,
      day: dt.day,
      hour: dt.hour,
      minute: dt.minute,
      kwImport: Math.max(0, toNum(row[kwImportCol])),
      kwExport: kwExportCol !== -1 ? Math.max(0, toNum(row[kwExportCol])) : 0,
      kvarExport: kvarExportCol !== -1 ? toNum(row[kvarExportCol]) : 0,
      kvarImport: kvarImportCol !== -1 ? toNum(row[kvarImportCol]) : 0,
    });
  }

  if (records.length === 0) {
    throw new Error('No valid half-hourly load records were found below the column header row.');
  }

  // Sort chronologically to guard against out-of-order rows
  records.sort((a, b) => {
    const ka =
      a.year * 100000000 + a.month * 1000000 + a.day * 10000 + a.hour * 100 + a.minute;
    const kb =
      b.year * 100000000 + b.month * 1000000 + b.day * 10000 + b.hour * 100 + b.minute;
    return ka - kb;
  });

  // Detect End-Time convention (00:30 .. 24:00 / next-day 00:00) vs Start-Time (00:00 .. 23:30)
  const first = records[0];
  const firstDateKey = makeDateKey(first.year, first.month, first.day);
  const has24Hour = records.some((r) => r.hour === 24);
  const firstIsMidnight = first.hour === 0 && first.minute === 0;
  const hasSubsequentMidnight = records.some(
    (r) =>
      r.hour === 0 &&
      r.minute === 0 &&
      makeDateKey(r.year, r.month, r.day) !== firstDateKey
  );
  const headerSaysEndTime = dateHeaderText.includes('end time') || dateHeaderText.includes('end_time');
  const usesEndTimeConvention: boolean =
    has24Hour ||
    (first.hour === 0 && first.minute === 30) ||
    (!firstIsMidnight && hasSubsequentMidnight) ||
    (headerSaysEndTime && !firstIsMidnight);

  const timeConvention: TimeConvention = usesEndTimeConvention ? 'end_time' : 'start_time';
  const dayMap = new Map<string, LoadedDayProfile>();

  for (const rec of records) {
    let targetYear = rec.year;
    let targetMonth = rec.month;
    let targetDay = rec.day;
    let slot: number;

    if (timeConvention === 'end_time') {
      // End-Time intervals run 00:30 (slot 0) through 23:30 (slot 46) and 24:00 / next-day 00:00 (slot 47).
      // Timestamp label matches the source file's exact HH:MM (no 30-min backward shift!).
      if (rec.hour === 24 && rec.minute === 0) {
        slot = 47;
      } else if (rec.hour === 0 && rec.minute === 0) {
        const prev = getPreviousCalendarDay(rec.year, rec.month, rec.day);
        targetYear = prev.year;
        targetMonth = prev.month;
        targetDay = prev.day;
        slot = 47;
      } else {
        const mins = rec.hour * 60 + rec.minute;
        slot = Math.min(47, Math.max(0, Math.round(mins / 30) - 1));
      }
    } else {
      const mins = rec.hour * 60 + rec.minute;
      slot = Math.min(47, Math.max(0, Math.round(mins / 30)));
    }

    const dateKey = makeDateKey(targetYear, targetMonth, targetDay);
    let dayProfile = dayMap.get(dateKey);
    if (!dayProfile) {
      dayProfile = {
        dateKey,
        displayDate: makeDisplayDate(targetYear, targetMonth, targetDay),
        loadKw: new Array(INTERVALS_PER_DAY).fill(0),
        kwExport: new Array(INTERVALS_PER_DAY).fill(0),
        kvarExport: new Array(INTERVALS_PER_DAY).fill(0),
        kvarImport: new Array(INTERVALS_PER_DAY).fill(0),
      };
      dayMap.set(dateKey, dayProfile);
    }

    dayProfile.loadKw[slot] = rec.kwImport;
    dayProfile.kwExport[slot] = rec.kwExport;
    dayProfile.kvarExport[slot] = rec.kvarExport;
    dayProfile.kvarImport[slot] = rec.kvarImport;
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  return {
    metadata: {
      device,
      meterType,
      fileName: file.name,
      totalRecords: records.length,
      isImported: true,
      timeConvention,
    },
    days,
  };
}

function getNextDisplayDate(dateKey: string): string | null {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(
    Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10) + 1)
  );
  return makeDisplayDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function formatDateTimeForExport(
  dateKey: string,
  displayDate: string,
  intervalIdx: number,
  timeConvention: TimeConvention
): string {
  const label = formatIntervalLabel(intervalIdx, timeConvention);
  if (timeConvention === 'end_time' && label === '24:00') {
    const nextDate = getNextDisplayDate(dateKey);
    if (nextDate) return `${nextDate} 0:00`;
    return `${displayDate} 24:00`;
  }
  const [hh, mm] = label.split(':');
  return `${displayDate} ${parseInt(hh, 10)}:${mm}`;
}

export function buildDispatchCsv(
  days: LoadedDayProfile[],
  dayResults: DaySimulationResult[],
  metadata: MeterDatasetMetadata,
  params: SimulationParams
): string {
  const metaRows = [
    `Device,${metadata.device}`,
    `Meter Type,${metadata.meterType}`,
    [
      'Date / End Time',
      'kW Import (Base Load)',
      'kW Export',
      'Solar PV (kW)',
      'Net Before BESS (kW)',
      'BESS Power (kW)',
      'Net After BESS (kW)',
      'Peak Shaved (kW)',
      'Target Cap (kW)',
      'SOC Start (%)',
      'SOC End (%)',
      'Stored Energy (kWh)',
      'Conversion Loss (kWh)',
      'Operating State',
    ].join(','),
  ];

  const dataRows: string[] = [];
  for (let d = 0; d < dayResults.length; d++) {
    const dayRes = dayResults[d];
    const daySource = days[d];
    for (const r of dayRes.output.intervals) {
      const ts =
        dayRes.dateKey === 'BENCHMARK'
          ? r.label
          : formatDateTimeForExport(
              dayRes.dateKey,
              dayRes.displayDate,
              r.interval,
              metadata.timeConvention
            );
      const kwExport = daySource?.kwExport[r.interval] ?? 0;

      dataRows.push(
        [
          ts,
          r.loadKw.toFixed(1),
          kwExport.toFixed(1),
          r.pvKw.toFixed(1),
          r.netBeforeKw.toFixed(1),
          r.bessKw.toFixed(1),
          r.netAfterKw.toFixed(1),
          r.peakShavedKw.toFixed(1),
          params.targetCapKw.toFixed(1),
          r.socStartPct.toFixed(2),
          r.socEndPct.toFixed(2),
          r.energyEndKwh.toFixed(1),
          r.lossesKwh.toFixed(2),
          `"${r.stateLabel}"`,
        ].join(',')
      );
    }
  }

  return [...metaRows, ...dataRows].join('\n');
}

export function exportMeterAndDispatchWorkbook(
  days: LoadedDayProfile[],
  dayResults: DaySimulationResult[],
  metadata: MeterDatasetMetadata,
  params: SimulationParams
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Standard Utility Meter Format (30-min intervals)
  const loadRows: (string | number)[][] = [
    ['Device', metadata.device],
    ['Meter Type', metadata.meterType],
    ['Date / End Time', 'kW Export', 'kW Import', 'kVAR Export', 'kVAR Import'],
  ];

  // Sheet 2: Simulated 30-Min BESS Dispatch Ledger
  const dispatchRows: (string | number)[][] = [
    ['Device', metadata.device, 'Target Cap (kW)', params.targetCapKw],
    ['BESS Rating', `${params.bessPowerKw} kW / ${params.bessCapacityKwh} kWh`, 'Δt (h)', 0.5],
    [
      'Date / End Time',
      'Time Label',
      'kW Import (kW)',
      'Solar PV (kW)',
      'Net Before BESS (kW)',
      'BESS Power (kW)',
      'Net After BESS (kW)',
      'Peak Shaved (kW)',
      'Target Cap (kW)',
      'SOC End (%)',
      'Stored Energy (kWh)',
      'Conversion Loss (kWh)',
      'Operating State',
    ],
  ];

  for (let d = 0; d < days.length; d++) {
    const day = days[d];
    const res = dayResults[d];
    const dateLabel = day.dateKey === 'BENCHMARK' ? '01-08-26' : day.displayDate;
    const dateKey = day.dateKey === 'BENCHMARK' ? '2026-08-01' : day.dateKey;

    for (let i = 0; i < INTERVALS_PER_DAY; i++) {
      const ts = formatDateTimeForExport(
        dateKey,
        dateLabel,
        i,
        metadata.timeConvention
      );
      loadRows.push([
        ts,
        Number((day.kwExport[i] ?? 0).toFixed(2)),
        Number((day.loadKw[i] ?? 0).toFixed(2)),
        Number((day.kvarExport[i] ?? 0).toFixed(2)),
        Number((day.kvarImport[i] ?? 0).toFixed(2)),
      ]);

      const r = res?.output.intervals[i];
      if (r) {
        dispatchRows.push([
          ts,
          formatIntervalLabel(i, metadata.timeConvention),
          Number(r.loadKw.toFixed(2)),
          Number(r.pvKw.toFixed(2)),
          Number(r.netBeforeKw.toFixed(2)),
          Number(r.bessKw.toFixed(2)),
          Number(r.netAfterKw.toFixed(2)),
          Number(r.peakShavedKw.toFixed(2)),
          Number(params.targetCapKw.toFixed(1)),
          Number(r.socEndPct.toFixed(2)),
          Number(r.energyEndKwh.toFixed(2)),
          Number(r.lossesKwh.toFixed(3)),
          r.stateLabel,
        ]);
      }
    }
  }

  const wsLoad = XLSX.utils.aoa_to_sheet(loadRows);
  const wsDispatch = XLSX.utils.aoa_to_sheet(dispatchRows);
  XLSX.utils.book_append_sheet(wb, wsLoad, 'Load Profile');
  XLSX.utils.book_append_sheet(wb, wsDispatch, 'Simulated Dispatch');

  const safeSlug =
    metadata.device.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
    'microgrid';
  XLSX.writeFile(wb, `${safeSlug}-30min-peak-shaving.xlsx`);
}

function getSafeFileSlug(metadata: MeterDatasetMetadata): string {
  return (
    metadata.device
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'microgrid'
  );
}

function triggerBlobDownload(content: string, mimeType: string, fileName: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDispatchCsvFile(
  days: LoadedDayProfile[],
  dayResults: DaySimulationResult[],
  metadata: MeterDatasetMetadata,
  params: SimulationParams
): void {
  const csv = buildDispatchCsv(days, dayResults, metadata, params);
  const safeSlug = getSafeFileSlug(metadata);
  triggerBlobDownload(
    csv,
    'text/csv;charset=utf-8;',
    `${safeSlug}-30min-peak-shaving.csv`
  );
}

export function buildDispatchJson(
  days: LoadedDayProfile[],
  dayResults: DaySimulationResult[],
  metadata: MeterDatasetMetadata,
  params: SimulationParams
): string {
  const criticalDaysSummary = dayResults
    .map((res) => ({
      dateKey: res.dateKey,
      displayDate: res.displayDate,
      originalMaxLoadKw: Number(res.originalMaxLoadKw.toFixed(2)),
      originalPeakTime: formatIntervalLabel(res.originalPeakInterval, metadata.timeConvention),
      peakBeforeKw: Number(res.output.summary.peakBeforeKw.toFixed(2)),
      peakAfterKw: Number(res.output.summary.peakAfterKw.toFixed(2)),
      peakReductionKw: Number(res.output.summary.peakReductionKw.toFixed(2)),
      peakReductionPct: Number(res.output.summary.peakReductionPct.toFixed(2)),
      hoursAboveCapBefore: Number(res.output.summary.hoursAboveCapBefore.toFixed(1)),
      hoursAboveCapAfter: Number(res.output.summary.hoursAboveCapAfter.toFixed(1)),
      minSocPct: Number(res.output.summary.minSocPct.toFixed(2)),
      maxSocPct: Number(res.output.summary.maxSocPct.toFixed(2)),
      totalLoadKwh: Number(res.output.summary.totalLoadKwh.toFixed(2)),
      totalPvKwh: Number(res.output.summary.totalPvKwh.toFixed(2)),
      totalBessDischargedKwh: Number(res.output.summary.totalBessDischargedKwh.toFixed(2)),
      totalBessChargedKwh: Number(res.output.summary.totalBessChargedKwh.toFixed(2)),
      monthlyDemandSavingsUsd: Number(res.output.summary.monthlyDemandSavingsUsd.toFixed(2)),
    }))
    .sort((a, b) => b.originalMaxLoadKw - a.originalMaxLoadKw);

  const payload = {
    metadata: {
      device: metadata.device,
      meterType: metadata.meterType,
      sourceFile: metadata.fileName,
      timeConvention: metadata.timeConvention,
      dtHours: 0.5,
      totalDays: days.length,
      totalRecords: metadata.totalRecords,
      exportedAt: new Date().toISOString(),
    },
    parameters: {
      targetCapKw: params.targetCapKw,
      transformerLimitKw: params.transformerLimitKw,
      bessPowerKw: params.bessPowerKw,
      bessCapacityKwh: params.bessCapacityKwh,
      roundTripEfficiencyPct: params.roundTripEfficiencyPct,
      socMinPct: params.socMinPct,
      socMaxPct: params.socMaxPct,
      initialSocPct: params.initialSocPct,
      solarPeakKw: params.solarPeakKw,
      irradiancePct: params.irradiancePct,
      loadScalePct: params.loadScalePct,
      demandChargeRate: params.demandChargeRate,
      chargingStrategy: params.chargingStrategy,
      peakStartMinutes: params.peakStartMinutes,
      peakEndMinutes: params.peakEndMinutes,
      offPeakChargeToTransformer: params.offPeakChargeToTransformer,
    },
    criticalDaysSummary,
    days: dayResults.map((res, dIdx) => {
      const sourceDay = days[dIdx];
      const dateLabel = res.dateKey === 'BENCHMARK' ? '01-08-26' : res.displayDate;
      const dateKey = res.dateKey === 'BENCHMARK' ? '2026-08-01' : res.dateKey;
      return {
        dateKey: res.dateKey,
        displayDate: res.displayDate,
        intervals: res.output.intervals.map((r) => ({
          dateEndTime: formatDateTimeForExport(
            dateKey,
            dateLabel,
            r.interval,
            metadata.timeConvention
          ),
          timeLabel: r.label,
          kwImport: Number(r.loadKw.toFixed(2)),
          kwExport: Number((sourceDay?.kwExport[r.interval] ?? 0).toFixed(2)),
          solarPvKw: Number(r.pvKw.toFixed(2)),
          netBeforeBessKw: Number(r.netBeforeKw.toFixed(2)),
          bessPowerKw: Number(r.bessKw.toFixed(2)),
          netAfterBessKw: Number(r.netAfterKw.toFixed(2)),
          peakShavedKw: Number(r.peakShavedKw.toFixed(2)),
          targetCapKw: params.targetCapKw,
          socStartPct: Number(r.socStartPct.toFixed(2)),
          socEndPct: Number(r.socEndPct.toFixed(2)),
          storedEnergyKwh: Number(r.energyEndKwh.toFixed(2)),
          conversionLossKwh: Number(r.lossesKwh.toFixed(3)),
          operatingState: r.stateLabel,
        })),
      };
    }),
  };

  return JSON.stringify(payload, null, 2);
}

export function exportDispatchJsonFile(
  days: LoadedDayProfile[],
  dayResults: DaySimulationResult[],
  metadata: MeterDatasetMetadata,
  params: SimulationParams
): void {
  const json = buildDispatchJson(days, dayResults, metadata, params);
  const safeSlug = getSafeFileSlug(metadata);
  triggerBlobDownload(
    json,
    'application/json;charset=utf-8;',
    `${safeSlug}-30min-peak-shaving.json`
  );
}
