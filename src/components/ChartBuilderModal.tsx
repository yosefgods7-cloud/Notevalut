import React, { useState } from 'react';
import { X, Check, BarChart3, LineChart, PieChart, AreaChart as AreaChartIcon, Hexagon, Plus, Trash2 } from 'lucide-react';
import { NoteChart } from '../types';
import { generateId } from '../lib/utils';
import { ChartRenderer } from './ChartRenderer';
import {
  BarChart, Bar, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie,
  AreaChart as RechartsAreaChart, Area, RadarChart as RechartsRadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

interface ChartBuilderModalProps {
  onClose: () => void;
  onSave: (chart: NoteChart) => void;
  initialChart?: NoteChart;
}

const CHART_THEMES: Record<string, string[]> = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'],
  ocean: ['#0077b6', '#0096c7', '#00b4d8', '#48cae4', '#90e0ef', '#ade8f4', '#caf0f8'],
  forest: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc'],
  sunset: ['#f94144', '#f3722c', '#f8961e', '#f9844a', '#f9c74f', '#90be6d', '#43aa8b'],
  monochrome: ['#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'],
  cyberpunk: ['#ff003c', '#00f0ff', '#fcee0a', '#b700ff', '#00ff15']
};

export function ChartBuilderModal({ onClose, onSave, initialChart }: ChartBuilderModalProps) {
  const [title, setTitle] = useState(initialChart?.title || 'New Chart');
  const [type, setType] = useState<NoteChart['type']>(initialChart?.type || 'bar');
  const [chartTheme, setChartTheme] = useState<string>(initialChart?.config?.colors ? 'custom' : 'default');
  const [customColors, setCustomColors] = useState<string[]>(initialChart?.config?.colors || CHART_THEMES.default);

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const theme = e.target.value;
    setChartTheme(theme);
    if (theme !== 'custom' && CHART_THEMES[theme]) {
      setCustomColors(CHART_THEMES[theme]);
    }
  };

  const [xAxisName, setXAxisName] = useState(initialChart?.config?.xAxisKey || 'Category');
  
  const initialSeries = React.useMemo(() => {
    const keys = initialChart?.config?.dataKeys || ['Value 1', 'Value 2'];
    return keys.map(k => ({ id: generateId(), name: k }));
  }, [initialChart]);

  const [seriesList, setSeriesList] = useState(initialSeries);

  const [rows, setRows] = useState(() => {
    const data = initialChart?.data || [
      { Category: 'Jan', 'Value 1': 400, 'Value 2': 240 },
      { Category: 'Feb', 'Value 1': 300, 'Value 2': 139 },
      { Category: 'Mar', 'Value 1': 500, 'Value 2': 150 }
    ];
    
    const xAxisKey = initialChart?.config?.xAxisKey || 'Category';

    return data.map((d: any) => {
      const rowData: { id: string; xValue: string, yValues: Record<string, string>} = {
        id: generateId(),
        xValue: String(d[xAxisKey] || ''),
        yValues: {}
      };

      initialSeries.forEach(s => {
        rowData.yValues[s.id] = String(d[s.name] ?? '');
      });

      return rowData;
    });
  });

  const parsedData = React.useMemo(() => {
    return rows.map(r => {
      const obj: any = {};
      obj[xAxisName] = r.xValue;
      seriesList.forEach(s => {
         const valStr = r.yValues[s.id];
         const parsedNum = parseFloat(valStr);
         obj[s.name] = !isNaN(parsedNum) ? parsedNum : valStr;
      });
      return obj;
    });
  }, [rows, xAxisName, seriesList]);

  const dataKeys = seriesList.map(s => s.name);
  const error = seriesList.length === 0 ? "You need at least one data series" : rows.length === 0 ? "You need at least one row of data" : xAxisName.trim() === '' ? "X-Axis label cannot be empty" : "";

  const handleSave = () => {
    if (error || !parsedData.length) return;
    
    onSave({
      id: initialChart?.id || generateId(),
      title,
      type,
      data: parsedData,
      config: {
        xAxisKey: xAxisName,
        dataKeys,
        colors: chartTheme === 'custom' ? customColors : CHART_THEMES[chartTheme]
      }
    });
  };

  const handleSeriesNameChange = (id: string, newName: string) => {
    setSeriesList(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  const handleYValueChange = (rowId: string, seriesId: string, val: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, yValues: { ...r.yValues, [seriesId]: val } };
    }));
  };

  const handleXValueChange = (rowId: string, val: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, xValue: val } : r));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: generateId(), xValue: 'New Item', yValues: {} }]);
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const addSeries = () => {
    setSeriesList(prev => [...prev, { id: generateId(), name: `Value ${prev.length + 1}` }]);
  };

  const removeSeries = (id: string) => {
    setSeriesList(prev => prev.filter(s => s.id !== id));
  };

  const renderChart = () => {
    if (!parsedData.length || error) return <div className="flex items-center justify-center h-full text-text-muted">Missing or Invalid Data</div>;

    return (
      <ChartRenderer
        type={type}
        data={parsedData}
        xAxisKey={xAxisName}
        dataKeys={dataKeys}
        colors={customColors}
        height="100%"
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col w-full max-w-6xl h-[85vh] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-header">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <BarChart3 size={20} className="text-accent"/> {initialChart ? 'Edit Chart' : 'Build Chart'}
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Controls */}
          <div className="w-1/2 border-r border-border bg-surface-header p-4 flex flex-col gap-5 overflow-hidden">
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">Chart Title</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">Chart Type</label>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setType('bar')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${type === 'bar' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><BarChart3 size={14}/> Bar</button>
                <button 
                  onClick={() => setType('line')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${type === 'line' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><LineChart size={14}/> Line</button>
                <button 
                  onClick={() => setType('pie')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${type === 'pie' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><PieChart size={14}/> Circle</button>
                <button 
                  onClick={() => setType('area')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${type === 'area' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><AreaChartIcon size={14}/> Area</button>
                <button 
                  onClick={() => setType('radar')}
                  className={`flex-1 py-1.5 px-2 flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors ${type === 'radar' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><Hexagon size={14}/> Geo</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">Chart Theme</label>
              <select 
                value={chartTheme} 
                onChange={handleThemeChange}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="default">Default</option>
                <option value="ocean">Ocean</option>
                <option value="forest">Forest</option>
                <option value="sunset">Sunset</option>
                <option value="monochrome">Monochrome</option>
                <option value="cyberpunk">Cyberpunk</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
              <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">Data</label>
              <div className="flex-1 flex flex-col border border-border rounded-md overflow-hidden bg-background">
                {/* Data Header */}
                <div className="flex bg-surface px-2 py-2 border-b border-border gap-2 overflow-x-auto min-w-max">
                  <div className="w-[120px] flex items-center shrink-0">
                    <input 
                      value={xAxisName}
                      onChange={e => setXAxisName(e.target.value)}
                      placeholder="X-Axis (e.g. Month)"
                      className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent font-semibold"
                    />
                  </div>
                  
                  {seriesList.map((s, idx) => (
                    <div key={s.id} className="w-[120px] flex items-center gap-1 shrink-0 bg-background border border-border rounded px-1 group">
                      <input 
                        type="color"
                        value={customColors[idx % customColors.length] || '#000000'}
                        onChange={e => {
                          const newColors = [...customColors];
                          if (idx >= newColors.length) {
                             // Extend array up to idx
                             while(newColors.length <= idx) {
                               newColors.push(customColors[newColors.length % customColors.length]);
                             }
                          }
                          newColors[idx] = e.target.value;
                          setCustomColors(newColors);
                          setChartTheme('custom');
                        }}
                        className="w-5 h-5 rounded cursor-pointer border-none bg-transparent p-0 flex-shrink-0"
                      />
                      <input 
                        value={s.name}
                        onChange={e => handleSeriesNameChange(s.id, e.target.value)}
                        placeholder="Series Name"
                        className="w-full bg-transparent border-none py-1 text-xs text-text-primary focus:outline-none font-semibold px-1"
                      />
                      <button onClick={() => removeSeries(s.id)} className="text-text-muted hover:text-red-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={12}/>
                      </button>
                    </div>
                  ))}

                  <button 
                    onClick={addSeries}
                    className="flex shrink-0 items-center gap-1 px-2 py-1 rounded bg-surface-active hover:bg-border text-xs text-text-secondary transition-colors whitespace-nowrap"
                  >
                    <Plus size={12}/> Series
                  </button>
                </div>

                {/* Data Rows */}
                <div className="flex-1 overflow-y-auto overflow-x-auto p-2">
                  <div className="flex flex-col gap-2 min-w-max">
                    {rows.map((row) => (
                      <div key={row.id} className="flex gap-2 items-center group">
                        <div className="w-[120px] shrink-0">
                          <input 
                              value={row.xValue}
                              onChange={e => handleXValueChange(row.id, e.target.value)}
                              placeholder={`Item ${rows.indexOf(row) + 1}`}
                              className="w-full bg-surface-active border border-border rounded px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                          />
                        </div>
                        {seriesList.map(s => (
                          <div key={s.id} className="w-[100px] shrink-0 flex items-center">
                            <input 
                                type="number"
                                value={row.yValues[s.id] || ''}
                                onChange={e => handleYValueChange(row.id, s.id, e.target.value)}
                                placeholder="0"
                                className="w-full bg-surface-active border border-border rounded px-2 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent"
                            />
                          </div>
                        ))}
                        <button 
                          onClick={() => removeRow(row.id)} 
                          className="p-1.5 text-text-muted hover:text-red-400 opacity-20 group-hover:opacity-100 transition-opacity"
                          title="Delete Row"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                    
                    <div>
                      <button 
                        onClick={addRow}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-surface border border-dashed border-border hover:border-accent hover:text-accent text-sm text-text-muted transition-colors mt-2"
                      >
                        <Plus size={14}/> Add Row
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
            </div>

          </div>

          {/* Preview */}
          <div className="w-1/2 p-6 bg-background flex flex-col relative min-h-0">
            <h3 className="text-lg font-bold text-text-primary mb-6 text-center">{title}</h3>
            <div className="flex-1 w-full min-h-0 relative">
              {renderChart()}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-border flex justify-end gap-3 bg-surface-header">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!!error || !parsedData.length}
            className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-lg font-medium hover:bg-accent/90 focus:ring-2 focus:ring-accent/20 transition-all disabled:opacity-50"
          >
            <Check size={18} /> {initialChart ? 'Update Chart' : 'Add Chart'}
          </button>
        </div>
      </div>
    </div>
  );
}

