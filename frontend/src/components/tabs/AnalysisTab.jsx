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

const AnalysisTab = () => {
  const [selMetric,setSelMetric] = useState("PM2.5");
  const metrics = ["PM2.5","PM10","CO","NO₂","SO₂","O₃"];

  const multiLine = Array.from({length:30},(_,i)=>({
    day:`T${i+1}`,
    hanoi:Math.round(30+Math.sin(i*0.4)*12+Math.random()*8),
    hcm:Math.round(22+Math.sin(i*0.35)*10+Math.random()*6),
    danang:Math.round(12+Math.sin(i*0.5)*6+Math.random()*4),
  }));

  const histData = Array.from({length:20},(_,i)=>({
    range:`${i*5}-${(i+1)*5}`,
    freq:Math.round(Math.exp(-0.5*Math.pow((i-8)/3,2))*120+Math.random()*10),
  }));

  const corrColor = (v) => {
    const abs = Math.abs(v);
    if(v===1) return "#38bdf8";
    if(v>0.7) return `rgba(56,189,248,${0.7+abs*0.3})`;
    if(v>0.3) return `rgba(167,139,250,${0.4+abs*0.4})`;
    if(v<0) return `rgba(248,113,113,${abs*0.8})`;
    return "rgba(255,255,255,0.05)";
  };

  const raw30 = Array.from({length:30},(_,i)=>({
    day:`T${i+1}`,
    raw:Math.round(50+Math.sin(i*0.8)*25+Math.random()*20),
    smooth:Math.round(50+Math.sin(i*0.4)*18),
    anomaly:Math.random()>0.88?Math.round(85+Math.random()*20):null,
  }));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      {/* Multi-line time series */}
      <section>
        <SectionHeader title="Chuỗi thời gian đa tỉnh"/>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {metrics.map(m=>(
            <button key={m} onClick={()=>setSelMetric(m)}
              style={{background:selMetric===m?`linear-gradient(135deg,${C.sky},${C.violet})`:"rgba(255,255,255,0.04)",border:`1px solid ${selMetric===m?C.sky:C.border}`,borderRadius:20,padding:"6px 16px",color:selMetric===m?"#fff":C.muted,fontSize:12,cursor:"pointer",...headFont}}>
              {m}
            </button>
          ))}
        </div>
        <div style={{...glassCard}}>
          <div style={{display:"flex",gap:16,marginBottom:12}}>
            {[{c:C.sky,l:"Hà Nội"},{c:C.violet,l:"TP.HCM"},{c:C.emerald,l:"Đà Nẵng"}].map(({c,l})=>(
              <span key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.muted}}>
                <span style={{width:20,height:2,background:c,display:"inline-block"}}/>
                {l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={multiLine} margin={{top:10,right:20,bottom:0,left:0}}>
              <defs>
                {[{id:"mhn",c:C.sky},{id:"mhcm",c:C.violet},{id:"mdn",c:C.emerald}].map(({id,c})=>(
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={c} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={c} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="day" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<DarkTooltip/>}/>
              <Area type="monotone" dataKey="hanoi" stroke={C.sky} strokeWidth={2} fill="url(#mhn)" dot={false} name="Hà Nội"/>
              <Area type="monotone" dataKey="hcm" stroke={C.violet} strokeWidth={2} fill="url(#mhcm)" dot={false} name="TP.HCM"/>
              <Area type="monotone" dataKey="danang" stroke={C.emerald} strokeWidth={2} fill="url(#mdn)" dot={false} name="Đà Nẵng"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Correlation Heatmap */}
      <section>
        <SectionHeader title="Ma trận tương quan Pearson — 7 biến môi trường"/>
        <div style={{...glassCard}}>
          <div style={{display:"grid",gridTemplateColumns:`80px repeat(7,1fr)`,gap:3}}>
            <div/>
            {correlationData.vars.map(v=>(
              <div key={v} style={{textAlign:"center",color:C.muted,fontSize:11,padding:"6px 2px",...monoFont}}>{v}</div>
            ))}
            {correlationData.vars.map((row,ri)=>(
              <>
                <div key={row} style={{color:C.muted,fontSize:11,display:"flex",alignItems:"center",...monoFont}}>{row}</div>
                {correlationData.matrix[ri].map((val,ci)=>(
                  <div key={ci} style={{background:corrColor(val),borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",height:48,fontSize:11,fontWeight:600,color:Math.abs(val)>0.4?"#fff":C.muted,...monoFont,transition:"transform 0.2s",cursor:"default"}}
                    onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                    {val.toFixed(2)}
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* Histogram + Box style */}
      <section>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{...glassCard}}>
            <SectionHeader title="Phân phối PM2.5"/>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={histData} margin={{top:10,right:20,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="range" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} interval={3}/>
                <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<DarkTooltip/>}/>
                <Bar dataKey="freq" name="Tần suất" fill={C.sky} radius={[3,3,0,0]} fillOpacity={0.8}/>
                <ReferenceLine x="35-40" stroke={C.warning} strokeDasharray="4 2" label={{value:"Mean",fill:C.warning,fontSize:10}}/>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={{...glassCard}}>
            <SectionHeader title="Phân vị AQI — Top 10 tỉnh"/>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
              {provinces.sort((a,b)=>b.aqi-a.aqi).slice(0,8).map((p,i)=>{
                const q1=p.aqi*0.75,med=p.aqi,q3=p.aqi*1.18,w=p.aqi*1.35;
                const scale=200/w;
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{color:C.text,fontSize:12,width:80,...headFont}}>{p.name}</span>
                    <div style={{position:"relative",height:14,flex:1}}>
                      <div style={{position:"absolute",left:`${q1*scale}px`,width:`${(q3-q1)*scale}px`,height:14,background:`${aqiColor(p.aqi)}44`,border:`1px solid ${aqiColor(p.aqi)}`,borderRadius:3}}/>
                      <div style={{position:"absolute",left:`${med*scale}px`,width:2,height:14,background:aqiColor(p.aqi)}}/>
                    </div>
                    <span style={{color:aqiColor(p.aqi),fontSize:11,width:28,...monoFont}}>{p.aqi}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Week×Hour heatmap */}
      <section>
        <SectionHeader title="AQI theo ngày × giờ trong tuần" sub="Phát hiện mô hình ô nhiễm giờ cao điểm"/>
        <div style={{...glassCard}}>
          <div style={{display:"grid",gridTemplateColumns:"40px repeat(24,1fr)",gap:2}}>
            <div/>
            {Array.from({length:24},(_,h)=>(
              <div key={h} style={{textAlign:"center",color:C.muted,fontSize:9,...monoFont}}>{h}</div>
            ))}
            {["T2","T3","T4","T5","T6","T7","CN"].map(day=>(
              <>
                <div key={day} style={{color:C.muted,fontSize:10,display:"flex",alignItems:"center",...monoFont}}>{day}</div>
                {Array.from({length:24},(_,h)=>{
                  const entry=weekHeatmap.find(d=>d.day===day&&d.h===h);
                  const v=entry?.aqi||30;
                  return (
                    <div key={h} title={`${day} ${h}h: AQI ${v}`}
                      style={{height:22,borderRadius:4,background:aqiColor(v),opacity:v/80,cursor:"default"}}/>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* Trend decomposition */}
      <section>
        <SectionHeader title="Phân rã xu hướng AQI — dữ liệu thô vs làm mượt"/>
        <div style={{...glassCard}}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={raw30} margin={{top:10,right:20,bottom:0,left:0}}>
              <defs>
                <linearGradient id="rawGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.sky} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="day" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<DarkTooltip/>}/>
              <Area type="monotone" dataKey="raw" stroke="rgba(56,189,248,0.4)" strokeWidth={1} fill="url(#rawGrad)" dot={false} name="AQI thô"/>
              <Line type="monotone" dataKey="smooth" stroke={C.sky} strokeWidth={2.5} dot={false} name="Trung bình 7 ngày"/>
              <Line dataKey="anomaly" stroke={C.danger} strokeWidth={0} dot={{fill:C.danger,r:5,stroke:C.danger}} name="Bất thường"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

// â”€â”€â”€ COMPARE TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default AnalysisTab;

