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

const AlertsTab = () => {
  const anomalyHeat = Array.from({length:12},(_,mi)=>
    provinces.map(p=>({province:p.name,month:`T${mi+1}`,count:Math.round(Math.random()*6*(p.aqi/60))}))
  ).flat();

  const topAnomProv = provinces.map(p=>({...p,anomalies:Math.round(p.aqi/12+Math.random()*4)})).sort((a,b)=>b.anomalies-a.anomalies);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      {/* KPIs */}
      <section>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[
            {label:"Tổng bất thường",value:"47",sub:"30 ngày qua",color:C.violet},
            {label:"Tỉnh nhiều nhất",value:"Hà Nội · 8 lần",sub:"Z-score TB: 3.1σ",color:C.danger},
            {label:"Z-score cao nhất",value:"3.82σ",sub:"PM2.5 · 27/06 08:30",color:C.warning},
          ].map(({label,value,sub,color})=>(
            <div key={label} style={{...glassCard,textAlign:"center",position:"relative"}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 30px ${color}20`}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color,margin:"0 auto 12px",animation:"pulse 2s infinite"}}/>
              <p style={{color:C.muted,fontSize:12,margin:"0 0 8px",...headFont}}>{label}</p>
              <p style={{color,fontSize:22,fontWeight:700,margin:"0 0 4px",...monoFont}}>{value}</p>
              <p style={{color:C.muted,fontSize:12,margin:0}}>{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Z-score timeline */}
      <section>
        <SectionHeader title="Z-score theo thời gian — PM2.5 Hà Nội" sub="Ngưỡng cảnh báo: 2.5σ (vàng) và 3.5σ (đỏ)"/>
        <div style={{...glassCard}}>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={zscore30} margin={{top:10,right:20,bottom:0,left:0}}>
              <defs>
                <linearGradient id="zgrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.sky} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="day" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} domain={[0,5]}/>
              <Tooltip content={<DarkTooltip/>}/>
              <ReferenceLine y={2.5} stroke={C.warning} strokeDasharray="5 3" strokeWidth={1.5} label={{value:"2.5σ",fill:C.warning,fontSize:10,position:"right"}}/>
              <ReferenceLine y={3.5} stroke={C.danger} strokeDasharray="5 3" strokeWidth={1.5} label={{value:"3.5σ",fill:C.danger,fontSize:10,position:"right"}}/>
              <Area type="monotone" dataKey="z" stroke={C.sky} strokeWidth={2} fill="url(#zgrad)" name="Z-score"
                dot={(props)=>{
                  const {cx,cy,value}=props;
                  if(value>2.5) return <circle cx={cx} cy={cy} r={5} fill={C.danger} stroke="none"/>;
                  return null;
                }}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Anomaly heatmap */}
      <section>
        <SectionHeader title="Bản đồ nhiệt bất thường — Tỉnh × Tháng"/>
        <div style={{...glassCard,overflowX:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:`100px repeat(12,1fr)`,gap:3,minWidth:700}}>
            <div/>
            {Array.from({length:12},(_,i)=>(
              <div key={i} style={{textAlign:"center",fontSize:11,color:C.muted,...monoFont}}>T{i+1}</div>
            ))}
            {provinces.slice(0,8).map(p=>(
              <>
                <div key={p.name} style={{color:C.text,fontSize:12,display:"flex",alignItems:"center",...headFont}}>{p.name}</div>
                {Array.from({length:12},(_,mi)=>{
                  const entry=anomalyHeat.find(d=>d.province===p.name&&d.month===`T${mi+1}`);
                  const cnt=entry?.count||0;
                  const opacity=cnt/6;
                  return (
                    <div key={mi} title={`${p.name} T${mi+1}: ${cnt} bất thường`}
                      style={{height:32,borderRadius:4,background:`rgba(248,113,113,${opacity})`,border:`1px solid rgba(248,113,113,${opacity*0.5})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:cnt>3?"#fff":C.muted,...monoFont}}>
                      {cnt||""}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* Alert Timeline */}
      <section>
        <SectionHeader title="Dòng thời gian sự kiện bất thường"/>
        <div style={{...glassCard}}>
          {alertsData.map((a,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"100px 24px 1fr",gap:12,marginBottom:i<alertsData.length-1?16:0,alignItems:"center"}}>
              <div style={{textAlign:"right"}}>
                <p style={{color:C.muted,fontSize:11,margin:0,...monoFont}}>{a.time}</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:a.level==="Rất cao"?C.danger:C.warning,boxShadow:`0 0 8px ${a.level==="Rất cao"?C.danger:C.warning}`}}/>
                {i<alertsData.length-1&&<div style={{width:1,height:24,background:"rgba(255,255,255,0.08)",marginTop:4}}/>}
              </div>
              <div style={{background:a.level==="Rất cao"?"rgba(248,113,113,0.06)":"rgba(251,191,36,0.06)",border:`1px solid ${a.level==="Rất cao"?"rgba(248,113,113,0.2)":"rgba(251,191,36,0.2)"}`,borderRadius:10,padding:"10px 14px",boxShadow:a.level==="Rất cao"?`0 0 16px rgba(248,113,113,0.12)`:"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{color:C.text,fontWeight:700,fontSize:13,...headFont}}>{a.province} · {a.metric}</span>
                  <span style={{background:a.level==="Rất cao"?"rgba(248,113,113,0.2)":"rgba(251,191,36,0.2)",border:`1px solid ${a.level==="Rất cao"?C.danger:C.warning}`,borderRadius:12,padding:"2px 10px",fontSize:11,color:a.level==="Rất cao"?C.danger:C.warning}}>{a.level}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <span style={{color:C.muted,fontSize:12,...monoFont}}>Giá trị: <span style={{color:a.level==="Rất cao"?C.danger:C.warning,fontWeight:700}}>{a.value}</span></span>
                  <span style={{color:C.muted,fontSize:12,...monoFont}}>Z-score: <span style={{color:C.warning,fontWeight:700}}>{a.zscore}σ</span></span>
                  <div style={{flex:1,height:4,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${(a.zscore/5)*100}%`,background:`linear-gradient(90deg,${C.warning},${C.danger})`,borderRadius:2}}/>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Alert Details Table */}
      <section>
        <SectionHeader title="Chi tiết tất cả bất thường — 30 ngày"/>
        <div style={{...glassCard,padding:0,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"rgba(248,113,113,0.06)",borderBottom:`1px solid rgba(248,113,113,0.15)`}}>
                {["Thời gian","Tỉnh","Chỉ số","Giá trị","Z-score","Mức độ"].map(h=>(
                  <th key={h} style={{padding:"12px 16px",textAlign:"left",color:C.muted,fontSize:11,...headFont}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertsData.map((a,i)=>(
                <tr key={i} style={{borderBottom:`1px solid rgba(255,255,255,0.03)`,transition:"background 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(248,113,113,0.04)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"10px 16px",color:C.muted,fontSize:12,...monoFont}}>{a.time}</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize:13,...headFont}}>{a.province}</td>
                  <td style={{padding:"10px 16px",color:C.sky,fontSize:12,...monoFont}}>{a.metric}</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize:12,fontWeight:700,...monoFont}}>{a.value}</td>
                  <td style={{padding:"10px 16px"}}>
                    <span style={{color:a.zscore>3?C.danger:C.warning,fontWeight:700,...monoFont}}>{a.zscore}σ</span>
                  </td>
                  <td style={{padding:"10px 16px"}}>
                    <span style={{background:a.level==="Rất cao"?"rgba(248,113,113,0.15)":"rgba(251,191,36,0.15)",border:`1px solid ${a.level==="Rất cao"?"rgba(248,113,113,0.3)":"rgba(251,191,36,0.3)"}`,borderRadius:12,padding:"3px 10px",fontSize:11,color:a.level==="Rất cao"?C.danger:C.warning,...headFont}}>
                      {a.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top anomalous provinces */}
      <section>
        <SectionHeader title="Số lần bất thường theo tỉnh — Top 10"/>
        <div style={{...glassCard}}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {topAnomProv.slice(0,10).map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{color:C.muted,fontSize:12,width:20,...monoFont}}>{i+1}</span>
                <span style={{color:C.text,fontSize:13,width:110,...headFont}}>{p.name}</span>
                <div style={{flex:1,height:10,background:"rgba(255,255,255,0.04)",borderRadius:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(p.anomalies/10)*100}%`,background:`linear-gradient(90deg,${C.warning},${C.danger})`,borderRadius:5,transition:"width 1s ease"}}/>
                </div>
                <span style={{color:C.danger,fontSize:13,fontWeight:700,width:30,...monoFont}}>{p.anomalies}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

// â”€â”€â”€ LIVE CLOCK â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LiveClock = () => {
  const [time,setTime] = useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);
  return <span style={{...monoFont,fontSize:13,color:C.muted}}>{time.toLocaleTimeString("vi-VN")}</span>;
};

// â”€â”€â”€ MAIN APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default AlertsTab;

