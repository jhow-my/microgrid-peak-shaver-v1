import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import {
  INTERVALS_PER_DAY,
  IntervalResult,
  SimulationParams,
  TimeConvention,
  formatIntervalWindow,
} from '../simulation/bessEngine';

interface MicrogridSchematicProps {
  intervalData: IntervalResult;
  params: SimulationParams;
  selectedInterval: number;
  activeDateLabel: string;
  timeConvention: TimeConvention;
  isPlaying: boolean;
  theme: 'dark' | 'light';
  onSelectInterval: (interval: number) => void;
  onTogglePlay: () => void;
}

export function MicrogridSchematic({
  intervalData,
  params,
  selectedInterval,
  activeDateLabel,
  timeConvention,
  isPlaying,
  theme,
  onSelectInterval,
  onTogglePlay,
}: MicrogridSchematicProps) {
  const isDark = theme === 'dark';
  const palette = {
    nodeBg: isDark ? '#111113' : '#ffffff',
    busBg: isDark ? '#1b1b1f' : '#eceae4',
    busStroke: isDark ? 'rgba(242,239,235,0.35)' : 'rgba(17,17,19,0.32)',
    borderIdle: isDark ? 'rgba(242,239,235,0.2)' : 'rgba(17,17,19,0.22)',
    ink: isDark ? '#f2efeb' : '#111113',
    inkMuted: isDark ? 'rgba(242,239,235,0.6)' : 'rgba(17,17,19,0.65)',
    inkSub: isDark ? 'rgba(242,239,235,0.55)' : 'rgba(17,17,19,0.6)',
    inkFaint: isDark ? 'rgba(242,239,235,0.45)' : 'rgba(17,17,19,0.52)',
    amber: isDark ? '#f59e0b' : '#d97706',
    emerald: isDark ? '#10b981' : '#059669',
    sky: isDark ? '#0ea5e9' : '#0284c7',
    orange: isDark ? '#ff4d00' : '#e04400',
    socTrack: isDark ? 'rgba(242,239,235,0.12)' : 'rgba(17,17,19,0.12)',
  };

  const isDischarging = intervalData.bessKw < -0.05;
  const isCharging = intervalData.bessKw > 0.05;
  const isGridImport = intervalData.netAfterKw > 0.05;
  const isGridExport = intervalData.netAfterKw < -0.05;
  const hasPv = intervalData.pvKw > 0.05;

  const stateColor =
    intervalData.state === 'shaving_soc_floor' || intervalData.state === 'cap_exceeded_depleted'
      ? 'text-[#e04400] dark:text-[#ff4d00]'
      : intervalData.state === 'shaving_power_limited'
      ? 'text-amber-700 dark:text-amber-400'
      : isDischarging
      ? 'text-emerald-700 dark:text-emerald-400'
      : isCharging
      ? 'text-sky-700 dark:text-sky-400'
      : 'text-[rgba(17,17,19,0.65)] dark:text-[rgba(242,239,235,0.65)]';

  const socRatio =
    params.bessCapacityKwh > 0
      ? Math.max(0, Math.min(1, intervalData.energyEndKwh / params.bessCapacityKwh))
      : 0;

  return (
    <section
      id="power-flow"
      aria-label="Live microgrid power flow schematic"
      className="dot-grid flex flex-col justify-between px-3.5 py-1.5"
    >
      {/* Compact Header & Playback Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.65)] dark:text-[rgba(242,239,235,0.6)]">
            Power Flow · {activeDateLabel} · {intervalData.label}
          </span>
          <span className="text-[rgba(17,17,19,0.24)] dark:text-[rgba(242,239,235,0.2)]" aria-hidden="true">
            /
          </span>
          <span className={`font-mono text-[9.5px] uppercase tracking-[0.06em] font-bold ${stateColor}`}>
            {intervalData.stateGlyph} {intervalData.stateLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              onSelectInterval((selectedInterval + INTERVALS_PER_DAY - 1) % INTERVALS_PER_DAY)
            }
            aria-label="Previous 30-min interval"
            className="p-1 bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.2)] text-[#111113] dark:text-[#f2efeb] transition-colors cursor-pointer"
          >
            <SkipBack className="w-3 h-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className={`inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.06em] transition-colors cursor-pointer whitespace-nowrap ${
              isPlaying
                ? 'bg-[#ff4d00] text-[#f2efeb] font-bold'
                : 'bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.2)] text-[#111113] dark:text-[#f2efeb]'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-2.5 h-2.5" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-2.5 h-2.5" aria-hidden="true" />
                <span>Play 24h</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onSelectInterval((selectedInterval + 1) % INTERVALS_PER_DAY)}
            aria-label="Next 30-min interval"
            className="p-1 bg-[rgba(17,17,19,0.08)] dark:bg-[rgba(242,239,235,0.12)] hover:bg-[rgba(17,17,19,0.16)] dark:hover:bg-[rgba(242,239,235,0.2)] text-[#111113] dark:text-[#f2efeb] transition-colors cursor-pointer"
          >
            <SkipForward className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 4-Node Technical CAD Single-Line Schematic */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox="0 0 820 156"
          className="w-full min-w-[580px] h-auto max-h-[144px] select-none"
          role="img"
          aria-label={`Microgrid power flow at ${intervalData.label}: Grid ${intervalData.netAfterKw.toFixed(1)} kW, Solar PV ${intervalData.pvKw.toFixed(1)} kW, BESS ${intervalData.bessKw.toFixed(1)} kW, Commercial Load ${intervalData.loadKw.toFixed(1)} kW`}
        >
          <defs>
            <marker id="arr-orange" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.orange} />
            </marker>
            <marker id="arr-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.amber} />
            </marker>
            <marker id="arr-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.emerald} />
            </marker>
            <marker id="arr-sky" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.sky} />
            </marker>
            <marker id="arr-ink" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.ink} />
            </marker>
          </defs>

          {/* NODE TOP: Solar PV Array */}
          <g transform="translate(300, 2)">
            <rect
              width="220"
              height="40"
              fill={palette.nodeBg}
              stroke={hasPv ? palette.amber : palette.borderIdle}
              strokeWidth="1"
            />
            <text x="10" y="13" fill={palette.inkMuted} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              SOLAR PV ARRAY
            </text>
            <text x="210" y="13" textAnchor="end" fill={palette.inkFaint} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              PEAK {params.solarPeakKw} kW
            </text>
            <text x="10" y="33" fill={hasPv ? palette.amber : palette.ink} fontSize="15" fontWeight="700" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              {intervalData.pvKw.toFixed(1)}{' '}
              <tspan fontSize="9.5" fill={palette.inkFaint} fontWeight="400">
                kW
              </tspan>
            </text>
            <text x="210" y="33" textAnchor="end" fill={palette.inkMuted} fontSize="9.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              {params.solarPeakKw > 0 ? `${((intervalData.pvKw / params.solarPeakKw) * 100).toFixed(0)}%` : '0%'}
            </text>
          </g>

          {/* Line: Solar PV -> AC Bus */}
          <line
            x1="410"
            y1="42"
            x2="410"
            y2="56"
            stroke={hasPv ? palette.amber : palette.borderIdle}
            strokeWidth={hasPv ? '2' : '1'}
            markerEnd={hasPv ? 'url(#arr-amber)' : undefined}
          />

          {/* NODE LEFT: Utility Grid */}
          <g transform="translate(16, 51)">
            <rect
              width="196"
              height="50"
              fill={palette.nodeBg}
              stroke={intervalData.aboveCap ? palette.orange : palette.borderIdle}
              strokeWidth={intervalData.aboveCap ? '1.5' : '1'}
            />
            <text
              x="10"
              y="15"
              fill={intervalData.aboveCap ? palette.orange : palette.inkMuted}
              fontSize="8.5"
              fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
            >
              UTILITY GRID (PCC)
            </text>
            <text
              x="10"
              y="38"
              fill={intervalData.aboveCap ? palette.orange : palette.ink}
              fontSize="15.5"
              fontWeight="700"
              fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
            >
              {intervalData.netAfterKw.toFixed(1)}{' '}
              <tspan fontSize="9.5" fill={palette.inkFaint} fontWeight="400">
                kW
              </tspan>
            </text>
            <text
              x="186"
              y="38"
              textAnchor="end"
              fill={intervalData.aboveCap ? palette.orange : palette.inkSub}
              fontSize="9.5"
              fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
            >
              {isGridExport
                ? 'EXPORT'
                : intervalData.aboveCap
                ? `+${(intervalData.netAfterKw - params.targetCapKw).toFixed(1)}`
                : `≤${params.targetCapKw}`}
            </text>
          </g>

          {/* Line: Utility Grid <-> AC Bus */}
          <line
            x1={isGridExport ? 336 : 212}
            y1="76"
            x2={isGridExport ? 216 : 332}
            y2="76"
            stroke={
              intervalData.aboveCap
                ? palette.orange
                : isGridExport
                ? palette.amber
                : isGridImport
                ? palette.ink
                : palette.borderIdle
            }
            strokeWidth={isGridImport || isGridExport ? '2' : '1'}
            markerEnd={
              isGridExport
                ? 'url(#arr-amber)'
                : intervalData.aboveCap
                ? 'url(#arr-orange)'
                : isGridImport
                ? 'url(#arr-ink)'
                : undefined
            }
          />
          <text x="274" y="69" textAnchor="middle" fill={palette.inkSub} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
            {isGridExport ? 'EXPORT' : 'IMPORT'}
          </text>

          {/* CENTRAL NODE: AC Microgrid Bus */}
          <g transform="translate(336, 58)">
            <rect width="148" height="36" fill={palette.busBg} stroke={palette.busStroke} strokeWidth="1" />
            <text x="74" y="14" textAnchor="middle" fill={palette.inkMuted} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              MICROGRID AC BUS
            </text>
            <text x="74" y="29" textAnchor="middle" fill={palette.ink} fontSize="10.5" fontWeight="700" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              NET₀ {intervalData.netBeforeKw.toFixed(1)} kW
            </text>
          </g>

          {/* Line: AC Bus -> Commercial Load */}
          <line
            x1="484"
            y1="76"
            x2="604"
            y2="76"
            stroke={palette.ink}
            strokeWidth="2"
            markerEnd="url(#arr-ink)"
          />
          <text x="544" y="69" textAnchor="middle" fill={palette.inkSub} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
            SERVE LOAD
          </text>

          {/* NODE RIGHT: Commercial Load */}
          <g transform="translate(608, 51)">
            <rect width="196" height="50" fill={palette.nodeBg} stroke={palette.borderIdle} strokeWidth="1" />
            <text x="10" y="15" fill={palette.inkMuted} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              COMMERCIAL LOAD
            </text>
            <text x="10" y="38" fill={palette.ink} fontSize="15.5" fontWeight="700" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              {intervalData.loadKw.toFixed(1)}{' '}
              <tspan fontSize="9.5" fill={palette.inkFaint} fontWeight="400">
                kW
              </tspan>
            </text>
            <text x="186" y="38" textAnchor="end" fill={palette.inkSub} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              DEMAND
            </text>
          </g>

          {/* Line: BESS <-> AC Bus */}
          <line
            x1="410"
            y1={isDischarging ? 112 : 94}
            x2="410"
            y2={isDischarging ? 98 : 108}
            stroke={isDischarging ? palette.emerald : isCharging ? palette.sky : palette.borderIdle}
            strokeWidth={isDischarging || isCharging ? '2' : '1'}
            markerEnd={
              isDischarging
                ? 'url(#arr-emerald)'
                : isCharging
                ? 'url(#arr-sky)'
                : undefined
            }
          />
          <text x="422" y="106" fill={palette.inkMuted} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
            {isDischarging
              ? `DISCH −${(-intervalData.bessKw).toFixed(1)} kW`
              : isCharging
              ? `CHG +${intervalData.bessKw.toFixed(1)} kW`
              : 'IDLE 0.0 kW'}
          </text>

          {/* NODE BOTTOM: BESS Storage */}
          <g transform="translate(250, 112)">
            <rect
              width="320"
              height="42"
              fill={palette.nodeBg}
              stroke={
                intervalData.socFloorHit
                  ? palette.orange
                  : isDischarging
                  ? palette.emerald
                  : isCharging
                  ? palette.sky
                  : palette.borderIdle
              }
              strokeWidth="1"
            />
            <text x="10" y="14" fill={palette.inkMuted} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              BESS ({params.bessPowerKw} kW / {params.bessCapacityKwh} kWh)
            </text>
            <text x="310" y="14" textAnchor="end" fill={palette.inkFaint} fontSize="8.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              η_RT {params.roundTripEfficiencyPct.toFixed(1)}%
            </text>
            <text x="10" y="34" fill={palette.ink} fontSize="14.5" fontWeight="700" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              {intervalData.socEndPct.toFixed(1)}% SOC
            </text>
            <text x="128" y="34" fill={palette.inkMuted} fontSize="9.5" fontFamily='"Chivo Mono", ui-monospace, SFMono-Regular, Menlo, monospace'>
              ({intervalData.energyEndKwh.toFixed(1)} kWh)
            </text>
            {/* Sharp SOC Bar */}
            <rect x="228" y="25" width="80" height="7" fill={palette.socTrack} />
            <rect
              x="228"
              y="25"
              width={Math.max(2, 80 * socRatio)}
              height="7"
              fill={intervalData.socFloorHit ? palette.orange : isDischarging ? palette.emerald : palette.sky}
            />
          </g>
        </svg>
      </div>

      {/* Compact 30-Min Interval Scrubber & Live Equation Strip */}
      <div className="mt-1 pt-1.5 border-t border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2.5">
          <label
            htmlFor="interval-scrubber"
            className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.65)] dark:text-[rgba(242,239,235,0.6)] whitespace-nowrap"
          >
            30m Slot
          </label>
          <input
            id="interval-scrubber"
            type="range"
            min={0}
            max={INTERVALS_PER_DAY - 1}
            step={1}
            value={selectedInterval}
            onChange={(e) => onSelectInterval(parseInt(e.target.value, 10))}
            className="sim-slider flex-1"
          />
          <span className="font-mono tabular-nums text-[10.5px] font-bold text-[#111113] dark:text-[#f2efeb] whitespace-nowrap">
            {formatIntervalWindow(selectedInterval, timeConvention)}
          </span>
        </div>

        <div className="font-mono tabular-nums text-[10.5px] text-[rgba(17,17,19,0.78)] dark:text-[rgba(242,239,235,0.75)] whitespace-nowrap">
          <span className="text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)] mr-1.5">P_NET =</span>
          <span className={intervalData.aboveCap ? 'font-bold text-[#e04400] dark:text-[#ff4d00]' : 'font-bold text-[#111113] dark:text-[#f2efeb]'}>
            {intervalData.netAfterKw.toFixed(1)}
          </span>{' '}
          = {intervalData.loadKw.toFixed(1)} − {intervalData.pvKw.toFixed(1)}{' '}
          {intervalData.bessKw >= 0 ? '+' : '−'}{' '}
          <span
            className={
              intervalData.bessKw < 0
                ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                : intervalData.bessKw > 0
                ? 'text-sky-700 dark:text-sky-400 font-bold'
                : ''
            }
          >
            {Math.abs(intervalData.bessKw).toFixed(1)}
          </span>{' '}
          <span className="text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)]">kW</span>
        </div>
      </div>
    </section>
  );
}
