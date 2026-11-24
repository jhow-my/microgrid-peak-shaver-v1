import { Lock, Repeat, Settings, Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AutoSizeResult,
  AutoSizeScope,
  ChargingStrategy,
  DatasetSimulationSummary,
  PrimaryParamKey,
  SimulationParams,
  SliderBoundsMap,
  SliderLocks,
  TimeConvention,
  formatIntervalLabel,
} from '../simulation/bessEngine';

interface ControlDeckProps {
  params: SimulationParams;
  sliderBounds: SliderBoundsMap;
  sliderLocks: SliderLocks;
  daysCount: number;
  activeDateLabel: string;
  timeConvention: TimeConvention;
  autoSizeScope: AutoSizeScope;
  autoSizePreview: AutoSizeResult;
  datasetSummary: DatasetSimulationSummary;
  onChangeScope: (scope: AutoSizeScope) => void;
  onJumpToDayInterval: (dayIndex: number, intervalIndex: number) => void;
  onChangePrimaryParam: (key: PrimaryParamKey, val: number) => void;
  onToggleLock: (key: PrimaryParamKey) => void;
  onChangeStrategy: (strategy: ChargingStrategy) => void;
  onOpenSettings: () => void;
}

interface SliderParamRowProps {
  id: string;
  label: string;
  value: number;
  min: number;
  baseSliderMax: number;
  inputMin?: number;
  inputMax: number;
  step: number;
  unit: string;
  isLocked: boolean;
  onToggleLock: () => void;
  onChange: (val: number) => void;
}

function SliderParamRow({
  id,
  label,
  value,
  min,
  baseSliderMax,
  inputMin,
  inputMax,
  step,
  unit,
  isLocked,
  onToggleLock,
  onChange,
}: SliderParamRowProps) {
  const [draft, setDraft] = useState<string>(() => value.toFixed(0));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value.toFixed(0));
    }
  }, [value, isFocused]);

  const effectiveInputMin = inputMin ?? min;
  const clampValue = (n: number) => Math.min(inputMax, Math.max(effectiveInputMin, n));

  const effectiveSliderMin = Math.min(min, value);
  const effectiveSliderMax =
    value > baseSliderMax
      ? Math.min(inputMax, Math.ceil(value / 500) * 500)
      : baseSliderMax;

  const handleInputChange = (raw: string) => {
    if (isLocked) return;
    setDraft(raw);
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      if (parsed >= effectiveInputMin && parsed <= inputMax) {
        onChange(parsed);
      }
    }
  };

  const commitDraft = () => {
    if (isLocked) {
      setDraft(value.toFixed(0));
      return;
    }
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      setDraft(value.toFixed(0));
      return;
    }
    const clamped = clampValue(parsed);
    onChange(clamped);
    setDraft(clamped.toFixed(0));
  };

  const sliderValue = Math.min(effectiveSliderMax, Math.max(effectiveSliderMin, value));
  const sliderDisabled = isLocked || effectiveSliderMax <= effectiveSliderMin;

  return (
    <div className="py-2 border-b border-[rgba(17,17,19,0.08)] dark:border-[rgba(242,239,235,0.08)]">
      {/* Top Line: Label (left) + Editable Numeric Input + Lock/Unlock Button (right) */}
      <div className="grid grid-cols-[minmax(0,1fr)_82px_26px] items-center gap-x-1.5">
        <label
          htmlFor={id}
          title={label}
          className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-[rgba(17,17,19,0.82)] dark:text-[rgba(242,239,235,0.78)] leading-tight truncate"
        >
          {label}
        </label>

        <div
          className={`flex items-center justify-end gap-1 px-1.5 py-1 border transition-colors ${
            isLocked
              ? 'bg-black/[0.03] dark:bg-white/[0.03] border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)] opacity-80'
              : 'bg-white dark:bg-[#111113] border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.18)] focus-within:border-[#ff4d00]'
          }`}
        >
          <input
            id={id}
            type="number"
            min={effectiveInputMin}
            max={inputMax}
            step={step}
            disabled={isLocked}
            value={draft}
            onFocus={(e) => {
              if (isLocked) return;
              setIsFocused(true);
              e.currentTarget.select();
            }}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={() => {
              setIsFocused(false);
              commitDraft();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitDraft();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                setDraft(value.toFixed(0));
                e.currentTarget.blur();
              }
            }}
            className="tech-num-input w-full min-w-0 bg-transparent text-right font-mono tabular-nums text-[11px] font-bold text-[#111113] dark:text-[#f2efeb] focus:outline-none disabled:cursor-not-allowed"
          />
          <span className="font-mono text-[9px] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.48)] shrink-0 select-none">
            {unit}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleLock}
          aria-pressed={isLocked}
          aria-label={isLocked ? `Unlock ${label}` : `Lock ${label}`}
          title={
            isLocked
              ? `${label} locked — fixed value & slider position. Click to unlock.`
              : `${label} unlocked — auto-updates dynamically. Click to lock.`
          }
          className={`w-[26px] h-[26px] flex items-center justify-center border transition-colors cursor-pointer shrink-0 ${
            isLocked
              ? 'bg-[#ff4d00] border-[#ff4d00] text-[#f2efeb] hover:bg-[#e04400]'
              : 'bg-white dark:bg-[#111113] border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.18)] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.5)] hover:border-[#ff4d00] hover:text-[#ff4d00]'
          }`}
        >
          {isLocked ? (
            <Lock className="w-3 h-3" aria-hidden="true" />
          ) : (
            <Unlock className="w-3 h-3" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Horizontal Range Slider + Min/Max Track Labels */}
      <div className="mt-1.5 space-y-0.5">
        <input
          type="range"
          min={effectiveSliderMin}
          max={effectiveSliderMax}
          step={step}
          disabled={sliderDisabled}
          value={sliderValue}
          aria-label={`${label} slider`}
          onChange={(e) => {
            if (isLocked) return;
            const next = parseFloat(e.target.value);
            if (!Number.isNaN(next) && Number.isFinite(next)) {
              onChange(next);
            }
          }}
          className={`sim-slider block w-full ${
            isLocked ? 'opacity-55' : ''
          }`}
        />
        <div className="flex items-center justify-between font-mono tabular-nums text-[8.5px] text-[rgba(17,17,19,0.48)] dark:text-[rgba(242,239,235,0.42)]">
          <span>
            {effectiveSliderMin.toLocaleString()} {unit}
          </span>
          <span>
            {effectiveSliderMax.toLocaleString()} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

const CHARGING_MODES: { value: ChargingStrategy; label: string; desc: string }[] = [
  {
    value: 'cap_aware',
    label: 'CAP-AWARE',
    desc: 'Charges across 24h whenever net load stays under active cap & transformer limit.',
  },
  {
    value: 'offpeak_solar',
    label: 'SOLAR+OFF',
    desc: 'Charges during PV hours or overnight off-peak (22:00–06:00).',
  },
  {
    value: 'excess_solar',
    label: 'EXCESS PV',
    desc: 'Charges strictly from surplus PV when PV exceeds load.',
  },
];

export function ControlDeck({
  params,
  sliderBounds,
  sliderLocks,
  daysCount,
  activeDateLabel,
  timeConvention,
  autoSizeScope,
  autoSizePreview,
  datasetSummary,
  onChangeScope,
  onJumpToDayInterval,
  onChangePrimaryParam,
  onToggleLock,
  onChangeStrategy,
  onOpenSettings,
}: ControlDeckProps) {
  const currentModeIndex = CHARGING_MODES.findIndex((m) => m.value === params.chargingStrategy);
  const activeMode = CHARGING_MODES[currentModeIndex >= 0 ? currentModeIndex : 0];

  const handleCycleChargingMode = () => {
    const nextIndex = (Math.max(0, currentModeIndex) + 1) % CHARGING_MODES.length;
    onChangeStrategy(CHARGING_MODES[nextIndex].value);
  };

  return (
    <aside
      aria-label="Simulation configuration"
      className="bg-black/[0.02] dark:bg-white/[0.02] border-b lg:border-b-0 lg:border-r border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] lg:h-full lg:overflow-y-auto tech-scroll flex flex-col px-3.5 py-2.5"
    >
      {/* Row 1: CONFIGURATION label (left) + SETTING icon button (right) */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)]">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#111113] dark:text-[#f2efeb]">
          CONFIGURATION
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          title="Open secondary simulation parameters"
          className="inline-flex items-center gap-1 px-2 py-1 bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.1)] hover:bg-[#ff4d00] text-[#111113] dark:text-[#f2efeb] hover:text-[#f2efeb] font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] transition-colors cursor-pointer"
        >
          <Settings className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span>SETTING</span>
        </button>
      </div>

      {/* Row 2: Scope toggle buttons — ALL DAYS (ND) and DAY: activeDateLabel */}
      <div className="grid grid-cols-2 gap-1 mb-2.5">
        <button
          type="button"
          onClick={() => onChangeScope('all_days')}
          className={`py-1.5 px-1.5 font-mono text-[9.5px] uppercase tracking-[0.04em] transition-colors cursor-pointer truncate ${
            autoSizeScope === 'all_days'
              ? 'bg-[rgba(17,17,19,0.12)] dark:bg-[rgba(242,239,235,0.18)] text-[#111113] dark:text-[#f2efeb] font-bold border border-[rgba(17,17,19,0.3)] dark:border-[rgba(242,239,235,0.3)]'
              : 'bg-white dark:bg-[#111113] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.55)] border border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)] hover:text-[#111113] dark:hover:text-[#f2efeb]'
          }`}
        >
          ALL DAYS ({daysCount}D)
        </button>
        <button
          type="button"
          onClick={() => onChangeScope('active_day')}
          className={`py-1.5 px-1.5 font-mono text-[9.5px] uppercase tracking-[0.04em] transition-colors cursor-pointer truncate ${
            autoSizeScope === 'active_day'
              ? 'bg-[rgba(17,17,19,0.12)] dark:bg-[rgba(242,239,235,0.18)] text-[#111113] dark:text-[#f2efeb] font-bold border border-[rgba(17,17,19,0.3)] dark:border-[rgba(242,239,235,0.3)]'
              : 'bg-white dark:bg-[#111113] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.55)] border border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)] hover:text-[#111113] dark:hover:text-[#f2efeb]'
          }`}
        >
          DAY: {activeDateLabel}
        </button>
      </div>

      {/* Row 3: Dispatch Mode */}
      <div className="pb-2.5 mb-2.5 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-1">
        <div className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-x-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-[rgba(17,17,19,0.82)] dark:text-[rgba(242,239,235,0.78)]">
            Dispatch Mode
          </span>
          <button
            type="button"
            onClick={handleCycleChargingMode}
            title="Click to cycle dispatch charging mode"
            className="w-full inline-flex items-center justify-between gap-1.5 px-2 py-1.5 bg-[#111113] dark:bg-[#f2efeb] hover:bg-[#ff4d00] dark:hover:bg-[#ff4d00] text-[#f6f5f2] dark:text-[#111113] hover:text-[#f2efeb] dark:hover:text-[#f2efeb] font-mono text-[10px] font-bold uppercase tracking-[0.04em] transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="truncate">{activeMode.label}</span>
            <Repeat className="w-3 h-3 shrink-0" aria-hidden="true" />
          </button>
        </div>
        <p className="text-[10px] text-[rgba(17,17,19,0.58)] dark:text-[rgba(242,239,235,0.48)] leading-snug">
          {activeMode.desc}
        </p>
      </div>

      {/* Primary Real-Time Sliders with Dynamic Bounds & Per-Row Locks */}
      <div className="flex flex-col">
        {/* Desired Max Demand */}
        <SliderParamRow
          id="desired-max-demand"
          label="Desired Max Demand"
          value={params.targetCapKw}
          min={sliderBounds.targetCapKw.min}
          baseSliderMax={sliderBounds.targetCapKw.max}
          inputMax={Math.max(5000, sliderBounds.targetCapKw.max * 2)}
          step={10}
          unit="kW"
          isLocked={sliderLocks.targetCapKw}
          onToggleLock={() => onToggleLock('targetCapKw')}
          onChange={(v) => onChangePrimaryParam('targetCapKw', v)}
        />

        {/* Transformer Limit */}
        <SliderParamRow
          id="transformer-limit"
          label="Transformer Limit"
          value={params.transformerLimitKw}
          min={sliderBounds.transformerLimitKw.min}
          baseSliderMax={sliderBounds.transformerLimitKw.max}
          inputMax={Math.max(10000, sliderBounds.transformerLimitKw.max * 2)}
          step={10}
          unit="kW"
          isLocked={sliderLocks.transformerLimitKw}
          onToggleLock={() => onToggleLock('transformerLimitKw')}
          onChange={(v) => onChangePrimaryParam('transformerLimitKw', v)}
        />

        {/* PV Array Peak */}
        <SliderParamRow
          id="solar-peak"
          label="PV Array Peak"
          value={params.solarPeakKw}
          min={sliderBounds.solarPeakKw.min}
          baseSliderMax={sliderBounds.solarPeakKw.max}
          inputMin={0}
          inputMax={Math.max(10000, sliderBounds.solarPeakKw.max * 2)}
          step={10}
          unit="kW"
          isLocked={sliderLocks.solarPeakKw}
          onToggleLock={() => onToggleLock('solarPeakKw')}
          onChange={(v) => onChangePrimaryParam('solarPeakKw', v)}
        />

        {/* Battery Capacity */}
        <SliderParamRow
          id="bess-capacity"
          label="Battery Capacity"
          value={params.bessCapacityKwh}
          min={sliderBounds.bessCapacityKwh.min}
          baseSliderMax={sliderBounds.bessCapacityKwh.max}
          inputMin={0}
          inputMax={Math.max(50000, sliderBounds.bessCapacityKwh.max * 2)}
          step={1}
          unit="kWh"
          isLocked={sliderLocks.bessCapacityKwh}
          onToggleLock={() => onToggleLock('bessCapacityKwh')}
          onChange={(v) => onChangePrimaryParam('bessCapacityKwh', v)}
        />

        {/* Inverter Rating */}
        <SliderParamRow
          id="bess-power"
          label="Inverter Rating"
          value={params.bessPowerKw}
          min={sliderBounds.bessPowerKw.min}
          baseSliderMax={sliderBounds.bessPowerKw.max}
          inputMin={0}
          inputMax={Math.max(10000, sliderBounds.bessPowerKw.max * 2)}
          step={1}
          unit="kW"
          isLocked={sliderLocks.bessPowerKw}
          onToggleLock={() => onToggleLock('bessPowerKw')}
          onChange={(v) => onChangePrimaryParam('bessPowerKw', v)}
        />
      </div>

      {/* Auto-Sizing & Live Simulation Summary Card (bottom of left panel) */}
      <div className="bg-white dark:bg-[#111113] border border-[rgba(17,17,19,0.16)] dark:border-[rgba(242,239,235,0.16)] p-2.5 space-y-1.5 mt-2.5">
        <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
          <div>
            <div className="text-[8.5px] uppercase tracking-[0.07em] text-[rgba(17,17,19,0.54)] dark:text-[rgba(242,239,235,0.48)]">
              REQ INVERTER
            </div>
            <div className="text-[13.5px] font-bold text-[#111113] dark:text-[#f2efeb]">
              {autoSizePreview.recommendedPowerKw.toLocaleString()}{' '}
              <span className="text-[9.5px] font-normal text-[rgba(17,17,19,0.58)] dark:text-[rgba(242,239,235,0.55)]">kW</span>
            </div>
            {params.bessPowerKw < autoSizePreview.recommendedPowerKw ? (
              <div className="text-[9px] text-[#e04400] dark:text-[#ff4d00]">
                short {(autoSizePreview.recommendedPowerKw - params.bessPowerKw).toLocaleString()} kW
              </div>
            ) : (
              <div className="text-[9px] text-[rgba(17,17,19,0.5)] dark:text-[rgba(242,239,235,0.45)]">
                exact {autoSizePreview.rawRequiredPowerKw.toFixed(1)} kW
              </div>
            )}
          </div>

          <div>
            <div className="text-[8.5px] uppercase tracking-[0.07em] text-[rgba(17,17,19,0.54)] dark:text-[rgba(242,239,235,0.48)]">
              REQ CAPACITY
            </div>
            <div className="text-[13.5px] font-bold text-[#111113] dark:text-[#f2efeb]">
              {autoSizePreview.recommendedCapacityKwh.toLocaleString()}{' '}
              <span className="text-[9.5px] font-normal text-[rgba(17,17,19,0.58)] dark:text-[rgba(242,239,235,0.55)]">kWh</span>
            </div>
            {params.bessCapacityKwh < autoSizePreview.recommendedCapacityKwh ? (
              <div className="text-[9px] text-[#e04400] dark:text-[#ff4d00]">
                short {(autoSizePreview.recommendedCapacityKwh - params.bessCapacityKwh).toLocaleString()} kWh
              </div>
            ) : (
              <div className="text-[9px] text-[rgba(17,17,19,0.5)] dark:text-[rgba(242,239,235,0.45)]">
                {autoSizePreview.usableCapacityKwh.toFixed(0)} kWh usable
              </div>
            )}
          </div>
        </div>

        <div className="pt-1.5 border-t border-[rgba(17,17,19,0.08)] dark:border-[rgba(242,239,235,0.08)] space-y-1 font-mono text-[9.5px]">
          {datasetSummary.totalBreachIntervals === 0 ? (
            autoSizePreview.alreadyCompliant ? (
              <div className="text-emerald-700 dark:text-emerald-400 leading-snug">
                ● Window already ≤ {params.targetCapKw} kW (0 kW BESS needed)
              </div>
            ) : (
              <div className="text-emerald-700 dark:text-emerald-400 tabular-nums leading-snug">
                ● Verified {datasetSummary.evaluatedDaysCount}{' '}
                {datasetSummary.evaluatedDaysCount === 1 ? 'day' : 'days'} · 0 breaches · Min SOC{' '}
                {datasetSummary.minSocObservedPct.toFixed(1)}%
              </div>
            )
          ) : (
            <>
              <div className="text-[#e04400] dark:text-[#ff4d00] tabular-nums leading-snug font-semibold">
                ▲ {datasetSummary.breachDaysCount}/{datasetSummary.evaluatedDaysCount}{' '}
                {datasetSummary.evaluatedDaysCount === 1 ? 'day' : 'days'} ·{' '}
                {datasetSummary.totalBreachIntervals}{' '}
                {datasetSummary.totalBreachIntervals === 1 ? 'breach' : 'breaches'} (
                {datasetSummary.totalBreachHours.toFixed(1)}h) · Min SOC{' '}
                {datasetSummary.minSocObservedPct.toFixed(1)}%
              </div>
              {!autoSizePreview.feasible && autoSizePreview.issueReason && (
                <div className="text-amber-700 dark:text-amber-400 leading-snug">
                  ▲ {autoSizePreview.issueReason}
                </div>
              )}
            </>
          )}

          {datasetSummary.totalBreachIntervals > 0 ? (
            <button
              type="button"
              onClick={() =>
                onJumpToDayInterval(
                  datasetSummary.worstDayIndex,
                  datasetSummary.worstIntervalIndex
                )
              }
              className="w-full text-left text-[9px] text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.62)] hover:text-[#ff4d00] transition-colors tabular-nums truncate cursor-pointer"
              title="Jump to highest breaching day and interval"
            >
              Peak Breach: {datasetSummary.worstDayDisplayDate} @{' '}
              {formatIntervalLabel(datasetSummary.worstIntervalIndex, timeConvention)} (
              {datasetSummary.maxPeakAfterKw.toFixed(1)} kW net)
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                onJumpToDayInterval(
                  autoSizePreview.driverDayIndex,
                  autoSizePreview.driverIntervalIndex
                )
              }
              className="w-full text-left text-[9px] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.55)] hover:text-[#ff4d00] transition-colors tabular-nums truncate cursor-pointer"
              title="Jump to critical peak driver day and interval"
            >
              Driver: {autoSizePreview.driverDisplayDate} @{' '}
              {formatIntervalLabel(autoSizePreview.driverIntervalIndex, timeConvention)} (
              {autoSizePreview.driverPeakBeforeKw.toFixed(0)} kW net₀)
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

