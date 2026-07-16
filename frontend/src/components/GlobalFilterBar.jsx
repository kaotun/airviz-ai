import React from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import { useFilterStore } from '../store/filterStore';
import { C, provinces, monoFont } from '../utils/dashboardConstants';

const latestDate = new Date('2024-12-31T00:00:00');
const DATE_RANGES = [
  { label: 'Hôm nay', getRange: () => [format(latestDate, 'yyyy-MM-dd'), format(latestDate, 'yyyy-MM-dd')] },
  { label: '7 ngày', getRange: () => [format(subDays(latestDate, 7), 'yyyy-MM-dd'), format(latestDate, 'yyyy-MM-dd')] },
  { label: '30 ngày', getRange: () => [format(subDays(latestDate, 30), 'yyyy-MM-dd'), format(latestDate, 'yyyy-MM-dd')] },
  { label: 'YTD', getRange: () => [format(startOfYear(latestDate), 'yyyy-MM-dd'), format(latestDate, 'yyyy-MM-dd')] },
];

const METRICS = [
  { label: 'PM2.5', value: 'pm2_5' },
  { label: 'PM10', value: 'pm10' },
  { label: 'CO', value: 'carbon_monoxide' },
  { label: 'NO₂', value: 'nitrogen_dioxide' },
  { label: 'SO₂', value: 'sulphur_dioxide' },
  { label: 'O₃', value: 'ozone' },
  { label: 'Dust', value: 'dust' }
];

export default function GlobalFilterBar() {
  const {
    startDate,
    endDate,
    selectedProvinces,
    selectedMetric,
    setDateRange,
    toggleProvince,
    setProvinces,
    setMetric
  } = useFilterStore();

  const handleDateClick = (range) => {
    const [start, end] = range.getRange();
    setDateRange(start, end);
  };

  const handleProvinceChange = (e) => {
    const val = e.target.value;
    if (val === 'all') {
      setProvinces([]);
    } else {
      const p = provinces.find(prov => prov.name === val);
      if (p) {
        // Here we just set it as single select to mimic the previous behavior for non-compare tabs
        // If we want to support multi-select in a regular dropdown it's tricky, so we'll just set it
        // and Compare tab can use toggleProvince manually if needed, or we keep it single here.
        setProvinces([{ id: provinces.indexOf(p) + 1, name: p.name }]); // mock ID as index + 1
      }
    }
  };

  return (
    <div style={{
      position: "sticky", top: 56, zIndex: 40,
      background: "rgba(5,10,20,0.85)", backdropFilter: "blur(12px)",
      borderBottom: `1px solid ${C.border}`, padding: "10px 32px",
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
    }}>
      {DATE_RANGES.map(d => {
        const [start, end] = d.getRange();
        const isActive = startDate === start && endDate === end;
        return (
          <button
            key={d.label}
            onClick={() => handleDateClick(d)}
            style={{
              background: isActive ? `rgba(56,189,248,0.2)` : "rgba(56,189,248,0.08)",
              border: `1px solid rgba(56,189,248,0.15)`,
              borderRadius: 16, padding: "4px 12px",
              color: isActive ? "#fff" : C.sky,
              fontSize: 11, cursor: "pointer", ...monoFont
            }}
          >
            {d.label}
          </button>
        );
      })}
      
      <select
        onChange={handleProvinceChange}
        value={selectedProvinces.length === 1 ? selectedProvinces[0].name : 'all'}
        style={{
          background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
          borderRadius: 16, padding: "4px 12px", color: C.text,
          fontSize: 11, outline: "none", ...monoFont
        }}
      >
        <option value="all" style={{background: "#050A14"}}>Tất cả tỉnh</option>
        {provinces.map(p => <option key={p.name} value={p.name} style={{background: "#050A14"}}>{p.name}</option>)}
      </select>
      
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {METRICS.map(m => {
          const isActive = selectedMetric === m.value;
          return (
            <span
              key={m.value}
              onClick={() => setMetric(m.value)}
              style={{
                background: isActive ? `rgba(167,139,250,0.3)` : "rgba(167,139,250,0.1)",
                border: "1px solid rgba(167,139,250,0.2)",
                borderRadius: 12, padding: "3px 10px", fontSize: 11,
                color: isActive ? "#fff" : C.violet, cursor: "pointer", ...monoFont
              }}
            >
              {m.label}
            </span>
          );
        })}
      </div>
      
      <span style={{ marginLeft: "auto", color: C.muted, fontSize: 11, ...monoFont }}>
        63 tỉnh · 1,372,000 bản ghi
      </span>
    </div>
  );
}
