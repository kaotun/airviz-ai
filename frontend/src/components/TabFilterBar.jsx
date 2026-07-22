import React from 'react';
import { format, subDays, startOfYear } from 'date-fns';
import { useFilterStore } from '../store/filterStore';
import { C, provinces, monoFont, headFont } from '../utils/dashboardConstants';

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

export default function TabFilterBar({
  showDateRange = true,
  showProvince = true,
  showMetric = true
}) {
  const {
    startDate,
    endDate,
    selectedProvinces,
    selectedMetric,
    setDateRange,
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
        setProvinces([{ id: provinces.indexOf(p) + 1, name: p.name }]);
      }
    }
  };

  return (
    <div style={{
      background: "var(--card)",
      border: `1px solid ${C.border}`, borderRadius: 16, padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      marginBottom: 24
    }}>
      {showDateRange && (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DATE_RANGES.map(d => {
              const [start, end] = d.getRange();
              const isActive = startDate === start && endDate === end;
              return (
                <button
                  key={d.label}
                  onClick={() => handleDateClick(d)}
                  style={{
                    background: isActive ? `rgba(56,189,248,0.2)` : "rgba(56,189,248,0.05)",
                    border: `1px solid rgba(56,189,248,0.15)`,
                    borderRadius: 8, padding: "6px 12px",
                    color: isActive ? "#fff" : C.sky,
                    fontSize: 14, cursor: "pointer", ...monoFont
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Pickers */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: 8, border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 14, color: C.muted, ...headFont }}>Từ:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setDateRange(e.target.value, endDate)}
              style={{ background: 'transparent', color: C.text, border: 'none', outline: 'none', fontSize: 14, ...monoFont, colorScheme: 'dark' }}
            />
            <span style={{color: C.muted}}>Đến:</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setDateRange(startDate, e.target.value)}
              style={{ background: 'transparent', color: C.text, border: 'none', outline: 'none', fontSize: 14, ...monoFont, colorScheme: 'dark' }}
            />
          </div>
        </>
      )}
      
      {showProvince && (
        <select
          onChange={handleProvinceChange}
          value={selectedProvinces.length === 1 ? selectedProvinces[0].name : 'all'}
          style={{
            background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "6px 12px", color: C.text,
            fontSize: 14, outline: "none", cursor: 'pointer', ...monoFont
          }}
        >
          <option value="all" style={{background: "#050A14"}}>Tất cả tỉnh</option>
          {provinces.map(p => <option key={p.name} value={p.name} style={{background: "#050A14"}}>{p.name}</option>)}
        </select>
      )}
      
      {showMetric && (
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
                  borderRadius: 8, padding: "5px 12px", fontSize: 14,
                  color: isActive ? "#fff" : C.violet, cursor: "pointer", ...monoFont
                }}
              >
                {m.label}
              </span>
            );
          })}
        </div>
      )}
      
      <span style={{ marginLeft: "auto", color: C.muted, fontSize: 14, ...monoFont }}>
        63 tỉnh · 1,372,000 bản ghi
      </span>
    </div>
  );
}
