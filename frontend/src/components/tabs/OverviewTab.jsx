import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, analyticsApi } from '../../api/dashboard';
import { useFilterStore } from '../../store/filterStore';

import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ScatterChart, Scatter,
  ReferenceLine, Legend, ComposedChart
} from "recharts";

import {
  C, AQI_COLORS, AQI_LABELS, aqiColor, glassCard, monoFont, headFont,
  chartDefaults, DarkTooltip, Sparkline, KPICard, SectionHeader
} from '../../utils/dashboardConstants';
import TabFilterBar from '../TabFilterBar';

const OverviewTab = () => {
  const { startDate, endDate } = useFilterStore();
  const isSingleDay = startDate === endDate;
  const isLive = startDate === '2026-07-06' && endDate === '2026-07-06';
  
  const { data: overview, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['overview', startDate, endDate],
    queryFn: () => dashboardApi.getOverview(startDate, endDate)
  });

  const { data: trend, isLoading: isTrendLoading } = useQuery({
    queryKey: ['trend', startDate, endDate],
    queryFn: () => dashboardApi.getTrend(startDate, endDate)
  });

  const { data: mapData } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => dashboardApi.getMapData()
  });

  // KPI processing
  const kpi = overview?.kpi || { aqi_national: '--', pm25_national: '--', provinces_exceeded: '--' };
  const { data: pm25TS } = useQuery({
    queryKey: ['ts', 'pm2_5', startDate, endDate],
    queryFn: () => dashboardApi.getTimeseries({ metric: 'pm2_5', start_date: startDate, end_date: endDate })
  });
  const { data: o3TS } = useQuery({
    queryKey: ['ts', 'ozone', startDate, endDate],
    queryFn: () => dashboardApi.getTimeseries({ metric: 'ozone', start_date: startDate, end_date: endDate })
  });
  const { data: no2TS } = useQuery({
    queryKey: ['ts', 'nitrogen_dioxide', startDate, endDate],
    queryFn: () => dashboardApi.getTimeseries({ metric: 'nitrogen_dioxide', start_date: startDate, end_date: endDate })
  });

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const yearEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];
  const { data: yearTrend } = useQuery({
    queryKey: ['yearTrend', yearStart, yearEnd],
    queryFn: () => dashboardApi.getTrend(yearStart, yearEnd)
  });
  const yearTrendArray = Array.isArray(yearTrend) ? yearTrend : yearTrend?.data ?? [];

  // Merge timeseries
  const mergedTS = React.useMemo(() => {
    if (!pm25TS?.data) return [];
    const map = new Map();
    pm25TS.data.forEach((d) => map.set(d.time, { time: d.time, pm25: d.value }));
    o3TS?.data?.forEach((d) => {
      if (map.has(d.time)) map.get(d.time).o3 = d.value;
      else map.set(d.time, { time: d.time, o3: d.value });
    });
    no2TS?.data?.forEach((d) => {
      if (map.has(d.time)) map.get(d.time).no2 = d.value;
      else map.set(d.time, { time: d.time, no2: d.value });
    });
    const isSingleDay = startDate === endDate;
    return Array.from(map.values()).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map(d => {
      const dt = new Date(d.time);
      return {
        ...d,
        h: isSingleDay ? `${dt.getHours().toString().padStart(2, '0')}:00` : `${dt.getDate()}/${dt.getMonth()+1} ${dt.getHours().toString().padStart(2, '0')}:00`
      };
    });
  }, [pm25TS, o3TS, no2TS, startDate, endDate]);

  const getMetricStats = (key, dataArr) => {
    if (!dataArr || dataArr.length === 0) return { cur: '--', min: '--', max: '--' };
    const vals = dataArr.map(d => d[key]).filter(v => v != null);
    if (vals.length === 0) return { cur: '--', min: '--', max: '--' };
    return {
      cur: vals[vals.length - 1].toFixed(1),
      min: Math.min(...vals).toFixed(1),
      max: Math.max(...vals).toFixed(1)
    };
  };

  const tsMetrics = [
    { key: "pm25", label: "PM2.5", color: C.sky, unit: "µg/m³", ...getMetricStats('pm25', mergedTS) },
    { key: "o3", label: "O₃", color: C.violet, unit: "µg/m³", ...getMetricStats('o3', mergedTS) },
    { key: "no2", label: "NO₂", color: C.warning, unit: "µg/m³", ...getMetricStats('no2', mergedTS) }
  ];

  const top10 = overview?.top_polluted || [];
  
  // Trend processing — API có thể trả về array hoặc {data:[...]}
  const trendArray = Array.isArray(trend) ? trend : (trend?.data ?? []);
  const trendData = trendArray.map(t => {
    const d = new Date(t.date ?? t.day ?? t.time);
    const label = isSingleDay
      ? `${d.getHours().toString().padStart(2, '0')}:00`
      : `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
    return { 
      day: label, 
      aqi: Math.round(t.aqi ?? t.avg_aqi ?? t.value ?? 0), 
      fullDateStr: `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}` 
    };
  });

  // Pie Data processing from mapData (latest AQI)
  const aqiCount = [0, 0, 0, 0, 0, 0];
  const mapDataArray = Array.isArray(mapData) ? mapData : (mapData?.provinces ?? mapData?.data ?? []);
  mapDataArray.forEach(p => {
      if (p.aqi <= 50) aqiCount[0]++;
      else if (p.aqi <= 100) aqiCount[1]++;
      else if (p.aqi <= 150) aqiCount[2]++;
      else if (p.aqi <= 200) aqiCount[3]++;
      else if (p.aqi <= 300) aqiCount[4]++;
      else aqiCount[5]++;
    });
  const pieData = [
    {name:"Tốt",value:aqiCount[0]},{name:"Trung bình",value:aqiCount[1]},{name:"Kém",value:aqiCount[2]},
    {name:"Xấu",value:aqiCount[3]},{name:"Rất xấu",value:aqiCount[4]},{name:"Nguy hiểm",value:aqiCount[5]},
  ];

  // Live KPI calculation from mapDataArray
  let liveKpi = null;
  if (isLive && mapDataArray.length > 0) {
    const validAqi = mapDataArray.map(p => p.aqi).filter(a => a != null);
    const validPm25 = mapDataArray.map(p => p.pm2_5).filter(a => a != null);
    const avgAqi = validAqi.length ? validAqi.reduce((a, b) => a + b, 0) / validAqi.length : 0;
    const avgPm25 = validPm25.length ? validPm25.reduce((a, b) => a + b, 0) / validPm25.length : 0;
    const exceeded = validAqi.filter(a => a > 100).length;
    liveKpi = {
      aqi_national: avgAqi,
      pm25_national: avgPm25,
      provinces_exceeded: exceeded,
      total_readings: mapDataArray.length
    };
  }

  const displayKpi = isLive && liveKpi ? liveKpi : kpi;

  // Dynamic calculations for bottom stats
  let worstDay = { value: '--', sub: 'Không có dữ liệu' };
  let bestDay = { value: '--', sub: 'Không có dữ liệu' };
  if (trendData.length > 0) {
    const sorted = [...trendData].sort((a, b) => b.aqi - a.aqi);
    worstDay = { 
      value: isSingleDay ? sorted[0].fullDateStr : sorted[0].day, 
      sub: isSingleDay ? `Lúc ${sorted[0].day} (AQI: ${sorted[0].aqi})` : `TB AQI: ${sorted[0].aqi}` 
    };
    
    const sortedAsc = [...trendData].sort((a, b) => a.aqi - b.aqi);
    bestDay = { 
      value: isSingleDay ? sortedAsc[0].fullDateStr : sortedAsc[0].day, 
      sub: isSingleDay ? `Lúc ${sortedAsc[0].day} (AQI: ${sortedAsc[0].aqi})` : `TB AQI: ${sortedAsc[0].aqi}` 
    };
  }

  let maxPm25 = { value: '--', sub: 'Không có dữ liệu' };
  let hazardousHours = { value: '--', sub: 'Không có dữ liệu' };
  if (mergedTS.length > 0) {
    const validPm25 = mergedTS.filter(d => d.pm25 != null);
    if (validPm25.length > 0) {
      const highest = [...validPm25].sort((a, b) => b.pm25 - a.pm25)[0];
      maxPm25 = { value: `${highest.pm25.toFixed(1)}`, sub: `Lúc ${highest.h}` };
      const badCount = validPm25.filter(d => d.pm25 > 50).length;
      hazardousHours = { value: `${badCount} giờ`, sub: 'PM2.5 > 50 µg/m³' };
    }
  }

  const dynamicStats = [
    { label: "Ngày ô nhiễm nhất", value: worstDay.value, sub: worstDay.sub, color: C.danger },
    { label: "Đỉnh điểm PM2.5", value: maxPm25.value, sub: maxPm25.sub, color: C.warning },
    { label: "Số giờ vượt ngưỡng", value: hazardousHours.value, sub: hazardousHours.sub, color: C.violet },
    { label: "Ngày sạch nhất", value: bestDay.value, sub: bestDay.sub, color: C.success },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      <TabFilterBar showDateRange showProvince={false} showMetric={false} />
      <style>{`
        @keyframes pulse-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
      
      {/* KPIs */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{color:C.text,fontSize:18,fontWeight:700,margin:0,...headFont}}>Tổng quan quốc gia</h2>
            <p style={{color:C.muted,fontSize: 14,margin:"4px 0 0",...monoFont}}>
              {isLive ? 'Đang theo dõi trực tiếp (Realtime)' : `Kỳ báo cáo: ${startDate} đến ${endDate}`}
            </p>
          </div>
          
          {isLive && (
            <div style={{ display: 'flex', gap: 8, background: 'rgba(239, 68, 68, 0.15)', padding: '6px 12px', borderRadius: 8, alignItems: 'center' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#ef4444', 
                animation: 'pulse-red 2s infinite'
              }}/>
              <span style={{ color: '#fca5a5', fontSize: 14, ...headFont, fontWeight: 600 }}>Realtime</span>
            </div>
          )}
        </div>

        <div className="responsive-grid grid-cols-4">
          <KPICard label={isLive ? "AQI Hiện tại" : "AQI Trung bình"} value={typeof displayKpi.aqi_national === 'number' ? Math.round(displayKpi.aqi_national) : '--'} color={C.sky} icon="🌤️"/>
          <KPICard label={isLive ? "PM2.5 Hiện tại" : "PM2.5 Trung bình"} value={typeof displayKpi.pm25_national === 'number' ? displayKpi.pm25_national.toFixed(1) : '--'} unit="µg/m³" color={C.warning} icon="💨"/>
          <KPICard label="Tỉnh vượt ngưỡng" value={`${displayKpi.provinces_exceeded ?? 0}/63`} color={C.danger} icon="⚠️"/>
          <KPICard label="Lượng dữ liệu" value={displayKpi.total_readings ? displayKpi.total_readings.toLocaleString() : '--'} color={C.violet} icon="📊"/>
        </div>
      </section>

      {/* 30-day AQI trend */}
      <section>
        <SectionHeader title="Xu hướng AQI Trung bình Quốc gia" sub="Đường WHO (PM2.5 ~ 25 µg/m³ = AQI 75) hiển thị màu vàng"/>
        <div style={{...glassCard,padding:"24px 20px"}}>
          <div style={{display:"flex",gap:20,marginBottom:16,flexWrap:"wrap"}}>
            {[{c:C.sky,l:"AQI quốc gia"},{c:C.warning,l:"WHO Limit"}].map(({c,l})=>(
              <span key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize: 14,color:C.muted}}>
                <span style={{width:20,height:2,background:c,display:"inline-block",borderRadius:2}}/>
                {l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            {isTrendLoading ? (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted}}>Loading...</div>
            ) : (
              <ComposedChart data={trendData} margin={{top:10,right:20,bottom:0,left:0}}>
                <defs>
                  <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.sky} stopOpacity={0.35}/>
                    <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="day" tick={{fill:C.muted,fontSize: 13}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize: 13}} axisLine={false} tickLine={false} domain={['auto', 'auto']}/>
                <Tooltip content={<DarkTooltip/>}/>
                <ReferenceLine y={75} stroke={C.warning} strokeDasharray="5 3" strokeWidth={1.5} label={{value:"WHO",fill:C.warning,fontSize: 13,position:"right"}}/>
                <Area type="monotone" dataKey="aqi" stroke={C.sky} strokeWidth={2.5} fill="url(#aqiGrad)" dot={false} name="AQI"/>
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* Donut + Top 10 */}
      <section>
        <div className="responsive-grid grid-cols-2">
          <div style={{...glassCard}}>
            <SectionHeader title="Phân phối AQI (Realtime hiện tại)"/>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3} dataKey="value">
                  {pieData.map((_,i)=><Cell key={i} fill={AQI_COLORS[i]}/>)}
                </Pie>
                <Tooltip content={<DarkTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
              {pieData.map((p,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize: 13,color:C.muted}}>
                  <span style={{width:8,height:8,borderRadius:2,background:AQI_COLORS[i],display:"inline-block"}}/>
                  {p.name} <span style={{color:C.text,fontWeight:600,...monoFont}}>{mapDataArray.length ? Math.round(p.value/mapDataArray.length*100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{...glassCard}}>
            <SectionHeader title="Top tỉnh ô nhiễm nhất"/>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
              {isOverviewLoading ? (
                 <div style={{color: C.muted, textAlign: 'center', marginTop: 40}}>Loading...</div>
              ) : top10.map((p,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{color:C.muted,fontSize: 13,width:16,...monoFont}}>{i+1}</span>
                  <span style={{color:C.text,fontSize: 15,width:100,...headFont}}>{p.province_name}</span>
                  <div style={{flex:1,height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(((p.avg_aqi ?? p.aqi_avg ?? 0)/200)*100, 100)}%`,background:aqiColor(p.avg_aqi ?? p.aqi_avg ?? 0),borderRadius:3,transition:"width 1s ease"}}/>
                  </div>
                  <span style={{color:aqiColor(p.avg_aqi ?? p.aqi_avg ?? 0),fontSize: 14,fontWeight:700,width:28,...monoFont}}>{Math.round(p.avg_aqi ?? p.aqi_avg ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hourly metrics */}
      <section>
        <SectionHeader title={startDate === endDate ? "Chỉ số theo giờ hôm nay" : "Chỉ số theo giờ trong kỳ"} sub="Trung bình toàn quốc"/>
        <div className="responsive-grid grid-cols-3">
          {tsMetrics.map(({key,label,color,unit,cur,min,max})=>(
            <div key={key} style={{...glassCard}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <p style={{color:C.muted,fontSize: 14,margin:0,...headFont}}>{label} theo giờ</p>
                <span style={{color,fontSize:18,fontWeight:700,...monoFont}}>{cur}</span>
              </div>
              <p style={{color:C.muted,fontSize: 13,margin:"0 0 8px",...monoFont}}>min {min} · max {max} {unit}</p>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={mergedTS.length > 0 ? mergedTS : []} margin={{top:0,right:0,bottom:0,left:-30}}>
                  <defs>
                    <linearGradient id={`hg${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="h" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} interval={Math.floor((mergedTS.length || 24) / 5) || 1}/>
                  <YAxis hide/>
                  <Tooltip content={<DarkTooltip/>}/>
                  <Area type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} fill={`url(#hg${key})`} dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </section>

      {/* Heatmap Calendar */}
      <section>
        <SectionHeader title={`Lịch AQI Năm ${new Date().getFullYear()}`} sub="Màu ô = mức AQI · hover để xem chi tiết"/>
        <div style={{...glassCard,overflowX:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"60px repeat(12,1fr)",gap:4,minWidth:700}}>
            <div/>
            {["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"].map(m=>(
              <div key={m} style={{textAlign:"center",fontSize: 13,color:C.muted,padding:"0 0 6px",...monoFont}}>{m}</div>
            ))}
            {Array.from({length:31},(_,day)=>(
              <React.Fragment key={`row-${day}`}>
                <div style={{fontSize: 12,color:C.muted,display:"flex",alignItems:"center",...monoFont}}>{day+1}</div>
                {Array.from({length:12},(_,mi)=>{
                  const dateObj = new Date(new Date().getFullYear(), mi, day + 1);
                  if (dateObj.getMonth() !== mi) return <div key={`${mi}-${day}`} style={{height:14}}/>;
                  
                  const yyyy = dateObj.getFullYear();
                  const mmStr = String(dateObj.getMonth() + 1).padStart(2, '0');
                  const ddStr = String(dateObj.getDate()).padStart(2, '0');
                  const targetDate = `${yyyy}-${mmStr}-${ddStr}`;
                  const entry = yearTrendArray.find((d) => String(d.day || d.date || '').startsWith(targetDate));
                  const v = entry?.aqi ?? entry?.avg_aqi ?? entry?.aqi_avg ?? 0;
                  const col = aqiColor(v);
                  return (
                    <div key={`${mi}-${day}`} title={`Ngày ${targetDate}: AQI ${Math.round(v)}`}
                      style={{height:14,borderRadius:3,background:v?col:"rgba(255,255,255,0.03)",cursor:"default",transition:"opacity 0.2s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity="0.7"}
                      onMouseLeave={e=>e.currentTarget.style.opacity="1"}/>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div style={{display:"flex",gap:16,marginTop:16,justifyContent:"center",flexWrap:"wrap"}}>
            {AQI_COLORS.map((c,i)=>(
              <span key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize: 13,color:C.muted}}>
                <span style={{width:12,height:12,borderRadius:2,background:c,display:"inline-block"}}/>
                {AQI_LABELS[i]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom stats */}
      <section>
        <div className="responsive-grid grid-cols-4">
          {dynamicStats.map(({label,value,sub,color})=>(
            <div key={label} style={{...glassCard,textAlign:"center"}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 20px ${color}22`}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <p style={{color:C.muted,fontSize: 13,margin:"0 0 8px",...headFont}}>{label}</p>
              <p style={{color,fontSize:20,fontWeight:700,margin:"0 0 4px",...monoFont}}>{value}</p>
              <p style={{color:C.muted,fontSize: 13,margin:0}}>{sub}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// ─── MAP TAB ──────────────────────────────────────────────────────────────────

export default OverviewTab;
