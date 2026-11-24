import {
  DT_HOURS,
  IntervalResult,
  SimulationParams,
  SimulationSummary,
  TimeConvention,
  formatIntervalLabel,
  formatPeakWindowRange,
} from '../simulation/bessEngine';

interface ProfileTunerAndEquationsProps {
  mode?: 'both' | 'tuner' | 'equations';
  params: SimulationParams;
  activeDayLoadKw: number[];
  activeDateLabel: string;
  timeConvention: TimeConvention;
  intervalData: IntervalResult;
  summary: SimulationSummary;
  selectedInterval: number;
  onSelectInterval: (interval: number) => void;
  onUpdateIntervalLoad: (interval: number, loadKw: number) => void;
  onResetProfile: () => void;
}

export function ProfileTunerAndEquations({
  mode = 'both',
  params,
  activeDayLoadKw,
  activeDateLabel,
  timeConvention,
  intervalData,
  summary,
  selectedInterval,
  onSelectInterval,
  onUpdateIntervalLoad,
  onResetProfile,
}: ProfileTunerAndEquationsProps) {
  const baseLoadAtInterval = activeDayLoadKw[selectedInterval] ?? 0;
  const maxDayLoad = Math.max(1300, ...activeDayLoadKw);
  const barCeiling = Math.ceil(maxDayLoad / 100) * 100;

  return (
    <section
      aria-label="30-minute load editor and governing equations"
      className={
        mode === 'both'
          ? 'grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-[rgba(17,17,19,0.12)] dark:divide-[rgba(242,239,235,0.12)]'
          : 'w-full'
      }
    >
      {/* Interactive 48-Interval (30-Min) Load Curve Editor */}
      {(mode === 'both' || mode === 'tuner') && (
        <div id="load-editor" className="p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#111113] dark:text-[#f2efeb] font-bold">
                30-Minute Load Curve Editor · {activeDateLabel}
              </h2>
              <p className="text-xs text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] mt-0.5">
                Click any 30-min interval bar (48 slots) to select and fine-tune its base kW demand
              </p>
            </div>
            <button
              type="button"
              onClick={onResetProfile}
              className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[#ff4d00] text-[#111113] dark:text-[#f2efeb] hover:text-[#f2efeb] transition-colors cursor-pointer shrink-0"
            >
              Restore Curve
            </button>
          </div>

          {/* Interactive 48-Bar Selector */}
          <div className="h-44 flex items-end gap-[2px] pt-4 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] pb-2">
            {activeDayLoadKw.map((val, idx) => {
              const heightPct = Math.max(6, Math.min(100, (val / barCeiling) * 100));
              const isSelected = idx === selectedInterval;
              const slotLabel = formatIntervalLabel(idx, timeConvention);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectInterval(idx)}
                  title={`${slotLabel}: ${val.toFixed(1)} kW base load`}
                  aria-label={`Select interval ${slotLabel}, base load ${val.toFixed(1)} kW`}
                  className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer focus-visible:outline-none"
                >
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full transition-colors ${
                      isSelected
                        ? 'bg-[#ff4d00]'
                        : 'bg-[rgba(17,17,19,0.2)] dark:bg-[rgba(242,239,235,0.22)] group-hover:bg-[rgba(17,17,19,0.45)] dark:group-hover:bg-[rgba(242,239,235,0.5)]'
                    }`}
                  />
                </button>
              );
            })}
          </div>
          <div className="flex justify-between font-mono tabular-nums text-[10px] text-[rgba(17,17,19,0.55)] dark:text-[rgba(242,239,235,0.5)] -mt-2">
            <span>{formatIntervalLabel(0, timeConvention)}</span>
            <span>{formatIntervalLabel(12, timeConvention)}</span>
            <span>{formatIntervalLabel(24, timeConvention)}</span>
            <span>{formatIntervalLabel(36, timeConvention)}</span>
            <span>{formatIntervalLabel(47, timeConvention)}</span>
          </div>

          {/* Selected Interval Fine Slider */}
          <div className="pt-2 space-y-2">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="interval-load-edit"
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.65)]"
              >
                Base Load at {formatIntervalLabel(selectedInterval, timeConvention)} (before {params.loadScalePct}% scale)
              </label>
              <span className="font-mono tabular-nums text-xs font-bold text-[#111113] dark:text-[#f2efeb]">
                {baseLoadAtInterval.toFixed(1)} kW
              </span>
            </div>
            <input
              id="interval-load-edit"
              type="range"
              min={0}
              max={barCeiling}
              step={5}
              value={baseLoadAtInterval}
              onChange={(e) => onUpdateIntervalLoad(selectedInterval, parseFloat(e.target.value))}
              className="sim-slider"
            />
          </div>
        </div>
      )}

      {/* Governing Equations & Dispatch Rules */}
      {(mode === 'both' || mode === 'equations') && (
        <div id="model-equations" className="p-5 space-y-4">
          <div>
            <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#111113] dark:text-[#f2efeb] font-bold">
              Core Simulation Model &amp; Dispatch Rules (Δt = {DT_HOURS} h)
            </h2>
            <p className="text-xs text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] mt-0.5">
              Live 30-minute physical constraints evaluated at {activeDateLabel} · {intervalData.label}
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-white dark:bg-white/[0.02] border border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.6)]">
                01. Net Load Balance
              </div>
              <div className="font-mono text-[#111113] dark:text-[#f2efeb]">
                P_net(t) = P_load(t) − P_PV(t) + P_BESS(t)
              </div>
              <div className="font-mono tabular-nums text-[#e04400] dark:text-[#ff4d00]">
                {intervalData.netAfterKw.toFixed(1)} = {intervalData.loadKw.toFixed(1)} −{' '}
                {intervalData.pvKw.toFixed(1)} + ({intervalData.bessKw >= 0 ? '+' : ''}
                {intervalData.bessKw.toFixed(1)}) kW
              </div>
            </div>

            <div className="p-3.5 bg-white dark:bg-white/[0.02] border border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.6)]">
                02. 30-Min SOC Energy Accounting (Δt = 0.5 h)
              </div>
              <div className="font-mono text-[#111113] dark:text-[#f2efeb]">
                ΔE(t) = P_BESS(t) · 0.5 h · η · (η_c = η_d = {(summary.etaC * 100).toFixed(2)}%)
              </div>
              <div className="font-mono tabular-nums text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.65)]">
                {summary.eMinKwh.toFixed(0)} kWh ({params.socMinPct}%) ≤ E(t) ={' '}
                {intervalData.energyEndKwh.toFixed(1)} kWh ({intervalData.socEndPct.toFixed(1)}%) ≤{' '}
                {summary.eMaxKwh.toFixed(0)} kWh ({params.socMaxPct}%)
              </div>
            </div>

            <div className="p-3.5 bg-white dark:bg-white/[0.02] border border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.6)]">
                03. Peak Shaving Dispatch Rule (Window: {formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes)})
              </div>
              <div className="font-mono text-[#111113] dark:text-[#f2efeb]">
                P_disch(t) ≤ min(P_BESS,max, P_net,before(t) − P_cap, (ΔE_avail · η_d) / 0.5 h) ∀ t ∈ T_peak
              </div>
              <div className="font-mono tabular-nums text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.65)]">
                P_cap = {params.targetCapKw} kW · P_BESS,max = {params.bessPowerKw} kW · Losses ={' '}
                {summary.totalConversionLossesKwh.toFixed(1)} kWh/day
              </div>
            </div>

            <div className="p-3.5 bg-white dark:bg-white/[0.02] border border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.6)]">
                04. Auto-Sizing Formulation (Multi-Day Critical Evaluation)
              </div>
              <div className="font-mono text-[#111113] dark:text-[#f2efeb]">
                P_inv ≥ max_(d, t∈T_peak)(P_net,0 − P_cap) · E_nom ≥ E_shave,AC / (η_d · (SOC_max − SOC_min))
              </div>
              <div className="font-mono tabular-nums text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.65)]">
                T_peak = {formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes)} ({summary.peakWindowIntervals} int/day) · Usable DoD ={' '}
                {(params.socMaxPct - params.socMinPct).toFixed(0)}% · η_d = {(summary.etaD * 100).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
