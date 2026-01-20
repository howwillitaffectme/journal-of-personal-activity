
import React, { useMemo } from 'react';
import { Category, MonthlyLogs, LogState, ProgressData } from '../types';

const VIRIDIS_COLORS = [
  '#440154', '#482475', '#414487', '#355f8d', '#2a788e',
  '#21918c', '#22a884', '#44bf70', '#7ad151', '#fde725'
];

interface TrackerGridProps {
  categories: Category[];
  logs: MonthlyLogs;
  daysInMonth: number;
  onToggle: (day: number, categoryId: string) => void;
  onToggleAtmosphere: (day: number) => void;
  onOpenNote: (day: number) => void;
}

const TrackerGrid: React.FC<TrackerGridProps> = ({ categories, logs, daysInMonth, onToggle, onToggleAtmosphere, onOpenNote }) => {
  const daysArray = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), []);

  const stats = useMemo<ProgressData[]>(() => {
    // Single pass over logs to calculate all counts
    const countsMap: { [catId: string]: number } = {};
    categories.forEach(cat => countsMap[cat.id] = 0);

    Object.values(logs).forEach(dayLog => {
      categories.forEach(cat => {
        const val = dayLog.entries?.[cat.id];
        if (cat.type === 'scalar') {
          if (typeof val === 'number' && val > 0) countsMap[cat.id]++;
        } else {
          if (val === LogState.ON) countsMap[cat.id]++;
          else if (val === LogState.QUESTIONABLE) countsMap[cat.id] += 0.5;
        }
      });
    });

    return categories.map(cat => ({
      name: cat.name || cat.icon || cat.id,
      count: Math.round(countsMap[cat.id] * 10) / 10,
      total: daysInMonth,
      percentage: Math.min(100, Math.round((countsMap[cat.id] / daysInMonth) * 100)),
      color: cat.color,
      type: cat.type || 'binary'
    }));
  }, [categories, logs, daysInMonth]);

  const statsMap = useMemo(() => {
    return stats.reduce((acc, s, idx) => {
      acc[categories[idx].id] = s;
      return acc;
    }, {} as Record<string, ProgressData>);
  }, [stats, categories]);

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <table className="border-collapse bg-transparent mb-4 table-fixed" style={{ width: 'max-content', minWidth: '100%' }}>
        <colgroup>
          <col style={{ width: '220px' }} />
          {daysArray.map((_, i) => (
            <col key={i} style={{ width: '36px' }} />
          ))}
          <col style={{ width: '160px' }} />
        </colgroup>
        <thead>
          <tr className="latex-toprule">
            <th className="sticky left-0 z-10 p-2 text-left font-normal text-lg bg-[var(--bg-warm)] italic">
              Variable \ Day
            </th>
            {daysArray.map(day => {
              const isActive = day <= daysInMonth;
              return (
                <th 
                  key={day} 
                  onClick={() => isActive && onOpenNote(day)}
                  className={`p-0.5 text-center text-lg font-normal tabular-nums relative transition-colors ${isActive ? 'cursor-pointer hover:text-neutral-500 text-black' : 'text-neutral-100 cursor-default'}`}
                >
                  <div className="py-2">{day}</div>
                  {isActive && logs[day]?.note && (
                    <div 
                      className="absolute top-0 right-1 w-1.5 h-2.5 bg-black"
                      style={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 50% 80%, 0% 100%)' }}
                      title="Marginalia present" 
                    />
                  )}
                </th>
              )
            })}
            <th className="p-2 text-left font-normal text-lg text-black">Frequency</th>
          </tr>
          <tr className="latex-midrule"><td colSpan={33} className="h-0 p-0"></td></tr>
        </thead>
        <tbody className="border-0">
          <tr className="border-b border-black/10 group transition-colors">
            <td className="sticky left-0 z-10 py-3 px-2 text-lg border-0 bg-[var(--bg-warm)] italic">Atmospheric Conditions</td>
            {daysArray.map(day => {
              const isActive = day <= daysInMonth;
              const val = isActive ? logs[day]?.atmosphere : undefined;
              return (
                <td key={day} className={`p-0 text-center border-0 ${isActive ? 'cursor-pointer' : ''}`} onClick={() => isActive && onToggleAtmosphere(day)}>
                  <div 
                    className={`h-9 w-full transition-all flex items-center justify-center text-[10px] font-bold tabular-nums ${val ? '' : 'text-neutral-200'}`}
                    style={{ 
                      backgroundColor: val ? VIRIDIS_COLORS[val - 1] : 'transparent',
                      color: val ? (val > 7 ? 'black' : 'white') : 'inherit'
                    }}
                  >
                    {isActive ? (val || '•') : ''}
                  </div>
                </td>
              )}
            )}
            <td className="p-2 border-0"></td>
          </tr>

          {categories.map((cat) => {
            const stat = statsMap[cat.id];
            return (
              <tr key={cat.id} className="hover:bg-black/5 transition-colors group">
                <td className="sticky left-0 z-10 bg-[var(--bg-warm)] py-2 px-2 text-lg border-0 truncate">
                  <div className="flex items-center gap-3">
                    {cat.icon && <span className="text-2xl leading-none shrink-0" title={cat.name}>{cat.icon}</span>}
                    {cat.name && <span className="text-lg font-normal truncate">{cat.name}</span>}
                  </div>
                </td>
                {daysArray.map(day => {
                  const isActive = day <= daysInMonth;
                  const value = isActive ? logs[day]?.entries?.[cat.id] : undefined;
                  return (
                    <td key={day} className={`p-0 text-center border-0 ${isActive ? 'cursor-pointer' : ''}`} onClick={() => isActive && onToggle(day, cat.id)}>
                      <div className="flex items-center justify-center py-2.5">
                        {isActive && (
                          cat.type === 'scalar' ? (
                            <div className={`text-[11px] tabular-nums w-[18px] h-[18px] flex items-center justify-center border border-black/10 transition-colors ${value ? 'font-bold bg-black text-white' : 'text-neutral-300 italic'}`}>
                              {typeof value === 'number' && value !== 0 ? value : '•'}
                            </div>
                          ) : (
                            <CellSquare state={(value as LogState) ?? LogState.OFF} />
                          )
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="p-2 align-middle border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-[14px] bg-[var(--bg-warm)] border-[0.5px] border-black relative overflow-hidden">
                      <div className="h-full transition-all duration-500 ease-in-out bg-black" style={{ width: `${stat?.percentage}%` }} />
                    </div>
                    <span className="text-lg font-normal tabular-nums min-w-[48px] text-right text-black">{stat?.percentage}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="latex-bottomrule"><td colSpan={33} className="h-0 p-0"></td></tr>
        </tfoot>
      </table>
    </div>
  );
};

const CellSquare = React.memo(({ state }: { state: LogState }) => {
  switch (state) {
    case LogState.ON:
      return <div className="cell-square bg-black shadow-sm" />;
    case LogState.QUESTIONABLE:
      return (
        <div className="cell-square relative bg-[var(--bg-warm)]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-black/60" />
          </div>
        </div>
      );
    default:
      return <div className="cell-square bg-transparent border-neutral-200 hover:border-black/40 transition-colors" />;
  }
});

export default TrackerGrid;
