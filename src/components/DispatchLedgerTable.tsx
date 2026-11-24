import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DaySimulationResult,
  IntervalResult,
  MeterDatasetMetadata,
  SimulationParams,
  TimeConvention,
  formatIntervalLabel,
  formatIntervalWindow,
  formatPeakWindowRange,
  isFullDayPeakWindow,
} from '../simulation/bessEngine';

export type ExportDatasetFormat = 'xlsx' | 'csv' | 'json';

interface DispatchLedgerTableProps {
  intervals: IntervalResult[];
  params: SimulationParams;
  selectedInterval: number;
  activeDateLabel: string;
  timeConvention: TimeConvention;
  dayResults: DaySimulationResult[];
  selectedDayIndex: number;
  metadata: MeterDatasetMetadata;
  importError: string | null;
  onSelectInterval: (interval: number) => void;
  onSelectDay: (dayIndex: number) => void;
  onImportFile: (file: File) => void;
  onExportDataset: (format: ExportDatasetFormat) => void;
}

export function DispatchLedgerTable({
  intervals,
  params,
  selectedInterval,
  activeDateLabel,
  timeConvention,
  dayResults,
  selectedDayIndex,
  metadata,
  importError,
  onSelectInterval,
  onSelectDay,
  onImportFile,
  onExportDataset,
}: DispatchLedgerTableProps) {
  const [criticalOpen, setCriticalOpen] = useState(true);
  const [criticalSort, setCriticalSort] = useState<'peak' | 'shaved'>('peak');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportMenuOpen]);

  const activeRow = intervals[selectedInterval] ?? intervals[0];

  const stateColorClass =
    activeRow.state === 'shaving_soc_floor' || activeRow.state === 'cap_exceeded_depleted'
      ? 'text-[#e04400] dark:text-[#ff4d00]'
      : activeRow.state === 'shaving_power_limited'
      ? 'text-amber-700 dark:text-amber-400'
      : activeRow.bessKw < -0.05
      ? 'text-emerald-700 dark:text-emerald-400'
      : activeRow.bessKw > 0.05
      ? 'text-sky-700 dark:text-sky-400'
      : 'text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.6)]';

  const rankedCriticalDays = useMemo(() => {
    const indexed = dayResults.map((res, index) => ({ res, index }));
    indexed.sort((a, b) => {
      if (criticalSort === 'shaved') {
        const diff =
          b.res.output.summary.peakReductionKw - a.res.output.summary.peakReductionKw;
        if (Math.abs(diff) > 0.01) return diff;
      }
      const peakDiff = b.res.originalMaxLoadKw - a.res.originalMaxLoadKw;
      if (Math.abs(peakDiff) > 0.01) return peakDiff;
      return b.res.output.summary.peakBeforeKw - a.res.output.summary.peakBeforeKw;
    });
    return indexed.slice(0, 5);
  }, [dayResults, criticalSort]);

  return (
    <aside
      id="time-ledger"
      aria-label="Critical days selector and 30-minute time ledger"
      className="flex flex-col lg:h-full lg:overflow-hidden bg-[#f6f5f2] dark:bg-[#111113]"
    >
      {/* Top Row: Import Load / Split Export (.XLSX | CSV | JSON) */}
      <div className="px-4 py-2.5 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-1.5 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportFile(file);
              e.currentTarget.value = '';
            }
          }}
        />

        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[#ff4d00] hover:bg-[#e04400] text-[#f2efeb] font-mono text-[10px] font-bold uppercase tracking-[0.04em] transition-colors whitespace-nowrap cursor-pointer"
            title="Import utility 30-min CSV, Excel (.xlsx), or Critical Days (.json) profile"
          >
            <Upload className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>Import Load</span>
          </button>

          <div ref={exportMenuRef} className="relative flex">
            <button
              type="button"
              onClick={() => {
                setExportMenuOpen(false);
                onExportDataset('xlsx');
              }}
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.2)] text-[#111113] dark:text-[#f2efeb] font-mono text-[10px] uppercase tracking-[0.04em] transition-colors whitespace-nowrap cursor-pointer"
              title="Export 30-min load profile & simulated dispatch (.xlsx)"
            >
              <Download className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Export .XLSX</span>
            </button>
            <button
              type="button"
              onClick={() => setExportMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              aria-label="Choose export format"
              className={`px-1.5 py-1.5 border-l border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.16)] font-mono text-[10px] transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                exportMenuOpen
                  ? 'bg-[#ff4d00] text-[#f2efeb]'
                  : 'bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.2)] text-[#111113] dark:text-[#f2efeb]'
              }`}
            >
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>

            {exportMenuOpen && (
              <div
                role="menu"
                aria-label="Export format options"
                className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-[#18181b] border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.22)] shadow-lg z-30 divide-y divide-[rgba(17,17,19,0.08)] dark:divide-[rgba(242,239,235,0.08)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportDataset('xlsx');
                  }}
                  className="w-full px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-[0.05em] text-[#111113] dark:text-[#f2efeb] hover:bg-[#ff4d00] hover:text-[#f2efeb] transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <span>Excel</span>
                  <span className="text-[rgba(17,17,19,0.55)] dark:text-[rgba(242,239,235,0.65)] group-hover:text-[#f2efeb]">.XLSX</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportDataset('csv');
                  }}
                  className="w-full px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-[0.05em] text-[#111113] dark:text-[#f2efeb] hover:bg-[#ff4d00] hover:text-[#f2efeb] transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <span>CSV</span>
                  <span className="text-[rgba(17,17,19,0.55)] dark:text-[rgba(242,239,235,0.65)] group-hover:text-[#f2efeb]">.CSV</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExportDataset('json');
                  }}
                  className="w-full px-2.5 py-2 text-left font-mono text-[10px] uppercase tracking-[0.05em] text-[#111113] dark:text-[#f2efeb] hover:bg-[#ff4d00] hover:text-[#f2efeb] transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <span>JSON</span>
                  <span className="text-[rgba(17,17,19,0.55)] dark:text-[rgba(242,239,235,0.65)] group-hover:text-[#f2efeb]">.JSON</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {importError && (
          <div
            role="alert"
            className="p-2 border border-[#ff4d00] bg-[rgba(255,77,0,0.1)] dark:bg-[rgba(255,77,0,0.12)] font-mono text-[10px] text-[#111113] dark:text-[#f2efeb] leading-snug"
          >
            {importError}
          </div>
        )}
      </div>

      {/* Top Section: Critical Days */}
      <section
        aria-label="Critical days selector"
        className="px-4 py-3 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] shrink-0"
      >
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)]">
          <button
            type="button"
            onClick={() => setCriticalOpen((v) => !v)}
            aria-expanded={criticalOpen}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#111113] dark:text-[#f2efeb] font-bold cursor-pointer"
          >
            {criticalOpen ? (
              <ChevronDown className="w-3 h-3 text-[rgba(17,17,19,0.65)] dark:text-[rgba(242,239,235,0.65)]" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[rgba(17,17,19,0.65)] dark:text-[rgba(242,239,235,0.65)]" aria-hidden="true" />
            )}
            <span>Critical Days</span>
          </button>
          <span className="font-mono text-[10px] text-[rgba(17,17,19,0.55)] dark:text-[rgba(242,239,235,0.5)] tabular-nums">
            {dayResults.length} {dayResults.length === 1 ? 'day' : 'days'} · {metadata.totalRecords} int
          </span>
        </div>

        {criticalOpen && (
          <div className="space-y-2">
            <div className="font-mono text-[9.5px] text-[rgba(17,17,19,0.58)] dark:text-[rgba(242,239,235,0.5)] truncate">
              {metadata.device} · {metadata.meterType}
            </div>

            {/* Inspect Date Selector */}
            <div className="grid grid-cols-[26px_minmax(0,1fr)_26px] gap-1 items-center">
              <button
                type="button"
                disabled={selectedDayIndex <= 0}
                onClick={() => onSelectDay(Math.max(0, selectedDayIndex - 1))}
                aria-label="Previous day"
                className="h-[26px] flex items-center justify-center bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.2)] disabled:opacity-30 text-[#111113] dark:text-[#f2efeb] cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <select
                aria-label="Select inspection date"
                value={selectedDayIndex}
                onChange={(e) => onSelectDay(parseInt(e.target.value, 10))}
                className="h-[26px] w-full min-w-0 px-2 bg-white dark:bg-[#111113] border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.16)] focus:border-[#ff4d00] focus:outline-none font-mono text-[10.5px] text-[#111113] dark:text-[#f2efeb] tabular-nums cursor-pointer"
              >
                {dayResults.map((d, idx) => (
                  <option key={d.dateKey} value={idx} className="bg-white dark:bg-[#111113] text-[#111113] dark:text-[#f2efeb]">
                    {d.displayDate} · Peak {d.originalMaxLoadKw.toFixed(0)} kW
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selectedDayIndex >= dayResults.length - 1}
                onClick={() =>
                  onSelectDay(Math.min(dayResults.length - 1, selectedDayIndex + 1))
                }
                aria-label="Next day"
                className="h-[26px] flex items-center justify-center bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.2)] disabled:opacity-30 text-[#111113] dark:text-[#f2efeb] cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Top Critical Peaks */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.58)] dark:text-[rgba(242,239,235,0.5)]">
                  Top Critical Peaks
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCriticalSort((prev) => (prev === 'peak' ? 'shaved' : 'peak'))
                  }
                  className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.65)] hover:text-[#ff4d00] cursor-pointer"
                >
                  Sort: {criticalSort === 'peak' ? 'Peak kW' : 'Shaved kW'}
                </button>
              </div>

              <div className="max-h-[126px] overflow-y-auto tech-scroll divide-y divide-[rgba(17,17,19,0.08)] dark:divide-[rgba(242,239,235,0.08)] border border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)]">
                {rankedCriticalDays.map(({ res, index }, rankIdx) => {
                  const isActive = index === selectedDayIndex;
                  const peakAfter = res.output.summary.peakAfterKw;
                  const shaved = res.output.summary.peakReductionKw;

                  return (
                    <button
                      key={res.dateKey}
                      type="button"
                      onClick={() => onSelectDay(index)}
                      className={`w-full px-2 py-1 text-left transition-colors cursor-pointer flex items-center justify-between gap-2 font-mono tabular-nums ${
                        isActive
                          ? 'bg-[rgba(255,77,0,0.12)] dark:bg-[rgba(255,77,0,0.14)] text-[#111113] dark:text-[#f2efeb]'
                          : 'bg-white dark:bg-[#111113] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-[rgba(17,17,19,0.82)] dark:text-[rgba(242,239,235,0.8)]'
                      }`}
                    >
                      <div className="min-w-0 flex items-baseline gap-1.5 truncate">
                        <span
                          className={`text-[10px] font-bold ${
                            isActive ? 'text-[#e04400] dark:text-[#ff4d00]' : 'text-[rgba(17,17,19,0.48)] dark:text-[rgba(242,239,235,0.45)]'
                          }`}
                        >
                          #{rankIdx + 1}
                        </span>
                        <span className="text-[10.5px] font-bold">{res.displayDate}</span>
                        <span className="text-[9.5px] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)]">
                          @{formatIntervalLabel(res.originalPeakInterval, timeConvention)}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0 text-[10px]">
                        <span className="font-bold text-[#111113] dark:text-[#f2efeb]">
                          {res.originalMaxLoadKw.toFixed(0)}→{peakAfter.toFixed(0)} kW
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-400">−{shaved.toFixed(0)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Bottom Section: 30-Min Time Ledger + Selected Interval Detail */}
      <div className="px-4 py-3 flex flex-col min-h-[260px] lg:min-h-0 flex-1">
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#111113] dark:text-[#f2efeb] font-bold">
              30-Min Time Ledger
            </span>
            {!isFullDayPeakWindow(params.peakStartMinutes, params.peakEndMinutes) && (
              <span className="font-mono text-[9px] px-1 py-0.5 bg-[rgba(255,77,0,0.12)] dark:bg-[rgba(255,77,0,0.16)] text-[#e04400] dark:text-[#ff4d00] tabular-nums">
                {formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes)}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)] tabular-nums">
            {activeDateLabel} · Δt=0.5h
          </span>
        </div>

        <div className="overflow-y-auto tech-scroll flex-1 min-h-[180px] lg:min-h-0">
          <table className="w-full text-left border-collapse font-mono text-[10.5px] tabular-nums">
            <thead className="sticky top-0 bg-[#f6f5f2] dark:bg-[#111113] z-10">
              <tr className="border-b border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)] text-[rgba(17,17,19,0.58)] dark:text-[rgba(242,239,235,0.5)]">
                <th className="py-1.5 px-1 font-normal">Time</th>
                <th className="py-1.5 px-1 text-right font-normal">Load</th>
                <th className="py-1.5 px-1 text-right font-normal">Solar</th>
                <th className="py-1.5 px-1 text-right font-normal">Net</th>
                <th className="py-1.5 px-1 text-right font-normal">BESS</th>
                <th className="py-1.5 px-1 text-right font-normal">SOC</th>
              </tr>
            </thead>
            <tbody>
              {intervals.map((row) => {
                const isSelected = row.interval === selectedInterval;
                const highlightWindow =
                  !isFullDayPeakWindow(params.peakStartMinutes, params.peakEndMinutes) &&
                  row.inPeakPeriod;
                return (
                  <tr
                    key={row.interval}
                    onClick={() => onSelectInterval(row.interval)}
                    className={`cursor-pointer border-b border-[rgba(17,17,19,0.06)] dark:border-[rgba(242,239,235,0.04)] transition-colors ${
                      isSelected
                        ? 'bg-[rgba(255,77,0,0.12)] dark:bg-[rgba(255,77,0,0.14)] text-[#111113] dark:text-[#f2efeb]'
                        : highlightWindow
                        ? 'bg-[rgba(255,77,0,0.04)] dark:bg-[rgba(255,77,0,0.03)] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] text-[rgba(17,17,19,0.9)] dark:text-[rgba(242,239,235,0.9)]'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-[rgba(17,17,19,0.82)] dark:text-[rgba(242,239,235,0.82)]'
                    }`}
                  >
                    <td
                      className={`py-1 px-1 font-bold whitespace-nowrap ${
                        highlightWindow ? 'border-l-2 border-l-[#ff4d00]' : ''
                      }`}
                    >
                      {row.label}
                    </td>
                    <td className="py-1 px-1 text-right">{row.loadKw.toFixed(1)}</td>
                    <td className="py-1 px-1 text-right text-amber-700 dark:text-amber-400/90">
                      {row.pvKw.toFixed(1)}
                    </td>
                    <td
                      className={`py-1 px-1 text-right font-bold ${
                        row.aboveCap ? 'text-[#e04400] dark:text-[#ff4d00]' : 'text-[#111113] dark:text-[#f2efeb]'
                      }`}
                    >
                      {row.netAfterKw.toFixed(1)}
                    </td>
                    <td
                      className={`py-1 px-1 text-right font-bold ${
                        row.socFloorHit
                          ? 'text-[#e04400] dark:text-[#ff4d00]'
                          : row.bessKw < -0.05
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : row.bessKw > 0.05
                          ? 'text-sky-700 dark:text-sky-400'
                          : 'text-[rgba(17,17,19,0.4)] dark:text-[rgba(242,239,235,0.4)]'
                      }`}
                    >
                      {row.bessKw > 0.05
                        ? `+${row.bessKw.toFixed(0)}`
                        : row.bessKw < -0.05
                        ? row.bessKw.toFixed(1)
                        : '0.0'}
                    </td>
                    <td className="py-1 px-1 text-right">{row.socEndPct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected 30-Min Interval Telemetry Detail */}
        <div className="mt-2 pt-2 border-t border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] space-y-1 shrink-0">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="uppercase tracking-[0.08em] text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.55)]">
              {formatIntervalWindow(activeRow.interval, timeConvention)}
            </span>
            <span className={`font-bold uppercase ${stateColorClass}`}>
              {activeRow.stateGlyph} {activeRow.stateLabel}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 font-mono text-[10px] tabular-nums text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.65)]">
            <div>
              <div className="text-[rgba(17,17,19,0.5)] dark:text-[rgba(242,239,235,0.45)]">SHAVED</div>
              <div className="text-[#111113] dark:text-[#f2efeb] font-bold">
                {activeRow.peakShavedKw > 0.05 ? `${activeRow.peakShavedKw.toFixed(1)} kW` : '0.0 kW'}
              </div>
            </div>
            <div>
              <div className="text-[rgba(17,17,19,0.5)] dark:text-[rgba(242,239,235,0.45)]">ENERGY</div>
              <div className="text-[#111113] dark:text-[#f2efeb] font-bold">
                {activeRow.energyEndKwh.toFixed(1)} kWh
              </div>
            </div>
            <div>
              <div className="text-[rgba(17,17,19,0.5)] dark:text-[rgba(242,239,235,0.45)]">LOSSES</div>
              <div className="text-[#111113] dark:text-[#f2efeb] font-bold">
                {activeRow.lossesKwh.toFixed(2)} kWh
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
