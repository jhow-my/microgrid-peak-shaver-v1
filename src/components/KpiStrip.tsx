import {
  SimulationParams,
  SimulationSummary,
  TimeConvention,
  formatIntervalLabel,
  formatPeakWindowRange,
} from '../simulation/bessEngine';

interface KpiStripProps {
  summary: SimulationSummary;
  params: SimulationParams;
  activeDateLabel: string;
  timeConvention: TimeConvention;
}

export function KpiStrip({ summary, params, activeDateLabel, timeConvention }: KpiStripProps) {
  const isWindowed = summary.isPeakWindowActive;
  const windowLabel = formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes);

  const displayedBeforeKw = isWindowed ? summary.peakWindowBeforeKw : summary.peakBeforeKw;
  const displayedAfterKw = isWindowed ? summary.peakWindowAfterKw : summary.peakAfterKw;
  const displayedAfterInterval = isWindowed
    ? summary.peakWindowAfterInterval
    : summary.peakAfterInterval;
  const displayedReductionKw = isWindowed
    ? summary.peakWindowReductionKw
    : summary.peakReductionKw;
  const displayedReductionPct = isWindowed
    ? summary.peakWindowReductionPct
    : summary.peakReductionPct;

  const intervalsChecked = isWindowed ? summary.peakWindowIntervals : 48;
  const intervalsAboveCap = isWindowed
    ? summary.intervalsAboveCapInWindow
    : summary.intervalsAboveCapAfter;
  const hoursAboveCapAfter = isWindowed
    ? summary.hoursAboveCapInWindow
    : summary.hoursAboveCapAfter;
  const hoursAboveCapBefore = isWindowed
    ? summary.hoursAboveCapBeforeInWindow
    : summary.hoursAboveCapBefore;
  const capMet = intervalsAboveCap === 0;

  return (
    <section
      aria-label="Simulation summary metrics"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] divide-y sm:divide-y-0 sm:divide-x divide-[rgba(17,17,19,0.12)] dark:divide-[rgba(242,239,235,0.12)] bg-[#f6f5f2] dark:bg-[#111113]"
    >
      {/* KPI 1: Peak Net Import */}
      <div className="px-3.5 py-1.5 flex flex-col justify-between gap-0.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.08em] leading-tight text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] truncate">
          {isWindowed ? `Peak Net (${windowLabel})` : 'Peak Net Import'} · {activeDateLabel}
        </div>
        <div className="flex items-baseline gap-1.5 font-mono tabular-nums leading-tight">
          <span className="text-[11px] text-[rgba(17,17,19,0.45)] dark:text-[rgba(242,239,235,0.4)] line-through">
            {displayedBeforeKw.toFixed(1)}
          </span>
          <span className="text-base xl:text-[17px] font-bold text-[#111113] dark:text-[#f2efeb]">
            {displayedAfterKw.toFixed(1)}
          </span>
          <span className="text-[10px] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)]">kW</span>
        </div>
        <div className="font-mono tabular-nums text-[9px] uppercase tracking-[0.05em] leading-tight text-[#e04400] dark:text-[#ff4d00] truncate">
          −{displayedReductionKw.toFixed(1)} kW (−{displayedReductionPct.toFixed(1)}%) @{' '}
          {formatIntervalLabel(displayedAfterInterval, timeConvention)}
        </div>
      </div>

      {/* KPI 2: Cap Compliance */}
      <div className="px-3.5 py-1.5 flex flex-col justify-between gap-0.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.08em] leading-tight text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] truncate">
          {isWindowed ? `Cap Compliance (${windowLabel})` : 'Cap Compliance'}
        </div>
        <div className="flex items-baseline gap-1.5 font-mono tabular-nums leading-tight">
          <span className="text-base xl:text-[17px] font-bold text-[#111113] dark:text-[#f2efeb]">
            {params.targetCapKw.toFixed(0)}
          </span>
          <span className="text-[10px] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)]">kW cap</span>
        </div>
        <div
          className={`font-mono tabular-nums text-[9px] uppercase tracking-[0.05em] leading-tight truncate ${
            capMet ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          {capMet
            ? `● Held ${intervalsChecked} int (was ${hoursAboveCapBefore.toFixed(1)}h over)`
            : `▲ ${hoursAboveCapAfter.toFixed(1)}h Above Cap (was ${hoursAboveCapBefore.toFixed(1)}h)`}
        </div>
      </div>

      {/* KPI 3: SOC Excursion */}
      <div className="px-3.5 py-1.5 flex flex-col justify-between gap-0.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.08em] leading-tight text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] truncate">
          SOC Excursion
        </div>
        <div className="flex items-baseline gap-1 font-mono tabular-nums leading-tight">
          <span className="text-base xl:text-[17px] font-bold text-[#111113] dark:text-[#f2efeb]">
            {summary.minSocPct.toFixed(1)}%
          </span>
          <span className="text-[11px] text-[rgba(17,17,19,0.45)] dark:text-[rgba(242,239,235,0.4)]">—</span>
          <span className="text-sm font-bold text-[rgba(17,17,19,0.85)] dark:text-[rgba(242,239,235,0.85)]">
            {summary.maxSocPct.toFixed(1)}%
          </span>
        </div>
        <div className="font-mono tabular-nums text-[9px] uppercase tracking-[0.05em] leading-tight text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] truncate">
          {summary.socFloorHitInterval !== null
            ? `▼ ${summary.eMinKwh.toFixed(0)} kWh floor @ ${formatIntervalLabel(summary.socFloorHitInterval, timeConvention)}`
            : `Min ${summary.minSocKwh.toFixed(0)} kWh @ ${formatIntervalLabel(summary.minSocInterval ?? 0, timeConvention)}`}
        </div>
      </div>

      {/* KPI 4: Demand Savings */}
      <div className="px-3.5 py-1.5 flex flex-col justify-between gap-0.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.08em] leading-tight text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] truncate">
          Demand Savings
        </div>
        <div className="flex items-baseline gap-1 font-mono tabular-nums leading-tight">
          <span className="text-base xl:text-[17px] font-bold text-[#111113] dark:text-[#f2efeb]">
            ${summary.monthlyDemandSavingsUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[10px] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)]">/ MO</span>
        </div>
        <div className="font-mono tabular-nums text-[9px] uppercase tracking-[0.05em] leading-tight text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] truncate">
          PV {summary.totalPvKwh.toFixed(0)} · Disch {summary.totalBessDischargedKwh.toFixed(1)} kWh
        </div>
      </div>
    </section>
  );
}
