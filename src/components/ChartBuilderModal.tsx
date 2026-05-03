import React, { useState } from 'react';
import { X, Check, BarChart3, LineChart, PieChart } from 'lucide-react';
import { NoteChart } from '../types';
import { generateId } from '../lib/utils';
import {
  BarChart, Bar, LineChart as RechartsLineChart, Line, PieChart as RechartsPieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

interface ChartBuilderModalProps {
  onClose: () => void;
  onSave: (chart: NoteChart) => void;
  initialChart?: NoteChart;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042'];

export function ChartBuilderModal({ onClose, onSave, initialChart }: ChartBuilderModalProps) {
  const [title, setTitle] = useState(initialChart?.title || 'New Chart');
  const [type, setType] = useState<NoteChart['type']>(initialChart?.type || 'bar');
  const [dataInput, setDataInput] = useState(
    initialChart ? JSON.stringify(initialChart.data, null, 2) : '[\n  { "name": "Jan", "value1": 400, "value2": 240 },\n  { "name": "Feb", "value1": 300, "value2": 139 }\n]'
  );
  const [xAxisKey, setXAxisKey] = useState(initialChart?.config?.xAxisKey || 'name');
  const [dataKeysInput, setDataKeysInput] = useState(initialChart?.config?.dataKeys?.join(', ') || 'value1, value2');

  const [error, setError] = useState('');

  const parsedData = React.useMemo(() => {
    try {
      const data = JSON.parse(dataInput);
      if (!Array.isArray(data)) throw new Error('Data must be an array of objects');
      setError('');
      return data;
    } catch (e: any) {
      setError(e.message || 'Invalid JSON');
      return [];
    }
  }, [dataInput]);

  const dataKeys = dataKeysInput.split(',').map(s => s.trim()).filter(Boolean);

  const handleSave = () => {
    if (error || !parsedData.length) return;
    
    onSave({
      id: initialChart?.id || generateId(),
      title,
      type,
      data: parsedData,
      config: {
        xAxisKey,
        dataKeys
      }
    });
  };

  const renderChart = () => {
    if (!parsedData.length || error) return <div className="flex items-center justify-center h-full text-text-muted">Invalid Data</div>;

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={parsedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xAxisKey} stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {dataKeys.map((key, i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={parsedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey={xAxisKey} stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {dataKeys.map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} />
              ))}
            </RechartsLineChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPieChart>
              <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
              <Legend />
              {dataKeys.map((key, i) => (
                <Pie 
                  key={key} 
                  data={parsedData} 
                  dataKey={key} 
                  nameKey={xAxisKey} 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100 - (i * 20)} 
                  fill={COLORS[i % COLORS.length]}
                >
                  {parsedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + i) % COLORS.length]} />
                  ))}
                </Pie>
              ))}
            </RechartsPieChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col w-full max-w-5xl h-[85vh] animate-in fade-in zoom-in duration-200">
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
          <div className="w-1/3 border-r border-border bg-surface-header p-4 overflow-y-auto flex flex-col gap-4">
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
              <div className="flex gap-2">
                <button 
                  onClick={() => setType('bar')}
                  className={`flex-1 py-2 px-3 flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${type === 'bar' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><BarChart3 size={16}/> Bar</button>
                <button 
                  onClick={() => setType('line')}
                  className={`flex-1 py-2 px-3 flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${type === 'line' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><LineChart size={16}/> Line</button>
                <button 
                  onClick={() => setType('pie')}
                  className={`flex-1 py-2 px-3 flex items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors ${type === 'pie' ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-secondary hover:bg-surface-active'}`}
                ><PieChart size={16}/> Pie</button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">X-Axis Property</label>
              <input 
                type="text" 
                value={xAxisKey} 
                onChange={e => setXAxisKey(e.target.value)} 
                placeholder="e.g. name"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">Data Properties (Comma separated)</label>
              <input 
                type="text" 
                value={dataKeysInput} 
                onChange={e => setDataKeysInput(e.target.value)} 
                placeholder="e.g. value1, value2"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">JSON Data</label>
              <textarea 
                value={dataInput} 
                onChange={e => setDataInput(e.target.value)} 
                className={`flex-1 min-h-[150px] w-full bg-background border rounded-md px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent resize-none ${error ? 'border-red-500' : 'border-border'}`}
              />
              {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 p-6 bg-background flex flex-col relative min-h-0">
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
