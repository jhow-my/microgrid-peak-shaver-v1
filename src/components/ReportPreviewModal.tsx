import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Maximize2,
  Printer,
  Ruler,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AutoSizeResult,
  AutoSizeScope,
  DT_HOURS,
  DatasetSimulationSummary,
  DaySimulationResult,
  INTERVALS_PER_DAY,
  IntervalResult,
  MeterDatasetMetadata,
  SimulationParams,
  TimeConvention,
  formatIntervalLabel,
  formatIntervalWindow,
  formatPeakWindowRange,
  isFullDayPeakWindow,
} from '../simulation/bessEngine';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: SimulationParams;
  metadata: MeterDatasetMetadata;
  dayResults: DaySimulationResult[];
  selectedDayIndex: number;
  selectedInterval: number;
  autoSizeScope: AutoSizeScope;
  autoSizePreview: AutoSizeResult;
  datasetSummary: DatasetSimulationSummary;
  onSelectDay: (dayIndex: number) => void;
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX;
const TOTAL_PAGES = 3;
const AXIS_TICKS = [0, 6, 12, 18, 24, 30, 36, 42, 47];
const ZOOM_STEPS = [0.5, 0.65, 0.75, 0.85, 1.0, 1.15];

function getContiguousPeakSegments(intervals: IntervalResult[]): Array<[number, number]> {
  const segments: Array<[number, number]> = [];
  let start: number | null = null;
  for (const r of intervals) {
    if (r.inPeakPeriod && start === null) {
      start = r.interval;
    } else if (!r.inPeakPeriod && start !== null) {
      segments.push([start, r.interval - 1]);
      start = null;
    }
  }
  if (start !== null) {
    segments.push([start, intervals.length - 1]);
  }
  return segments;
}

function strategyDisplayName(strategy: SimulationParams['chargingStrategy']): string {
  if (strategy === 'cap_aware') return 'Cap-Aware (24h)';
  if (strategy === 'offpeak_solar') return 'Solar + Off-Peak (22:00–06:00)';
  return 'Excess PV Only';
}

function MarginGuides({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-[13mm] border border-dashed border-sky-500/45 print:hidden z-20"
    >
      <span className="absolute -top-3.5 left-0 font-mono text-[7px] uppercase tracking-[0.06em] text-sky-600/80">
        13mm margin · Printable 184 × 271 mm
      </span>
    </div>
  );
}

interface PageChromeProps {
  pageNumber: number;
  totalPages: number;
  sectionTitle: string;
  activeDateLabel: string;
  fileName: string;
  timeConvention: TimeConvention;
}

function A4PageHeader({
  pageNumber,
  totalPages,
  sectionTitle,
  activeDateLabel,
  fileName,
}: Omit<PageChromeProps, 'timeConvention'>) {
  return (
    <div className="flex items-end justify-between pb-2 mb-3 border-b border-[#111113]/25">
      <div>
        <div className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.12em] text-[#e04400]">
          MICROGRID PEAK SHAVER · ENGINEERING REPORT
        </div>
        <div className="font-display text-[11pt] font-extrabold tracking-[-0.02em] text-[#111113] leading-tight">
          {sectionTitle}
        </div>
      </div>
      <div className="text-right font-mono text-[7pt] uppercase tracking-[0.06em] text-[#111113]/65 tabular-nums leading-snug">
        <div className="font-bold text-[#111113]">
          {activeDateLabel} · {fileName}
        </div>
        <div>
          A4 (210 × 297 mm) · Page {pageNumber} of {totalPages}
        </div>
      </div>
    </div>
  );
}

function A4PageFooter({
  pageNumber,
  totalPages,
  timeConvention,
}: Pick<PageChromeProps, 'pageNumber' | 'totalPages' | 'timeConvention'>) {
  return (
    <div className="mt-auto pt-2 border-t border-[#111113]/20 flex items-center justify-between font-mono text-[6.8pt] uppercase tracking-[0.07em] text-[#111113]/60 tabular-nums">
      <span>
        Δt = {DT_HOURS} h · 48 Intervals · Time:{' '}
        {timeConvention === 'end_time' ? 'Interval End (00:30–24:00)' : 'Interval Start (00:00–23:30)'}
      </span>
      <span className="font-bold text-[#111113]">
        Page {pageNumber} of {totalPages}
      </span>
    </div>
  );
}

function ReportDispatchChartsSvg({
  intervals,
  summary,
  params,
  timeConvention,
}: {
  intervals: IntervalResult[];
  summary: DaySimulationResult['output']['summary'];
  params: SimulationParams;
  timeConvention: TimeConvention;
}) {
  const lastIndex = INTERVALS_PER_DAY - 1;
  const peakSegments = summary.isPeakWindowActive ? getContiguousPeakSegments(intervals) : [];
  const peakWindowLabel = formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes);

  // Chart 1 (860 x 205)
  const w1 = 860;
  const h1 = 205;
  const pad1 = { top: 16, right: 20, bottom: 24, left: 50 };
  const plotW1 = w1 - pad1.left - pad1.right;
  const plotH1 = h1 - pad1.top - pad1.bottom;

  const allValues = intervals.flatMap((r) => [
    r.loadKw,
    r.pvKw,
    r.netBeforeKw,
    r.netAfterKw,
    params.targetCapKw,
  ]);
  const rawMax = Math.max(1100, ...allValues);
  const rawMin = Math.min(0, ...allValues);
  const yMax1 = Math.ceil(rawMax / 200) * 200;
  const yMin1 = rawMin < 0 ? Math.floor(rawMin / 200) * 200 : 0;

  const xFor1 = (idx: number) => pad1.left + (idx / lastIndex) * plotW1;
  const halfStep1 = plotW1 / lastIndex / 2;
  const yForKw1 = (kw: number) =>
    pad1.top + ((yMax1 - kw) / Math.max(1, yMax1 - yMin1)) * plotH1;

  const poly1 = (getter: (r: IntervalResult) => number) =>
    intervals.map((r) => `${xFor1(r.interval).toFixed(1)},${yForKw1(getter(r)).toFixed(1)}`).join(' ');

  const pvAreaPath =
    `M ${xFor1(0).toFixed(1)},${yForKw1(0).toFixed(1)} ` +
    intervals.map((r) => `L ${xFor1(r.interval).toFixed(1)},${yForKw1(r.pvKw).toFixed(1)}`).join(' ') +
    ` L ${xFor1(lastIndex).toFixed(1)},${yForKw1(0).toFixed(1)} Z`;

  const shavedAreaPath =
    `M ${intervals
      .map(
        (r) =>
          `${xFor1(r.interval).toFixed(1)},${yForKw1(
            Math.max(r.netBeforeKw, r.netAfterKw)
          ).toFixed(1)}`
      )
      .join(' L ')} ` +
    `L ${[...intervals]
      .reverse()
      .map((r) => `${xFor1(r.interval).toFixed(1)},${yForKw1(r.netAfterKw).toFixed(1)}`)
      .join(' L ')} Z`;

  const yTicks1: number[] = [];
  const step1 = yMax1 - yMin1 > 1400 ? 400 : 200;
  for (let v = yMin1; v <= yMax1; v += step1) yTicks1.push(v);

  // Chart 2 (860 x 145)
  const w2 = 860;
  const h2 = 145;
  const pad2 = { top: 14, right: 46, bottom: 24, left: 50 };
  const plotW2 = w2 - pad2.left - pad2.right;
  const plotH2 = h2 - pad2.top - pad2.bottom;
  const pBound = Math.max(100, Math.ceil(params.bessPowerKw / 100) * 100);
  const yForPower2 = (kw: number) => pad2.top + ((pBound - kw) / (2 * pBound)) * plotH2;
  const yForSoc2 = (pct: number) => pad2.top + ((100 - pct) / 100) * plotH2;
  const xFor2 = (idx: number) => pad2.left + (idx / lastIndex) * plotW2;
  const halfStep2 = plotW2 / lastIndex / 2;
  const barWidth2 = Math.max(5, plotW2 / INTERVALS_PER_DAY - 3);
  const socLinePoints = intervals
    .map((r) => `${xFor2(r.interval).toFixed(1)},${yForSoc2(r.socEndPct).toFixed(1)}`)
    .join(' ');

  return (
    <div className="space-y-2.5 border border-[#111113]/20 p-2.5 bg-white">
      <div>
        <div className="flex items-center justify-between mb-1 font-mono text-[7pt] uppercase tracking-[0.06em]">
          <span className="font-bold text-[#111113]">
            Fig 1. 24-Hour Commercial Load, Solar PV &amp; Grid Net Demand (kW)
          </span>
          <div className="flex items-center gap-3 text-[#111113]/75">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-t border-dotted border-[#111113]/55 inline-block" />
              Load
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              <span className="w-2 h-2 bg-amber-500/40 border border-amber-600 inline-block" />
              Solar PV
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-0.5 border-t border-dashed border-[#111113]/70 inline-block" />
              Net₀
            </span>
            <span className="inline-flex items-center gap-1 text-[#e04400] font-bold">
              <span className="w-2.5 h-0.5 bg-[#e04400] inline-block" />
              Net After BESS
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 bg-emerald-600/25 border border-emerald-700 inline-block" />
              Shaved
            </span>
          </div>
        </div>

        <svg viewBox={`0 0 ${w1} ${h1}`} className="w-full h-auto block">
          <rect x={pad1.left} y={pad1.top} width={plotW1} height={plotH1} fill="#fafafa" />

          {peakSegments.map(([segStart, segEnd], segIdx) => {
            const x1 = Math.max(pad1.left, xFor1(segStart) - halfStep1);
            const x2 = Math.min(pad1.left + plotW1, xFor1(segEnd) + halfStep1);
            return (
              <g key={`${segStart}-${segEnd}`}>
                <rect
                  x={x1}
                  y={pad1.top}
                  width={Math.max(1, x2 - x1)}
                  height={plotH1}
                  fill="rgba(255, 77, 0, 0.065)"
                />
                <line
                  x1={x1}
                  y1={pad1.top}
                  x2={x1}
                  y2={pad1.top + plotH1}
                  stroke="rgba(224, 68, 0, 0.45)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={x2}
                  y1={pad1.top}
                  x2={x2}
                  y2={pad1.top + plotH1}
                  stroke="rgba(224, 68, 0, 0.45)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                {segIdx === 0 && (
                  <text
                    x={x1 + 5}
                    y={pad1.top + 11}
                    fill="#d94100"
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily='"Chivo Mono", monospace'
                  >
                    PEAK {peakWindowLabel}
                  </text>
                )}
              </g>
            );
          })}

          {yTicks1.map((tick) => {
            const y = yForKw1(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad1.left}
                  y1={y}
                  x2={w1 - pad1.right}
                  y2={y}
                  stroke={tick === 0 ? 'rgba(17,17,19,0.28)' : 'rgba(17,17,19,0.09)'}
                  strokeWidth="1"
                />
                <text
                  x={pad1.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="rgba(17,17,19,0.68)"
                  fontSize="9.5"
                  fontFamily='"Chivo Mono", monospace'
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <text
            x={13}
            y={pad1.top + plotH1 / 2}
            transform={`rotate(-90 13 ${pad1.top + plotH1 / 2})`}
            textAnchor="middle"
            fill="rgba(17,17,19,0.58)"
            fontSize="9"
            fontFamily='"Chivo Mono", monospace'
          >
            POWER (kW)
          </text>

          {AXIS_TICKS.map((idx) => {
            const x = xFor1(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={pad1.top}
                  x2={x}
                  y2={pad1.top + plotH1}
                  stroke="rgba(17,17,19,0.06)"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={h1 - 6}
                  textAnchor="middle"
                  fill="rgba(17,17,19,0.68)"
                  fontSize="9"
                  fontFamily='"Chivo Mono", monospace'
                >
                  {formatIntervalLabel(idx, timeConvention)}
                </text>
              </g>
            );
          })}

          <path d={shavedAreaPath} fill="#059669" fillOpacity="0.18" />
          <path d={pvAreaPath} fill="#d97706" fillOpacity="0.14" />
          <polyline fill="none" stroke="#d97706" strokeWidth="1.4" points={poly1((r) => r.pvKw)} />
          <polyline
            fill="none"
            stroke="rgba(17,17,19,0.4)"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            points={poly1((r) => r.loadKw)}
          />
          <polyline
            fill="none"
            stroke="rgba(17,17,19,0.72)"
            strokeWidth="1.4"
            strokeDasharray="5 4"
            points={poly1((r) => r.netBeforeKw)}
          />

          <line
            x1={pad1.left}
            y1={yForKw1(params.targetCapKw)}
            x2={w1 - pad1.right}
            y2={yForKw1(params.targetCapKw)}
            stroke="#dc2626"
            strokeWidth="1.25"
            strokeDasharray="7 4"
          />
          <text
            x={w1 - pad1.right - 4}
            y={yForKw1(params.targetCapKw) - 5}
            textAnchor="end"
            fill="#dc2626"
            fontSize="9.5"
            fontWeight="700"
            fontFamily='"Chivo Mono", monospace'
          >
            P_CAP = {params.targetCapKw} kW
          </text>

          <polyline
            fill="none"
            stroke="#e04400"
            strokeWidth="2.2"
            strokeLinejoin="round"
            points={poly1((r) => r.netAfterKw)}
          />
          <circle
            cx={xFor1(summary.peakAfterInterval)}
            cy={yForKw1(summary.peakAfterKw)}
            r="4"
            fill="#e04400"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="pt-2 border-t border-[#111113]/15">
        <div className="flex items-center justify-between mb-1 font-mono text-[7pt] uppercase tracking-[0.06em]">
          <span className="font-bold text-[#111113]">
            Fig 2. BESS Charge/Discharge Power (kW) &amp; State of Charge (%)
          </span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-sky-700">
              <span className="w-2 h-2 bg-sky-600 inline-block" />
              Charge (+kW)
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="w-2 h-2 bg-emerald-600 inline-block" />
              Discharge (−kW)
            </span>
            <span className="inline-flex items-center gap-1 text-violet-700 font-bold">
              <span className="w-2.5 h-0.5 bg-violet-700 inline-block" />
              SOC (%)
            </span>
          </div>
        </div>

        <svg viewBox={`0 0 ${w2} ${h2}`} className="w-full h-auto block">
          <rect
            x={pad2.left}
            y={pad2.top}
            width={plotW2}
            height={Math.max(0, yForSoc2(params.socMaxPct) - pad2.top)}
            fill="rgba(17,17,19,0.04)"
          />
          <rect
            x={pad2.left}
            y={yForSoc2(params.socMinPct)}
            width={plotW2}
            height={Math.max(0, pad2.top + plotH2 - yForSoc2(params.socMinPct))}
            fill="rgba(255,77,0,0.07)"
          />

          {peakSegments.map(([segStart, segEnd]) => {
            const x1 = Math.max(pad2.left, xFor2(segStart) - halfStep2);
            const x2 = Math.min(pad2.left + plotW2, xFor2(segEnd) + halfStep2);
            return (
              <rect
                key={`p2-${segStart}-${segEnd}`}
                x={x1}
                y={pad2.top}
                width={Math.max(1, x2 - x1)}
                height={plotH2}
                fill="rgba(255, 77, 0, 0.05)"
              />
            );
          })}

          {[-pBound, -pBound / 2, 0, pBound / 2, pBound].map((val) => {
            const y = yForPower2(val);
            return (
              <g key={val}>
                <line
                  x1={pad2.left}
                  y1={y}
                  x2={w2 - pad2.right}
                  y2={y}
                  stroke={val === 0 ? 'rgba(17,17,19,0.28)' : 'rgba(17,17,19,0.08)'}
                />
                <text
                  x={pad2.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="rgba(17,17,19,0.68)"
                  fontSize="9"
                  fontFamily='"Chivo Mono", monospace'
                >
                  {val > 0 ? `+${val}` : val}
                </text>
              </g>
            );
          })}

          {[0, 25, 50, 75, 100].map((pct) => (
            <text
              key={pct}
              x={w2 - pad2.right + 8}
              y={yForSoc2(pct) + 3.5}
              textAnchor="start"
              fill="#6d28d9"
              fontSize="9"
              fontFamily='"Chivo Mono", monospace'
            >
              {pct}%
            </text>
          ))}

          <line
            x1={pad2.left}
            y1={yForSoc2(params.socMaxPct)}
            x2={w2 - pad2.right}
            y2={yForSoc2(params.socMaxPct)}
            stroke="#7c3aed"
            strokeOpacity="0.5"
            strokeDasharray="4 4"
          />
          <line
            x1={pad2.left}
            y1={yForSoc2(params.socMinPct)}
            x2={w2 - pad2.right}
            y2={yForSoc2(params.socMinPct)}
            stroke="#e04400"
            strokeOpacity="0.6"
            strokeDasharray="4 4"
          />

          {intervals.map((r) => {
            const x = xFor2(r.interval) - barWidth2 / 2;
            const yZero = yForPower2(0);
            const yVal = yForPower2(r.bessKw);
            return (
              <rect
                key={r.interval}
                x={x}
                y={Math.min(yZero, yVal)}
                width={barWidth2}
                height={Math.max(1, Math.abs(yVal - yZero))}
                fill={
                  r.bessKw > 0.05
                    ? '#0284c7'
                    : r.bessKw < -0.05
                    ? '#059669'
                    : 'rgba(17,17,19,0.18)'
                }
                fillOpacity="0.82"
              />
            );
          })}

          {AXIS_TICKS.map((idx) => (
            <text
              key={idx}
              x={xFor2(idx)}
              y={h2 - 6}
              textAnchor="middle"
              fill="rgba(17,17,19,0.68)"
              fontSize="9"
              fontFamily='"Chivo Mono", monospace'
            >
              {formatIntervalLabel(idx, timeConvention)}
            </text>
          ))}

          <polyline
            fill="none"
            stroke="#7c3aed"
            strokeWidth="2"
            strokeLinejoin="round"
            points={socLinePoints}
          />
        </svg>
      </div>
    </div>
  );
}

function ReportSchematicSvg({
  intervalData,
  params,
}: {
  intervalData: IntervalResult;
  params: SimulationParams;
}) {
  const isDischarging = intervalData.bessKw < -0.05;
  const isCharging = intervalData.bessKw > 0.05;
  const isGridImport = intervalData.netAfterKw > 0.05;
  const isGridExport = intervalData.netAfterKw < -0.05;
  const hasPv = intervalData.pvKw > 0.05;
  const socRatio =
    params.bessCapacityKwh > 0
      ? Math.max(0, Math.min(1, intervalData.energyEndKwh / params.bessCapacityKwh))
      : 0;

  return (
    <svg viewBox="0 0 820 156" className="w-full h-auto block">
      <defs>
        <marker id="rpt-arr-orange" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#e04400" />
        </marker>
        <marker id="rpt-arr-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#d97706" />
        </marker>
        <marker id="rpt-arr-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#059669" />
        </marker>
        <marker id="rpt-arr-sky" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0284c7" />
        </marker>
        <marker id="rpt-arr-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#111113" />
        </marker>
      </defs>

      {/* Solar PV */}
      <g transform="translate(300, 2)">
        <rect
          width="220"
          height="40"
          fill="#ffffff"
          stroke={hasPv ? '#d97706' : 'rgba(17,17,19,0.24)'}
          strokeWidth="1"
        />
        <text x="10" y="13" fill="rgba(17,17,19,0.65)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          SOLAR PV ARRAY
        </text>
        <text x="210" y="13" textAnchor="end" fill="rgba(17,17,19,0.52)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          PEAK {params.solarPeakKw} kW
        </text>
        <text x="10" y="33" fill={hasPv ? '#d97706' : '#111113'} fontSize="15" fontWeight="700" fontFamily='"Chivo Mono", monospace'>
          {intervalData.pvKw.toFixed(1)}{' '}
          <tspan fontSize="9.5" fill="rgba(17,17,19,0.52)" fontWeight="400">
            kW
          </tspan>
        </text>
        <text x="210" y="33" textAnchor="end" fill="rgba(17,17,19,0.65)" fontSize="9.5" fontFamily='"Chivo Mono", monospace'>
          {params.solarPeakKw > 0 ? `${((intervalData.pvKw / params.solarPeakKw) * 100).toFixed(0)}%` : '0%'}
        </text>
      </g>

      <line
        x1="410"
        y1="42"
        x2="410"
        y2="56"
        stroke={hasPv ? '#d97706' : 'rgba(17,17,19,0.24)'}
        strokeWidth={hasPv ? '2' : '1'}
        markerEnd={hasPv ? 'url(#rpt-arr-amber)' : undefined}
      />

      {/* Utility Grid */}
      <g transform="translate(16, 51)">
        <rect
          width="196"
          height="50"
          fill="#ffffff"
          stroke={intervalData.aboveCap ? '#e04400' : 'rgba(17,17,19,0.24)'}
          strokeWidth={intervalData.aboveCap ? '1.5' : '1'}
        />
        <text x="10" y="15" fill={intervalData.aboveCap ? '#e04400' : 'rgba(17,17,19,0.65)'} fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          UTILITY GRID (PCC)
        </text>
        <text x="10" y="38" fill={intervalData.aboveCap ? '#e04400' : '#111113'} fontSize="15.5" fontWeight="700" fontFamily='"Chivo Mono", monospace'>
          {intervalData.netAfterKw.toFixed(1)}{' '}
          <tspan fontSize="9.5" fill="rgba(17,17,19,0.52)" fontWeight="400">
            kW
          </tspan>
        </text>
        <text x="186" y="38" textAnchor="end" fill={intervalData.aboveCap ? '#e04400' : 'rgba(17,17,19,0.6)'} fontSize="9.5" fontFamily='"Chivo Mono", monospace'>
          {isGridExport ? 'EXPORT' : intervalData.aboveCap ? `+${(intervalData.netAfterKw - params.targetCapKw).toFixed(1)}` : `≤${params.targetCapKw}`}
        </text>
      </g>

      <line
        x1={isGridExport ? 336 : 212}
        y1="76"
        x2={isGridExport ? 216 : 332}
        y2="76"
        stroke={intervalData.aboveCap ? '#e04400' : isGridExport ? '#d97706' : isGridImport ? '#111113' : 'rgba(17,17,19,0.24)'}
        strokeWidth={isGridImport || isGridExport ? '2' : '1'}
        markerEnd={isGridExport ? 'url(#rpt-arr-amber)' : intervalData.aboveCap ? 'url(#rpt-arr-orange)' : isGridImport ? 'url(#rpt-arr-ink)' : undefined}
      />
      <text x="274" y="69" textAnchor="middle" fill="rgba(17,17,19,0.6)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
        {isGridExport ? 'EXPORT' : 'IMPORT'}
      </text>

      {/* AC Bus */}
      <g transform="translate(336, 58)">
        <rect width="148" height="36" fill="#eceae4" stroke="rgba(17,17,19,0.32)" strokeWidth="1" />
        <text x="74" y="14" textAnchor="middle" fill="rgba(17,17,19,0.65)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          MICROGRID AC BUS
        </text>
        <text x="74" y="29" textAnchor="middle" fill="#111113" fontSize="10.5" fontWeight="700" fontFamily='"Chivo Mono", monospace'>
          NET₀ {intervalData.netBeforeKw.toFixed(1)} kW
        </text>
      </g>

      <line x1="484" y1="76" x2="604" y2="76" stroke="#111113" strokeWidth="2" markerEnd="url(#rpt-arr-ink)" />
      <text x="544" y="69" textAnchor="middle" fill="rgba(17,17,19,0.6)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
        SERVE LOAD
      </text>

      {/* Commercial Load */}
      <g transform="translate(608, 51)">
        <rect width="196" height="50" fill="#ffffff" stroke="rgba(17,17,19,0.24)" strokeWidth="1" />
        <text x="10" y="15" fill="rgba(17,17,19,0.65)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          COMMERCIAL LOAD
        </text>
        <text x="10" y="38" fill="#111113" fontSize="15.5" fontWeight="700" fontFamily='"Chivo Mono", monospace'>
          {intervalData.loadKw.toFixed(1)}{' '}
          <tspan fontSize="9.5" fill="rgba(17,17,19,0.52)" fontWeight="400">
            kW
          </tspan>
        </text>
        <text x="186" y="38" textAnchor="end" fill="rgba(17,17,19,0.6)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          DEMAND
        </text>
      </g>

      {/* BESS Link & Node */}
      <line
        x1="410"
        y1={isDischarging ? 112 : 94}
        x2="410"
        y2={isDischarging ? 98 : 108}
        stroke={isDischarging ? '#059669' : isCharging ? '#0284c7' : 'rgba(17,17,19,0.24)'}
        strokeWidth={isDischarging || isCharging ? '2' : '1'}
        markerEnd={isDischarging ? 'url(#rpt-arr-emerald)' : isCharging ? 'url(#rpt-arr-sky)' : undefined}
      />
      <text x="422" y="106" fill="rgba(17,17,19,0.65)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
        {isDischarging
          ? `DISCH −${(-intervalData.bessKw).toFixed(1)} kW`
          : isCharging
          ? `CHG +${intervalData.bessKw.toFixed(1)} kW`
          : 'IDLE 0.0 kW'}
      </text>

      <g transform="translate(250, 112)">
        <rect
          width="320"
          height="42"
          fill="#ffffff"
          stroke={intervalData.socFloorHit ? '#e04400' : isDischarging ? '#059669' : isCharging ? '#0284c7' : 'rgba(17,17,19,0.24)'}
          strokeWidth="1"
        />
        <text x="10" y="14" fill="rgba(17,17,19,0.65)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          BESS ({params.bessPowerKw} kW / {params.bessCapacityKwh} kWh)
        </text>
        <text x="310" y="14" textAnchor="end" fill="rgba(17,17,19,0.52)" fontSize="8.5" fontFamily='"Chivo Mono", monospace'>
          η_RT {params.roundTripEfficiencyPct.toFixed(1)}%
        </text>
        <text x="10" y="34" fill="#111113" fontSize="14.5" fontWeight="700" fontFamily='"Chivo Mono", monospace'>
          {intervalData.socEndPct.toFixed(1)}% SOC
        </text>
        <text x="128" y="34" fill="rgba(17,17,19,0.65)" fontSize="9.5" fontFamily='"Chivo Mono", monospace'>
          ({intervalData.energyEndKwh.toFixed(1)} kWh)
        </text>
        <rect x="228" y="25" width="80" height="7" fill="rgba(17,17,19,0.12)" />
        <rect
          x="228"
          y="25"
          width={Math.max(2, 80 * socRatio)}
          height="7"
          fill={intervalData.socFloorHit ? '#e04400' : isDischarging ? '#059669' : '#0284c7'}
        />
      </g>
    </svg>
  );
}

export function ReportPreviewModal({
  isOpen,
  onClose,
  params,
  metadata,
  dayResults,
  selectedDayIndex,
  selectedInterval,
  autoSizeScope,
  autoSizePreview,
  datasetSummary,
  onSelectDay,
}: ReportPreviewModalProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [zoom, setZoom] = useState<number>(0.78);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showMarginGuides, setShowMarginGuides] = useState<boolean>(false);

  const computeFitZoom = useCallback(() => {
    const containerW = scrollRef.current?.clientWidth ?? window.innerWidth;
    const availableW = Math.max(320, containerW - 64);
    const fit = Math.min(1.0, Math.max(0.42, availableW / A4_WIDTH_PX));
    return Math.round(fit * 100) / 100;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentPage(1);
    const timer = window.setTimeout(() => {
      setZoom(computeFitZoom());
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [isOpen, computeFitZoom]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const safeDayIndex = Math.min(selectedDayIndex, Math.max(0, dayResults.length - 1));
  const activeDay = dayResults[safeDayIndex] ?? dayResults[0];
  const summary = activeDay.output.summary;
  const intervals = activeDay.output.intervals;
  const selectedIntervalData = intervals[selectedInterval] ?? intervals[0];
  const timeConvention = metadata.timeConvention;

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
  const intervalsChecked = isWindowed ? summary.peakWindowIntervals : INTERVALS_PER_DAY;
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

  const topMultiDayRows = useMemo(() => {
    const indexed = dayResults.map((res, index) => ({ res, index }));
    indexed.sort((a, b) => b.res.originalMaxLoadKw - a.res.originalMaxLoadKw);
    return indexed.slice(0, 10);
  }, [dayResults]);

  const datasetTotals = useMemo(() => {
    let maxBeforeKw = -Infinity;
    let maxAfterKw = -Infinity;
    let totalLoadKwh = 0;
    let totalPvKwh = 0;
    let totalDischKwh = 0;
    let totalChgKwh = 0;
    let totalBreachHours = 0;
    for (const d of dayResults) {
      const s = d.output.summary;
      const b = s.isPeakWindowActive ? s.peakWindowBeforeKw : s.peakBeforeKw;
      const a = s.isPeakWindowActive ? s.peakWindowAfterKw : s.peakAfterKw;
      if (b > maxBeforeKw) maxBeforeKw = b;
      if (a > maxAfterKw) maxAfterKw = a;
      totalLoadKwh += s.totalLoadKwh;
      totalPvKwh += s.totalPvKwh;
      totalDischKwh += s.totalBessDischargedKwh;
      totalChgKwh += s.totalBessChargedKwh;
      totalBreachHours += s.isPeakWindowActive ? s.hoursAboveCapInWindow : s.hoursAboveCapAfter;
    }
    return {
      maxBeforeKw: maxBeforeKw === -Infinity ? 0 : maxBeforeKw,
      maxAfterKw: maxAfterKw === -Infinity ? 0 : maxAfterKw,
      totalLoadKwh,
      totalPvKwh,
      totalDischKwh,
      totalChgKwh,
      totalBreachHours,
    };
  }, [dayResults]);

  const scrollToPage = (pageNum: number) => {
    const target = Math.max(1, Math.min(TOTAL_PAGES, pageNum));
    setCurrentPage(target);
    const el = pageRefs.current[target - 1];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const midY = container.scrollTop + container.clientHeight * 0.35;
    let bestPage = 1;
    for (let i = 0; i < pageRefs.current.length; i++) {
      const el = pageRefs.current[i];
      if (!el) continue;
      if (el.offsetTop <= midY) {
        bestPage = i + 1;
      }
    }
    setCurrentPage(bestPage);
  };

  const handleStepZoom = (direction: -1 | 1) => {
    if (direction < 0) {
      const lower = [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.02);
      setZoom(lower ?? Math.max(0.4, Math.round((zoom - 0.1) * 100) / 100));
    } else {
      const higher = ZOOM_STEPS.find((z) => z > zoom + 0.02);
      setZoom(higher ?? Math.min(1.4, Math.round((zoom + 0.1) * 100) / 100));
    }
  };

  const generatedTimestamp = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-preview-title"
      className="a4-preview-overlay fixed inset-0 z-50 flex flex-col bg-[#222226] text-[#f2efeb]"
    >
      {/* Top Print Preview Toolbar (Microsoft Word-style) — hidden when printing */}
      <div className="print:hidden shrink-0 bg-[#161619] border-b border-white/15 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Document Title & Paper Spec */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 bg-[#ff4d00] text-[#f2efeb] flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="report-preview-title"
              className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#f2efeb] truncate"
            >
              A4 Print Preview · Peak Shaving Technical Report
            </h2>
            <div className="font-mono text-[9.5px] text-white/60 tabular-nums truncate">
              Standard A4 (210 × 297 mm) · Portrait · 13 mm Margins · {TOTAL_PAGES} Pages
            </div>
          </div>
        </div>

        {/* Center: Day Switcher, Page Stepper, Zoom & Margin Guides */}
        <div className="flex flex-wrap items-center gap-2">
          {dayResults.length > 1 && (
            <select
              aria-label="Inspect day in report"
              value={safeDayIndex}
              onChange={(e) => onSelectDay(parseInt(e.target.value, 10))}
              className="h-7 px-2 bg-[#232328] border border-white/20 font-mono text-[10px] text-[#f2efeb] tabular-nums focus:border-[#ff4d00] focus:outline-none cursor-pointer"
            >
              {dayResults.map((d, idx) => (
                <option key={d.dateKey} value={idx} className="bg-[#161619] text-[#f2efeb]">
                  {d.displayDate} (Peak {d.originalMaxLoadKw.toFixed(0)} kW)
                </option>
              ))}
            </select>
          )}

          {/* Page Navigation */}
          <div className="inline-flex items-center border border-white/20 bg-[#232328] h-7">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => scrollToPage(currentPage - 1)}
              aria-label="Previous report page"
              className="px-1.5 h-full hover:bg-white/10 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <span className="px-2 font-mono text-[10px] tabular-nums whitespace-nowrap">
              Page {currentPage} / {TOTAL_PAGES}
            </span>
            <button
              type="button"
              disabled={currentPage >= TOTAL_PAGES}
              onClick={() => scrollToPage(currentPage + 1)}
              aria-label="Next report page"
              className="px-1.5 h-full hover:bg-white/10 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="inline-flex items-center border border-white/20 bg-[#232328] h-7">
            <button
              type="button"
              onClick={() => handleStepZoom(-1)}
              aria-label="Zoom out preview"
              title="Zoom out"
              className="px-1.5 h-full hover:bg-white/10 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <span className="px-2 font-mono text-[10px] tabular-nums min-w-[44px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleStepZoom(1)}
              aria-label="Zoom in preview"
              title="Zoom in"
              className="px-1.5 h-full hover:bg-white/10 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(computeFitZoom())}
              title="Fit A4 page width to window"
              className="px-2 h-full border-l border-white/15 hover:bg-white/10 font-mono text-[9.5px] uppercase tracking-[0.05em] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3 h-3" aria-hidden="true" />
              <span>Fit</span>
            </button>
          </div>

          {/* Margin Guides Toggle */}
          <button
            type="button"
            onClick={() => setShowMarginGuides((v) => !v)}
            aria-pressed={showMarginGuides}
            title="Show or hide printable 13mm A4 margin boundaries"
            className={`h-7 px-2.5 border font-mono text-[9.5px] uppercase tracking-[0.05em] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              showMarginGuides
                ? 'bg-sky-600/25 border-sky-400 text-sky-200'
                : 'bg-[#232328] border-white/20 text-white/75 hover:text-white hover:bg-white/10'
            }`}
          >
            <Ruler className="w-3 h-3" aria-hidden="true" />
            <span>Margins</span>
          </button>
        </div>

        {/* Right: Print / Download PDF + Close */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="h-8 inline-flex items-center gap-2 px-3.5 bg-[#ff4d00] hover:bg-[#e04400] text-[#f2efeb] font-mono text-[10.5px] font-bold uppercase tracking-[0.06em] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Print / Download PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close print preview"
            className="h-8 px-2.5 bg-[#232328] hover:bg-white/15 border border-white/20 text-[#f2efeb] font-mono text-[10px] uppercase tracking-[0.06em] inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Scrollable A4 Print Preview Desk */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="a4-preview-scroll flex-1 min-h-0 overflow-auto tech-scroll bg-[#2b2b30] py-8 px-4 flex flex-col items-center gap-7"
      >
        {/* ==================== PAGE 1: EXECUTIVE SUMMARY & DISPATCH CHARTS ==================== */}
        <div
          ref={(el) => {
            pageRefs.current[0] = el;
          }}
          className="a4-page-slot shrink-0"
          style={{
            width: `${A4_WIDTH_MM * zoom}mm`,
            height: `${A4_HEIGHT_MM * zoom}mm`,
          }}
        >
          <article
            className="a4-page relative bg-white text-[#111113] shadow-[0_14px_40px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden"
            style={{
              width: `${A4_WIDTH_MM}mm`,
              height: `${A4_HEIGHT_MM}mm`,
              padding: '13mm',
              boxSizing: 'border-box',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <MarginGuides visible={showMarginGuides} />

            {/* Report Masthead */}
            <header className="pb-3 mb-3 border-b-2 border-[#111113] flex items-end justify-between gap-4">
              <div>
                <div className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.14em] text-[#e04400]">
                  BESS &amp; SOLAR MICROGRID SIMULATION REPORT
                </div>
                <h1 className="font-display text-[17pt] font-extrabold tracking-[-0.03em] text-[#111113] leading-tight mt-0.5">
                  MICROGRID PEAK SHAVER
                </h1>
                <div className="font-mono text-[7.5pt] text-[#111113]/65 mt-0.5">
                  Dataset: <strong className="text-[#111113]">{metadata.fileName}</strong> ·{' '}
                  {metadata.device} ({metadata.meterType}) · {dayResults.length}{' '}
                  {dayResults.length === 1 ? 'Day' : 'Days'} Loaded
                </div>
              </div>

              <div className="text-right font-mono text-[7pt] text-[#111113]/70 tabular-nums leading-relaxed shrink-0">
                <div>
                  INSPECTION DAY: <strong className="text-[#111113]">{activeDay.displayDate}</strong>
                </div>
                <div>
                  GENERATED: <strong className="text-[#111113]">{generatedTimestamp}</strong>
                </div>
                <div>
                  FORMAT: <strong className="text-[#111113]">ISO A4 (210 × 297 mm)</strong>
                </div>
              </div>
            </header>

            {/* Section 1: Executive KPI Summary */}
            <section className="mb-3">
              <div className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.1em] text-[#111113]/70 mb-1.5">
                01. Executive Performance Summary · {activeDay.displayDate}
              </div>
              <div className="grid grid-cols-4 border border-[#111113]/25 divide-x divide-[#111113]/20">
                <div className="p-2.5">
                  <div className="font-mono text-[6.8pt] uppercase tracking-[0.07em] text-[#111113]/60">
                    {isWindowed ? `Peak Net (${windowLabel})` : 'Peak Net Import'}
                  </div>
                  <div className="font-mono tabular-nums mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-[8.5pt] text-[#111113]/45 line-through">
                      {displayedBeforeKw.toFixed(1)}
                    </span>
                    <span className="text-[13pt] font-bold text-[#111113]">
                      {displayedAfterKw.toFixed(1)}
                    </span>
                    <span className="text-[7.5pt] text-[#111113]/60">kW</span>
                  </div>
                  <div className="font-mono tabular-nums text-[7pt] text-[#e04400] font-bold mt-0.5">
                    −{displayedReductionKw.toFixed(1)} kW (−{displayedReductionPct.toFixed(1)}%) @{' '}
                    {formatIntervalLabel(displayedAfterInterval, timeConvention)}
                  </div>
                </div>

                <div className="p-2.5">
                  <div className="font-mono text-[6.8pt] uppercase tracking-[0.07em] text-[#111113]/60">
                    Target Cap Compliance
                  </div>
                  <div className="font-mono tabular-nums mt-0.5 flex items-baseline gap-1">
                    <span className="text-[13pt] font-bold text-[#111113]">
                      {params.targetCapKw.toFixed(0)}
                    </span>
                    <span className="text-[7.5pt] text-[#111113]/60">kW cap</span>
                  </div>
                  <div
                    className={`font-mono tabular-nums text-[7pt] font-bold mt-0.5 ${
                      capMet ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {capMet
                      ? `● Held ${intervalsChecked} int (was ${hoursAboveCapBefore.toFixed(1)}h over)`
                      : `▲ ${hoursAboveCapAfter.toFixed(1)}h Over (was ${hoursAboveCapBefore.toFixed(1)}h)`}
                  </div>
                </div>

                <div className="p-2.5">
                  <div className="font-mono text-[6.8pt] uppercase tracking-[0.07em] text-[#111113]/60">
                    BESS SOC Excursion
                  </div>
                  <div className="font-mono tabular-nums mt-0.5 flex items-baseline gap-1">
                    <span className="text-[13pt] font-bold text-[#111113]">
                      {summary.minSocPct.toFixed(1)}%
                    </span>
                    <span className="text-[9pt] text-[#111113]/45">—</span>
                    <span className="text-[11pt] font-bold text-[#111113]/85">
                      {summary.maxSocPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-[7pt] text-[#111113]/65 mt-0.5">
                    {summary.socFloorHitInterval !== null
                      ? `▼ ${summary.eMinKwh.toFixed(0)} kWh floor @ ${formatIntervalLabel(
                          summary.socFloorHitInterval,
                          timeConvention
                        )}`
                      : `Min ${summary.minSocKwh.toFixed(0)} kWh @ ${formatIntervalLabel(
                          summary.minSocInterval ?? 0,
                          timeConvention
                        )}`}
                  </div>
                </div>

                <div className="p-2.5">
                  <div className="font-mono text-[6.8pt] uppercase tracking-[0.07em] text-[#111113]/60">
                    Est. Demand Savings
                  </div>
                  <div className="font-mono tabular-nums mt-0.5 flex items-baseline gap-1">
                    <span className="text-[13pt] font-bold text-[#111113]">
                      $
                      {summary.monthlyDemandSavingsUsd.toLocaleString('en-US', {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="text-[7.5pt] text-[#111113]/60">/ MO</span>
                  </div>
                  <div className="font-mono tabular-nums text-[7pt] text-[#111113]/65 mt-0.5">
                    ${summary.annualDemandSavingsUsd.toLocaleString('en-US', {
                      maximumFractionDigits: 0,
                    })}{' '}
                    / yr @ ${params.demandChargeRate}/kW
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: System Parameters & Auto-Sizing Specification */}
            <section className="mb-3">
              <div className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.1em] text-[#111113]/70 mb-1.5">
                02. System Parameters &amp; Auto-Sizing Specification
              </div>
              <div className="grid grid-cols-2 gap-3">
                <table className="w-full border-collapse border border-[#111113]/20 font-mono text-[7.3pt] tabular-nums">
                  <tbody>
                    <tr className="border-b border-[#111113]/12 bg-[#111113]/[0.03]">
                      <td className="px-2 py-1 text-[#111113]/70">Desired Max Demand (P_cap)</td>
                      <td className="px-2 py-1 text-right font-bold">{params.targetCapKw.toFixed(0)} kW</td>
                    </tr>
                    <tr className="border-b border-[#111113]/12">
                      <td className="px-2 py-1 text-[#111113]/70">Transformer Limit (P_TX)</td>
                      <td className="px-2 py-1 text-right font-bold">{params.transformerLimitKw.toFixed(0)} kW</td>
                    </tr>
                    <tr className="border-b border-[#111113]/12 bg-[#111113]/[0.03]">
                      <td className="px-2 py-1 text-[#111113]/70">Solar PV Array Peak</td>
                      <td className="px-2 py-1 text-right font-bold">
                        {params.solarPeakKw.toFixed(0)} kW ({params.irradiancePct}% irr.)
                      </td>
                    </tr>
                    <tr className="border-b border-[#111113]/12">
                      <td className="px-2 py-1 text-[#111113]/70">Battery Capacity (E_nom)</td>
                      <td className="px-2 py-1 text-right font-bold">{params.bessCapacityKwh.toLocaleString()} kWh</td>
                    </tr>
                    <tr className="border-b border-[#111113]/12 bg-[#111113]/[0.03]">
                      <td className="px-2 py-1 text-[#111113]/70">Inverter Rating (P_BESS,max)</td>
                      <td className="px-2 py-1 text-right font-bold">{params.bessPowerKw.toLocaleString()} kW</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-[#111113]/70">Dispatch Strategy</td>
                      <td className="px-2 py-1 text-right font-bold">{strategyDisplayName(params.chargingStrategy)}</td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse border border-[#111113]/20 font-mono text-[7.3pt] tabular-nums">
                  <tbody>
                    <tr className="border-b border-[#111113]/12 bg-[#111113]/[0.03]">
                      <td className="px-2 py-1 text-[#111113]/70">Peak Shaving Window</td>
                      <td className="px-2 py-1 text-right font-bold">
                        {windowLabel} ({isFullDayPeakWindow(params.peakStartMinutes, params.peakEndMinutes) ? '24h' : `${(intervalsChecked * 0.5).toFixed(1)}h`})
                      </td>
                    </tr>
                    <tr className="border-b border-[#111113]/12">
                      <td className="px-2 py-1 text-[#111113]/70">SOC Operating Bounds</td>
                      <td className="px-2 py-1 text-right font-bold">
                        {params.socMinPct}%–{params.socMaxPct}% (Init {params.initialSocPct}%)
                      </td>
                    </tr>
                    <tr className="border-b border-[#111113]/12 bg-[#111113]/[0.03]">
                      <td className="px-2 py-1 text-[#111113]/70">Round-Trip Efficiency (η_RT)</td>
                      <td className="px-2 py-1 text-right font-bold">
                        {params.roundTripEfficiencyPct.toFixed(1)}% (η_c=η_d={(summary.etaC * 100).toFixed(2)}%)
                      </td>
                    </tr>
                    <tr className="border-b border-[#111113]/12">
                      <td className="px-2 py-1 text-[#111113]/70">Load Scale / Non-Peak Ceiling</td>
                      <td className="px-2 py-1 text-right font-bold">
                        {params.loadScalePct}% / {params.offPeakChargeToTransformer ? 'TX Limit' : 'Target Cap'}
                      </td>
                    </tr>
                    <tr className="border-b border-[#111113]/12 bg-[#111113]/[0.03]">
                      <td className="px-2 py-1 text-[#111113]/70">
                        Auto-Size ({autoSizeScope === 'all_days' ? `All ${dayResults.length}D` : 'Active Day'})
                      </td>
                      <td className="px-2 py-1 text-right font-bold">
                        {autoSizePreview.recommendedPowerKw} kW / {autoSizePreview.recommendedCapacityKwh.toLocaleString()} kWh
                      </td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 text-[#111113]/70">Sizing Verification</td>
                      <td
                        className={`px-2 py-1 text-right font-bold ${
                          datasetSummary.totalBreachIntervals === 0
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {datasetSummary.totalBreachIntervals === 0
                          ? autoSizePreview.alreadyCompliant
                            ? 'Already Compliant (0 kW)'
                            : `Verified 0 Breaches (Min ${datasetSummary.minSocObservedPct.toFixed(1)}%)`
                          : !autoSizePreview.feasible
                          ? `${datasetSummary.totalBreachIntervals} Breaches · Recharge Constrained`
                          : `${datasetSummary.totalBreachIntervals} Breaches (${datasetSummary.totalBreachHours.toFixed(1)}h · Min ${datasetSummary.minSocObservedPct.toFixed(1)}%)`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3: 24-Hour Dispatch & SOC Profiles */}
            <section className="flex-1 min-h-0 flex flex-col">
              <div className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.1em] text-[#111113]/70 mb-1.5">
                03. 24-Hour Dispatch &amp; State-of-Charge Curves · {activeDay.displayDate}
              </div>
              <ReportDispatchChartsSvg
                intervals={intervals}
                summary={summary}
                params={params}
                timeConvention={timeConvention}
              />
            </section>

            <A4PageFooter pageNumber={1} totalPages={TOTAL_PAGES} timeConvention={timeConvention} />
          </article>
        </div>

        {/* ==================== PAGE 2: 48-INTERVAL 30-MIN DISPATCH LEDGER ==================== */}
        <div
          ref={(el) => {
            pageRefs.current[1] = el;
          }}
          className="a4-page-slot shrink-0"
          style={{
            width: `${A4_WIDTH_MM * zoom}mm`,
            height: `${A4_HEIGHT_MM * zoom}mm`,
          }}
        >
          <article
            className="a4-page relative bg-white text-[#111113] shadow-[0_14px_40px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden"
            style={{
              width: `${A4_WIDTH_MM}mm`,
              height: `${A4_HEIGHT_MM}mm`,
              padding: '13mm',
              boxSizing: 'border-box',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <MarginGuides visible={showMarginGuides} />

            <A4PageHeader
              pageNumber={2}
              totalPages={TOTAL_PAGES}
              sectionTitle="04. 30-Minute Dispatch Ledger (All 48 Intervals)"
              activeDateLabel={activeDay.displayDate}
              fileName={metadata.fileName}
            />

            {/* Daily Energy Balance Strip */}
            <div className="grid grid-cols-6 border border-[#111113]/20 divide-x divide-[#111113]/15 mb-2.5 font-mono tabular-nums bg-[#111113]/[0.025]">
              <div className="px-2 py-1.5">
                <div className="text-[6.2pt] uppercase text-[#111113]/60">Total Load</div>
                <div className="text-[8.5pt] font-bold">{summary.totalLoadKwh.toFixed(0)} kWh</div>
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[6.2pt] uppercase text-[#111113]/60">Solar PV Gen</div>
                <div className="text-[8.5pt] font-bold text-amber-700">{summary.totalPvKwh.toFixed(0)} kWh</div>
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[6.2pt] uppercase text-[#111113]/60">Grid Import (Before)</div>
                <div className="text-[8.5pt] font-bold">{summary.totalGridImportBeforeKwh.toFixed(0)} kWh</div>
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[6.2pt] uppercase text-[#111113]/60">Grid Import (After)</div>
                <div className="text-[8.5pt] font-bold text-[#e04400]">{summary.totalGridImportAfterKwh.toFixed(0)} kWh</div>
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[6.2pt] uppercase text-[#111113]/60">BESS Chg / Disch</div>
                <div className="text-[8pt] font-bold">
                  +{summary.totalBessChargedKwh.toFixed(0)} / −{summary.totalBessDischargedKwh.toFixed(0)}
                </div>
              </div>
              <div className="px-2 py-1.5">
                <div className="text-[6.2pt] uppercase text-[#111113]/60">Conv. Losses</div>
                <div className="text-[8.5pt] font-bold">{summary.totalConversionLossesKwh.toFixed(1)} kWh</div>
              </div>
            </div>

            {/* 48-Row Ledger Table */}
            <div className="flex-1 min-h-0">
              <table className="w-full border-collapse border border-[#111113]/25 font-mono text-[6.9pt] tabular-nums">
                <thead>
                  <tr className="bg-[#111113] text-[#f6f5f2] text-[6.5pt] uppercase tracking-[0.04em]">
                    <th className="py-1 px-1.5 text-left font-bold">#</th>
                    <th className="py-1 px-1.5 text-left font-bold">Interval</th>
                    <th className="py-1 px-1 text-center font-bold">Win</th>
                    <th className="py-1 px-1.5 text-right font-bold">Load (kW)</th>
                    <th className="py-1 px-1.5 text-right font-bold">PV (kW)</th>
                    <th className="py-1 px-1.5 text-right font-bold">Net₀ (kW)</th>
                    <th className="py-1 px-1.5 text-right font-bold">BESS (kW)</th>
                    <th className="py-1 px-1.5 text-right font-bold">Net (kW)</th>
                    <th className="py-1 px-1.5 text-right font-bold">Shaved</th>
                    <th className="py-1 px-1.5 text-right font-bold">SOC</th>
                    <th className="py-1 px-1.5 text-right font-bold">Energy</th>
                    <th className="py-1 px-1.5 text-left font-bold">State</th>
                  </tr>
                </thead>
                <tbody>
                  {intervals.map((row) => {
                    const highlightPeak =
                      !isFullDayPeakWindow(params.peakStartMinutes, params.peakEndMinutes) &&
                      row.inPeakPeriod;
                    return (
                      <tr
                        key={row.interval}
                        className={`border-b border-[#111113]/10 leading-[1.2] ${
                          row.aboveCap
                            ? 'bg-orange-50'
                            : highlightPeak
                            ? 'bg-orange-50/45'
                            : row.interval % 2 === 1
                            ? 'bg-[#111113]/[0.02]'
                            : 'bg-white'
                        }`}
                      >
                        <td className="py-[1.9px] px-1.5 text-[#111113]/55">
                          {String(row.interval + 1).padStart(2, '0')}
                        </td>
                        <td className="py-[1.9px] px-1.5 font-bold whitespace-nowrap">
                          {formatIntervalWindow(row.interval, timeConvention)}
                        </td>
                        <td className="py-[1.9px] px-1 text-center">
                          {row.inPeakPeriod ? (
                            <span className="font-bold text-[#e04400]">PK</span>
                          ) : (
                            <span className="text-[#111113]/35">—</span>
                          )}
                        </td>
                        <td className="py-[1.9px] px-1.5 text-right">{row.loadKw.toFixed(1)}</td>
                        <td className="py-[1.9px] px-1.5 text-right text-amber-800">
                          {row.pvKw.toFixed(1)}
                        </td>
                        <td className="py-[1.9px] px-1.5 text-right text-[#111113]/75">
                          {row.netBeforeKw.toFixed(1)}
                        </td>
                        <td
                          className={`py-[1.9px] px-1.5 text-right font-bold ${
                            row.bessKw < -0.05
                              ? 'text-emerald-700'
                              : row.bessKw > 0.05
                              ? 'text-sky-700'
                              : 'text-[#111113]/40'
                          }`}
                        >
                          {row.bessKw > 0.05
                            ? `+${row.bessKw.toFixed(1)}`
                            : row.bessKw < -0.05
                            ? row.bessKw.toFixed(1)
                            : '0.0'}
                        </td>
                        <td
                          className={`py-[1.9px] px-1.5 text-right font-bold ${
                            row.aboveCap ? 'text-[#e04400]' : 'text-[#111113]'
                          }`}
                        >
                          {row.netAfterKw.toFixed(1)}
                        </td>
                        <td className="py-[1.9px] px-1.5 text-right text-emerald-700">
                          {row.peakShavedKw > 0.05 ? row.peakShavedKw.toFixed(1) : '—'}
                        </td>
                        <td className="py-[1.9px] px-1.5 text-right font-bold">
                          {row.socEndPct.toFixed(1)}%
                        </td>
                        <td className="py-[1.9px] px-1.5 text-right text-[#111113]/75">
                          {row.energyEndKwh.toFixed(0)} kWh
                        </td>
                        <td
                          className={`py-[1.9px] px-1.5 whitespace-nowrap ${
                            row.aboveCap || row.socFloorHit
                              ? 'text-[#e04400] font-bold'
                              : 'text-[#111113]/75'
                          }`}
                        >
                          {row.stateGlyph} {row.stateLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <A4PageFooter pageNumber={2} totalPages={TOTAL_PAGES} timeConvention={timeConvention} />
          </article>
        </div>

        {/* ==================== PAGE 3: MULTI-DAY SUMMARY, SCHEMATIC & EQUATIONS ==================== */}
        <div
          ref={(el) => {
            pageRefs.current[2] = el;
          }}
          className="a4-page-slot shrink-0"
          style={{
            width: `${A4_WIDTH_MM * zoom}mm`,
            height: `${A4_HEIGHT_MM * zoom}mm`,
          }}
        >
          <article
            className="a4-page relative bg-white text-[#111113] shadow-[0_14px_40px_rgba(0,0,0,0.45)] flex flex-col overflow-hidden"
            style={{
              width: `${A4_WIDTH_MM}mm`,
              height: `${A4_HEIGHT_MM}mm`,
              padding: '13mm',
              boxSizing: 'border-box',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <MarginGuides visible={showMarginGuides} />

            <A4PageHeader
              pageNumber={3}
              totalPages={TOTAL_PAGES}
              sectionTitle="05. Multi-Day Critical Peaks, Power Flow & Governing Model"
              activeDateLabel={activeDay.displayDate}
              fileName={metadata.fileName}
            />

            {/* Section 5A: Multi-Day Dataset Performance */}
            <section className="mb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.1em] text-[#111113]/70">
                  A. Dataset Critical Peak Ranking ({dayResults.length}{' '}
                  {dayResults.length === 1 ? 'Day' : 'Days'} · Top {topMultiDayRows.length} Shown)
                </span>
                <span className="font-mono text-[7pt] text-[#111113]/65 tabular-nums">
                  Dataset Max Net: {datasetTotals.maxBeforeKw.toFixed(1)} →{' '}
                  <strong className="text-[#111113]">{datasetTotals.maxAfterKw.toFixed(1)} kW</strong> ·
                  Total Breaches: <strong>{datasetTotals.totalBreachHours.toFixed(1)} h</strong>
                </span>
              </div>

              <table className="w-full border-collapse border border-[#111113]/25 font-mono text-[7.2pt] tabular-nums">
                <thead>
                  <tr className="bg-[#111113]/[0.06] border-b border-[#111113]/20 text-[6.7pt] uppercase tracking-[0.04em] text-[#111113]/75">
                    <th className="py-1 px-2 text-left">Rank</th>
                    <th className="py-1 px-2 text-left">Date</th>
                    <th className="py-1 px-2 text-right">Raw Peak</th>
                    <th className="py-1 px-2 text-right">Net₀ Peak</th>
                    <th className="py-1 px-2 text-right">Net After</th>
                    <th className="py-1 px-2 text-right">Shaved</th>
                    <th className="py-1 px-2 text-right">Min SOC</th>
                    <th className="py-1 px-2 text-right">Cap Over</th>
                    <th className="py-1 px-2 text-right">Savings/Mo</th>
                  </tr>
                </thead>
                <tbody>
                  {topMultiDayRows.map(({ res, index }, idx) => {
                    const s = res.output.summary;
                    const isSelectedDay = index === safeDayIndex;
                    const overHrs = s.isPeakWindowActive ? s.hoursAboveCapInWindow : s.hoursAboveCapAfter;
                    return (
                      <tr
                        key={res.dateKey}
                        className={`border-b border-[#111113]/10 ${
                          isSelectedDay ? 'bg-orange-50 font-bold' : idx % 2 === 1 ? 'bg-[#111113]/[0.02]' : ''
                        }`}
                      >
                        <td className="py-1 px-2">#{idx + 1}</td>
                        <td className="py-1 px-2">
                          {res.displayDate} {isSelectedDay ? '(Inspected)' : ''}
                        </td>
                        <td className="py-1 px-2 text-right">{res.originalMaxLoadKw.toFixed(1)} kW</td>
                        <td className="py-1 px-2 text-right">{s.peakBeforeKw.toFixed(1)} kW</td>
                        <td
                          className={`py-1 px-2 text-right ${
                            s.peakAfterKw > params.targetCapKw + 0.05 ? 'text-[#e04400]' : ''
                          }`}
                        >
                          {s.peakAfterKw.toFixed(1)} kW
                        </td>
                        <td className="py-1 px-2 text-right text-emerald-700">
                          −{s.peakReductionKw.toFixed(1)} kW
                        </td>
                        <td className="py-1 px-2 text-right">{s.minSocPct.toFixed(1)}%</td>
                        <td
                          className={`py-1 px-2 text-right ${
                            overHrs > 0 ? 'text-[#e04400]' : 'text-emerald-700'
                          }`}
                        >
                          {overHrs.toFixed(1)} h
                        </td>
                        <td className="py-1 px-2 text-right">
                          ${s.monthlyDemandSavingsUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            {/* Section 5B: Inspected Interval Power Flow Schematic */}
            <section className="mb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.1em] text-[#111113]/70">
                  B. Single-Line Power Flow Snapshot · {activeDay.displayDate} @{' '}
                  {formatIntervalWindow(selectedIntervalData.interval, timeConvention)}
                </span>
                <span className="font-mono text-[7pt] font-bold uppercase text-[#111113]">
                  {selectedIntervalData.stateGlyph} {selectedIntervalData.stateLabel}
                </span>
              </div>
              <div className="border border-[#111113]/20 p-2.5 bg-[#fafafa]">
                <ReportSchematicSvg intervalData={selectedIntervalData} params={params} />
                <div className="mt-1.5 pt-1.5 border-t border-[#111113]/15 flex items-center justify-between font-mono text-[7.3pt] tabular-nums">
                  <span>
                    Instantaneous Bus Balance:{' '}
                    <strong>
                      P_net = {selectedIntervalData.loadKw.toFixed(1)} −{' '}
                      {selectedIntervalData.pvKw.toFixed(1)}{' '}
                      {selectedIntervalData.bessKw >= 0 ? '+' : '−'}{' '}
                      {Math.abs(selectedIntervalData.bessKw).toFixed(1)} ={' '}
                      {selectedIntervalData.netAfterKw.toFixed(1)} kW
                    </strong>
                  </span>
                  <span>
                    Interval Losses: <strong>{selectedIntervalData.lossesKwh.toFixed(2)} kWh</strong>
                  </span>
                </div>
              </div>
            </section>

            {/* Section 5C: Governing Dispatch Equations */}
            <section className="flex-1 min-h-0 flex flex-col">
              <div className="font-mono text-[7.5pt] font-bold uppercase tracking-[0.1em] text-[#111113]/70 mb-1.5">
                C. Governing BESS Dispatch &amp; Energy Conservation Model
              </div>
              <div className="grid grid-cols-2 gap-2.5 font-mono text-[7.1pt] leading-relaxed">
                <div className="border border-[#111113]/20 p-2.5">
                  <div className="font-bold uppercase text-[6.8pt] tracking-[0.06em] text-[#e04400] mb-1">
                    1. Net Bus Balance (Δt = 0.5 h)
                  </div>
                  <div className="text-[#111113] font-bold">
                    P_net,0(t) = P_load(t) − P_PV(t)
                  </div>
                  <div className="text-[#111113] font-bold">
                    P_net(t) = P_net,0(t) + P_BESS(t)
                  </div>
                  <div className="text-[#111113]/65 mt-1">
                    Sign convention: P_BESS &gt; 0 denotes charging from AC bus; P_BESS &lt; 0 denotes
                    peak-shaving discharge to AC bus.
                  </div>
                </div>

                <div className="border border-[#111113]/20 p-2.5">
                  <div className="font-bold uppercase text-[6.8pt] tracking-[0.06em] text-[#e04400] mb-1">
                    2. Peak Shaving Discharge Dispatch
                  </div>
                  <div className="text-[#111113] font-bold">
                    P_disch(t) = min(P_BESS,max, P_net,0(t) − P_cap, (E_t − E_min)·η_d / Δt)
                  </div>
                  <div className="text-[#111113]/65 mt-1">
                    Active during peak window ({windowLabel}) whenever P_net,0(t) &gt; P_cap. Subject to
                    inverter rating and SOC reserve floor E_min = {summary.eMinKwh.toFixed(0)} kWh.
                  </div>
                </div>

                <div className="border border-[#111113]/20 p-2.5">
                  <div className="font-bold uppercase text-[6.8pt] tracking-[0.06em] text-[#e04400] mb-1">
                    3. Battery Energy &amp; Symmetric Efficiency
                  </div>
                  <div className="text-[#111113] font-bold">
                    η_c = η_d = √η_RT = {(summary.etaC * 100).toFixed(2)}%
                  </div>
                  <div className="text-[#111113] font-bold">
                    E_{'{t+1}'} = E_t + P_chg·Δt·η_c − (|P_disch|·Δt)/η_d
                  </div>
                  <div className="text-[#111113]/65 mt-1">
                    SOC bounds enforced every interval: {params.socMinPct}% ≤ SOC ≤ {params.socMaxPct}%
                    ({summary.eMinKwh.toFixed(0)}–{summary.eMaxKwh.toFixed(0)} kWh).
                  </div>
                </div>

                <div className="border border-[#111113]/20 p-2.5">
                  <div className="font-bold uppercase text-[6.8pt] tracking-[0.06em] text-[#e04400] mb-1">
                    4. Charge Headroom &amp; Demand Savings
                  </div>
                  <div className="text-[#111113] font-bold">
                    P_chg(t) ≤ min(P_BESS,max, P_ceil − P_net,0(t), (E_max − E_t)/(η_c·Δt))
                  </div>
                  <div className="text-[#111113] font-bold mt-0.5">
                    Savings/mo = (Peak_before − Peak_after) × ${params.demandChargeRate}/kW
                  </div>
                  <div className="text-[#111113]/65 mt-1">
                    Current strategy: {strategyDisplayName(params.chargingStrategy)}.
                  </div>
                </div>
              </div>
            </section>

            <A4PageFooter pageNumber={3} totalPages={TOTAL_PAGES} timeConvention={timeConvention} />
          </article>
        </div>
      </div>
    </div>
  );
}
