/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { TopBar, StageView } from './components/TopBar';
import { KpiStrip } from './components/KpiStrip';
import { ControlDeck } from './components/ControlDeck';
import { SettingsModal } from './components/SettingsModal';
import { ReportPreviewModal } from './components/ReportPreviewModal';
import { MicrogridSchematic } from './components/MicrogridSchematic';
import { DispatchCharts } from './components/DispatchCharts';
import { ProfileTunerAndEquations } from './components/ProfileTunerAndEquations';
import { DispatchLedgerTable } from './components/DispatchLedgerTable';
import {
  AutoSizeScope,
  ChargingStrategy,
  DEFAULT_BASE_LOAD_48_KW,
  DEFAULT_BENCHMARK_DAY,
  DEFAULT_METADATA,
  DEFAULT_PARAMS,
  DEFAULT_SLIDER_LOCKS,
  DT_HOURS,
  DynamicRecalcTrigger,
  INTERVALS_PER_DAY,
  LoadedDayProfile,
  MeterDatasetMetadata,
  PrimaryParamKey,
  SimulationParams,
  SliderBoundsMap,
  SliderLocks,
  autoSizeBessSystem,
  formatIntervalWindow,
  reconcileDynamicSimulationState,
  runMultiDaySimulation,
  summarizeDatasetSimulation,
} from './simulation/bessEngine';
import {
  DEFAULT_CRITICAL_DAYS_JSON_URL,
  buildDispatchCsv,
  exportDispatchCsvFile,
  exportDispatchJsonFile,
  exportMeterAndDispatchWorkbook,
  findHighestPeakLocation,
  parseExportedDispatchJson,
  parseUtilityMeterFile,
} from './simulation/meterImportExport';

const LOWER_STAGE_TABS: { id: 'curves' | 'tuner' | 'equations'; label: string }[] = [
  { id: 'curves', label: '24h Dispatch & SOC' },
  { id: 'tuner', label: 'Load Curve Editor' },
  { id: 'equations', label: 'Model Equations' },
];

interface DefaultBaselineSnapshot {
  days: LoadedDayProfile[];
  metadata: MeterDatasetMetadata;
  params: SimulationParams;
  bounds: SliderBoundsMap;
  mCeilKw: number;
  selectedDayIndex: number;
  selectedInterval: number;
}

interface DynamicControlState {
  params: SimulationParams;
  bounds: SliderBoundsMap;
  mCeilKw: number;
  locks: SliderLocks;
}

const SECONDARY_SIZING_KEYS: ReadonlySet<keyof SimulationParams> = new Set([
  'chargingStrategy',
  'roundTripEfficiencyPct',
  'socMinPct',
  'socMaxPct',
  'initialSocPct',
  'irradiancePct',
  'loadScalePct',
  'peakStartMinutes',
  'peakEndMinutes',
  'offPeakChargeToTransformer',
]);

type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'microgrid-theme';

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [dynamicState, setDynamicState] = useState<DynamicControlState>(() => {
    const init = reconcileDynamicSimulationState({
      days: [DEFAULT_BENCHMARK_DAY],
      params: DEFAULT_PARAMS,
      locks: DEFAULT_SLIDER_LOCKS,
      scope: 'all_days',
      activeDayIndex: 0,
      timeConvention: DEFAULT_METADATA.timeConvention,
      trigger: 'dataset_or_scope',
    });
    return {
      params: init.params,
      bounds: init.bounds,
      mCeilKw: init.mCeilKw,
      locks: { ...DEFAULT_SLIDER_LOCKS },
    };
  });
  const params = dynamicState.params;
  const sliderBounds = dynamicState.bounds;
  const sliderLocks = dynamicState.locks;

  const [days, setDays] = useState<LoadedDayProfile[]>([DEFAULT_BENCHMARK_DAY]);
  const [originalDays, setOriginalDays] = useState<LoadedDayProfile[]>([DEFAULT_BENCHMARK_DAY]);
  const [metadata, setMetadata] = useState<MeterDatasetMetadata>(DEFAULT_METADATA);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [selectedInterval, setSelectedInterval] = useState<number>(38); // 19:00
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<StageView>('overview');
  const [importError, setImportError] = useState<string | null>(null);
  const [autoSizeScope, setAutoSizeScope] = useState<AutoSizeScope>('all_days');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [reportPreviewOpen, setReportPreviewOpen] = useState<boolean>(false);

  const userModifiedRef = useRef<boolean>(false);
  const defaultBaselineRef = useRef<DefaultBaselineSnapshot | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }, [theme]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDefaultCriticalDaysJson() {
      try {
        const res = await fetch(DEFAULT_CRITICAL_DAYS_JSON_URL, {
          signal: controller.signal,
          cache: 'no-cache',
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const rawText = await res.text();
        if (!rawText.trim()) {
          throw new Error('JSON file is empty');
        }

        const parsed = parseExportedDispatchJson(rawText, {
          isImported: false,
          fallbackFileName: '816701093-30min-peak-shaving.json',
        });

        const baseMergedParams: SimulationParams = {
          ...DEFAULT_PARAMS,
          ...(parsed.parameters ?? {}),
          chargingStrategy: DEFAULT_PARAMS.chargingStrategy,
          baseLoadProfileKw: [...DEFAULT_BASE_LOAD_48_KW],
          basePvNormalized: [...DEFAULT_PARAMS.basePvNormalized],
        };
        const { dayIndex, intervalIndex } = findHighestPeakLocation(parsed.days);
        const reconciled = reconcileDynamicSimulationState({
          days: parsed.days,
          params: baseMergedParams,
          locks: DEFAULT_SLIDER_LOCKS,
          scope: 'all_days',
          activeDayIndex: dayIndex,
          timeConvention: parsed.metadata.timeConvention,
          trigger: 'dataset_or_scope',
        });
        defaultBaselineRef.current = {
          days: parsed.days.map((d) => ({ ...d, loadKw: [...d.loadKw] })),
          metadata: parsed.metadata,
          params: reconciled.params,
          bounds: reconciled.bounds,
          mCeilKw: reconciled.mCeilKw,
          selectedDayIndex: dayIndex,
          selectedInterval: intervalIndex,
        };

        if (userModifiedRef.current || controller.signal.aborted) {
          return;
        }

        setDays(parsed.days);
        setOriginalDays(parsed.days.map((d) => ({ ...d, loadKw: [...d.loadKw] })));
        setMetadata(parsed.metadata);
        setDynamicState({
          params: reconciled.params,
          bounds: reconciled.bounds,
          mCeilKw: reconciled.mCeilKw,
          locks: { ...DEFAULT_SLIDER_LOCKS },
        });
        setSelectedDayIndex(dayIndex);
        setSelectedInterval(intervalIndex);
        setImportError(null);
      } catch (err) {
        if (controller.signal.aborted || userModifiedRef.current) {
          return;
        }
        const detail = err instanceof Error ? err.message : 'Unable to load default JSON.';
        setImportError(
          `Default Critical Days JSON fallback (${detail}). Using built-in Benchmark Day.`
        );
      }
    }

    void loadDefaultCriticalDaysJson();

    return () => {
      controller.abort();
    };
  }, []);

  const dayResults = useMemo(
    () => runMultiDaySimulation(days, params, metadata.timeConvention),
    [days, params, metadata.timeConvention]
  );

  const safeDayIndex = Math.min(selectedDayIndex, Math.max(0, dayResults.length - 1));
  const activeDayResult = dayResults[safeDayIndex];
  const activeDayProfile = days[safeDayIndex] ?? DEFAULT_BENCHMARK_DAY;
  const activeOutput = activeDayResult.output;

  const autoSizePreview = useMemo(
    () =>
      autoSizeBessSystem({
        days,
        baseParams: params,
        desiredMaxDemandKw: params.targetCapKw,
        peakStartMinutes: params.peakStartMinutes,
        peakEndMinutes: params.peakEndMinutes,
        scope: autoSizeScope,
        activeDayIndex: safeDayIndex,
        offPeakChargeToTransformer: params.offPeakChargeToTransformer,
        timeConvention: metadata.timeConvention,
      }),
    [days, params, autoSizeScope, safeDayIndex, metadata.timeConvention]
  );

  const datasetSummary = useMemo(
    () => summarizeDatasetSimulation(dayResults, params, autoSizeScope, safeDayIndex),
    [dayResults, params, autoSizeScope, safeDayIndex]
  );

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setSelectedInterval((prev) => (prev + 1) % INTERVALS_PER_DAY);
    }, 420);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const handlePrimaryParamChange = (key: PrimaryParamKey, val: number) => {
    userModifiedRef.current = true;
    setDynamicState((prev) => {
      if (prev.locks[key]) return prev;
      const nextBase: SimulationParams = { ...prev.params, [key]: val };
      const reconciled = reconcileDynamicSimulationState({
        days,
        params: nextBase,
        locks: prev.locks,
        previousBounds: prev.bounds,
        previousMCeilKw: prev.mCeilKw,
        scope: autoSizeScope,
        activeDayIndex: safeDayIndex,
        timeConvention: metadata.timeConvention,
        trigger: key,
      });
      return {
        params: reconciled.params,
        bounds: reconciled.bounds,
        mCeilKw: reconciled.mCeilKw,
        locks: prev.locks,
      };
    });
  };

  const handleToggleLock = (key: PrimaryParamKey) => {
    userModifiedRef.current = true;
    setDynamicState((prev) => {
      const nextLocked = !prev.locks[key];
      const nextLocks: SliderLocks = { ...prev.locks, [key]: nextLocked };
      if (nextLocked) {
        return { ...prev, locks: nextLocks };
      }
      const trigger: DynamicRecalcTrigger = `unlock_${key}`;
      const reconciled = reconcileDynamicSimulationState({
        days,
        params: prev.params,
        locks: nextLocks,
        previousBounds: prev.bounds,
        previousMCeilKw: prev.mCeilKw,
        scope: autoSizeScope,
        activeDayIndex: safeDayIndex,
        timeConvention: metadata.timeConvention,
        trigger,
      });
      return {
        params: reconciled.params,
        bounds: reconciled.bounds,
        mCeilKw: reconciled.mCeilKw,
        locks: nextLocks,
      };
    });
  };

  const handleStrategyChange = (strategy: ChargingStrategy) => {
    userModifiedRef.current = true;
    setDynamicState((prev) => {
      const nextBase: SimulationParams = { ...prev.params, chargingStrategy: strategy };
      const reconciled = reconcileDynamicSimulationState({
        days,
        params: nextBase,
        locks: prev.locks,
        previousBounds: prev.bounds,
        previousMCeilKw: prev.mCeilKw,
        scope: autoSizeScope,
        activeDayIndex: safeDayIndex,
        timeConvention: metadata.timeConvention,
        trigger: 'mode_or_secondary',
      });
      return {
        params: reconciled.params,
        bounds: reconciled.bounds,
        mCeilKw: reconciled.mCeilKw,
        locks: prev.locks,
      };
    });
  };

  const handleParamChange = (patch: Partial<SimulationParams>) => {
    userModifiedRef.current = true;
    setDynamicState((prev) => {
      const nextBase: SimulationParams = { ...prev.params, ...patch };
      const keys = Object.keys(patch) as Array<keyof SimulationParams>;
      const affectsLoadScale = keys.includes('loadScalePct');
      const affectsSizing = keys.some((k) => SECONDARY_SIZING_KEYS.has(k));

      if (!affectsSizing) {
        return { ...prev, params: nextBase };
      }

      const reconciled = reconcileDynamicSimulationState({
        days,
        params: nextBase,
        locks: prev.locks,
        previousBounds: prev.bounds,
        previousMCeilKw: prev.mCeilKw,
        scope: autoSizeScope,
        activeDayIndex: safeDayIndex,
        timeConvention: metadata.timeConvention,
        trigger: affectsLoadScale ? 'dataset_or_scope' : 'mode_or_secondary',
      });
      return {
        params: reconciled.params,
        bounds: reconciled.bounds,
        mCeilKw: reconciled.mCeilKw,
        locks: prev.locks,
      };
    });
  };

  const handleJumpToDayInterval = (dayIndex: number, intervalIndex: number) => {
    setIsPlaying(false);
    const nextIdx = Math.max(0, Math.min(days.length - 1, dayIndex));
    setSelectedDayIndex(nextIdx);
    setSelectedInterval(Math.max(0, Math.min(INTERVALS_PER_DAY - 1, intervalIndex)));
    if (autoSizeScope === 'active_day' && nextIdx !== safeDayIndex) {
      setDynamicState((prev) => {
        const reconciled = reconcileDynamicSimulationState({
          days,
          params: prev.params,
          locks: prev.locks,
          previousBounds: prev.bounds,
          previousMCeilKw: prev.mCeilKw,
          scope: 'active_day',
          activeDayIndex: nextIdx,
          timeConvention: metadata.timeConvention,
          trigger: 'dataset_or_scope',
        });
        return {
          params: reconciled.params,
          bounds: reconciled.bounds,
          mCeilKw: reconciled.mCeilKw,
          locks: prev.locks,
        };
      });
    }
  };

  const handleReset = () => {
    userModifiedRef.current = true;
    setIsPlaying(false);

    const baseline = defaultBaselineRef.current;
    if (baseline) {
      setDynamicState({
        params: {
          ...baseline.params,
          baseLoadProfileKw: [...baseline.params.baseLoadProfileKw],
          basePvNormalized: [...baseline.params.basePvNormalized],
        },
        bounds: baseline.bounds,
        mCeilKw: baseline.mCeilKw,
        locks: { ...DEFAULT_SLIDER_LOCKS },
      });
      setAutoSizeScope('all_days');
      setDays(baseline.days.map((d) => ({ ...d, loadKw: [...d.loadKw] })));
      setOriginalDays(baseline.days.map((d) => ({ ...d, loadKw: [...d.loadKw] })));
      setMetadata(baseline.metadata);
      setSelectedDayIndex(baseline.selectedDayIndex);
      setSelectedInterval(baseline.selectedInterval);
      setImportError(null);
      return;
    }

    const baseResetParams: SimulationParams = {
      ...DEFAULT_PARAMS,
      baseLoadProfileKw: [...DEFAULT_BASE_LOAD_48_KW],
      basePvNormalized: [...DEFAULT_PARAMS.basePvNormalized],
    };
    const reconciled = reconcileDynamicSimulationState({
      days: [DEFAULT_BENCHMARK_DAY],
      params: baseResetParams,
      locks: DEFAULT_SLIDER_LOCKS,
      scope: 'all_days',
      activeDayIndex: 0,
      timeConvention: DEFAULT_METADATA.timeConvention,
      trigger: 'dataset_or_scope',
    });

    setDynamicState({
      params: reconciled.params,
      bounds: reconciled.bounds,
      mCeilKw: reconciled.mCeilKw,
      locks: { ...DEFAULT_SLIDER_LOCKS },
    });
    setAutoSizeScope('all_days');
    setDays([DEFAULT_BENCHMARK_DAY]);
    setOriginalDays([DEFAULT_BENCHMARK_DAY]);
    setMetadata(DEFAULT_METADATA);
    setSelectedDayIndex(0);
    setSelectedInterval(38);
    setImportError(null);
  };

  const handleUpdateIntervalLoad = (interval: number, loadKw: number) => {
    userModifiedRef.current = true;
    const nextDays = days.map((d, idx) => {
      if (idx !== safeDayIndex) return d;
      const nextLoad = [...d.loadKw];
      nextLoad[interval] = loadKw;
      return { ...d, loadKw: nextLoad };
    });
    setDays(nextDays);
    setDynamicState((prev) => {
      const reconciled = reconcileDynamicSimulationState({
        days: nextDays,
        params: prev.params,
        locks: prev.locks,
        previousBounds: prev.bounds,
        previousMCeilKw: prev.mCeilKw,
        scope: autoSizeScope,
        activeDayIndex: safeDayIndex,
        timeConvention: metadata.timeConvention,
        trigger: 'mode_or_secondary',
      });
      return {
        params: reconciled.params,
        bounds: reconciled.bounds,
        mCeilKw: reconciled.mCeilKw,
        locks: prev.locks,
      };
    });
  };

  const handleResetProfile = () => {
    userModifiedRef.current = true;
    const original = originalDays[safeDayIndex];
    if (!original) return;
    const nextDays = days.map((d, idx) =>
      idx === safeDayIndex ? { ...original, loadKw: [...original.loadKw] } : d
    );
    setDays(nextDays);
    setDynamicState((prev) => {
      const reconciled = reconcileDynamicSimulationState({
        days: nextDays,
        params: prev.params,
        locks: prev.locks,
        previousBounds: prev.bounds,
        previousMCeilKw: prev.mCeilKw,
        scope: autoSizeScope,
        activeDayIndex: safeDayIndex,
        timeConvention: metadata.timeConvention,
        trigger: 'mode_or_secondary',
      });
      return {
        params: reconciled.params,
        bounds: reconciled.bounds,
        mCeilKw: reconciled.mCeilKw,
        locks: prev.locks,
      };
    });
  };

  const handleImportFile = async (file: File) => {
    userModifiedRef.current = true;
    setImportError(null);
    setIsPlaying(false);
    try {
      const parsed = await parseUtilityMeterFile(file);
      setDays(parsed.days);
      setOriginalDays(parsed.days.map((d) => ({ ...d, loadKw: [...d.loadKw] })));
      setMetadata(parsed.metadata);

      // Automatically focus on the highest original peak day & peak interval
      const { dayIndex, intervalIndex } = findHighestPeakLocation(parsed.days);
      setSelectedDayIndex(dayIndex);
      setSelectedInterval(intervalIndex);

      setDynamicState((prev) => {
        const baseParams: SimulationParams = parsed.parameters
          ? {
              ...prev.params,
              ...parsed.parameters,
              baseLoadProfileKw: [...DEFAULT_BASE_LOAD_48_KW],
              basePvNormalized: [...DEFAULT_PARAMS.basePvNormalized],
            }
          : prev.params;
        if (prev.locks.targetCapKw) baseParams.targetCapKw = prev.params.targetCapKw;
        if (prev.locks.transformerLimitKw) {
          baseParams.transformerLimitKw = prev.params.transformerLimitKw;
        }
        if (prev.locks.solarPeakKw) baseParams.solarPeakKw = prev.params.solarPeakKw;
        if (prev.locks.bessCapacityKwh) baseParams.bessCapacityKwh = prev.params.bessCapacityKwh;
        if (prev.locks.bessPowerKw) baseParams.bessPowerKw = prev.params.bessPowerKw;

        const reconciled = reconcileDynamicSimulationState({
          days: parsed.days,
          params: baseParams,
          locks: prev.locks,
          previousBounds: prev.bounds,
          previousMCeilKw: prev.mCeilKw,
          scope: autoSizeScope,
          activeDayIndex: dayIndex,
          timeConvention: parsed.metadata.timeConvention,
          trigger: 'dataset_or_scope',
        });
        return {
          params: reconciled.params,
          bounds: reconciled.bounds,
          mCeilKw: reconciled.mCeilKw,
          locks: prev.locks,
        };
      });
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Unable to parse utility meter file.'
      );
    }
  };

  const handleExportCsv = () => {
    const csv = buildDispatchCsv(days, dayResults, metadata, params);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `microgrid-30min-dispatch-${params.bessPowerKw}kw-${params.bessCapacityKwh}kwh.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportDataset = (format: 'xlsx' | 'csv' | 'json') => {
    if (format === 'xlsx') {
      exportMeterAndDispatchWorkbook(days, dayResults, metadata, params);
    } else if (format === 'csv') {
      exportDispatchCsvFile(days, dayResults, metadata, params);
    } else {
      exportDispatchJsonFile(days, dayResults, metadata, params);
    }
  };

  const selectedIntervalData =
    activeOutput.intervals[selectedInterval] ?? activeOutput.intervals[0];
  const lowerMode: 'curves' | 'tuner' | 'equations' =
    activeView === 'tuner' ? 'tuner' : activeView === 'equations' ? 'equations' : 'curves';

  const handleSelectDay = (idx: number) => {
    setIsPlaying(false);
    const nextIdx = Math.max(0, Math.min(days.length - 1, idx));
    setSelectedDayIndex(nextIdx);
    if (autoSizeScope === 'active_day' && nextIdx !== safeDayIndex) {
      setDynamicState((prev) => {
        const reconciled = reconcileDynamicSimulationState({
          days,
          params: prev.params,
          locks: prev.locks,
          previousBounds: prev.bounds,
          previousMCeilKw: prev.mCeilKw,
          scope: 'active_day',
          activeDayIndex: nextIdx,
          timeConvention: metadata.timeConvention,
          trigger: 'dataset_or_scope',
        });
        return {
          params: reconciled.params,
          bounds: reconciled.bounds,
          mCeilKw: reconciled.mCeilKw,
          locks: prev.locks,
        };
      });
    }
  };

  return (
    <>
    <div
      id="overview"
      className={`${
        reportPreviewOpen ? 'print:hidden ' : ''
      }min-h-screen lg:h-screen lg:overflow-hidden bg-[#f6f5f2] dark:bg-[#111113] text-[#111113] dark:text-[#f2efeb] flex flex-col max-w-[1600px] mx-auto border-x border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)]`}
    >
      <TopBar
        activeView={activeView}
        onSelectView={setActiveView}
        onExportCsv={handleExportCsv}
        onPreviewReport={() => {
          setIsPlaying(false);
          setReportPreviewOpen(true);
        }}
      />

      {/* 3-Column Compact Technical Console */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_350px]">
        {/* Left Sidebar: Consolidated Configuration */}
        <ControlDeck
          params={params}
          sliderBounds={sliderBounds}
          sliderLocks={sliderLocks}
          daysCount={days.length}
          activeDateLabel={activeDayResult.displayDate}
          timeConvention={metadata.timeConvention}
          autoSizeScope={autoSizeScope}
          autoSizePreview={autoSizePreview}
          datasetSummary={datasetSummary}
          onChangeScope={(scope) => {
            userModifiedRef.current = true;
            setAutoSizeScope(scope);
            setDynamicState((prev) => {
              const reconciled = reconcileDynamicSimulationState({
                days,
                params: prev.params,
                locks: prev.locks,
                previousBounds: prev.bounds,
                previousMCeilKw: prev.mCeilKw,
                scope,
                activeDayIndex: safeDayIndex,
                timeConvention: metadata.timeConvention,
                trigger: 'dataset_or_scope',
              });
              return {
                params: reconciled.params,
                bounds: reconciled.bounds,
                mCeilKw: reconciled.mCeilKw,
                locks: prev.locks,
              };
            });
          }}
          onJumpToDayInterval={handleJumpToDayInterval}
          onChangePrimaryParam={handlePrimaryParamChange}
          onToggleLock={handleToggleLock}
          onChangeStrategy={handleStrategyChange}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Center Main Stage: KPI Strip + Power Flow Schematic + Lower Analysis Pane */}
        <main className="min-w-0 lg:h-full flex flex-col lg:overflow-hidden border-b lg:border-b-0 lg:border-r border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)]">
          <KpiStrip
            summary={activeOutput.summary}
            params={params}
            activeDateLabel={activeDayResult.displayDate}
            timeConvention={metadata.timeConvention}
          />

          {/* Upper Viz Pane: Microgrid Power Flow Schematic on Dot Grid */}
          <div className="shrink-0 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)]">
            <MicrogridSchematic
              intervalData={selectedIntervalData}
              params={params}
              selectedInterval={selectedInterval}
              activeDateLabel={activeDayResult.displayDate}
              timeConvention={metadata.timeConvention}
              isPlaying={isPlaying}
              theme={theme}
              onSelectInterval={(idx) => {
                setIsPlaying(false);
                setSelectedInterval(idx);
              }}
              onTogglePlay={() => setIsPlaying((p) => !p)}
            />
          </div>

          {/* Lower Stage Sub-Nav + Scrollable Analysis Viewport */}
          <div className="flex items-center justify-between px-3.5 py-1 border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] bg-black/[0.025] dark:bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-1">
              {LOWER_STAGE_TABS.map((tab) => {
                const isActive = lowerMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveView(tab.id)}
                    className={`px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#111113] text-[#f6f5f2] dark:bg-[#f2efeb] dark:text-[#111113] font-bold'
                        : 'bg-[rgba(17,17,19,0.07)] text-[rgba(17,17,19,0.7)] hover:text-[#111113] dark:bg-[rgba(242,239,235,0.08)] dark:text-[rgba(242,239,235,0.65)] dark:hover:text-[#f2efeb]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <span className="hidden sm:inline font-mono text-[9.5px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.52)] dark:text-[rgba(242,239,235,0.45)] tabular-nums">
              Δt = {DT_HOURS} h · η_RT {params.roundTripEfficiencyPct.toFixed(1)}% · SOC {params.socMinPct}–{params.socMaxPct}%
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto tech-scroll">
            {lowerMode === 'curves' && (
              <DispatchCharts
                intervals={activeOutput.intervals}
                summary={activeOutput.summary}
                params={params}
                selectedInterval={selectedInterval}
                timeConvention={metadata.timeConvention}
                theme={theme}
                onSelectInterval={(idx) => {
                  setIsPlaying(false);
                  setSelectedInterval(idx);
                }}
              />
            )}

            {lowerMode === 'tuner' && (
              <ProfileTunerAndEquations
                mode="tuner"
                params={params}
                activeDayLoadKw={activeDayProfile.loadKw}
                activeDateLabel={activeDayResult.displayDate}
                timeConvention={metadata.timeConvention}
                intervalData={selectedIntervalData}
                summary={activeOutput.summary}
                selectedInterval={selectedInterval}
                onSelectInterval={(idx) => {
                  setIsPlaying(false);
                  setSelectedInterval(idx);
                }}
                onUpdateIntervalLoad={handleUpdateIntervalLoad}
                onResetProfile={handleResetProfile}
              />
            )}

            {lowerMode === 'equations' && (
              <ProfileTunerAndEquations
                mode="equations"
                params={params}
                activeDayLoadKw={activeDayProfile.loadKw}
                activeDateLabel={activeDayResult.displayDate}
                timeConvention={metadata.timeConvention}
                intervalData={selectedIntervalData}
                summary={activeOutput.summary}
                selectedInterval={selectedInterval}
                onSelectInterval={(idx) => {
                  setIsPlaying(false);
                  setSelectedInterval(idx);
                }}
                onUpdateIntervalLoad={handleUpdateIntervalLoad}
                onResetProfile={handleResetProfile}
              />
            )}
          </div>
        </main>

        {/* Right Panel: Import/Export + Critical Days + 30-Min Time Ledger */}
        <DispatchLedgerTable
          intervals={activeOutput.intervals}
          params={params}
          selectedInterval={selectedInterval}
          activeDateLabel={activeDayResult.displayDate}
          timeConvention={metadata.timeConvention}
          dayResults={dayResults}
          selectedDayIndex={safeDayIndex}
          metadata={metadata}
          importError={importError}
          onSelectInterval={(idx) => {
            setIsPlaying(false);
            setSelectedInterval(idx);
          }}
          onSelectDay={handleSelectDay}
          onImportFile={handleImportFile}
          onExportDataset={handleExportDataset}
        />
      </div>

      {/* Compact Technical Footer */}
      <footer className="border-t border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] bg-[#f6f5f2] dark:bg-[#111113] px-6 py-1.5 flex flex-wrap items-center justify-between gap-4 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[rgba(17,17,19,0.6)] dark:text-[rgba(242,239,235,0.55)] shrink-0">
        <span>Δt = {DT_HOURS} h · η_c = η_d = √η_RT</span>
        <span className="text-[#111113] dark:text-[#f2efeb] tabular-nums">
          Selected Interval: {activeDayResult.displayDate} · {formatIntervalWindow(selectedInterval, metadata.timeConvention)}
        </span>
        <div className="flex items-center gap-3 ml-auto sm:ml-0">
          <span>Commercial BESS &amp; Solar PV Dispatch Model</span>
          <div
            role="group"
            aria-label="Color theme"
            className="inline-flex items-center border border-[rgba(17,17,19,0.2)] dark:border-[rgba(242,239,235,0.2)] bg-[rgba(17,17,19,0.04)] dark:bg-[rgba(242,239,235,0.05)]"
          >
            <button
              type="button"
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'dark'
                  ? 'bg-[#f2efeb] text-[#111113] font-bold'
                  : 'text-[rgba(17,17,19,0.65)] hover:text-[#111113] dark:text-[rgba(242,239,235,0.55)] dark:hover:text-[#f2efeb]'
              }`}
            >
              <Moon className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
              <span>Dark</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'light'
                  ? 'bg-[#111113] text-[#f6f5f2] font-bold'
                  : 'text-[rgba(17,17,19,0.65)] hover:text-[#111113] dark:text-[rgba(242,239,235,0.55)] dark:hover:text-[#f2efeb]'
              }`}
            >
              <Sun className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
              <span>Light</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Secondary Parameters Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        params={params}
        onChange={handleParamChange}
        onReset={handleReset}
        onClose={() => setSettingsOpen(false)}
      />
    </div>

      {/* A4 Report Print Preview Modal */}
      <ReportPreviewModal
        isOpen={reportPreviewOpen}
        onClose={() => setReportPreviewOpen(false)}
        params={params}
        metadata={metadata}
        dayResults={dayResults}
        selectedDayIndex={safeDayIndex}
        selectedInterval={selectedInterval}
        autoSizeScope={autoSizeScope}
        autoSizePreview={autoSizePreview}
        datasetSummary={datasetSummary}
        onSelectDay={handleSelectDay}
      />
    </>
  );
}
