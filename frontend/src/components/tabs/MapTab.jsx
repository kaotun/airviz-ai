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
import VietnamMap from '../map/VietnamMap';

const MapTab = () => {
  const { data: mapData } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => dashboardApi.getMapData()
  });

  const [selectedName, setSelectedName] = useState("Hà Nội");

  // Tìm id của tỉnh đang chọn từ mapData
  const selectedProvince = mapData?.find(p => p.province_name === selectedName);

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['provinceDetail', selectedProvince?.province_id],
    queryFn: () => dashboardApi.getProvinceDetail(selectedProvince?.province_id),
    enabled: !!selectedProvince?.province_id
  });

  // Fallback data khi chưa có data thật
  const s = detail || {
    province_name: selectedName,
    aqi: 0,
    aqi_level: 0,
    pm2_5: 0, pm10: 0, carbon_monoxide: 0, nitrogen_dioxide: 0, sulphur_dioxide: 0, ozone: 0
  };

  const regionalData = [
    {region:"Miền Bắc",pm25:28,pm10:45,o3:42},
    {region:"Miền Trung",pm25:13,pm10:22,o3:58},
    {region:"Miền Nam",pm25:21,pm10:35,o3:52},
  ];

  const seasonData = [
    {season:"Xuân",pm25:22,pm10:38,o3:48},
    {season:"Hè",pm25:15,pm10:26,o3:68},
    {season:"Thu",pm25:19,pm10:32,o3:55},
    {season:"Đông",pm25:32,pm10:52,o3:38},
  ];

  // Simple SVG Vietnam shape (schematic, not real GeoJSON)
  // Map hardcoded cities with their actual AQI if available
  const vnProvinces = [
    {name:"Hà Nội",x:230,y:140},{name:"Hải Phòng",x:260,y:150},{name:"Bắc Ninh",x:240,y:130},
    {name:"TP.HCM",x:220,y:420},{name:"Bình Dương",x:210,y:400},{name:"Đà Nẵng",x:230,y:280},
    {name:"Huế",x:220,y:255},{name:"Cần Thơ",x:200,y:440},{name:"Đồng Nai",x:240,y:415},
    {name:"Hưng Yên",x:245,y:155},
  ].map(p => {
    const real = mapData?.find(md => md.province_name === p.name);
    return { ...p, aqi: real ? Math.round(real.aqi) : 0 };
  });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      {/* Map + Detail */}
      <section>
        <SectionHeader title="Bản đồ Chất lượng Không khí" sub="Nhấp vào tỉnh để xem chi tiết"/>
        <div style={{display:"grid",gridTemplateColumns:"45% 55%",gap:20}}>
          {/* Leaflet Map */}
          <div style={{...glassCard,padding:0, position:"relative", overflow:"hidden", height: 460}}>
             <VietnamMap onProvinceClick={(name) => setSelectedName(name)} />
          </div>

          {/* Province detail */}
          <div style={{...glassCard}}>
            {isDetailLoading ? (
              <div style={{color: C.muted, textAlign: 'center', marginTop: 40}}>Loading detail...</div>
            ) : (
            <>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
              <div style={{width:72,height:72,borderRadius:"50%",background:`conic-gradient(${aqiColor(s.aqi)} 0% ${(s.aqi||0)/200*100}%, rgba(255,255,255,0.05) ${(s.aqi||0)/200*100}% 100%)`,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                <div style={{width:56,height:56,borderRadius:"50%",background:C.card,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{color:aqiColor(s.aqi),fontWeight:700,fontSize:18,...monoFont}}>{Math.round(s.aqi)||0}</span>
                </div>
              </div>
              <div>
                <h2 style={{color:C.text,fontSize:22,margin:0,...headFont}}>{s.province_name}</h2>
                <span style={{background:`${aqiColor(s.aqi)}22`,border:`1px solid ${aqiColor(s.aqi)}44`,borderRadius:6,padding:"2px 10px",fontSize:12,color:aqiColor(s.aqi)}}>{AQI_LABELS[Math.min(s.aqi_level||0, 5)]}</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
              {[
                {label:"PM2.5",val:`${s.pm2_5?.toFixed(1)||'--'} µg/m³`,color:C.sky},
                {label:"PM10",val:`${s.pm10?.toFixed(1)||'--'} µg/m³`,color:C.warning},
                {label:"CO",val:`${s.carbon_monoxide?.toFixed(1)||'--'} mg/m³`,color:C.violet},
                {label:"NO₂",val:`${s.nitrogen_dioxide?.toFixed(1)||'--'} µg/m³`,color:"#f97316"},
                {label:"SO₂",val:`${s.sulphur_dioxide?.toFixed(1)||'--'} µg/m³`,color:C.success},
                {label:"O₃",val:`${s.ozone?.toFixed(1)||'--'} µg/m³`,color:"#a3e635"},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                  <p style={{color:C.muted,fontSize:11,margin:"0 0 4px",...headFont}}>{label}</p>
                  <p style={{color,fontSize:14,fontWeight:700,margin:0,...monoFont}}>{val}</p>
                </div>
              ))}
            </div>
            <p style={{color:C.muted,fontSize:12,marginBottom:8,...headFont}}>Xu hướng PM2.5 — 24h qua</p>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={hourlyData.slice(0,24)} margin={{top:0,right:0,bottom:0,left:-30}}>
                <defs>
                  <linearGradient id="provGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.sky} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="h" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false} interval={3}/>
                <YAxis hide/>
                <Tooltip content={<DarkTooltip/>}/>
                <Area type="monotone" dataKey="pm25" stroke={C.sky} strokeWidth={2} fill="url(#provGrad)" dot={false} name="PM2.5"/>
              </AreaChart>
            </ResponsiveContainer>
            </>
            )}
          </div>
        </div>
      </section>

      {/* Rankings Table */}
      <section>
        <SectionHeader title="Bảng xếp hạng 63 tỉnh thành" sub="Sắp xếp theo AQI giảm dần"/>
        <div style={{...glassCard,padding:0,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"rgba(56,189,248,0.06)",borderBottom:`1px solid ${C.border}`}}>
                {["#","Tỉnh","AQI","Mức độ","PM2.5","PM10","Cập nhật"].map(h=>(
                  <th key={h} style={{color:C.muted,fontSize:11,fontWeight:600,padding:"12px 16px",textAlign:"left",...headFont}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapData ? [...mapData].sort((a,b)=>b.aqi-a.aqi).slice(0, 15).map((p,i)=>(
                <tr key={i} style={{borderBottom:`1px solid rgba(255,255,255,0.03)`,transition:"background 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(56,189,248,0.04)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"10px 16px",color:C.muted,fontSize:12,...monoFont}}>{i+1}</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize:13,...headFont}}>{p.province_name}</td>
                  <td style={{padding:"10px 16px"}}>
                    <span style={{background:`${aqiColor(p.aqi)}18`,color:aqiColor(p.aqi),borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700,...monoFont}}>{Math.round(p.aqi)}</span>
                  </td>
                  <td style={{padding:"10px 16px",color:aqiColor(p.aqi),fontSize:12,...headFont}}>{AQI_LABELS[Math.min(p.aqi_level||0, 5)]}</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize:12,...monoFont}}>{p.pm2_5?.toFixed(1) || '--'} µg/m³</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize:12,...monoFont}}>{p.pm10?.toFixed(1) || '--'} µg/m³</td>
                  <td style={{padding:"10px 16px",color:C.muted,fontSize:11,...headFont}}>{p.time ? new Date(p.time).toLocaleTimeString('vi-VN') : '--'}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} style={{textAlign: 'center', padding: 20, color: C.muted}}>Loading data...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Regional + Seasonal */}
      <section>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <div style={{...glassCard}}>
            <SectionHeader title="So sánh 3 miền"/>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionalData} margin={{top:10,right:20,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="region" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<DarkTooltip/>}/>
                <Bar dataKey="pm25" name="PM2.5" fill={C.sky} radius={[4,4,0,0]} barSize={18}/>
                <Bar dataKey="pm10" name="PM10" fill={C.violet} radius={[4,4,0,0]} barSize={18}/>
                <Bar dataKey="o3" name="O₃" fill={C.success} radius={[4,4,0,0]} barSize={18}/>
              </BarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:16,marginTop:8}}>
              {[{c:C.sky,l:"PM2.5"},{c:C.violet,l:"PM10"},{c:C.success,l:"O₃"}].map(({c,l})=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.muted}}>
                  <span style={{width:10,height:10,borderRadius:2,background:c,display:"inline-block"}}/>
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div style={{...glassCard}}>
            <SectionHeader title="AQI theo mùa"/>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={seasonData} margin={{top:10,right:20,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="season" tick={{fill:C.muted,fontSize:12}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<DarkTooltip/>}/>
                <Bar dataKey="pm25" name="PM2.5" fill={C.warning} radius={[4,4,0,0]} barSize={18}/>
                <Bar dataKey="pm10" name="PM10" fill={C.danger} radius={[4,4,0,0]} barSize={18}/>
                <Bar dataKey="o3" name="O₃" fill={C.sky} radius={[4,4,0,0]} barSize={18}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Hourly polar simulation via bar */}
      <section>
        <SectionHeader title="AQI theo giờ trong ngày — vòng 24h"/>
        <div style={{...glassCard}}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourlyData} margin={{top:10,right:20,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="h" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip content={<DarkTooltip/>}/>
              <Bar dataKey="pm25" name="PM2.5" fill={C.sky} radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

// ─── ANALYSIS TAB ─────────────────────────────────────────────────────────────

export default MapTab;
