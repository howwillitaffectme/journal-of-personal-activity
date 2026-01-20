
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit2, X as CloseIcon, Download, Upload, Hash, CheckSquare, Image as ImageIcon } from 'lucide-react';
import { loadData, saveData } from './services/storage';
import { Category, LogState, StorageData, DailyLog, CategoryType } from './types';
import TrackerGrid from './components/TrackerGrid';
import { getInsights } from './services/gemini';

const VIRIDIS_COLORS = [
  '#440154', '#482475', '#414487', '#355f8d', '#2a788e',
  '#21918c', '#22a884', '#44bf70', '#7ad151', '#fde725'
];

const toRoman = (num: number): string => {
  const map: { [key: number]: string } = { 
    12: 'XII', 11: 'XI', 10: 'X', 9: 'IX', 8: 'VIII', 7: 'VII', 6: 'VI', 5: 'V', 4: 'IV', 3: 'III', 2: 'II', 1: 'I' 
  };
  return map[num] || num.toString();
};

const App: React.FC = () => {
  const [data, setData] = useState<StorageData>(loadData());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [insights, setInsights] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  
  // Editor States
  const [editingNote, setEditingNote] = useState<{ day: number, text: string } | null>(null);
  const [editingScalar, setEditingScalar] = useState<{ day: number, categoryId: string, value: number, name: string, units?: string } | null>(null);
  const [editingAtmosphere, setEditingAtmosphere] = useState<{ day: number, value: number | undefined } | null>(null);
  
  // Category Modal State Consolidated
  const [catModal, setCatModal] = useState<{
    isOpen: boolean;
    editingId: string | null;
    name: string;
    color: string;
    icon: string;
    type: CategoryType;
    units: string;
  }>({
    isOpen: false,
    editingId: null,
    name: '',
    color: '#000000',
    icon: '',
    type: 'binary',
    units: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  
  const monthKey = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const monthNumber = currentDate.getMonth() + 1;
  const romanMonth = toRoman(monthNumber);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const daysInMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }, [currentDate]);

  const handleCellAction = useCallback((day: number, categoryId: string) => {
    const category = data.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (category.type === 'scalar') {
      const currentVal = (data.logs[monthKey]?.[day]?.entries[categoryId] as number) || 0;
      setEditingScalar({ day, categoryId, value: currentVal, name: category.name, units: category.units });
    } else {
      setData(prev => {
        const monthLogs = prev.logs[monthKey] || {};
        const dayLog: DailyLog = monthLogs[day] || { entries: {}, note: '' };
        const currentState = (dayLog.entries[categoryId] as LogState) ?? LogState.OFF;
        const nextState = (currentState + 1) % 3;
        
        return {
          ...prev,
          logs: {
            ...prev.logs,
            [monthKey]: {
              ...monthLogs,
              [day]: { ...dayLog, entries: { ...dayLog.entries, [categoryId]: nextState } }
            }
          }
        };
      });
    }
  }, [data.categories, monthKey, data.logs]);

  const handleAtmosphereToggle = useCallback((day: number) => {
    const currentValue = data.logs[monthKey]?.[day]?.atmosphere;
    setEditingAtmosphere({ day, value: currentValue });
  }, [data.logs, monthKey]);

  const saveAtmosphere = (day: number, value: number | undefined) => {
    setData(prev => {
      const monthLogs = prev.logs[monthKey] || {};
      const dayLog = monthLogs[day] || { entries: {}, note: '' };
      return {
        ...prev,
        logs: { ...prev.logs, [monthKey]: { ...monthLogs, [day]: { ...dayLog, atmosphere: value } } }
      };
    });
    setEditingAtmosphere(null);
  };

  const saveScalarValue = () => {
    if (!editingScalar) return;
    setData(prev => {
      const monthLogs = prev.logs[monthKey] || {};
      const dayLog = monthLogs[editingScalar.day] || { entries: {}, note: '' };
      return {
        ...prev,
        logs: {
          ...prev.logs,
          [monthKey]: {
            ...monthLogs,
            [editingScalar.day]: {
              ...dayLog,
              entries: { ...dayLog.entries, [editingScalar.categoryId]: editingScalar.value }
            }
          }
        }
      };
    });
    setEditingScalar(null);
  };

  const handleNoteSave = () => {
    if (!editingNote) return;
    setData(prev => {
      const monthLogs = prev.logs[monthKey] || {};
      const dayLog = monthLogs[editingNote.day] || { entries: {}, note: '' };
      return {
        ...prev,
        logs: { ...prev.logs, [monthKey]: { ...monthLogs, [editingNote.day]: { ...dayLog, note: editingNote.text } } }
      };
    });
    setEditingNote(null);
  };

  const openAddCategory = () => {
    setCatModal({
      isOpen: true,
      editingId: null,
      name: '',
      color: '#000000',
      icon: '',
      type: 'binary',
      units: ''
    });
  };

  const openEditCategory = (cat: Category) => {
    setCatModal({
      isOpen: true,
      editingId: cat.id,
      name: cat.name || '',
      color: cat.color,
      icon: cat.icon || '',
      type: cat.type || 'binary',
      units: cat.units || ''
    });
  };

  const handleSaveCategory = () => {
    if (!catModal.name.trim() && !catModal.icon.trim()) return;

    setData(prev => {
      if (catModal.editingId) {
        return {
          ...prev,
          categories: prev.categories.map(c => 
            c.id === catModal.editingId 
              ? { ...c, name: catModal.name, color: catModal.color, icon: catModal.icon, type: catModal.type, units: catModal.units } 
              : c
          )
        };
      } else {
        const newCat: Category = { 
          id: Date.now().toString(), 
          name: catModal.name, 
          color: catModal.color,
          icon: catModal.icon,
          type: catModal.type,
          units: catModal.units
        };
        return { ...prev, categories: [...prev.categories, newCat] };
      }
    });
    setCatModal(prev => ({ ...prev, isOpen: false }));
  };

  const removeCategory = (id: string) => {
    if (!confirm("Remove this entry from the classification index?")) return;
    setData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id)
    }));
  };

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setData(prev => ({
        ...prev,
        evidence: { ...(prev.evidence || {}), [monthKey]: base64 }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleEvidenceTitleChange = (val: string) => {
    setData(prev => ({
      ...prev,
      evidenceTitles: { ...(prev.evidenceTitles || {}), [monthKey]: val }
    }));
  };

  const removeEvidence = () => {
    if (!confirm("Discard this month's physical evidence?")) return;
    setData(prev => {
      const newEvidence = { ...(prev.evidence || {}) };
      const newTitles = { ...(prev.evidenceTitles || {}) };
      delete newEvidence[monthKey];
      delete newTitles[monthKey];
      return { ...prev, evidence: newEvidence, evidenceTitles: newTitles };
    });
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + offset);
    setCurrentDate(newDate);
    setInsights(null);
  };

  const fetchAIInsights = async () => {
    setIsInsightLoading(true);
    const monthLogs = data.logs[monthKey] || {};
    const result = await getInsights(monthLabel, data.categories, monthLogs);
    setInsights(result);
    setIsInsightLoading(false);
  };

  const exportData = () => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jopa-record-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.categories && imported.logs) {
          setData(imported);
        }
      } catch (err) {
        alert("Error parsing file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto selection:bg-neutral-200">
      <header className="space-y-3 border-b border-black pb-6">
        <h1 className="text-4xl font-normal tracking-tight">Journal of Personal Activity (JOPA)</h1>
        <p className="text-lg italic text-neutral-600 mt-1 tabular-nums">Monthly Observation Record — Vol. {currentDate.getFullYear()}</p>
      </header>

      <main className="space-y-12 flex-1">
        <section className="space-y-4">
          <div className="flex items-center">
             <div className="min-w-[110px]">
               <h2 className="text-xl font-bold uppercase tracking-widest tabular-nums">TABLE {romanMonth}:</h2>
             </div>
             <div className="flex items-center ml-2">
                <button onClick={() => changeMonth(-1)} className="p-0.5 hover:text-neutral-500 transition-colors"><ChevronLeft size={18} /></button>
                <span className="font-bold uppercase tracking-[0.2em] min-w-[150px] text-center px-1 text-sm whitespace-nowrap">{monthLabel}</span>
                <button onClick={() => changeMonth(1)} className="p-0.5 hover:text-neutral-500 transition-colors"><ChevronRight size={18} /></button>
             </div>
          </div>
          <TrackerGrid 
            categories={data.categories}
            logs={data.logs[monthKey] || {}}
            daysInMonth={daysInMonth}
            onToggle={handleCellAction}
            onToggleAtmosphere={handleAtmosphereToggle}
            onOpenNote={(day) => setEditingNote({ day, text: data.logs[monthKey]?.[day]?.note || '' })}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            {/* Physical Evidence Section (Moved Up) */}
            <section className="space-y-6">
              <h2 className="text-2xl border-b border-black pb-2 italic">Physical Evidence</h2>
              <div className="max-w-2xl">
                <div className="border border-black bg-white flex items-center justify-center relative group min-h-[400px]">
                  {data.evidence?.[monthKey] ? (
                    <>
                      <img src={data.evidence[monthKey]} alt="Scientific Record" className="w-full h-auto max-h-[600px] object-contain block" />
                      <button onClick={removeEvidence} className="absolute top-2 right-2 p-1.5 bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"><Trash2 size={16} /></button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-12 text-center">
                      <ImageIcon size={48} className="text-neutral-200" />
                      <p className="italic text-neutral-400">No artifact cataloged for this period.</p>
                      <button onClick={() => evidenceInputRef.current?.click()} className="mt-2 px-6 py-2 border border-black text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all">Catalog Artifact</button>
                      <input type="file" ref={evidenceInputRef} className="hidden" accept="image/*" onChange={handleEvidenceUpload} />
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-base font-normal italic tracking-wide">
                    Fig. <span className="tabular-nums">{monthKey}</span>. 
                    <input 
                      type="text" 
                      placeholder="[ Speciemen designation pending ]"
                      className="ml-2 bg-transparent border-b border-black/10 hover:border-black/30 focus:border-black outline-none italic placeholder:text-neutral-300 w-full sm:w-auto min-w-[280px]"
                      value={data.evidenceTitles?.[monthKey] || ''}
                      onChange={(e) => handleEvidenceTitleChange(e.target.value)}
                    />
                  </p>
                </div>
              </div>
            </section>

            {/* AI Insights Section (Moved Down) */}
            <section className="space-y-6">
              <h2 className="text-2xl border-b border-black pb-2 italic">Analysis & Insights (AI)</h2>
              {isInsightLoading ? (
                <div className="py-12 flex items-center justify-center gap-3 italic text-neutral-500 text-lg">
                  <div className="w-4 h-4 border border-black border-t-transparent rounded-full animate-spin"></div>
                  Synthesizing dataset...
                </div>
              ) : insights ? (
                <div className="bg-neutral-100/50 p-6 border-l border-black">
                  <p className="text-lg leading-relaxed text-neutral-800 italic">&ldquo;{insights}&rdquo;</p>
                  <button onClick={() => setInsights(null)} className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-neutral-400 hover:text-black transition-colors">[ Discard Remarks ]</button>
                </div>
              ) : (
                <div className="py-12 border border-dashed border-black flex flex-col items-center justify-center text-neutral-400 space-y-4">
                  <p className="italic text-base">No automated insights synthesized for this period.</p>
                  <button onClick={fetchAIInsights} className="px-6 py-2.5 border border-black text-black text-xs font-bold uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all">Request Analysis</button>
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center justify-between border-b border-black pb-2">
              <h2 className="text-2xl italic">Index of Classifications</h2>
              <button onClick={openAddCategory} className="p-1 border border-black hover:bg-black hover:text-white transition-colors"><Plus size={18} /></button>
            </div>
            <div className="divide-y divide-black/10">
              {data.categories.length === 0 ? (
                <p className="py-8 italic text-neutral-400 text-center text-base">No classifications defined.</p>
              ) : (
                data.categories.map(cat => (
                  <div key={cat.id} className="group py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-3.5 h-3.5 border border-black" style={{ backgroundColor: cat.color }} />
                      <div className="flex items-baseline gap-3">
                        <span className="text-xl flex items-center gap-3">
                          {cat.icon && <span className="text-2xl leading-none shrink-0" title={cat.name}>{cat.icon}</span>}
                          {cat.name && <span className="text-lg">{cat.name}</span>}
                        </span>
                        {cat.type === 'scalar' && (
                          <span className="text-xs uppercase tracking-[0.1em] text-neutral-400 italic font-bold">
                            {cat.units ? `[ ${cat.units} ]` : <Hash size={12} />}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditCategory(cat)} className="text-neutral-400 hover:text-black"><Edit2 size={16} /></button>
                      <button onClick={() => removeCategory(cat.id)} className="text-neutral-400 hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="pb-6 border-t border-black pt-8 flex justify-between items-center text-sm text-neutral-400 italic">
        <span>Scientific Observation Record Vol. {currentDate.getFullYear()}</span>
        <div className="flex gap-6">
          <button onClick={exportData} className="hover:text-black uppercase tracking-widest font-bold flex items-center gap-2 transition-colors"><Download size={14} /> Export Dataset</button>
          <button onClick={() => fileInputRef.current?.click()} className="hover:text-black uppercase tracking-widest font-bold flex items-center gap-2 transition-colors"><Upload size={14} /> Restore Record</button>
          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={importData} />
        </div>
      </footer>

      {/* Modals */}
      {editingAtmosphere && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 p-4 backdrop-blur-[2px]">
          <div className="border border-black bg-[var(--bg-warm)] w-full max-w-[400px] p-8 space-y-8 shadow-2xl">
            <div className="text-center space-y-1"><h3 className="text-xs uppercase tracking-widest font-bold text-neutral-400">Day {editingAtmosphere.day}</h3><p className="text-2xl italic">Atmospheric Intensity</p></div>
            <div className="grid grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                <button key={v} onClick={() => saveAtmosphere(editingAtmosphere.day, v)} className={`aspect-square border border-black/10 flex items-center justify-center text-lg font-bold transition-all hover:scale-105 ${editingAtmosphere.value === v ? 'ring-2 ring-black ring-offset-2 scale-105' : ''}`} style={{ backgroundColor: VIRIDIS_COLORS[v-1], color: v > 7 ? 'black' : 'white' }}>{v}</button>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-4"><button onClick={() => saveAtmosphere(editingAtmosphere.day, undefined)} className="w-full py-3 border border-black text-xs font-bold uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-colors">Clear Intensity</button><button onClick={() => setEditingAtmosphere(null)} className="w-full py-2 text-neutral-400 hover:text-black text-xs font-bold uppercase tracking-[0.2em]">Close</button></div>
          </div>
        </div>
      )}

      {editingScalar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 p-4 backdrop-blur-[2px]">
          <div className="border border-black bg-[var(--bg-warm)] w-full max-w-[280px] p-6 space-y-6 shadow-2xl">
            <div className="text-center space-y-1"><h3 className="text-sm uppercase tracking-widest font-bold text-neutral-400">Day {editingScalar.day}</h3><p className="text-xl italic">{editingScalar.name}</p></div>
            <input autoFocus type="number" step="any" className="w-full text-center py-2 border-b border-black outline-none text-4xl bg-transparent tabular-nums" value={editingScalar.value === 0 ? '' : editingScalar.value} onChange={(e) => setEditingScalar({ ...editingScalar, value: parseFloat(e.target.value) || 0 })} onKeyDown={(e) => e.key === 'Enter' && saveScalarValue()} />
            {editingScalar.units && <div className="text-center mt-2 text-xs uppercase tracking-widest text-neutral-400 italic">{editingScalar.units}</div>}
            <div className="flex flex-col gap-2"><button onClick={saveScalarValue} className="w-full py-3 bg-black text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800">Set Value</button><button onClick={() => setEditingScalar(null)} className="w-full py-2 text-neutral-400 hover:text-black text-xs font-bold uppercase tracking-[0.2em]">Cancel</button></div>
          </div>
        </div>
      )}

      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 p-4 backdrop-blur-[2px]">
          <div className="border border-black bg-[var(--bg-warm)] w-full max-w-lg p-8 space-y-6 shadow-2xl">
            <h3 className="text-2xl italic border-b border-black pb-2">Marginalia: Day {editingNote.day}</h3>
            <textarea autoFocus className="w-full h-48 p-4 border border-black outline-none italic text-xl resize-none bg-transparent" placeholder="Record daily observation..." value={editingNote.text} onChange={(e) => setEditingNote({ ...editingNote, text: e.target.value })} />
            <div className="flex gap-4"><button onClick={handleNoteSave} className="flex-1 py-3 bg-black text-white text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-800">Apply Record</button><button onClick={() => setEditingNote(null)} className="flex-1 py-3 border border-black text-xs font-bold uppercase tracking-[0.2em] hover:bg-neutral-50">Discard</button></div>
          </div>
        </div>
      )}

      {catModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/5 p-4 backdrop-blur-[2px]">
          <div className="border border-black bg-[var(--bg-warm)] w-full max-w-md p-8 space-y-8 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-2xl font-normal underline underline-offset-[10px] decoration-1">{catModal.editingId ? 'Modify Record' : 'New Classification'}</h3><button onClick={() => setCatModal(prev => ({ ...prev, isOpen: false }))} className="hover:text-neutral-500"><CloseIcon size={20} /></button></div>
            <div className="space-y-6">
              <div className="space-y-2"><label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Nomenclature</label><input type="text" autoFocus value={catModal.name} onChange={(e) => setCatModal(p => ({ ...p, name: e.target.value }))} className="w-full py-2 border-b border-black outline-none text-xl bg-transparent" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Symbol</label><input type="text" value={catModal.icon} onChange={(e) => setCatModal(p => ({ ...p, icon: e.target.value }))} className="w-full py-2 border-b border-black outline-none text-xl bg-transparent" /></div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Data Type</label>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setCatModal(p => ({ ...p, type: 'binary' }))} className={`flex-1 flex items-center justify-center gap-2 py-2 border ${catModal.type === 'binary' ? 'border-black bg-black text-white' : 'border-neutral-200'}`}><CheckSquare size={14} /> <span className="text-[10px] font-bold uppercase">Binary</span></button>
                    <button onClick={() => setCatModal(p => ({ ...p, type: 'scalar' }))} className={`flex-1 flex items-center justify-center gap-2 py-2 border ${catModal.type === 'scalar' ? 'border-black bg-black text-white' : 'border-neutral-200'}`}><Hash size={14} /> <span className="text-[10px] font-bold uppercase">Scalar</span></button>
                  </div>
                </div>
              </div>
              {catModal.type === 'scalar' && <div className="space-y-2"><label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Units</label><input type="text" placeholder="e.g. hrs, cups" value={catModal.units} onChange={(e) => setCatModal(p => ({ ...p, units: e.target.value }))} className="w-full py-2 border-b border-black outline-none text-xl bg-transparent italic" /></div>}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Color Index</label>
                <div className="flex gap-4">
                  <input type="color" value={catModal.color} onChange={(e) => setCatModal(p => ({ ...p, color: e.target.value }))} className="w-10 h-10 border border-black bg-white cursor-pointer" />
                  <input type="text" value={catModal.color} onChange={(e) => setCatModal(p => ({ ...p, color: e.target.value }))} className="flex-1 py-2 border-b border-black text-base outline-none bg-transparent tabular-nums" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 pt-4"><button onClick={handleSaveCategory} className="w-full py-3.5 bg-black text-white text-xs font-bold uppercase tracking-[0.2em]">Apply To Index</button><button onClick={() => setCatModal(prev => ({ ...prev, isOpen: false }))} className="w-full py-3.5 border border-black text-xs font-bold uppercase tracking-[0.2em]">Dismiss</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
