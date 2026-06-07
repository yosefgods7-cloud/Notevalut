import React, { useState } from 'react';
import {
  ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

interface ChartRendererProps {
  type: "bar" | "line" | "pie" | "area" | "radar";
  data: any[];
  xAxisKey: string;
  dataKeys: string[];
  colors?: string[];
  height?: number | string;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({
  type, data, xAxisKey, dataKeys, colors, height = 300
}) => {
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  const handleLegendClick = (e: any) => {
    if (e && e.dataKey) {
      setHiddenSeries(prev => ({
        ...prev,
        [e.dataKey]: !prev[e.dataKey]
      }));
    }
  };

  const COLORS = colors || [
    "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe", "#00c49f", "#ffbb28", "#ff8042",
  ];

  switch (type) {
    case "bar":
      return (
        <ResponsiveContainer width="100%" height={height as any}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey={xAxisKey} stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }} />
            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
            {dataKeys.map((key, i) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={COLORS[i % COLORS.length]} 
                hide={hiddenSeries[key]} 
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    case "line":
      return (
        <ResponsiveContainer width="100%" height={height as any}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey={xAxisKey} stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }} />
            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
            {dataKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                hide={hiddenSeries[key]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    case "pie":
      return (
        <ResponsiveContainer width="100%" height={height as any}>
          <PieChart>
            <Tooltip contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }} />
            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
            {dataKeys.map((key, i) => (
              <Pie
                key={key}
                data={data}
                dataKey={key}
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={100 - i * 20}
                fill={COLORS[i % COLORS.length]}
                hide={hiddenSeries[key]}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[(index + i) % COLORS.length]}
                    fillOpacity={hiddenSeries[key] ? 0 : 1}
                  />
                ))}
              </Pie>
            ))}
          </PieChart>
        </ResponsiveContainer>
      );
    case "area":
      return (
        <ResponsiveContainer width="100%" height={height as any}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey={xAxisKey} stroke="#888" fontSize={12} />
            <YAxis stroke="#888" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }} />
            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
            {dataKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.3}
                hide={hiddenSeries[key]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    case "radar":
      return (
        <ResponsiveContainer width="100%" height={height as any}>
          <RadarChart data={data}>
            <PolarGrid stroke="#555" />
            <PolarAngleAxis dataKey={xAxisKey} stroke="#888" fontSize={12} />
            <PolarRadiusAxis stroke="#888" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#1e1e1e", borderColor: "#333" }} />
            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
            {dataKeys.map((key, i) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.6}
                hide={hiddenSeries[key]}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      );
    default:
      return null;
  }
};
