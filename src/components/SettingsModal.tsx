import { RotateCcw, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  SimulationParams,
  countIntervalsInPeakWindow,
  formatMinutesHHMM,
  formatPeakWindowRange,
  isFullDayPeakWindow,
} from '../simulation/bessEngine';

interface SettingsModalProps {
  isOpen: boolean;
  params: SimulationParams;
  onChange: (patch: Partial<SimulationParams>) => void;
  onReset: () => void;
  onClose: () => void;
}

interface ModalNumericRowProps {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  precision?: number;
  onChange: (val: number) => void;
}

function ModalNumericRow({
  id,
  label,
  sublabel,
  value,
  min,
  max,
  step,
  unit,
  precision = 0,
  onChange,
}: ModalNumericRowProps) {
  const [draft, setDraft] = useState<string>(() => value.toFixed(precision));
  const [isFocused, setIsFocused] = useState<boolean>(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value.toFixed(precision));
    }
  }, [value, precision, isFocused]);

  const clampValue = (n: number) => Math.min(max, Math.max(min, n));

  const handleChange = (raw: string) => {
    setDraft(raw);
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      if (parsed >= min && parsed <= max) {
        onChange(parsed);
      }
    }
  };

  const commitDraft = () => {
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      setDraft(value.toFixed(precision));
      return;
    }
    const clamped = clampValue(parsed);
    onChange(clamped);
    setDraft(clamped.toFixed(precision));
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_124px] items-center gap-x-3 py-2 border-b border-[rgba(17,17,19,0.08)] dark:border-[rgba(242,239,235,0.08)] last:border-b-0">
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block font-mono text-[10.5px] uppercase tracking-[0.07em] text-[rgba(17,17,19,0.85)] dark:text-[rgba(242,239,235,0.82)] leading-tight"
        >
          {label}
        </label>
        {sublabel && (
          <div className="font-mono tabular-nums text-[9.5px] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)] mt-0.5 truncate">
            {sublabel}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#0c0c0e] border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.18)] focus-within:border-[#ff4d00] transition-colors">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onFocus={(e) => {
            setIsFocused(true);
            e.currentTarget.select();
          }}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => {
            setIsFocused(false);
            commitDraft();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitDraft();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setDraft(value.toFixed(precision));
              e.currentTarget.blur();
            }
          }}
          className="tech-num-input w-full min-w-0 bg-transparent text-right font-mono tabular-nums text-[11.5px] font-bold text-[#111113] dark:text-[#f2efeb] focus:outline-none"
        />
        <span className="font-mono text-[9.5px] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.5)] shrink-0 select-none">
          {unit}
        </span>
      </div>
    </div>
  );
}

const START_TIME_OPTIONS: number[] = Array.from({ length: 48 }, (_, i) => i * 30);
const END_TIME_OPTIONS: number[] = Array.from({ length: 48 }, (_, i) => (i + 1) * 30);

export function SettingsModal({
  isOpen,
  params,
  onChange,
  onReset,
  onClose,
}: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const etaSingle = Math.sqrt(params.roundTripEfficiencyPct / 100) * 100;
  const eMinKwh = params.bessCapacityKwh * (params.socMinPct / 100);
  const eMaxKwh = params.bessCapacityKwh * (params.socMaxPct / 100);
  const eInitKwh = params.bessCapacityKwh * (params.initialSocPct / 100);
  const effPvKw = (params.solarPeakKw * params.irradiancePct) / 100;

  const peakIntervals = countIntervalsInPeakWindow(
    params.peakStartMinutes,
    params.peakEndMinutes
  );
  const peakHours = peakIntervals * 0.5;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 dark:bg-black/75 p-4"
    >
      <div className="w-full max-w-[440px] bg-[#f6f5f2] dark:bg-[#111113] border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.22)] shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.14)] flex items-center justify-between bg-black/[0.025] dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-3.5 h-3.5 text-[#ff4d00]" aria-hidden="true" />
            <h2
              id="settings-modal-title"
              className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#111113] dark:text-[#f2efeb]"
            >
              Setting · Secondary Parameters
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1 text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.6)] hover:text-[#111113] dark:hover:text-[#f2efeb] hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-4 py-3 overflow-y-auto tech-scroll space-y-3">
          {/* Peak Period (Start & End Time Selectors Only) */}
          <div className="pb-3 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-[rgba(17,17,19,0.85)] dark:text-[rgba(242,239,235,0.82)]">
                Peak Period
              </span>
              <span className="font-mono tabular-nums text-[10px] text-[#e04400] dark:text-[#ff4d00]">
                {formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes)} ·{' '}
                {peakHours.toFixed(1)}h ({peakIntervals} int)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[rgba(17,17,19,0.55)] dark:text-[rgba(242,239,235,0.5)]">
                  Start
                </span>
                <select
                  aria-label="Peak period start time"
                  value={params.peakStartMinutes}
                  onChange={(e) => {
                    const nextStart = parseInt(e.target.value, 10);
                    onChange({
                      peakStartMinutes: nextStart,
                      peakEndMinutes:
                        nextStart === params.peakEndMinutes
                          ? nextStart === 1410
                            ? 1440
                            : Math.min(1440, nextStart + 30)
                          : params.peakEndMinutes,
                    });
                  }}
                  className="h-[30px] w-full px-2 bg-white dark:bg-[#0c0c0e] border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.18)] focus:border-[#ff4d00] focus:outline-none font-mono tabular-nums text-[11px] font-bold text-[#111113] dark:text-[#f2efeb] cursor-pointer"
                >
                  {START_TIME_OPTIONS.map((mins) => (
                    <option key={mins} value={mins} className="bg-white dark:bg-[#111113] text-[#111113] dark:text-[#f2efeb]">
                      {formatMinutesHHMM(mins)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[rgba(17,17,19,0.55)] dark:text-[rgba(242,239,235,0.5)]">
                  End
                </span>
                <select
                  aria-label="Peak period end time"
                  value={params.peakEndMinutes}
                  onChange={(e) => {
                    const nextEnd = parseInt(e.target.value, 10);
                    onChange({
                      peakEndMinutes: nextEnd,
                      peakStartMinutes:
                        nextEnd === params.peakStartMinutes
                          ? Math.max(0, nextEnd - 30)
                          : params.peakStartMinutes,
                    });
                  }}
                  className="h-[30px] w-full px-2 bg-white dark:bg-[#0c0c0e] border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.18)] focus:border-[#ff4d00] focus:outline-none font-mono tabular-nums text-[11px] font-bold text-[#111113] dark:text-[#f2efeb] cursor-pointer"
                >
                  {END_TIME_OPTIONS.map((mins) => (
                    <option key={mins} value={mins} className="bg-white dark:bg-[#111113] text-[#111113] dark:text-[#f2efeb]">
                      {formatMinutesHHMM(mins)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!isFullDayPeakWindow(params.peakStartMinutes, params.peakEndMinutes) && (
              <div className="pt-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.06em] text-[rgba(17,17,19,0.78)] dark:text-[rgba(242,239,235,0.75)]">
                    Non-Peak Charge Ceiling
                  </span>
                  <span className="block font-mono text-[9px] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)] truncate">
                    Outside {formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes)}
                  </span>
                </div>
                <div
                  role="group"
                  aria-label="Non-peak charge ceiling"
                  className="inline-flex border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.18)] shrink-0"
                >
                  <button
                    type="button"
                    onClick={() => onChange({ offPeakChargeToTransformer: true })}
                    aria-pressed={params.offPeakChargeToTransformer}
                    className={`px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.05em] transition-colors cursor-pointer ${
                      params.offPeakChargeToTransformer
                        ? 'bg-[#111113] text-[#f6f5f2] dark:bg-[#f2efeb] dark:text-[#111113] font-bold'
                        : 'bg-white dark:bg-[#0c0c0e] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.55)] hover:text-[#111113] dark:hover:text-[#f2efeb]'
                    }`}
                  >
                    TX Limit
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ offPeakChargeToTransformer: false })}
                    aria-pressed={!params.offPeakChargeToTransformer}
                    className={`px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.05em] transition-colors cursor-pointer border-l border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.18)] ${
                      !params.offPeakChargeToTransformer
                        ? 'bg-[#111113] text-[#f6f5f2] dark:bg-[#f2efeb] dark:text-[#111113] font-bold'
                        : 'bg-white dark:bg-[#0c0c0e] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.55)] hover:text-[#111113] dark:hover:text-[#f2efeb]'
                    }`}
                  >
                    Target Cap
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Numeric Secondary Parameters */}
          <div>
            <ModalNumericRow
              id="setting-demand-charge"
              label="Demand Charge"
              sublabel="Monthly peak demand tariff"
              value={params.demandChargeRate}
              min={5}
              max={45}
              step={1}
              unit="$/kW"
              onChange={(v) => onChange({ demandChargeRate: v })}
            />
            <ModalNumericRow
              id="setting-bess-rte"
              label="Round-Trip Efficiency"
              sublabel={`η_RT · η_c = η_d = ${etaSingle.toFixed(2)}%`}
              value={params.roundTripEfficiencyPct}
              min={80}
              max={98}
              step={0.5}
              precision={1}
              unit="%"
              onChange={(v) => onChange({ roundTripEfficiencyPct: v })}
            />
            <ModalNumericRow
              id="setting-soc-floor"
              label="SOC Floor"
              sublabel={`${eMinKwh.toFixed(0)} kWh reserve`}
              value={params.socMinPct}
              min={5}
              max={40}
              step={1}
              unit="%"
              onChange={(v) =>
                onChange({
                  socMinPct: Math.min(v, params.socMaxPct - 5),
                  initialSocPct: Math.max(
                    params.initialSocPct,
                    Math.min(v, params.socMaxPct - 5)
                  ),
                })
              }
            />
            <ModalNumericRow
              id="setting-soc-ceiling"
              label="SOC Ceiling"
              sublabel={`${eMaxKwh.toFixed(0)} kWh ceiling`}
              value={params.socMaxPct}
              min={60}
              max={100}
              step={1}
              unit="%"
              onChange={(v) =>
                onChange({
                  socMaxPct: Math.max(v, params.socMinPct + 5),
                  initialSocPct: Math.min(
                    params.initialSocPct,
                    Math.max(v, params.socMinPct + 5)
                  ),
                })
              }
            />
            <ModalNumericRow
              id="setting-soc-init"
              label="Initial SOC"
              sublabel={`00:00 start · ${eInitKwh.toFixed(0)} kWh`}
              value={params.initialSocPct}
              min={params.socMinPct}
              max={params.socMaxPct}
              step={1}
              unit="%"
              onChange={(v) => onChange({ initialSocPct: v })}
            />
            <ModalNumericRow
              id="setting-irradiance"
              label="Irradiance Factor"
              sublabel={`${effPvKw.toFixed(0)} kW effective PV`}
              value={params.irradiancePct}
              min={10}
              max={120}
              step={5}
              unit="%"
              onChange={(v) => onChange({ irradiancePct: v })}
            />
            <ModalNumericRow
              id="setting-load-scale"
              label="Load Scale"
              sublabel="Commercial load multiplier"
              value={params.loadScalePct}
              min={50}
              max={200}
              step={5}
              unit="%"
              onChange={(v) => onChange({ loadScalePct: v })}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 border-t border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.14)] bg-black/[0.025] dark:bg-white/[0.02] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.1)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.18)] text-[#111113] dark:text-[#f2efeb] font-mono text-[10px] uppercase tracking-[0.06em] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#ff4d00] hover:bg-[#e04400] text-[#f2efeb] font-mono text-[10px] font-bold uppercase tracking-[0.07em] transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
