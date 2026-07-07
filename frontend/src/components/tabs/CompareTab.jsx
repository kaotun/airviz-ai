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
  C, AQI_COLORS, AQI_LABELS, generate30Days, hourlyData, provinces,
  compareData, heatmapData, alertsData, correlationData, radarData,
  weekHeatmap, zscore30, aqiColor, glassCard, monoFont, headFont,
  chartDefaults, DarkTooltip, Sparkline, KPICard, SectionHeader
} from '../../utils/dashboardConstants';

const CompareTab = () => {
  const { startDate, endDate } = useFilterStore();
  
  const { data: mapData } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => dashboardApi.getMapData()
  });

  const hanoiId = mapData?.find(p => p.province_name === "Hà Nội")?.province_id;
  const hcmId = mapData?.find(p => p.province_name === "Hồ Chí Minh" || p.province_name === "TP.HCM")?.province_id;
  const danangId = mapData?.find(p => p.province_name === "Đà Nẵng")?.province_id;

  const compareIds = [hanoiId, hcmId, danangId].filter(Boolean).join(',');

  const { data: compData, isLoading } = useQuery({
    queryKey: ['comparison', startDate, endDate, compareIds],
    queryFn: () => dashboardApi.getComparison(compareIds, startDate, endDate),
    enabled: !!compareIds
  });

  const [visible,setVisible] = useState({hanoi:true,hcm:true,danang:true});
  const provs = [{key:"hanoi",label:"Hà Nội",color:C.sky},{key:"hcm",label:"TP.HCM",color:C.violet},{key:"danang",label:"Đà Nẵng",color:C.emerald}];

  const compareDataRaw = [];
  if (compData?.timeseries) {
    const hnTs = compData.timeseries[hanoiId] || [];
    const hcmTs = compData.timeseries[hcmId] || [];
    const dnTs = compData.timeseries[danangId] || [];
    
    // Merge by date
    const dateSet = new Set([...hnTs, ...hcmTs, ...dnTs].map(d => d.date));
    Array.from(dateSet).sort().forEach(date => {
      const d = new Date(date);
      compareDataRaw.push({
        day: `${d.getDate()}/${d.getMonth()+1}`,
        hanoi: hnTs.find(t => t.date === date)?.aqi || null,
        hcm: hcmTs.find(t => t.date === date)?.aqi || null,
        danang: dnTs.find(t => t.date === date)?.aqi || null,
      });
    });
  }

  const monthlyComp = Array.from({length:12},(_,i)=>({
    month:`T${i+1}`,
    hanoi:Math.round(70+Math.sin(i*0.5)*20+Math.random()*10),
    hcm:Math.round(60+Math.sin(i*0.4)*15+Math.random()*8),
    danang:Math.round(30+Math.sin(i*0.6)*10+Math.random()*6),
  }));

  const scatterD = Array.from({length:30},()=>[
    {t:Math.round(20+Math.random()*15),pm:Math.round(28+Math.random()*20),p:"hanoi"},
    {t:Math.round(24+Math.random()*10),pm:Math.round(20+Math.random()*15),p:"hcm"},
    {t:Math.round(22+Math.random()*12),pm:Math.round(10+Math.random()*8),p:"danang"},
  ]).flat();

  const streamData = Array.from({length:12},(_,i)=>({
    month:`T${i+1}`,
    hanoi:Math.round(70+Math.sin(i*0.5)*20),
    hcm:Math.round(60+Math.sin(i*0.4)*15),
    danang:Math.round(30+Math.sin(i*0.6)*10),
  }));

  const statsRows = [
    {label:"AQI Trung bình",hanoi:"78.2",hcm:"64.8",danang:"33.9"},
    {label:"AQI Cao nhất",hanoi:"142",hcm:"118",danang:"67"},
    {label:"AQI Thấp nhất",hanoi:"32",hcm:"28",danang:"12"},
    {label:"Độ lệch chuẩn",hanoi:"18.4",hcm:"14.2",danang:"8.6"},
    {label:"PM2.5 TB",hanoi:"34.2 µg/m³",hcm:"21.4 µg/m³",danang:"11.8 µg/m³"},
    {label:"Ngày > WHO",hanoi:"187 ngày",hcm:"124 ngày",danang:"28 ngày"},
    {label:"Ngày Tốt",hanoi:"42 ngày",hcm:"89 ngày",danang:"198 ngày"},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      {/* Province selector */}
      <section>
        <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          {provs.map(({key,label,color})=>(
            <button key={key} onClick={()=>setVisible(v=>({...v,[key]:!v[key]}))}
              style={{background:visible[key]?`${color}22`:"rgba(255,255,255,0.03)",border:`2px solid ${visible[key]?color:C.border}`,borderRadius:24,padding:"8px 20px",color:visible[key]?color:C.muted,fontSize:13,cursor:"pointer",fontWeight:600,transition:"all 0.2s",...headFont}}>
              ● {label}
            </button>
          ))}
          <button style={{background:"rgba(255,255,255,0.04)",border:`1px dashed ${C.border}`,borderRadius:24,padding:"8px 20px",color:C.muted,fontSize:13,cursor:"pointer",...headFont}}>+ Thêm tỉnh</button>
        </div>
      </section>

      {/* Multi-line AQI comparison */}
      <section>
        <SectionHeader title="So sánh AQI — 30 ngày" sub="Bật/tắt tỉnh bằng nút trên"/>
        <div style={{...glassCard}}>
          <ResponsiveContainer width="100%" height={300}>
            {isLoading ? (
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted}}>Loading...</div>
            ) : (
            <ComposedChart data={compareDataRaw.length > 0 ? compareDataRaw : compareData} margin={{top:10,right:20,bottom:0,left:0}}>
              <defs>
                {provs.map(({key,color})=>(
                  <linearGradient key={key} id={`cg${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="day" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<DarkTooltip/>}/>
              {visible.hanoi&&<Area type="monotone" dataKey="hanoi" stroke={C.sky} strokeWidth={2} fill="url(#cghanoi)" dot={false} name="Hà Nội" connectNulls/>}
              {visible.hcm&&<Area type="monotone" dataKey="hcm" stroke={C.violet} strokeWidth={2} fill="url(#cghcm)" dot={false} name="TP.HCM" connectNulls/>}
              {visible.danang&&<Area type="monotone" dataKey="danang" stroke={C.emerald} strokeWidth={2} fill="url(#cgdanang)" dot={false} name="Đà Nẵng" connectNulls/>}
            </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* Radar + Scatter */}
      <section>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{...glassCard}}>
            <SectionHeader title="Radar 6 chỉ số"/>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)"/>
                <PolarAngleAxis dataKey="metric" tick={{fill:C.muted,fontSize:11}}/>
                {visible.hanoi&&<Radar name="Hà Nội" dataKey="hanoi" stroke={C.sky} fill={C.sky} fillOpacity={0.15} strokeWidth={2}/>}
                {visible.hcm&&<Radar name="TP.HCM" dataKey="hcm" stroke={C.violet} fill={C.violet} fillOpacity={0.15} strokeWidth={2}/>}
                {visible.danang&&<Radar name="Đà Nẵng" dataKey="danang" stroke={C.emerald} fill={C.emerald} fillOpacity={0.15} strokeWidth={2}/>}
                <Tooltip content={<DarkTooltip/>}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div style={{...glassCard}}>
            <SectionHeader title="PM2.5 vs Nhiệt độ"/>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{top:10,right:20,bottom:10,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="t" name="Nhiệt độ" unit="°C" tick={{fill:C.muted,fontSize:11}} axisLine={false}/>
                <YAxis dataKey="pm" name="PM2.5" unit=" µg" tick={{fill:C.muted,fontSize:11}} axisLine={false}/>
                <Tooltip content={<DarkTooltip/>} cursor={{fill:"rgba(255,255,255,0.02)"}}/>
                {visible.hanoi&&<Scatter data={scatterD.filter(d=>d.p==="hanoi")} fill={C.sky} name="Hà Nội" opacity={0.7}/>}
                {visible.hcm&&<Scatter data={scatterD.filter(d=>d.p==="hcm")} fill={C.violet} name="TP.HCM" opacity={0.7}/>}
                {visible.danang&&<Scatter data={scatterD.filter(d=>d.p==="danang")} fill={C.emerald} name="Đà Nẵng" opacity={0.7}/>}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Monthly heatmap */}
      <section>
        <SectionHeader title="So sánh AQI theo tháng — 3 tỉnh"/>
        <div style={{...glassCard}}>
          {provs.map(({key,label,color})=>(
            <div key={key} style={{marginBottom:16}}>
              <p style={{color,fontSize:12,margin:"0 0 6px",fontWeight:600,...headFont}}>{label}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:4}}>
                {monthlyComp.map((d,i)=>{
                  const v=d[key];
                  return (
                    <div key={i} title={`${d.month}: AQI ${v}`}
                      style={{height:32,borderRadius:6,background:aqiColor(v),opacity:v/120,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:600,...monoFont}}>
                      {v}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:4,marginTop:2}}>
                {monthlyComp.map((d,i)=><div key={i} style={{textAlign:"center",fontSize:10,color:C.muted,...monoFont}}>{d.month}</div>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats table */}
      <section>
        <SectionHeader title="Bảng thống kê tổng hợp"/>
        <div style={{...glassCard,padding:0,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"rgba(255,255,255,0.03)"}}>
                <th style={{padding:"14px 20px",textAlign:"left",color:C.muted,fontSize:12,...headFont}}>Chỉ số</th>
                {provs.map(({label,color})=>(
                  <th key={label} style={{padding:"14px 20px",textAlign:"center",color,fontSize:13,...headFont}}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statsRows.map((row,i)=>(
                <tr key={i} style={{borderTop:`1px solid rgba(255,255,255,0.04)`}}>
                  <td style={{padding:"12px 20px",color:C.muted,fontSize:13,...headFont}}>{row.label}</td>
                  {provs.map(({key,color})=>(
                    <td key={key} style={{padding:"12px 20px",textAlign:"center",color:C.text,fontSize:13,fontWeight:600,...monoFont}}>{row[key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stream chart */}
      <section>
        <SectionHeader title="Xu hướng AQI theo tháng — 3 tỉnh"/>
        <div style={{...glassCard}}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={streamData} margin={{top:10,right:20,bottom:0,left:0}}>
              <defs>
                {provs.map(({key,color})=>(
                  <linearGradient key={key} id={`stg${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.6}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="month" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<DarkTooltip/>}/>
              {visible.hanoi&&<Area type="monotone" dataKey="hanoi" stackId="1" stroke={C.sky} fill={`url(#stghanoi)`} name="Hà Nội"/>}
              {visible.hcm&&<Area type="monotone" dataKey="hcm" stackId="1" stroke={C.violet} fill={`url(#stghcm)`} name="TP.HCM"/>}
              {visible.danang&&<Area type="monotone" dataKey="danang" stackId="1" stroke={C.emerald} fill={`url(#stgdanang)`} name="Đà Nẵng"/>}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

// ─── ALERTS TAB ───────────────────────────────────────────────────────────────

export default CompareTab;
