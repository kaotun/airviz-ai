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

const OverviewTab = () => {
  const { startDate, endDate } = useFilterStore();
  
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
  const top10 = overview?.top_polluted || [];
  
  // Trend processing (format date string to "DD/MM")
  const trendData = trend?.map(t => {
    const d = new Date(t.date);
    return { day: `${d.getDate()}/${d.getMonth()+1}`, aqi: Math.round(t.avg_aqi) };
  }) || [];

  // Pie Data processing from mapData (latest AQI)
  const aqiCount = [0, 0, 0, 0, 0, 0];
  if (mapData) {
    mapData.forEach(p => {
      if (p.aqi <= 50) aqiCount[0]++;
      else if (p.aqi <= 100) aqiCount[1]++;
      else if (p.aqi <= 150) aqiCount[2]++;
      else if (p.aqi <= 200) aqiCount[3]++;
      else if (p.aqi <= 300) aqiCount[4]++;
      else aqiCount[5]++;
    });
  }
  const pieData = [
    {name:"Tốt",value:aqiCount[0]},{name:"Trung bình",value:aqiCount[1]},{name:"Kém",value:aqiCount[2]},
    {name:"Xấu",value:aqiCount[3]},{name:"Rất xấu",value:aqiCount[4]},{name:"Nguy hiểm",value:aqiCount[5]},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      {/* KPIs */}
      <section>
        <SectionHeader title="Tổng quan quốc gia" sub={`Kỳ báo cáo: ${startDate} đến ${endDate}`}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          <KPICard label="AQI Trung bình" value={kpi.aqi_national !== '--' ? Math.round(kpi.aqi_national) : '--'} color={C.sky} icon="🌤️"/>
          <KPICard label="PM2.5 Trung bình" value={kpi.pm25_national !== '--' ? kpi.pm25_national.toFixed(1) : '--'} unit="µg/m³" color={C.warning} icon="💨"/>
          <KPICard label="Tỉnh vượt ngưỡng" value={`${kpi.provinces_exceeded}/63`} color={C.danger} icon="⚠️"/>
          <KPICard label="Bất thường hôm nay" value="47" color={C.violet} icon="⚡"/>
        </div>
      </section>

      {/* 30-day AQI trend */}
      <section>
        <SectionHeader title="Xu hướng AQI Trung bình Quốc gia" sub="Đường WHO (PM2.5 ~ 25 µg/m³ = AQI 75) hiển thị màu vàng"/>
        <div style={{...glassCard,padding:"24px 20px"}}>
          <div style={{display:"flex",gap:20,marginBottom:16,flexWrap:"wrap"}}>
            {[{c:C.sky,l:"AQI quốc gia"},{c:C.warning,l:"WHO Limit"}].map(({c,l})=>(
              <span key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.muted}}>
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
                <XAxis dataKey="day" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} domain={['auto', 'auto']}/>
                <Tooltip content={<DarkTooltip/>}/>
                <ReferenceLine y={75} stroke={C.warning} strokeDasharray="5 3" strokeWidth={1.5} label={{value:"WHO",fill:C.warning,fontSize:11,position:"right"}}/>
                <Area type="monotone" dataKey="aqi" stroke={C.sky} strokeWidth={2.5} fill="url(#aqiGrad)" dot={false} name="AQI"/>
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </section>

      {/* Donut + Top 10 */}
      <section>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{...glassCard}}>
            <SectionHeader title="Phân phối AQI (Hiện tại)"/>
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
                <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.muted}}>
                  <span style={{width:8,height:8,borderRadius:2,background:AQI_COLORS[i],display:"inline-block"}}/>
                  {p.name} <span style={{color:C.text,fontWeight:600,...monoFont}}>{mapData ? Math.round(p.value/mapData.length*100) : 0}%</span>
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
                  <span style={{color:C.muted,fontSize:11,width:16,...monoFont}}>{i+1}</span>
                  <span style={{color:C.text,fontSize:13,width:100,...headFont}}>{p.province_name}</span>
                  <div style={{flex:1,height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min((p.avg_aqi/200)*100, 100)}%`,background:`linear-gradient(90deg,${C.sky},${C.violet})`,borderRadius:3,transition:"width 1s ease"}}/>
                  </div>
                  <span style={{color:aqiColor(p.avg_aqi),fontSize:12,fontWeight:700,width:28,...monoFont}}>{Math.round(p.avg_aqi)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Hourly metrics */}
      <section>
        <SectionHeader title="Chỉ số theo giờ hôm nay" sub="Dữ liệu cập nhật mỗi giờ"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[{key:"pm25",label:"PM2.5",color:C.sky,unit:"µg/m³",cur:34.2,min:18,max:52},
            {key:"o3",label:"O₃",color:C.violet,unit:"µg/m³",cur:68,min:32,max:112},
            {key:"no2",label:"NO₂",color:C.warning,unit:"µg/m³",cur:42,min:20,max:68}].map(({key,label,color,unit,cur,min,max})=>(
            <div key={key} style={{...glassCard}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <p style={{color:C.muted,fontSize:12,margin:0,...headFont}}>{label} theo giờ</p>
                <span style={{color,fontSize:18,fontWeight:700,...monoFont}}>{cur}</span>
              </div>
              <p style={{color:C.muted,fontSize:11,margin:"0 0 8px",...monoFont}}>min {min} · max {max} {unit}</p>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={hourlyData} margin={{top:0,right:0,bottom:0,left:-30}}>
                  <defs>
                    <linearGradient id={`hg${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={color} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="h" tick={{fill:C.muted,fontSize:9}} axisLine={false} tickLine={false} interval={5}/>
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
        <SectionHeader title="Lịch AQI Năm 2025" sub="Màu ô = mức AQI · hover để xem chi tiết"/>
        <div style={{...glassCard,overflowX:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"60px repeat(12,1fr)",gap:4,minWidth:700}}>
            <div/>
            {["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"].map(m=>(
              <div key={m} style={{textAlign:"center",fontSize:11,color:C.muted,padding:"0 0 6px",...monoFont}}>{m}</div>
            ))}
            {Array.from({length:31},(_,day)=>(
              <>
                <div key={`d${day}`} style={{fontSize:10,color:C.muted,display:"flex",alignItems:"center",...monoFont}}>{day+1}</div>
                {Array.from({length:12},(_,mi)=>{
                  const entry = heatmapData.find(d=>d.month===`T${mi+1}`&&d.day===day+1);
                  const v = entry?.aqi||0;
                  const col = v>100?"#dc2626":v>75?C.danger:v>50?"#f97316":v>25?C.warning:v>10?"#a3e635":C.success;
                  return (
                    <div key={`${mi}-${day}`} title={`T${mi+1}/ngày ${day+1}: AQI ${v}`}
                      style={{height:14,borderRadius:3,background:v?col:"rgba(255,255,255,0.03)",cursor:"default",transition:"opacity 0.2s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity="0.7"}
                      onMouseLeave={e=>e.currentTarget.style.opacity="1"}/>
                  );
                })}
              </>
            ))}
          </div>
          <div style={{display:"flex",gap:16,marginTop:16,justifyContent:"center",flexWrap:"wrap"}}>
            {AQI_COLORS.map((c,i)=>(
              <span key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.muted}}>
                <span style={{width:12,height:12,borderRadius:2,background:c,display:"inline-block"}}/>
                {AQI_LABELS[i]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom stats */}
      <section>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {[
            {label:"Ngày ô nhiễm nhất",value:"14/01/2025",sub:"AQI: 142 · Hà Nội",color:C.danger},
            {label:"Tháng AQI cao nhất",value:"Tháng 1",sub:"TB AQI: 87.3 toàn quốc",color:C.warning},
            {label:"Giờ cao điểm",value:"07:00 – 09:00",sub:"PM2.5 cao nhất ngày",color:C.sky},
            {label:"Cải thiện vs 2024",value:"−8.2%",sub:"So sánh AQI trung bình",color:C.success},
          ].map(({label,value,sub,color})=>(
            <div key={label} style={{...glassCard,textAlign:"center"}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 20px ${color}22`}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
              <p style={{color:C.muted,fontSize:11,margin:"0 0 8px",...headFont}}>{label}</p>
              <p style={{color,fontSize:20,fontWeight:700,margin:"0 0 4px",...monoFont}}>{value}</p>
              <p style={{color:C.muted,fontSize:11,margin:0}}>{sub}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

// ─── MAP TAB ──────────────────────────────────────────────────────────────────

export default OverviewTab;
