import { useState } from 'react';
import {
  INTERVALS_PER_DAY,
  IntervalResult,
  SimulationParams,
  SimulationSummary,
  TimeConvention,
  formatIntervalLabel,
  formatPeakWindowRange,
} from '../simulation/bessEngine';

interface DispatchChartsProps {
  intervals: IntervalResult[];
  summary: SimulationSummary;
  params: SimulationParams;
  selectedInterval: number;
  timeConvention: TimeConvention;
  theme: 'dark' | 'light';
  onSelectInterval: (interval: number) => void;
}

const AXIS_TICKS = [0, 6, 12, 18, 24, 30, 36, 42, 47];

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

export function DispatchCharts({
  intervals,
  summary,
  params,
  selectedInterval,
  timeConvention,
  theme,
  onSelectInterval,
}: DispatchChartsProps) {
  const [hoveredInterval, setHoveredInterval] = useState<number | null>(null);
  const [showGrossLoad, setShowGrossLoad] = useState(true);
  const [showPv, setShowPv] = useState(true);
  const [showNetBefore, setShowNetBefore] = useState(true);

  const isDark = theme === 'dark';
  const chartColors = {
    plotBg: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.72)',
    peakBandBg: isDark ? 'rgba(255, 77, 0, 0.06)' : 'rgba(255, 77, 0, 0.065)',
    peakBandBg2: isDark ? 'rgba(255, 77, 0, 0.05)' : 'rgba(255, 77, 0, 0.055)',
    peakBandBorder: isDark ? 'rgba(255, 77, 0, 0.32)' : 'rgba(224, 68, 0, 0.38)',
    peakLabel: isDark ? 'rgba(255, 77, 0, 0.85)' : '#d94100',
    zeroLine: isDark ? 'rgba(242,239,235,0.22)' : 'rgba(17,17,19,0.25)',
    gridLine: isDark ? 'rgba(242,239,235,0.08)' : 'rgba(17,17,19,0.09)',
    gridLine2: isDark ? 'rgba(242,239,235,0.07)' : 'rgba(17,17,19,0.08)',
    vGridLine: isDark ? 'rgba(242,239,235,0.05)' : 'rgba(17,17,19,0.06)',
    tickText: isDark ? 'rgba(242,239,235,0.55)' : 'rgba(17,17,19,0.62)',
    axisTitle: isDark ? 'rgba(242,239,235,0.45)' : 'rgba(17,17,19,0.55)',
    shavedArea: isDark ? '#10b981' : '#059669',
    pvColor: isDark ? '#f59e0b' : '#d97706',
    grossLoad: isDark ? 'rgba(242,239,235,0.32)' : 'rgba(17,17,19,0.38)',
    netBefore: isDark ? 'rgba(242,239,235,0.6)' : 'rgba(17,17,19,0.68)',
    capLine: isDark ? 'rgba(239, 68, 68, 0.7)' : 'rgba(220, 38, 38, 0.78)',
    capLabel: isDark ? '#f87171' : '#dc2626',
    netAfter: isDark ? '#ff4d00' : '#e04400',
    ink: isDark ? '#f2efeb' : '#111113',
    markerStroke: isDark ? '#111113' : '#ffffff',
    selectedHairline: isDark ? 'rgba(242,239,235,0.35)' : 'rgba(17,17,19,0.35)',
    socForbiddenTop: isDark ? 'rgba(242,239,235,0.03)' : 'rgba(17,17,19,0.04)',
    socForbiddenBottom: isDark ? 'rgba(255,77,0,0.08)' : 'rgba(255,77,0,0.07)',
    socColor: isDark ? '#a78bfa' : '#7c3aed',
    socAxisText: isDark ? '#c4b5fd' : '#6d28d9',
    chgBar: isDark ? '#0ea5e9' : '#0284c7',
    dischBar: isDark ? '#10b981' : '#059669',
    idleBar: isDark ? 'rgba(242,239,235,0.16)' : 'rgba(17,17,19,0.18)',
  };

  const activeIndex = hoveredInterval ?? selectedInterval;
  const activeRow = intervals[activeIndex] ?? intervals[0];
  const lastIndex = INTERVALS_PER_DAY - 1;
  const peakSegments = summary.isPeakWindowActive ? getContiguousPeakSegments(intervals) : [];
  const peakWindowLabel = formatPeakWindowRange(params.peakStartMinutes, params.peakEndMinutes);

  // Chart 1 Geometry (860 x 185)
  const w1 = 860;
  const h1 = 185;
  const pad1 = { top: 14, right: 18, bottom: 22, left: 48 };
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

  const xForInterval = (idx: number, left = pad1.left, width = plotW1) =>
    left + (idx / lastIndex) * width;
  const halfStep1 = plotW1 / lastIndex / 2;
  const yForKw1 = (kw: number) =>
    pad1.top + ((yMax1 - kw) / Math.max(1, yMax1 - yMin1)) * plotH1;

  const buildPolyline = (getter: (r: IntervalResult) => number) =>
    intervals
      .map((r) => `${xForInterval(r.interval).toFixed(1)},${yForKw1(getter(r)).toFixed(1)}`)
      .join(' ');

  const pvAreaPath =
    `M ${xForInterval(0).toFixed(1)},${yForKw1(0).toFixed(1)} ` +
    intervals
      .map((r) => `L ${xForInterval(r.interval).toFixed(1)},${yForKw1(r.pvKw).toFixed(1)}`)
      .join(' ') +
    ` L ${xForInterval(lastIndex).toFixed(1)},${yForKw1(0).toFixed(1)} Z`;

  const shavedAreaPath =
    `M ${intervals
      .map(
        (r) =>
          `${xForInterval(r.interval).toFixed(1)},${yForKw1(
            Math.max(r.netBeforeKw, r.netAfterKw)
          ).toFixed(1)}`
      )
      .join(' L ')} ` +
    `L ${[...intervals]
      .reverse()
      .map((r) => `${xForInterval(r.interval).toFixed(1)},${yForKw1(r.netAfterKw).toFixed(1)}`)
      .join(' L ')} Z`;

  const yTicks1: number[] = [];
  const step1 = yMax1 - yMin1 > 1400 ? 400 : 200;
  for (let v = yMin1; v <= yMax1; v += step1) {
    yTicks1.push(v);
  }

  // Chart 2 Geometry (860 x 135): BESS Dispatch Power (kW) & SOC (%)
  const w2 = 860;
  const h2 = 135;
  const pad2 = { top: 12, right: 44, bottom: 22, left: 48 };
  const plotW2 = w2 - pad2.left - pad2.right;
  const plotH2 = h2 - pad2.top - pad2.bottom;

  const pBound = Math.max(100, Math.ceil(params.bessPowerKw / 100) * 100);
  const yForPower2 = (kw: number) =>
    pad2.top + ((pBound - kw) / (2 * pBound)) * plotH2;
  const yForSoc2 = (pct: number) =>
    pad2.top + ((100 - pct) / 100) * plotH2;

  const xForInterval2 = (idx: number) => pad2.left + (idx / lastIndex) * plotW2;
  const halfStep2 = plotW2 / lastIndex / 2;
  const barWidth2 = Math.max(5, plotW2 / INTERVALS_PER_DAY - 3);

  const socLinePoints = intervals
    .map((r) => `${xForInterval2(r.interval).toFixed(1)},${yForSoc2(r.socEndPct).toFixed(1)}`)
    .join(' ');

  const handleSvgMouseMove = (
    e: React.MouseEvent<SVGSVGElement>,
    padLeft: number,
    plotWidth: number,
    svgWidth: number,
    svgHeight: number
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / svgWidth, rect.height / svgHeight);
    const renderedW = svgWidth * scale;
    const offsetX = (rect.width - renderedW) / 2;
    const relX = ((e.clientX - rect.left - offsetX) / Math.max(1, renderedW)) * svgWidth;
    const clamped = Math.max(padLeft, Math.min(padLeft + plotWidth, relX));
    const idx = Math.round(((clamped - padLeft) / plotWidth) * lastIndex);
    setHoveredInterval(Math.max(0, Math.min(lastIndex, idx)));
  };

  return (
    <section
      id="dispatch-curves"
      aria-label="24-hour 30-minute dispatch and SOC charts"
      className="divide-y divide-[rgba(17,17,19,0.12)] dark:divide-[rgba(242,239,235,0.12)] lg:h-full lg:flex lg:flex-col"
    >
      {/* CHART 1: 24h Peak Shaving & Load Profile */}
      <div className="px-3.5 py-2 flex flex-col gap-1 lg:flex-[1.35] lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)]">
              24h Dispatch Curves (30m)
            </span>
            {summary.isPeakWindowActive && (
              <span className="font-mono text-[9px] uppercase tracking-[0.06em] px-1.5 py-0.5 bg-[rgba(255,77,0,0.12)] dark:bg-[rgba(255,77,0,0.16)] text-[#e04400] dark:text-[#ff4d00] tabular-nums">
                PEAK {peakWindowLabel}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono tabular-nums text-[9.5px] text-[rgba(17,17,19,0.68)] dark:text-[rgba(242,239,235,0.65)]">
              <span className="text-[#111113] dark:text-[#f2efeb] font-bold">
                {activeRow.label} {hoveredInterval !== null ? '(HOVER)' : '(SEL)'}
              </span>
              <span>
                LOAD <strong className="text-[#111113] dark:text-[#f2efeb]">{activeRow.loadKw.toFixed(1)}</strong>
              </span>
              <span>
                PV <strong className="text-amber-700 dark:text-amber-400">{activeRow.pvKw.toFixed(1)}</strong>
              </span>
              <span>
                NET₀ <strong className="text-[rgba(17,17,19,0.85)] dark:text-[rgba(242,239,235,0.85)]">{activeRow.netBeforeKw.toFixed(1)}</strong>
              </span>
              <span>
                BESS{' '}
                <strong
                  className={
                    activeRow.bessKw < 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : activeRow.bessKw > 0
                      ? 'text-sky-700 dark:text-sky-400'
                      : 'text-[rgba(17,17,19,0.5)] dark:text-[rgba(242,239,235,0.5)]'
                  }
                >
                  {activeRow.bessKw > 0 ? '+' : ''}
                  {activeRow.bessKw.toFixed(1)}
                </strong>
              </span>
              <span>
                NET{' '}
                <strong className={activeRow.aboveCap ? 'text-[#e04400] dark:text-[#ff4d00]' : 'text-[#111113] dark:text-[#f2efeb]'}>
                  {activeRow.netAfterKw.toFixed(1)}
                </strong>
              </span>
              <span>
                SOC <strong className="text-violet-700 dark:text-violet-400">{activeRow.socEndPct.toFixed(1)}%</strong>
              </span>
            </div>
          </div>

          {/* Compact Layer Toggles */}
          <div className="flex flex-wrap items-center gap-1 font-mono text-[9.5px]">
            <button
              type="button"
              onClick={() => setShowGrossLoad((v) => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 transition-colors cursor-pointer whitespace-nowrap ${
                showGrossLoad
                  ? 'bg-[rgba(17,17,19,0.1)] dark:bg-[rgba(242,239,235,0.14)] text-[#111113] dark:text-[#f2efeb]'
                  : 'bg-transparent text-[rgba(17,17,19,0.38)] dark:text-[rgba(242,239,235,0.35)] border border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)]'
              }`}
            >
              <span className="w-2 h-0.5 bg-[rgba(17,17,19,0.5)] dark:bg-[rgba(242,239,235,0.5)] inline-block" aria-hidden="true" />
              <span>LOAD</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPv((v) => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 transition-colors cursor-pointer whitespace-nowrap ${
                showPv
                  ? 'bg-[rgba(217,119,6,0.14)] dark:bg-[rgba(245,158,11,0.16)] text-amber-800 dark:text-amber-300'
                  : 'bg-transparent text-[rgba(17,17,19,0.38)] dark:text-[rgba(242,239,235,0.35)] border border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)]'
              }`}
            >
              <span className="w-2 h-2 bg-amber-600/80 dark:bg-amber-400/70 inline-block" aria-hidden="true" />
              <span>SOLAR</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNetBefore((v) => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 transition-colors cursor-pointer whitespace-nowrap ${
                showNetBefore
                  ? 'bg-[rgba(17,17,19,0.1)] dark:bg-[rgba(242,239,235,0.14)] text-[#111113] dark:text-[#f2efeb]'
                  : 'bg-transparent text-[rgba(17,17,19,0.38)] dark:text-[rgba(242,239,235,0.35)] border border-[rgba(17,17,19,0.14)] dark:border-[rgba(242,239,235,0.12)]'
              }`}
            >
              <span className="w-2 h-0.5 border-t border-dashed border-[rgba(17,17,19,0.7)] dark:border-[rgba(242,239,235,0.7)] inline-block" aria-hidden="true" />
              <span>NET₀</span>
            </button>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[rgba(255,77,0,0.12)] dark:bg-[rgba(255,77,0,0.14)] text-[#e04400] dark:text-[#ff4d00] whitespace-nowrap">
              <span className="w-2 h-0.5 bg-[#e04400] dark:bg-[#ff4d00] inline-block" aria-hidden="true" />
              <span>NET AFTER</span>
            </span>
          </div>
        </div>

        {/* SVG Chart 1 */}
        <svg
          viewBox={`0 0 ${w1} ${h1}`}
          className="w-full h-auto lg:flex-1 lg:min-h-0 cursor-crosshair select-none"
          onMouseMove={(e) => handleSvgMouseMove(e, pad1.left, plotW1, w1, h1)}
          onMouseLeave={() => setHoveredInterval(null)}
          onClick={() => {
            if (hoveredInterval !== null) onSelectInterval(hoveredInterval);
          }}
          role="img"
          aria-label="24-hour 30-minute commercial load, solar PV, and net grid demand before and after BESS peak shaving"
        >
          <rect
            x={pad1.left}
            y={pad1.top}
            width={plotW1}
            height={plotH1}
            fill={chartColors.plotBg}
          />

          {/* Selected Peak Period Band */}
          {peakSegments.map(([segStart, segEnd], segIdx) => {
            const x1 = Math.max(pad1.left, xForInterval(segStart) - halfStep1);
            const x2 = Math.min(pad1.left + plotW1, xForInterval(segEnd) + halfStep1);
            return (
              <g key={`${segStart}-${segEnd}`}>
                <rect
                  x={x1}
                  y={pad1.top}
                  width={Math.max(1, x2 - x1)}
                  height={plotH1}
                  fill={chartColors.peakBandBg}
                />
                <line
                  x1={x1}
                  y1={pad1.top}
                  x2={x1}
                  y2={pad1.top + plotH1}
                  stroke={chartColors.peakBandBorder}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={x2}
                  y1={pad1.top}
                  x2={x2}
                  y2={pad1.top + plotH1}
                  stroke={chartColors.peakBandBorder}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                {segIdx === 0 && (
                  <text
                    x={x1 + 5}
                    y={pad1.top + 11}
                    fill={chartColors.peakLabel}
                    fontSize="8.5"
                    fontWeight="700"
                    fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
                  >
                    PEAK {peakWindowLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* Horizontal Grid Lines & Y Labels */}
          {yTicks1.map((tick) => {
            const y = yForKw1(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad1.left}
                  y1={y}
                  x2={w1 - pad1.right}
                  y2={y}
                  stroke={tick === 0 ? chartColors.zeroLine : chartColors.gridLine}
                  strokeWidth="1"
                />
                <text
                  x={pad1.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill={chartColors.tickText}
                  fontSize="10"
                  fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <text
            x={12}
            y={pad1.top + plotH1 / 2}
            transform={`rotate(-90 12 ${pad1.top + plotH1 / 2})`}
            textAnchor="middle"
            fill={chartColors.axisTitle}
            fontSize="9.5"
            fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
          >
            POWER (kW)
          </text>

          {/* X-Axis 3-Hour Gridlines & Labels */}
          {AXIS_TICKS.map((idx) => {
            const x = xForInterval(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={pad1.top}
                  x2={x}
                  y2={pad1.top + plotH1}
                  stroke={chartColors.vGridLine}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={h1 - 5}
                  textAnchor="middle"
                  fill={chartColors.tickText}
                  fontSize="9.5"
                  fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
                >
                  {formatIntervalLabel(idx, timeConvention)}
                </text>
              </g>
            );
          })}

          {/* Shaved Peak Shaded Region */}
          <path d={shavedAreaPath} fill={chartColors.shavedArea} fillOpacity="0.18" />

          {/* Solar PV Area & Curve */}
          {showPv && (
            <>
              <path d={pvAreaPath} fill={chartColors.pvColor} fillOpacity="0.13" />
              <polyline
                fill="none"
                stroke={chartColors.pvColor}
                strokeWidth="1.5"
                points={buildPolyline((r) => r.pvKw)}
              />
            </>
          )}

          {/* Gross Commercial Load */}
          {showGrossLoad && (
            <polyline
              fill="none"
              stroke={chartColors.grossLoad}
              strokeWidth="1.25"
              strokeDasharray="2 3"
              points={buildPolyline((r) => r.loadKw)}
            />
          )}

          {/* Net Load Before BESS */}
          {showNetBefore && (
            <polyline
              fill="none"
              stroke={chartColors.netBefore}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              points={buildPolyline((r) => r.netBeforeKw)}
            />
          )}

          {/* Target Cap Line P_cap */}
          <line
            x1={pad1.left}
            y1={yForKw1(params.targetCapKw)}
            x2={w1 - pad1.right}
            y2={yForKw1(params.targetCapKw)}
            stroke={chartColors.capLine}
            strokeWidth="1.25"
            strokeDasharray="7 4"
          />
          <text
            x={w1 - pad1.right - 4}
            y={yForKw1(params.targetCapKw) - 5}
            textAnchor="end"
            fill={chartColors.capLabel}
            fontSize="10"
            fontWeight="700"
            fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
          >
            P_CAP = {params.targetCapKw} kW
          </text>

          {/* Net Load After BESS (Primary Safety Orange Curve) */}
          <polyline
            fill="none"
            stroke={chartColors.netAfter}
            strokeWidth="2.25"
            strokeLinejoin="round"
            points={buildPolyline((r) => r.netAfterKw)}
          />

          {/* Peak After Marker */}
          <circle
            cx={xForInterval(summary.peakAfterInterval)}
            cy={yForKw1(summary.peakAfterKw)}
            r="4"
            fill={chartColors.netAfter}
            stroke={chartColors.markerStroke}
            strokeWidth="1.5"
          />

          {/* Selected Interval Persistent Indicator */}
          <line
            x1={xForInterval(selectedInterval)}
            y1={pad1.top}
            x2={xForInterval(selectedInterval)}
            y2={pad1.top + plotH1}
            stroke={chartColors.selectedHairline}
            strokeWidth="1"
          />

          {/* Active Crosshair */}
          <line
            x1={xForInterval(activeIndex)}
            y1={pad1.top}
            x2={xForInterval(activeIndex)}
            y2={pad1.top + plotH1}
            stroke={chartColors.netAfter}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle
            cx={xForInterval(activeIndex)}
            cy={yForKw1(activeRow.netAfterKw)}
            r="4.5"
            fill={chartColors.netAfter}
            stroke={chartColors.ink}
            strokeWidth="1.5"
          />
          {showNetBefore && (
            <circle
              cx={xForInterval(activeIndex)}
              cy={yForKw1(activeRow.netBeforeKw)}
              r="3.5"
              fill={chartColors.ink}
              stroke={chartColors.markerStroke}
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      {/* CHART 2: BESS Power Dispatch (kW) & SOC (%) across 48 intervals */}
      <div className="px-3.5 py-2 flex flex-col gap-1 lg:flex-1 lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)]">
              BESS Dispatch &amp; SOC (Δt = 0.5h)
            </span>
            <span className="font-mono text-[9.5px] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)] tabular-nums">
              {params.socMinPct}%–{params.socMaxPct}% ({summary.eMinKwh.toFixed(0)}–{summary.eMaxKwh.toFixed(0)} kWh) · η_RT {params.roundTripEfficiencyPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[9.5px]">
            <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
              <span className="w-2 h-2 bg-sky-600 dark:bg-sky-500 inline-block" aria-hidden="true" />
              CHG (+kW)
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="w-2 h-2 bg-emerald-600 dark:bg-emerald-500 inline-block" aria-hidden="true" />
              DISCH (−kW)
            </span>
            <span className="inline-flex items-center gap-1.5 text-violet-700 dark:text-violet-300">
              <span className="w-3 h-0.5 bg-violet-600 dark:bg-violet-400 inline-block" aria-hidden="true" />
              SOC (%)
            </span>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${w2} ${h2}`}
          className="w-full h-auto lg:flex-1 lg:min-h-0 cursor-crosshair select-none"
          onMouseMove={(e) => handleSvgMouseMove(e, pad2.left, plotW2, w2, h2)}
          onMouseLeave={() => setHoveredInterval(null)}
          onClick={() => {
            if (hoveredInterval !== null) onSelectInterval(hoveredInterval);
          }}
          role="img"
          aria-label="Half-hourly BESS charge and discharge power and battery state of charge percentage"
        >
          {/* Shaded SOC Forbidden Bands */}
          <rect
            x={pad2.left}
            y={pad2.top}
            width={plotW2}
            height={Math.max(0, yForSoc2(params.socMaxPct) - pad2.top)}
            fill={chartColors.socForbiddenTop}
          />
          <rect
            x={pad2.left}
            y={yForSoc2(params.socMinPct)}
            width={plotW2}
            height={Math.max(0, pad2.top + plotH2 - yForSoc2(params.socMinPct))}
            fill={chartColors.socForbiddenBottom}
          />

          {/* Selected Peak Period Band */}
          {peakSegments.map(([segStart, segEnd]) => {
            const x1 = Math.max(pad2.left, xForInterval2(segStart) - halfStep2);
            const x2 = Math.min(pad2.left + plotW2, xForInterval2(segEnd) + halfStep2);
            return (
              <g key={`c2-${segStart}-${segEnd}`}>
                <rect
                  x={x1}
                  y={pad2.top}
                  width={Math.max(1, x2 - x1)}
                  height={plotH2}
                  fill={chartColors.peakBandBg2}
                />
                <line
                  x1={x1}
                  y1={pad2.top}
                  x2={x1}
                  y2={pad2.top + plotH2}
                  stroke={chartColors.peakBandBorder}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <line
                  x1={x2}
                  y1={pad2.top}
                  x2={x2}
                  y2={pad2.top + plotH2}
                  stroke={chartColors.peakBandBorder}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              </g>
            );
          })}

          {/* Zero Power Line */}
          <line
            x1={pad2.left}
            y1={yForPower2(0)}
            x2={w2 - pad2.right}
            y2={yForPower2(0)}
            stroke={chartColors.zeroLine}
            strokeWidth="1"
          />

          {/* SOC Min & Max Dashed Limits */}
          <line
            x1={pad2.left}
            y1={yForSoc2(params.socMaxPct)}
            x2={w2 - pad2.right}
            y2={yForSoc2(params.socMaxPct)}
            stroke={chartColors.socColor}
            strokeOpacity="0.5"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1={pad2.left}
            y1={yForSoc2(params.socMinPct)}
            x2={w2 - pad2.right}
            y2={yForSoc2(params.socMinPct)}
            stroke={chartColors.netAfter}
            strokeOpacity="0.65"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Left Y-Axis: Power (kW) */}
          {[-pBound, -pBound / 2, 0, pBound / 2, pBound].map((val) => {
            const y = yForPower2(val);
            return (
              <g key={val}>
                <line
                  x1={pad2.left}
                  y1={y}
                  x2={w2 - pad2.right}
                  y2={y}
                  stroke={chartColors.gridLine2}
                />
                <text
                  x={pad2.left - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill={chartColors.tickText}
                  fontSize="9.5"
                  fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
                >
                  {val > 0 ? `+${val}` : val}
                </text>
              </g>
            );
          })}

          {/* Right Y-Axis: SOC (%) */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = yForSoc2(pct);
            return (
              <text
                key={pct}
                x={w2 - pad2.right + 8}
                y={y + 3.5}
                textAnchor="start"
                fill={chartColors.socAxisText}
                fontSize="9.5"
                fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
              >
                {pct}%
              </text>
            );
          })}

          {/* 48 Half-Hourly BESS Power Bars */}
          {intervals.map((r) => {
            const x = xForInterval2(r.interval) - barWidth2 / 2;
            const yZero = yForPower2(0);
            const yVal = yForPower2(r.bessKw);
            const height = Math.abs(yVal - yZero);
            const yTop = Math.min(yZero, yVal);
            const isActive = r.interval === activeIndex;
            return (
              <rect
                key={r.interval}
                x={x}
                y={yTop}
                width={barWidth2}
                height={Math.max(1, height)}
                fill={
                  r.bessKw > 0.05
                    ? chartColors.chgBar
                    : r.bessKw < -0.05
                    ? chartColors.dischBar
                    : chartColors.idleBar
                }
                fillOpacity={isActive ? 1 : 0.76}
              />
            );
          })}

          {/* X-Axis Labels */}
          {AXIS_TICKS.map((idx) => (
            <text
              key={idx}
              x={xForInterval2(idx)}
              y={h2 - 5}
              textAnchor="middle"
              fill={chartColors.tickText}
              fontSize="9.5"
              fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
            >
              {formatIntervalLabel(idx, timeConvention)}
            </text>
          ))}

          {/* SOC Trajectory Curve */}
          <polyline
            fill="none"
            stroke={chartColors.socColor}
            strokeWidth="2"
            strokeLinejoin="round"
            points={socLinePoints}
          />

          {/* SOC Floor Hit Pin */}
          {summary.socFloorHitInterval !== null && (
            <g>
              <circle
                cx={xForInterval2(summary.socFloorHitInterval)}
                cy={yForSoc2(intervals[summary.socFloorHitInterval].socEndPct)}
                r="4"
                fill={chartColors.netAfter}
                stroke={chartColors.markerStroke}
                strokeWidth="1.5"
              />
              <text
                x={Math.min(w2 - pad2.right - 95, xForInterval2(summary.socFloorHitInterval) + 8)}
                y={yForSoc2(intervals[summary.socFloorHitInterval].socEndPct) - 7}
                fill={chartColors.netAfter}
                fontSize="9.5"
                fontWeight="700"
                fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
              >
                ▼ {params.socMinPct}% FLOOR ({formatIntervalLabel(summary.socFloorHitInterval, timeConvention)})
              </text>
            </g>
          )}

          {/* Active Hover/Selected Crosshair */}
          <line
            x1={xForInterval2(activeIndex)}
            y1={pad2.top}
            x2={xForInterval2(activeIndex)}
            y2={pad2.top + plotH2}
            stroke={chartColors.socColor}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <circle
            cx={xForInterval2(activeIndex)}
            cy={yForSoc2(activeRow.socEndPct)}
            r="4"
            fill={chartColors.socColor}
            stroke={chartColors.markerStroke}
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </section>
  );
}
