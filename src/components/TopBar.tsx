import { Download, FileText } from 'lucide-react';

export type StageView = 'overview' | 'curves' | 'tuner' | 'equations';

interface TopBarProps {
  activeView: StageView;
  onSelectView: (view: StageView) => void;
  onExportCsv: () => void;
  onPreviewReport: () => void;
}

const NAV_ITEMS: { id: StageView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'equations', label: 'Model Rules' },
];

export function TopBar({ activeView, onSelectView, onExportCsv, onPreviewReport }: TopBarProps) {
  return (
    <header className="bg-[#f6f5f2] dark:bg-[#111113] border-b border-[rgba(17,17,19,0.12)] dark:border-[rgba(242,239,235,0.12)] px-4 sm:px-6 py-2 flex items-center justify-between gap-6 shrink-0">
      {/* Zone 1: Single-element Brand Wordmark */}
      <a
        href="#overview"
        onClick={(e) => {
          e.preventDefault();
          onSelectView('overview');
        }}
        className="font-display text-base sm:text-lg font-extrabold tracking-[-0.03em] text-[#111113] dark:text-[#f2efeb] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff4d00]"
      >
        MICROGRID PEAK SHAVER
      </a>

      {/* Zone 2: 4 concise single-line navigation controls */}
      <nav
        aria-label="Primary workspace views"
        className="hidden md:flex items-center gap-6 font-mono text-[11px] tracking-[0.08em] uppercase"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b ${
                isActive
                  ? 'text-[#111113] dark:text-[#f2efeb] border-[#ff4d00]'
                  : 'text-[rgba(17,17,19,0.62)] dark:text-[rgba(242,239,235,0.6)] border-transparent hover:text-[#111113] dark:hover:text-[#f2efeb]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Top-Right Actions (Export CSV + PREVIEW REPORT) */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[#f2efeb] bg-[#ff4d00] hover:bg-[#e04400] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111113] dark:focus-visible:ring-[#f2efeb]"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export CSV</span>
        </button>

        <button
          type="button"
          onClick={onPreviewReport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-[#f2efeb] bg-[#111113] dark:bg-[#f2efeb] dark:text-[#111113] hover:bg-[#ff4d00] dark:hover:bg-[#ff4d00] dark:hover:text-[#f2efeb] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4d00]"
        >
          <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>PREVIEW REPORT</span>
        </button>
      </div>
    </header>
  );
}
