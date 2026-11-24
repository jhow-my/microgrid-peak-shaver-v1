export type ChargingStrategy = 'cap_aware' | 'offpeak_solar' | 'excess_solar';
export type TimeConvention = 'start_time' | 'end_time';

export const INTERVALS_PER_DAY = 48;
export const DT_HOURS = 0.5;

export type IntervalOperatingState =
  | 'shaving_cap_met'
  | 'shaving_soc_floor'
  | 'shaving_power_limited'
  | 'cap_exceeded_depleted'
  | 'charging_grid_solar'
  | 'charging_solar_excess'
  | 'idle_full'
  | 'idle_standby'
  | 'exporting_solar';

export interface LoadedDayProfile {
  dateKey: string; // YYYY-MM-DD (sortable)
  displayDate: string; // DD-MM-YY or readable label
  loadKw: number[]; // 48 half-hourly kW Import values
  kwExport: number[]; // 48 half-hourly kW Export values
  kvarExport: number[]; // 48 half-hourly kVAR Export values
  kvarImport: number[]; // 48 half-hourly kVAR Import values
}

export interface MeterDatasetMetadata {
  device: string;
  meterType: string;
  fileName: string;
  totalRecords: number;
  isImported: boolean;
  timeConvention: TimeConvention;
}

export interface SimulationParams {
  /** Target grid import peak cap P_cap (kW) */
  targetCapKw: number;
  /** Maximum transformer / grid import limit (kW) */
  transformerLimitKw: number;
  /** BESS maximum charge/discharge power rating P_BESS,max (kW) */
  bessPowerKw: number;
  /** BESS nameplate energy capacity E_nom (kWh) */
  bessCapacityKwh: number;
  /** Round-trip efficiency eta_RT (%), split symmetrically eta_c = eta_d = sqrt(eta_RT) */
  roundTripEfficiencyPct: number;
  /** Minimum allowable SOC (%) */
  socMinPct: number;
  /** Maximum allowable SOC (%) */
  socMaxPct: number;
  /** Initial SOC at day 0 interval 00:00 (%) */
  initialSocPct: number;
  /** Peak solar PV array rating (kW) */
  solarPeakKw: number;
  /** Irradiance / weather multiplier (%) */
  irradiancePct: number;
  /** Commercial load scale multiplier (%) */
  loadScalePct: number;
  /** Monthly utility peak demand charge ($/kW-month) */
  demandChargeRate: number;
  /** Charging dispatch rule */
  chargingStrategy: ChargingStrategy;
  /** Selected peak shaving period start in minutes from 00:00 (0..1410) */
  peakStartMinutes: number;
  /** Selected peak shaving period end in minutes from 00:00 (30..1440) */
  peakEndMinutes: number;
  /** When a sub-24h peak period is active, allow off-peak charging up to transformerLimitKw */
  offPeakChargeToTransformer: boolean;
  /** Base 48-interval (30-min) commercial load curve (kW) */
  baseLoadProfileKw: number[];
  /** Base normalized 48-interval (30-min) solar PV profile (0..1 fraction of peak) */
  basePvNormalized: number[];
}

export interface IntervalResult {
  interval: number; // 0..47
  hour: number; // 0..24
  minute: number; // 0 | 30
  label: string; // HH:MM
  inPeakPeriod: boolean;
  loadKw: number;
  pvKw: number;
  netBeforeKw: number;
  bessKw: number; // > 0 charging, < 0 discharging
  netAfterKw: number;
  peakShavedKw: number; // max(0, netBefore - netAfter) when discharging
  socStartPct: number;
  socEndPct: number;
  energyStartKwh: number;
  energyEndKwh: number;
  lossesKwh: number;
  state: IntervalOperatingState;
  stateLabel: string;
  stateGlyph: string;
  aboveCap: boolean;
  socFloorHit: boolean;
  powerLimited: boolean;
}

export interface SimulationSummary {
  isPeakWindowActive: boolean;
  peakWindowIntervals: number;
  peakBeforeKw: number;
  peakBeforeInterval: number;
  peakAfterKw: number;
  peakAfterInterval: number;
  peakReductionKw: number;
  peakReductionPct: number;
  peakWindowBeforeKw: number;
  peakWindowBeforeInterval: number;
  peakWindowAfterKw: number;
  peakWindowAfterInterval: number;
  peakWindowReductionKw: number;
  peakWindowReductionPct: number;
  intervalsAboveCapBefore: number;
  intervalsAboveCapAfter: number;
  hoursAboveCapBefore: number;
  hoursAboveCapAfter: number;
  intervalsAboveCapBeforeInWindow: number;
  intervalsAboveCapInWindow: number;
  hoursAboveCapBeforeInWindow: number;
  hoursAboveCapInWindow: number;
  minSocPct: number;
  minSocKwh: number;
  minSocInterval: number | null;
  maxSocPct: number;
  maxSocKwh: number;
  socFloorHitInterval: number | null;
  socFloorHitInWindowInterval: number | null;
  totalLoadKwh: number;
  totalPvKwh: number;
  totalGridImportBeforeKwh: number;
  totalGridImportAfterKwh: number;
  totalExportedSolarKwh: number;
  totalBessDischargedKwh: number;
  totalBessChargedKwh: number;
  totalConversionLossesKwh: number;
  effectiveRoundTripPct: number;
  monthlyDemandSavingsUsd: number;
  annualDemandSavingsUsd: number;
  etaC: number;
  etaD: number;
  eMinKwh: number;
  eMaxKwh: number;
  startEnergyKwh: number;
  endEnergyKwh: number;
}

export interface SimulationOutput {
  intervals: IntervalResult[];
  summary: SimulationSummary;
}

export interface DaySimulationResult {
  dateKey: string;
  displayDate: string;
  output: SimulationOutput;
  originalMaxLoadKw: number;
  originalPeakInterval: number;
}

const HOURLY_BASE_LOAD_KW: number[] = [
  295, 285, 290, 300, 320, 380, 490, 630, 760, 870, 940, 990,
  1020, 1005, 970, 930, 900, 970, 1000, 1000, 840, 690, 510, 370,
];

const HOURLY_PV_NORMALIZED: number[] = [
  0, 0, 0, 0, 0, 0,
  25 / 820, 120 / 820, 290 / 820, 480 / 820, 650 / 820, 770 / 820,
  1.0, 785 / 820, 680 / 820, 510 / 820, 130 / 820, 20 / 820,
  0, 0, 0, 0, 0, 0,
];

function interpolate24To48(hourly: number[], wrapLastToFirst = false): number[] {
  const result: number[] = [];
  for (let h = 0; h < 24; h++) {
    const curr = hourly[h] ?? 0;
    const next = h < 23 ? (hourly[h + 1] ?? curr) : wrapLastToFirst ? (hourly[0] ?? curr) : curr;
    result.push(Math.round(curr * 1000) / 1000);
    result.push(Math.round(((curr + next) / 2) * 1000) / 1000);
  }
  return result;
}

/**
 * 48-interval (30-min) commercial benchmark load profile (kW).
 */
export const DEFAULT_BASE_LOAD_48_KW: number[] = interpolate24To48(HOURLY_BASE_LOAD_KW, true);

/**
 * 48-interval (30-min) normalized solar irradiance curve (peaks at 1.000 at 12:00).
 */
export const DEFAULT_PV_NORMALIZED_48: number[] = interpolate24To48(HOURLY_PV_NORMALIZED, false);

export const DEFAULT_BENCHMARK_DAY: LoadedDayProfile = {
  dateKey: 'BENCHMARK',
  displayDate: 'Benchmark Day',
  loadKw: [...DEFAULT_BASE_LOAD_48_KW],
  kwExport: new Array(INTERVALS_PER_DAY).fill(0),
  kvarExport: new Array(INTERVALS_PER_DAY).fill(0),
  kvarImport: new Array(INTERVALS_PER_DAY).fill(0),
};

export const DEFAULT_METADATA: MeterDatasetMetadata = {
  device: 'Commercial Reference',
  meterType: '30-Min Interval Model',
  fileName: 'Built-in Benchmark',
  totalRecords: 48,
  isImported: false,
  timeConvention: 'start_time',
};

export const DEFAULT_PARAMS: SimulationParams = {
  targetCapKw: 650,
  transformerLimitKw: 1200,
  bessPowerKw: 400,
  bessCapacityKwh: 1200,
  roundTripEfficiencyPct: 92,
  socMinPct: 15,
  socMaxPct: 90,
  initialSocPct: 50,
  solarPeakKw: 820,
  irradiancePct: 100,
  loadScalePct: 100,
  demandChargeRate: 20,
  chargingStrategy: 'offpeak_solar',
  peakStartMinutes: 840,
  peakEndMinutes: 1320,
  offPeakChargeToTransformer: true,
  baseLoadProfileKw: [...DEFAULT_BASE_LOAD_48_KW],
  basePvNormalized: [...DEFAULT_PV_NORMALIZED_48],
};

export interface SimulationPreset {
  id: string;
  label: string;
  summary: string;
  overrides: Partial<SimulationParams>;
}

export const SIMULATION_PRESETS: SimulationPreset[] = [
  {
    id: 'benchmark',
    label: 'Commercial Benchmark',
    summary: '400 kW / 1,200 kWh · 820 kW PV · 650 kW Cap',
    overrides: {
      targetCapKw: 650,
      transformerLimitKw: 1200,
      bessPowerKw: 400,
      bessCapacityKwh: 1200,
      roundTripEfficiencyPct: 92,
      socMinPct: 15,
      socMaxPct: 90,
      initialSocPct: 50,
      solarPeakKw: 820,
      irradiancePct: 100,
      loadScalePct: 100,
      chargingStrategy: 'cap_aware',
      peakStartMinutes: 840,
      peakEndMinutes: 1320,
      offPeakChargeToTransformer: true,
    },
  },
  {
    id: 'aggressive_cap',
    label: 'Aggressive 550 kW Cap',
    summary: '600 kW / 1,800 kWh BESS sized for 550 kW target',
    overrides: {
      targetCapKw: 550,
      transformerLimitKw: 1200,
      bessPowerKw: 600,
      bessCapacityKwh: 1800,
      roundTripEfficiencyPct: 92,
      socMinPct: 15,
      socMaxPct: 90,
      initialSocPct: 50,
      solarPeakKw: 820,
      irradiancePct: 100,
      loadScalePct: 100,
      chargingStrategy: 'cap_aware',
      peakStartMinutes: 840,
      peakEndMinutes: 1320,
      offPeakChargeToTransformer: true,
    },
  },
  {
    id: 'high_solar',
    label: 'Solar-Only Charging',
    summary: '1,250 kW PV · Excess solar capture without grid import',
    overrides: {
      targetCapKw: 650,
      transformerLimitKw: 1200,
      bessPowerKw: 400,
      bessCapacityKwh: 1200,
      roundTripEfficiencyPct: 94,
      socMinPct: 10,
      socMaxPct: 90,
      initialSocPct: 30,
      solarPeakKw: 1250,
      irradiancePct: 100,
      loadScalePct: 100,
      chargingStrategy: 'excess_solar',
      peakStartMinutes: 840,
      peakEndMinutes: 1320,
      offPeakChargeToTransformer: true,
    },
  },
  {
    id: 'cloudy_stress',
    label: 'Cloudy Day Stress Test',
    summary: '35% Solar Irradiance · Midday & evening demand pressure',
    overrides: {
      targetCapKw: 650,
      transformerLimitKw: 1200,
      bessPowerKw: 400,
      bessCapacityKwh: 1200,
      roundTripEfficiencyPct: 92,
      socMinPct: 15,
      socMaxPct: 90,
      initialSocPct: 50,
      solarPeakKw: 820,
      irradiancePct: 35,
      loadScalePct: 100,
      chargingStrategy: 'cap_aware',
      peakStartMinutes: 840,
      peakEndMinutes: 1320,
      offPeakChargeToTransformer: true,
    },
  },
];

const EPS = 1e-6;

export function formatMinutesHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(totalMinutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function isFullDayPeakWindow(startMinutes: number, endMinutes: number): boolean {
  return (startMinutes <= 0 && endMinutes >= 1440) || startMinutes === endMinutes;
}

export function isIntervalInPeakWindow(
  interval: number,
  startMinutes: number,
  endMinutes: number
): boolean {
  if (isFullDayPeakWindow(startMinutes, endMinutes)) return true;
  const slotStart = interval * 30;
  const slotEnd = (interval + 1) * 30;
  if (startMinutes < endMinutes) {
    return slotStart >= startMinutes && slotEnd <= endMinutes;
  }
  // Overnight wrap-around window (e.g., 20:00 to 06:00)
  return slotStart >= startMinutes || slotEnd <= endMinutes;
}

export function countIntervalsInPeakWindow(startMinutes: number, endMinutes: number): number {
  let count = 0;
  for (let i = 0; i < INTERVALS_PER_DAY; i++) {
    if (isIntervalInPeakWindow(i, startMinutes, endMinutes)) count++;
  }
  return count;
}

export function formatPeakWindowRange(startMinutes: number, endMinutes: number): string {
  if (isFullDayPeakWindow(startMinutes, endMinutes)) {
    return '00:00–24:00';
  }
  return `${formatMinutesHHMM(startMinutes)}–${formatMinutesHHMM(endMinutes)}`;
}

export function formatIntervalLabel(
  interval: number,
  convention: TimeConvention = 'start_time'
): string {
  const safe = ((interval % INTERVALS_PER_DAY) + INTERVALS_PER_DAY) % INTERVALS_PER_DAY;
  const totalMinutes = convention === 'end_time' ? (safe + 1) * 30 : safe * 30;
  return formatMinutesHHMM(totalMinutes);
}

export function formatIntervalWindow(
  interval: number,
  convention: TimeConvention = 'start_time'
): string {
  const safe = ((interval % INTERVALS_PER_DAY) + INTERVALS_PER_DAY) % INTERVALS_PER_DAY;
  if (convention === 'end_time') {
    const start = formatMinutesHHMM(safe * 30);
    const end = formatMinutesHHMM((safe + 1) * 30);
    return `${start} – ${end}`;
  }
  const start = formatMinutesHHMM(safe * 30);
  const end = formatMinutesHHMM(((safe + 1) % INTERVALS_PER_DAY) * 30);
  return `${start} – ${end}`;
}

export function runSimulation(
  params: SimulationParams,
  loadOverride48?: number[],
  initialEnergyOverrideKwh?: number,
  timeConvention: TimeConvention = 'start_time'
): SimulationOutput {
  const etaRt = Math.min(0.999, Math.max(0.5, params.roundTripEfficiencyPct / 100));
  const etaC = Math.sqrt(etaRt);
  const etaD = Math.sqrt(etaRt);

  const safeSocMin = Math.min(params.socMinPct, params.socMaxPct - 1);
  const safeSocMax = Math.max(params.socMaxPct, safeSocMin + 1);
  const capacity = Math.max(0, params.bessCapacityKwh);
  const eMin = capacity * (safeSocMin / 100);
  const eMax = capacity * (safeSocMax / 100);

  const clampedInitSoc = Math.min(safeSocMax, Math.max(safeSocMin, params.initialSocPct));
  const startEnergyKwh =
    initialEnergyOverrideKwh !== undefined
      ? Math.min(eMax, Math.max(eMin, initialEnergyOverrideKwh))
      : capacity * (clampedInitSoc / 100);
  let energy = startEnergyKwh;

  const loadScale = params.loadScalePct / 100;
  const pvScale = params.solarPeakKw * (params.irradiancePct / 100);
  const effectiveCap = Math.min(params.targetCapKw, params.transformerLimitKw);

  const peakStartMin = params.peakStartMinutes ?? 0;
  const peakEndMin = params.peakEndMinutes ?? 1440;
  const isPeakWindowActive = !isFullDayPeakWindow(peakStartMin, peakEndMin);

  const activeLoad = loadOverride48 ?? params.baseLoadProfileKw;
  const intervals: IntervalResult[] = [];
  let socFloorHitInterval: number | null = null;
  let socFloorHitInWindowInterval: number | null = null;

  for (let idx = 0; idx < INTERVALS_PER_DAY; idx++) {
    const totalMinutes = timeConvention === 'end_time' ? (idx + 1) * 30 : idx * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const timeHours = totalMinutes / 60;
    const inPeakPeriod = isIntervalInPeakWindow(idx, peakStartMin, peakEndMin);

    // Align solar PV strictly to the interval timestamp (00:30..24:00 vs 00:00..23:30)
    const pvSlot = timeConvention === 'end_time' ? idx + 1 : idx;
    const pvFraction =
      pvSlot >= 0 && pvSlot < INTERVALS_PER_DAY ? (params.basePvNormalized[pvSlot] ?? 0) : 0;

    const loadKw = Math.max(0, (activeLoad[idx] ?? 0) * loadScale);
    const pvKw = Math.max(0, pvFraction * pvScale);
    const netBeforeKw = loadKw - pvKw;

    const energyStartKwh = energy;
    const socStartPct = capacity > 0 ? (energyStartKwh / capacity) * 100 : 0;

    let bessKw = 0;
    let lossesKwh = 0;
    let socFloorHit = false;
    let powerLimited = false;

    if (inPeakPeriod && netBeforeKw > params.targetCapKw + EPS) {
      const desiredDischargeKw = netBeforeKw - params.targetCapKw;
      const powerCappedDischargeKw = Math.min(params.bessPowerKw, desiredDischargeKw);
      if (desiredDischargeKw > params.bessPowerKw + EPS) {
        powerLimited = true;
      }

      const availableEnergyKwh = Math.max(0, energyStartKwh - eMin);
      const maxDeliverableAcKw = (availableEnergyKwh * etaD) / DT_HOURS;

      const actualDischargeKw = Math.min(powerCappedDischargeKw, maxDeliverableAcKw);
      bessKw = -actualDischargeKw;

      const energyDrawnFromBatteryKwh = (actualDischargeKw * DT_HOURS) / etaD;
      energy = Math.max(eMin, energyStartKwh - energyDrawnFromBatteryKwh);
      lossesKwh = energyDrawnFromBatteryKwh - actualDischargeKw * DT_HOURS;

      if (energy <= eMin + 1e-4 && desiredDischargeKw > actualDischargeKw + 1e-3) {
        socFloorHit = true;
        if (socFloorHitInterval === null) {
          socFloorHitInterval = idx;
        }
        if (inPeakPeriod && socFloorHitInWindowInterval === null) {
          socFloorHitInWindowInterval = idx;
        }
      } else if (
        actualDischargeKw > EPS &&
        Math.abs(energy - eMin) <= 1e-3 &&
        socFloorHitInterval === null
      ) {
        socFloorHit = true;
        socFloorHitInterval = idx;
        if (inPeakPeriod && socFloorHitInWindowInterval === null) {
          socFloorHitInWindowInterval = idx;
        }
      }
    } else if (energyStartKwh < eMax - 1e-4) {
      const slotStartMin = idx * 30;
      const slotEndMin = (idx + 1) * 30;
      const isOffPeakWindow = slotStartMin >= 1320 || slotEndMin <= 360; // 22:00–06:00 overnight
      const isSolarWindow = pvKw > EPS;
      const isExcessSolar = netBeforeKw < -EPS;

      const chargeCeilingKw =
        !inPeakPeriod && params.offPeakChargeToTransformer
          ? params.transformerLimitKw
          : effectiveCap;

      let canCharge = false;
      if (params.chargingStrategy === 'cap_aware') {
        canCharge = netBeforeKw < chargeCeilingKw - EPS;
      } else if (params.chargingStrategy === 'offpeak_solar') {
        canCharge = (isOffPeakWindow || isSolarWindow) && netBeforeKw < chargeCeilingKw - EPS;
      } else if (params.chargingStrategy === 'excess_solar') {
        canCharge = isExcessSolar;
      }

      if (canCharge) {
        const gridHeadroomKw =
          params.chargingStrategy === 'excess_solar'
            ? Math.max(0, -netBeforeKw)
            : Math.max(0, chargeCeilingKw - netBeforeKw);

        const maxChargeBySocKw = (eMax - energyStartKwh) / (etaC * DT_HOURS);
        const actualChargeKw = Math.min(params.bessPowerKw, gridHeadroomKw, maxChargeBySocKw);

        if (actualChargeKw > EPS) {
          bessKw = actualChargeKw;
          const storedEnergyKwh = actualChargeKw * DT_HOURS * etaC;
          energy = Math.min(eMax, energyStartKwh + storedEnergyKwh);
          lossesKwh = actualChargeKw * DT_HOURS - storedEnergyKwh;
        }
      }
    }

    const netAfterKw = netBeforeKw + bessKw;
    const peakShavedKw = bessKw < -EPS ? -bessKw : 0;
    const socEndPct = capacity > 0 ? (energy / capacity) * 100 : 0;
    const aboveCap = inPeakPeriod && netAfterKw > params.targetCapKw + 0.05;

    let state: IntervalOperatingState = 'idle_standby';
    let stateLabel = inPeakPeriod ? 'Standby' : 'Off-Peak Standby';
    let stateGlyph = '○';

    if (bessKw < -EPS) {
      if (socFloorHit) {
        state = 'shaving_soc_floor';
        stateLabel = 'SOC Floor Hit';
        stateGlyph = '▼';
      } else if (powerLimited && aboveCap) {
        state = 'shaving_power_limited';
        stateLabel = 'Power Limited';
        stateGlyph = '▲';
      } else {
        state = 'shaving_cap_met';
        stateLabel = 'Peak Shaving';
        stateGlyph = '●';
      }
    } else if (aboveCap) {
      state = 'cap_exceeded_depleted';
      stateLabel = 'Depleted · Over Cap';
      stateGlyph = '✖';
    } else if (bessKw > EPS) {
      if (netBeforeKw < -EPS) {
        state = 'charging_solar_excess';
        stateLabel = 'Solar Charging';
        stateGlyph = '◈';
      } else {
        state = 'charging_grid_solar';
        stateLabel = 'Charging';
        stateGlyph = '◈';
      }
    } else if (netAfterKw < -EPS) {
      state = 'exporting_solar';
      stateLabel = 'Solar Export';
      stateGlyph = '↗';
    } else if (energy >= eMax - 0.1) {
      state = 'idle_full';
      stateLabel = inPeakPeriod ? 'Charged Reserve' : 'Off-Peak Full';
      stateGlyph = '●';
    }

    intervals.push({
      interval: idx,
      hour,
      minute,
      label: formatIntervalLabel(idx, timeConvention),
      inPeakPeriod,
      loadKw,
      pvKw,
      netBeforeKw,
      bessKw,
      netAfterKw,
      peakShavedKw,
      socStartPct,
      socEndPct,
      energyStartKwh,
      energyEndKwh: energy,
      lossesKwh,
      state,
      stateLabel,
      stateGlyph,
      aboveCap,
      socFloorHit,
      powerLimited,
    });
  }

  let peakBeforeKw = -Infinity;
  let peakBeforeInterval = 0;
  let peakAfterKw = -Infinity;
  let peakAfterInterval = 0;
  let peakWindowBeforeKw = -Infinity;
  let peakWindowBeforeInterval = 0;
  let peakWindowAfterKw = -Infinity;
  let peakWindowAfterInterval = 0;
  let peakWindowIntervals = 0;

  let minSocPct = Infinity;
  let minSocKwh = Infinity;
  let minSocInterval: number | null = null;
  let maxSocPct = -Infinity;
  let maxSocKwh = -Infinity;

  let intervalsAboveCapBefore = 0;
  let intervalsAboveCapAfter = 0;
  let intervalsAboveCapBeforeInWindow = 0;
  let intervalsAboveCapInWindow = 0;
  let totalLoadKwh = 0;
  let totalPvKwh = 0;
  let totalGridImportBeforeKwh = 0;
  let totalGridImportAfterKwh = 0;
  let totalExportedSolarKwh = 0;
  let totalBessDischargedKwh = 0;
  let totalBessChargedKwh = 0;
  let totalConversionLossesKwh = 0;

  for (const row of intervals) {
    if (row.netBeforeKw > peakBeforeKw) {
      peakBeforeKw = row.netBeforeKw;
      peakBeforeInterval = row.interval;
    }
    if (row.netAfterKw > peakAfterKw) {
      peakAfterKw = row.netAfterKw;
      peakAfterInterval = row.interval;
    }
    if (row.inPeakPeriod) {
      peakWindowIntervals++;
      if (row.netBeforeKw > peakWindowBeforeKw) {
        peakWindowBeforeKw = row.netBeforeKw;
        peakWindowBeforeInterval = row.interval;
      }
      if (row.netAfterKw > peakWindowAfterKw) {
        peakWindowAfterKw = row.netAfterKw;
        peakWindowAfterInterval = row.interval;
      }
      if (row.netBeforeKw > params.targetCapKw + 0.05) intervalsAboveCapBeforeInWindow++;
      if (row.netAfterKw > params.targetCapKw + 0.05) intervalsAboveCapInWindow++;
    }
    if (row.socEndPct < minSocPct) {
      minSocPct = row.socEndPct;
      minSocKwh = row.energyEndKwh;
      minSocInterval = row.interval;
    }
    if (row.socEndPct > maxSocPct) {
      maxSocPct = row.socEndPct;
      maxSocKwh = row.energyEndKwh;
    }
    if (row.netBeforeKw > params.targetCapKw + 0.05) intervalsAboveCapBefore++;
    if (row.netAfterKw > params.targetCapKw + 0.05) intervalsAboveCapAfter++;

    totalLoadKwh += row.loadKw * DT_HOURS;
    totalPvKwh += row.pvKw * DT_HOURS;
    totalGridImportBeforeKwh += Math.max(0, row.netBeforeKw) * DT_HOURS;
    totalGridImportAfterKwh += Math.max(0, row.netAfterKw) * DT_HOURS;
    totalExportedSolarKwh += Math.max(0, -row.netAfterKw) * DT_HOURS;

    if (row.bessKw < 0) totalBessDischargedKwh += -row.bessKw * DT_HOURS;
    if (row.bessKw > 0) totalBessChargedKwh += row.bessKw * DT_HOURS;
    totalConversionLossesKwh += row.lossesKwh;
  }

  if (peakWindowIntervals === 0) {
    peakWindowBeforeKw = peakBeforeKw;
    peakWindowBeforeInterval = peakBeforeInterval;
    peakWindowAfterKw = peakAfterKw;
    peakWindowAfterInterval = peakAfterInterval;
  }

  const peakReductionKw = Math.max(0, peakBeforeKw - peakAfterKw);
  const peakReductionPct = peakBeforeKw > 0 ? (peakReductionKw / peakBeforeKw) * 100 : 0;

  const peakWindowReductionKw = Math.max(0, peakWindowBeforeKw - peakWindowAfterKw);
  const peakWindowReductionPct =
    peakWindowBeforeKw > 0 ? (peakWindowReductionKw / peakWindowBeforeKw) * 100 : 0;

  const effectiveDemandReductionKw = isPeakWindowActive ? peakWindowReductionKw : peakReductionKw;
  const monthlyDemandSavingsUsd = effectiveDemandReductionKw * params.demandChargeRate;
  const annualDemandSavingsUsd = monthlyDemandSavingsUsd * 12;

  return {
    intervals,
    summary: {
      isPeakWindowActive,
      peakWindowIntervals,
      peakBeforeKw,
      peakBeforeInterval,
      peakAfterKw,
      peakAfterInterval,
      peakReductionKw,
      peakReductionPct,
      peakWindowBeforeKw,
      peakWindowBeforeInterval,
      peakWindowAfterKw,
      peakWindowAfterInterval,
      peakWindowReductionKw,
      peakWindowReductionPct,
      intervalsAboveCapBefore,
      intervalsAboveCapAfter,
      hoursAboveCapBefore: intervalsAboveCapBefore * DT_HOURS,
      hoursAboveCapAfter: intervalsAboveCapAfter * DT_HOURS,
      intervalsAboveCapBeforeInWindow,
      intervalsAboveCapInWindow,
      hoursAboveCapBeforeInWindow: intervalsAboveCapBeforeInWindow * DT_HOURS,
      hoursAboveCapInWindow: intervalsAboveCapInWindow * DT_HOURS,
      minSocPct,
      minSocKwh,
      minSocInterval,
      maxSocPct,
      maxSocKwh,
      socFloorHitInterval,
      socFloorHitInWindowInterval,
      totalLoadKwh,
      totalPvKwh,
      totalGridImportBeforeKwh,
      totalGridImportAfterKwh,
      totalExportedSolarKwh,
      totalBessDischargedKwh,
      totalBessChargedKwh,
      totalConversionLossesKwh,
      effectiveRoundTripPct: etaRt * 100,
      monthlyDemandSavingsUsd,
      annualDemandSavingsUsd,
      etaC,
      etaD,
      eMinKwh: eMin,
      eMaxKwh: eMax,
      startEnergyKwh,
      endEnergyKwh: energy,
    },
  };
}

export function runMultiDaySimulation(
  days: LoadedDayProfile[],
  params: SimulationParams,
  timeConvention: TimeConvention = 'start_time'
): DaySimulationResult[] {
  const results: DaySimulationResult[] = [];
  let carryEnergyKwh: number | undefined = undefined;

  for (const day of days) {
    const output = runSimulation(params, day.loadKw, carryEnergyKwh, timeConvention);
    carryEnergyKwh = output.summary.endEnergyKwh;

    let originalMaxLoadKw = -Infinity;
    let originalPeakInterval = 0;
    for (let i = 0; i < day.loadKw.length; i++) {
      const val = day.loadKw[i] ?? 0;
      if (val > originalMaxLoadKw) {
        originalMaxLoadKw = val;
        originalPeakInterval = i;
      }
    }

    results.push({
      dateKey: day.dateKey,
      displayDate: day.displayDate,
      output,
      originalMaxLoadKw: originalMaxLoadKw === -Infinity ? 0 : originalMaxLoadKw,
      originalPeakInterval,
    });
  }

  return results;
}

export type AutoSizeScope = 'all_days' | 'active_day';

export interface AutoSizeRequest {
  days: LoadedDayProfile[];
  baseParams: SimulationParams;
  desiredMaxDemandKw: number;
  peakStartMinutes: number;
  peakEndMinutes: number;
  scope: AutoSizeScope;
  activeDayIndex: number;
  offPeakChargeToTransformer: boolean;
  timeConvention: TimeConvention;
}

export interface AutoSizeResult {
  recommendedPowerKw: number;
  recommendedCapacityKwh: number;
  usableCapacityKwh: number;
  rawRequiredPowerKw: number;
  singleDayEnergyCapacityKwh: number;
  evaluatedDaysCount: number;
  peakPeriodIntervalsPerDay: number;
  feasible: boolean;
  alreadyCompliant: boolean;
  issueReason: string | null;
  suggestOffPeakRecharge: boolean;
  driverDayIndex: number;
  driverDisplayDate: string;
  driverIntervalIndex: number;
  driverPeakBeforeKw: number;
  driverPeakEnergyDayIndex: number;
  driverPeakEnergyDisplayDate: string;
  maxPeakAfterInWindowKw: number;
  totalBreachIntervalsInWindow: number;
  socFloorHitsInWindow: number;
  minSocObservedPct: number;
}

function evaluateAutoSizeCandidate(
  evalDays: LoadedDayProfile[],
  testParams: SimulationParams,
  desiredMaxDemandKw: number,
  timeConvention: TimeConvention
): {
  passes: boolean;
  maxPeakAfterInWindowKw: number;
  totalBreachIntervalsInWindow: number;
  socFloorHitsInWindow: number;
  minSocObservedPct: number;
} {
  const results = runMultiDaySimulation(evalDays, testParams, timeConvention);
  const safeSocMin = Math.min(testParams.socMinPct, testParams.socMaxPct - 1);
  const eMin = Math.max(0, testParams.bessCapacityKwh) * (safeSocMin / 100);

  let maxPeakAfterInWindowKw = -Infinity;
  let totalBreachIntervalsInWindow = 0;
  let socFloorHitsInWindow = 0;
  let minSocObservedPct = Infinity;
  let floorViolation = false;

  for (const res of results) {
    if (res.output.summary.minSocPct < minSocObservedPct) {
      minSocObservedPct = res.output.summary.minSocPct;
    }
    for (const row of res.output.intervals) {
      if (!row.inPeakPeriod) continue;
      if (row.netAfterKw > maxPeakAfterInWindowKw) {
        maxPeakAfterInWindowKw = row.netAfterKw;
      }
      if (row.netAfterKw > desiredMaxDemandKw + 0.05) {
        totalBreachIntervalsInWindow++;
      }
      if (row.socFloorHit) {
        socFloorHitsInWindow++;
      }
      if (testParams.bessCapacityKwh > 0 && row.energyEndKwh <= eMin + 0.02 && row.bessKw < -EPS) {
        floorViolation = true;
      }
    }
  }

  const passes =
    totalBreachIntervalsInWindow === 0 && socFloorHitsInWindow === 0 && !floorViolation;

  return {
    passes,
    maxPeakAfterInWindowKw: maxPeakAfterInWindowKw === -Infinity ? 0 : maxPeakAfterInWindowKw,
    totalBreachIntervalsInWindow,
    socFloorHitsInWindow,
    minSocObservedPct: minSocObservedPct === Infinity ? testParams.initialSocPct : minSocObservedPct,
  };
}

export function autoSizeBessSystem(req: AutoSizeRequest): AutoSizeResult {
  const safeDays = req.days.length > 0 ? req.days : [DEFAULT_BENCHMARK_DAY];
  const safeActiveIdx = Math.max(0, Math.min(safeDays.length - 1, req.activeDayIndex));
  const evalDays = req.scope === 'active_day' ? [safeDays[safeActiveIdx]] : safeDays;
  const indexOffset = req.scope === 'active_day' ? safeActiveIdx : 0;

  const etaRt = Math.min(0.999, Math.max(0.5, req.baseParams.roundTripEfficiencyPct / 100));
  const etaD = Math.sqrt(etaRt);
  const safeSocMin = Math.min(req.baseParams.socMinPct, req.baseParams.socMaxPct - 1);
  const safeSocMax = Math.max(req.baseParams.socMaxPct, safeSocMin + 1);
  const usableSocFraction = Math.max(0.01, (safeSocMax - safeSocMin) / 100);

  const loadScale = req.baseParams.loadScalePct / 100;
  const pvScale = req.baseParams.solarPeakKw * (req.baseParams.irradiancePct / 100);
  const peakPeriodIntervalsPerDay = countIntervalsInPeakWindow(
    req.peakStartMinutes,
    req.peakEndMinutes
  );

  let rawRequiredPowerKw = 0;
  let driverDayLocalIdx = 0;
  let driverIntervalIndex = 0;
  let driverPeakBeforeKw = -Infinity;

  let maxSingleDayAcShaveKwh = 0;
  let driverPeakEnergyLocalIdx = 0;

  for (let d = 0; d < evalDays.length; d++) {
    const day = evalDays[d];
    let dayAcShaveKwh = 0;

    for (let idx = 0; idx < INTERVALS_PER_DAY; idx++) {
      if (!isIntervalInPeakWindow(idx, req.peakStartMinutes, req.peakEndMinutes)) continue;

      const pvSlot = req.timeConvention === 'end_time' ? idx + 1 : idx;
      const pvFraction =
        pvSlot >= 0 && pvSlot < INTERVALS_PER_DAY
          ? (req.baseParams.basePvNormalized[pvSlot] ?? 0)
          : 0;
      const loadKw = Math.max(0, (day.loadKw[idx] ?? 0) * loadScale);
      const pvKw = Math.max(0, pvFraction * pvScale);
      const netBeforeKw = loadKw - pvKw;

      if (netBeforeKw > driverPeakBeforeKw) {
        driverPeakBeforeKw = netBeforeKw;
      }

      const shaveKw = Math.max(0, netBeforeKw - req.desiredMaxDemandKw);
      if (shaveKw > rawRequiredPowerKw) {
        rawRequiredPowerKw = shaveKw;
        driverDayLocalIdx = d;
        driverIntervalIndex = idx;
      }
      dayAcShaveKwh += shaveKw * DT_HOURS;
    }

    if (dayAcShaveKwh > maxSingleDayAcShaveKwh) {
      maxSingleDayAcShaveKwh = dayAcShaveKwh;
      driverPeakEnergyLocalIdx = d;
    }
  }

  const singleDayEnergyCapacityKwh =
    maxSingleDayAcShaveKwh > 0 ? maxSingleDayAcShaveKwh / (etaD * usableSocFraction) : 0;

  const driverDayIndex = indexOffset + driverDayLocalIdx;
  const driverPeakEnergyDayIndex = indexOffset + driverPeakEnergyLocalIdx;
  const driverDisplayDate = safeDays[driverDayIndex]?.displayDate ?? safeDays[0].displayDate;
  const driverPeakEnergyDisplayDate =
    safeDays[driverPeakEnergyDayIndex]?.displayDate ?? safeDays[0].displayDate;

  if (rawRequiredPowerKw <= 1e-3 || peakPeriodIntervalsPerDay === 0) {
    const baselineEval = evaluateAutoSizeCandidate(
      evalDays,
      {
        ...req.baseParams,
        targetCapKw: req.desiredMaxDemandKw,
        bessPowerKw: 0,
        bessCapacityKwh: 0,
        peakStartMinutes: req.peakStartMinutes,
        peakEndMinutes: req.peakEndMinutes,
        offPeakChargeToTransformer: req.offPeakChargeToTransformer,
      },
      req.desiredMaxDemandKw,
      req.timeConvention
    );

    return {
      recommendedPowerKw: 0,
      recommendedCapacityKwh: 0,
      usableCapacityKwh: 0,
      rawRequiredPowerKw: 0,
      singleDayEnergyCapacityKwh: 0,
      evaluatedDaysCount: evalDays.length,
      peakPeriodIntervalsPerDay,
      feasible: true,
      alreadyCompliant: true,
      issueReason: null,
      suggestOffPeakRecharge: false,
      driverDayIndex,
      driverDisplayDate,
      driverIntervalIndex,
      driverPeakBeforeKw: driverPeakBeforeKw === -Infinity ? 0 : driverPeakBeforeKw,
      driverPeakEnergyDayIndex,
      driverPeakEnergyDisplayDate,
      maxPeakAfterInWindowKw: baselineEval.maxPeakAfterInWindowKw,
      totalBreachIntervalsInWindow: baselineEval.totalBreachIntervalsInWindow,
      socFloorHitsInWindow: baselineEval.socFloorHitsInWindow,
      minSocObservedPct: baselineEval.minSocObservedPct,
    };
  }

  const recommendedPowerKw = Math.max(5, Math.ceil(rawRequiredPowerKw / 5) * 5);

  const baseTestParams: SimulationParams = {
    ...req.baseParams,
    targetCapKw: req.desiredMaxDemandKw,
    bessPowerKw: recommendedPowerKw,
    peakStartMinutes: req.peakStartMinutes,
    peakEndMinutes: req.peakEndMinutes,
    offPeakChargeToTransformer: req.offPeakChargeToTransformer,
  };

  const upperBoundKwh = Math.max(
    500,
    Math.ceil((singleDayEnergyCapacityKwh * 6) / 10) * 10
  );
  const highEval = evaluateAutoSizeCandidate(
    evalDays,
    { ...baseTestParams, bessCapacityKwh: upperBoundKwh },
    req.desiredMaxDemandKw,
    req.timeConvention
  );

  if (highEval.passes) {
    let lo = Math.min(upperBoundKwh, Math.max(10, singleDayEnergyCapacityKwh * 0.5));
    let hi = upperBoundKwh;

    for (let iter = 0; iter < 36; iter++) {
      const mid = (lo + hi) / 2;
      const midEval = evaluateAutoSizeCandidate(
        evalDays,
        { ...baseTestParams, bessCapacityKwh: mid },
        req.desiredMaxDemandKw,
        req.timeConvention
      );
      if (midEval.passes) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    let recommendedCapacityKwh = Math.max(10, Math.ceil(hi / 10) * 10);
    let finalEval = evaluateAutoSizeCandidate(
      evalDays,
      { ...baseTestParams, bessCapacityKwh: recommendedCapacityKwh },
      req.desiredMaxDemandKw,
      req.timeConvention
    );

    if (!finalEval.passes) {
      recommendedCapacityKwh += 10;
      finalEval = evaluateAutoSizeCandidate(
        evalDays,
        { ...baseTestParams, bessCapacityKwh: recommendedCapacityKwh },
        req.desiredMaxDemandKw,
        req.timeConvention
      );
    }

    return {
      recommendedPowerKw,
      recommendedCapacityKwh,
      usableCapacityKwh: recommendedCapacityKwh * usableSocFraction,
      rawRequiredPowerKw,
      singleDayEnergyCapacityKwh,
      evaluatedDaysCount: evalDays.length,
      peakPeriodIntervalsPerDay,
      feasible: finalEval.passes,
      alreadyCompliant: false,
      issueReason: null,
      suggestOffPeakRecharge: false,
      driverDayIndex,
      driverDisplayDate,
      driverIntervalIndex,
      driverPeakBeforeKw: driverPeakBeforeKw === -Infinity ? 0 : driverPeakBeforeKw,
      driverPeakEnergyDayIndex,
      driverPeakEnergyDisplayDate,
      maxPeakAfterInWindowKw: finalEval.maxPeakAfterInWindowKw,
      totalBreachIntervalsInWindow: finalEval.totalBreachIntervalsInWindow,
      socFloorHitsInWindow: finalEval.socFloorHitsInWindow,
      minSocObservedPct: finalEval.minSocObservedPct,
    };
  }

  // Multi-day feasibility failed even at upperBoundKwh: diagnose why and return single-day baseline
  const fallbackCapacityKwh = Math.max(50, Math.ceil(singleDayEnergyCapacityKwh / 10) * 10);
  const fallbackEval = evaluateAutoSizeCandidate(
    evalDays,
    { ...baseTestParams, bessCapacityKwh: fallbackCapacityKwh },
    req.desiredMaxDemandKw,
    req.timeConvention
  );

  let suggestOffPeakRecharge = false;
  if (
    !req.offPeakChargeToTransformer &&
    !isFullDayPeakWindow(req.peakStartMinutes, req.peakEndMinutes)
  ) {
    const withOffPeakRecharge = evaluateAutoSizeCandidate(
      evalDays,
      {
        ...baseTestParams,
        bessCapacityKwh: upperBoundKwh,
        offPeakChargeToTransformer: true,
      },
      req.desiredMaxDemandKw,
      req.timeConvention
    );
    if (withOffPeakRecharge.passes) {
      suggestOffPeakRecharge = true;
    }
  }

  let issueReason =
    'Insufficient recharge headroom between consecutive peak periods under current dispatch settings.';
  if (req.baseParams.initialSocPct <= safeSocMin + 0.5) {
    issueReason =
      'Initial SOC (00:00) is at SOC Floor; increase Initial SOC or allow recharge prior to peak.';
  } else if (suggestOffPeakRecharge) {
    issueReason =
      'Off-peak recharge below Desired Max Demand is insufficient across days. Enable TX Limit off-peak charging in Settings, or raise Cap / PV Peak.';
  } else if (req.baseParams.chargingStrategy === 'excess_solar') {
    issueReason =
      'Excess PV alone cannot recharge daily peak discharge across days. Switch Dispatch Mode to Cap-Aware.';
  }

  return {
    recommendedPowerKw,
    recommendedCapacityKwh: fallbackCapacityKwh,
    usableCapacityKwh: fallbackCapacityKwh * usableSocFraction,
    rawRequiredPowerKw,
    singleDayEnergyCapacityKwh,
    evaluatedDaysCount: evalDays.length,
    peakPeriodIntervalsPerDay,
    feasible: false,
    alreadyCompliant: false,
    issueReason,
    suggestOffPeakRecharge,
    driverDayIndex,
    driverDisplayDate,
    driverIntervalIndex,
    driverPeakBeforeKw: driverPeakBeforeKw === -Infinity ? 0 : driverPeakBeforeKw,
    driverPeakEnergyDayIndex,
    driverPeakEnergyDisplayDate,
    maxPeakAfterInWindowKw: fallbackEval.maxPeakAfterInWindowKw,
    totalBreachIntervalsInWindow: fallbackEval.totalBreachIntervalsInWindow,
    socFloorHitsInWindow: fallbackEval.socFloorHitsInWindow,
    minSocObservedPct: fallbackEval.minSocObservedPct,
  };
}

export type PrimaryParamKey =
  | 'targetCapKw'
  | 'transformerLimitKw'
  | 'solarPeakKw'
  | 'bessCapacityKwh'
  | 'bessPowerKw';

export type SliderLocks = Record<PrimaryParamKey, boolean>;

export interface SliderRange {
  min: number;
  max: number;
}

export type SliderBoundsMap = Record<PrimaryParamKey, SliderRange>;

export const DEFAULT_SLIDER_LOCKS: SliderLocks = {
  targetCapKw: false,
  transformerLimitKw: false,
  solarPeakKw: false,
  bessCapacityKwh: false,
  bessPowerKw: false,
};

export type DynamicRecalcTrigger =
  | 'dataset_or_scope'
  | 'mode_or_secondary'
  | PrimaryParamKey
  | `unlock_${PrimaryParamKey}`;

export interface RequiredPvRequest {
  days: LoadedDayProfile[];
  baseParams: SimulationParams;
  desiredMaxDemandKw: number;
  peakStartMinutes: number;
  peakEndMinutes: number;
  scope: AutoSizeScope;
  activeDayIndex: number;
  timeConvention: TimeConvention;
}

export interface RequiredPvResult {
  rawRequiredPvKw: number;
  roundedPvKw: number;
}

/**
 * Maximum facility load (kW) across the active dataset (all days or active day),
 * scaled by loadScalePct and rounded up to the nearest multiple of 100 kW.
 */
export function computeMaxFacilityLoadCeilingKw(
  days: LoadedDayProfile[],
  scope: AutoSizeScope,
  activeDayIndex: number,
  loadScalePct: number
): number {
  const safeDays = days.length > 0 ? days : [DEFAULT_BENCHMARK_DAY];
  const safeActiveIdx = Math.max(0, Math.min(safeDays.length - 1, activeDayIndex));
  const evalDays = scope === 'active_day' ? [safeDays[safeActiveIdx]] : safeDays;
  const loadScale = Math.max(0.01, loadScalePct / 100);

  let maxLoadKw = 0;
  for (const day of evalDays) {
    for (let i = 0; i < INTERVALS_PER_DAY; i++) {
      const val = Math.max(0, (day.loadKw[i] ?? 0) * loadScale);
      if (val > maxLoadKw) maxLoadKw = val;
    }
  }

  return Math.max(100, Math.ceil(maxLoadKw / 100) * 100);
}

/**
 * Calculates P_PV,req (kW) needed to achieve desiredMaxDemandKw solely from
 * surplus PV generation (when PV > facility load) charging the battery,
 * assuming battery charging is sourced strictly from surplus PV (no grid charging).
 * Rounds P_PV,req to the nearest multiple of 100 kW (P_PV,round).
 */
export function calculateRequiredPvPeakKw(req: RequiredPvRequest): RequiredPvResult {
  const safeDays = req.days.length > 0 ? req.days : [DEFAULT_BENCHMARK_DAY];
  const safeActiveIdx = Math.max(0, Math.min(safeDays.length - 1, req.activeDayIndex));
  const evalDays = req.scope === 'active_day' ? [safeDays[safeActiveIdx]] : safeDays;

  const etaRt = Math.min(0.999, Math.max(0.5, req.baseParams.roundTripEfficiencyPct / 100));
  const etaC = Math.sqrt(etaRt);
  const etaD = Math.sqrt(etaRt);
  const loadScale = Math.max(0.01, req.baseParams.loadScalePct / 100);
  const irradianceScale = Math.max(0, req.baseParams.irradiancePct / 100);

  let maxPvFrac = 0;
  for (let i = 0; i < INTERVALS_PER_DAY; i++) {
    const f = req.baseParams.basePvNormalized[i] ?? 0;
    if (f > maxPvFrac) maxPvFrac = f;
  }

  if (irradianceScale <= 1e-6 || maxPvFrac <= 1e-6) {
    return { rawRequiredPvKw: 0, roundedPvKw: 0 };
  }

  let maxLoadKw = 0;
  const checkPvFeasible = (pvPeakKw: number): boolean => {
    const pvScale = pvPeakKw * irradianceScale;
    for (const day of evalDays) {
      let surplusDcKwh = 0;
      let needDcKwh = 0;
      for (let idx = 0; idx < INTERVALS_PER_DAY; idx++) {
        const pvSlot = req.timeConvention === 'end_time' ? idx + 1 : idx;
        const pvFraction =
          pvSlot >= 0 && pvSlot < INTERVALS_PER_DAY
            ? (req.baseParams.basePvNormalized[pvSlot] ?? 0)
            : 0;
        const loadKw = Math.max(0, (day.loadKw[idx] ?? 0) * loadScale);
        if (loadKw > maxLoadKw) maxLoadKw = loadKw;
        const pvKw = Math.max(0, pvFraction * pvScale);

        if (pvKw > loadKw + EPS) {
          surplusDcKwh += (pvKw - loadKw) * DT_HOURS * etaC;
        }
        if (isIntervalInPeakWindow(idx, req.peakStartMinutes, req.peakEndMinutes)) {
          const netBeforeKw = loadKw - pvKw;
          if (netBeforeKw > req.desiredMaxDemandKw + EPS) {
            needDcKwh += ((netBeforeKw - req.desiredMaxDemandKw) * DT_HOURS) / etaD;
          }
        }
      }
      if (surplusDcKwh + 1e-6 < needDcKwh) {
        return false;
      }
    }
    return true;
  };

  // Already compliant with 0 kW PV
  if (checkPvFeasible(0)) {
    return { rawRequiredPvKw: 0, roundedPvKw: 0 };
  }

  let lo = 0;
  let hi = Math.max(1000, maxLoadKw * 5);
  while (!checkPvFeasible(hi) && hi < 1e7) {
    hi *= 2;
  }

  for (let iter = 0; iter < 42; iter++) {
    const mid = (lo + hi) / 2;
    if (checkPvFeasible(mid)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const rawRequiredPvKw = hi;
  const roundedPvKw =
    rawRequiredPvKw <= 1e-3 ? 0 : Math.max(100, Math.round(rawRequiredPvKw / 100) * 100);

  return { rawRequiredPvKw, roundedPvKw };
}

export function getDefaultPvForStrategy(
  roundedPvKw: number,
  strategy: ChargingStrategy
): number {
  if (roundedPvKw <= 0) return 0;
  return strategy === 'excess_solar'
    ? roundedPvKw
    : Math.round(0.5 * roundedPvKw);
}

export interface ReconcileDynamicStateInput {
  days: LoadedDayProfile[];
  params: SimulationParams;
  locks: SliderLocks;
  previousBounds?: SliderBoundsMap;
  previousMCeilKw?: number;
  scope: AutoSizeScope;
  activeDayIndex: number;
  timeConvention: TimeConvention;
  trigger: DynamicRecalcTrigger;
}

export interface ReconcileDynamicStateResult {
  params: SimulationParams;
  bounds: SliderBoundsMap;
  mCeilKw: number;
  requiredPv: RequiredPvResult;
  autoSize: AutoSizeResult;
}

export function reconcileDynamicSimulationState(
  input: ReconcileDynamicStateInput
): ReconcileDynamicStateResult {
  const {
    days,
    params,
    locks,
    previousBounds,
    previousMCeilKw,
    scope,
    activeDayIndex,
    timeConvention,
    trigger,
  } = input;

  const mCeilKw = computeMaxFacilityLoadCeilingKw(
    days,
    scope,
    activeDayIndex,
    params.loadScalePct
  );
  const mCeilChanged = previousMCeilKw === undefined || previousMCeilKw !== mCeilKw;

  const nextParams: SimulationParams = { ...params };
  const targetDefault = Math.round(0.8 * mCeilKw);
  const targetBounds: SliderRange = {
    min: Math.round(0.1 * mCeilKw),
    max: mCeilKw,
  };
  const txDefault = Math.round(1.5 * mCeilKw);
  const txBounds: SliderRange = {
    min: Math.round(0.1 * mCeilKw),
    max: 2 * mCeilKw,
  };

  // 1. Desired Max Demand
  const shouldSetTargetDefault =
    trigger === 'dataset_or_scope' ||
    trigger === 'unlock_targetCapKw' ||
    (trigger === 'mode_or_secondary' && mCeilChanged);
  if (!locks.targetCapKw && shouldSetTargetDefault) {
    nextParams.targetCapKw = targetDefault;
  }

  // 2. Transformer Limit
  const shouldSetTxDefault =
    trigger === 'dataset_or_scope' ||
    trigger === 'unlock_transformerLimitKw' ||
    (trigger === 'mode_or_secondary' && mCeilChanged);
  if (!locks.transformerLimitKw && shouldSetTxDefault) {
    nextParams.transformerLimitKw = txDefault;
  }

  // 3. Required PV Peak (P_PV,req -> P_PV,round) & PV Array Peak
  const requiredPv = calculateRequiredPvPeakKw({
    days,
    baseParams: nextParams,
    desiredMaxDemandKw: nextParams.targetCapKw,
    peakStartMinutes: nextParams.peakStartMinutes,
    peakEndMinutes: nextParams.peakEndMinutes,
    scope,
    activeDayIndex,
    timeConvention,
  });

  const pvBounds: SliderRange = {
    min: 0,
    max: Math.round(1.5 * requiredPv.roundedPvKw),
  };

  const shouldSetPvDefault =
    trigger === 'dataset_or_scope' ||
    trigger === 'mode_or_secondary' ||
    trigger === 'targetCapKw' ||
    trigger === 'unlock_targetCapKw' ||
    trigger === 'unlock_solarPeakKw';

  if (!locks.solarPeakKw && shouldSetPvDefault) {
    nextParams.solarPeakKw = getDefaultPvForStrategy(
      requiredPv.roundedPvKw,
      nextParams.chargingStrategy
    );
  }

  // 4 & 5. Auto-Size BESS Capacity & Inverter Rating
  const autoSize = autoSizeBessSystem({
    days,
    baseParams: nextParams,
    desiredMaxDemandKw: nextParams.targetCapKw,
    peakStartMinutes: nextParams.peakStartMinutes,
    peakEndMinutes: nextParams.peakEndMinutes,
    scope,
    activeDayIndex,
    offPeakChargeToTransformer: nextParams.offPeakChargeToTransformer,
    timeConvention,
  });

  const capBounds: SliderRange = {
    min: 0,
    max: Math.round(1.5 * autoSize.recommendedCapacityKwh),
  };
  const pwrBounds: SliderRange = {
    min: Math.round(0.1 * autoSize.recommendedPowerKw),
    max: Math.round(1.5 * autoSize.recommendedPowerKw),
  };

  const isEditingCapacityOnly = trigger === 'bessCapacityKwh';
  const isEditingPowerOnly = trigger === 'bessPowerKw';

  if (
    !locks.bessCapacityKwh &&
    !isEditingCapacityOnly &&
    !isEditingPowerOnly
  ) {
    nextParams.bessCapacityKwh = autoSize.recommendedCapacityKwh;
  } else if (!locks.bessCapacityKwh && trigger === 'unlock_bessCapacityKwh') {
    nextParams.bessCapacityKwh = autoSize.recommendedCapacityKwh;
  }

  if (
    !locks.bessPowerKw &&
    !isEditingPowerOnly &&
    !isEditingCapacityOnly
  ) {
    nextParams.bessPowerKw = autoSize.recommendedPowerKw;
  } else if (!locks.bessPowerKw && trigger === 'unlock_bessPowerKw') {
    nextParams.bessPowerKw = autoSize.recommendedPowerKw;
  }

  // Preserve exact slider bounds for locked parameters so their slider thumb position never shifts
  const bounds: SliderBoundsMap = {
    targetCapKw:
      locks.targetCapKw && previousBounds
        ? previousBounds.targetCapKw
        : targetBounds,
    transformerLimitKw:
      locks.transformerLimitKw && previousBounds
        ? previousBounds.transformerLimitKw
        : txBounds,
    solarPeakKw:
      locks.solarPeakKw && previousBounds
        ? previousBounds.solarPeakKw
        : pvBounds,
    bessCapacityKwh:
      locks.bessCapacityKwh && previousBounds
        ? previousBounds.bessCapacityKwh
        : capBounds,
    bessPowerKw:
      locks.bessPowerKw && previousBounds
        ? previousBounds.bessPowerKw
        : pwrBounds,
  };

  return {
    params: nextParams,
    bounds,
    mCeilKw,
    requiredPv,
    autoSize,
  };
}

export interface DatasetSimulationSummary {
  evaluatedDaysCount: number;
  totalBreachIntervals: number;
  totalBreachHours: number;
  breachDaysCount: number;
  minSocObservedPct: number;
  maxPeakAfterKw: number;
  worstDayIndex: number;
  worstDayDisplayDate: string;
  worstIntervalIndex: number;
  socFloorHitsInWindow: number;
}

export function summarizeDatasetSimulation(
  dayResults: DaySimulationResult[],
  params: SimulationParams,
  scope: AutoSizeScope,
  activeDayIndex: number
): DatasetSimulationSummary {
  if (dayResults.length === 0) {
    return {
      evaluatedDaysCount: 0,
      totalBreachIntervals: 0,
      totalBreachHours: 0,
      breachDaysCount: 0,
      minSocObservedPct: params.bessCapacityKwh > 0 ? params.initialSocPct : 0,
      maxPeakAfterKw: 0,
      worstDayIndex: 0,
      worstDayDisplayDate: DEFAULT_BENCHMARK_DAY.displayDate,
      worstIntervalIndex: 0,
      socFloorHitsInWindow: 0,
    };
  }

  const safeActiveIdx = Math.max(0, Math.min(dayResults.length - 1, activeDayIndex));
  const evalIndices =
    scope === 'active_day' ? [safeActiveIdx] : dayResults.map((_, idx) => idx);

  let totalBreachIntervals = 0;
  let breachDaysCount = 0;
  let minSocObservedPct = Infinity;
  let maxPeakAfterKw = -Infinity;
  let worstDayIndex = evalIndices[0];
  let worstDayDisplayDate = dayResults[worstDayIndex].displayDate;
  let worstIntervalIndex = 0;
  let socFloorHitsInWindow = 0;

  for (const idx of evalIndices) {
    const res = dayResults[idx];
    const s = res.output.summary;
    const dayBreachIntervals = s.isPeakWindowActive
      ? s.intervalsAboveCapInWindow
      : s.intervalsAboveCapAfter;

    totalBreachIntervals += dayBreachIntervals;
    if (dayBreachIntervals > 0) {
      breachDaysCount++;
    }
    if (s.minSocPct < minSocObservedPct) {
      minSocObservedPct = s.minSocPct;
    }

    const peakAfter = s.isPeakWindowActive ? s.peakWindowAfterKw : s.peakAfterKw;
    const peakAfterInterval = s.isPeakWindowActive
      ? s.peakWindowAfterInterval
      : s.peakAfterInterval;
    if (peakAfter > maxPeakAfterKw) {
      maxPeakAfterKw = peakAfter;
      worstDayIndex = idx;
      worstDayDisplayDate = res.displayDate;
      worstIntervalIndex = peakAfterInterval;
    }

    for (const row of res.output.intervals) {
      if (row.inPeakPeriod && row.socFloorHit) {
        socFloorHitsInWindow++;
      }
    }
  }

  return {
    evaluatedDaysCount: evalIndices.length,
    totalBreachIntervals,
    totalBreachHours: totalBreachIntervals * DT_HOURS,
    breachDaysCount,
    minSocObservedPct:
      minSocObservedPct === Infinity
        ? params.bessCapacityKwh > 0
          ? params.initialSocPct
          : 0
        : minSocObservedPct,
    maxPeakAfterKw: maxPeakAfterKw === -Infinity ? 0 : maxPeakAfterKw,
    worstDayIndex,
    worstDayDisplayDate,
    worstIntervalIndex,
    socFloorHitsInWindow,
  };
}



