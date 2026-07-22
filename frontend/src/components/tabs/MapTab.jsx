import React from 'react';
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
  C, AQI_COLORS, AQI_LABELS, provinces,
  aqiColor, glassCard, monoFont, headFont,
  chartDefaults, DarkTooltip, Sparkline, KPICard, SectionHeader
} from '../../utils/dashboardConstants';
import VietnamMap from '../map/VietnamMap';
import TabFilterBar from '../TabFilterBar';

const MapTab = () => {
  const { data: mapData } = useQuery({
    queryKey: ['mapData'],
    queryFn: () => dashboardApi.getMapData()
  });

  const { startDate, endDate, selectedProvinces, setProvinces } = useFilterStore();
  
  const mapDataArray = Array.isArray(mapData) ? mapData : (mapData?.data || mapData?.provinces || []);
  const effectiveProvinceName = selectedProvinces.length > 0 ? selectedProvinces[0].name : 'Hà Nội';
  const selectedProvince = mapDataArray.find(p => p.province_name === effectiveProvinceName);

  const { data: detail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['provinceDetail', selectedProvince?.province_id],
    queryFn: () => dashboardApi.getProvinceDetail(selectedProvince?.province_id),
    enabled: !!selectedProvince?.province_id
  });


  const { data: trendDetail, isLoading: isTrendDetailLoading } = useQuery({
    queryKey: ['trendDetail', selectedProvince?.province_id, startDate, endDate],
    queryFn: () => dashboardApi.getTimeseries({
      metric: 'pm2_5',
      province_id: selectedProvince?.province_id,
      start_date: startDate,
      end_date: endDate
    }),
    enabled: !!selectedProvince?.province_id
  });

  const realHourlyData = trendDetail?.data?.length > 0 
    ? trendDetail.data.map((d) => {
        const dt = new Date(d.time);
        const isSingleDay = startDate === endDate;
        const label = isSingleDay 
          ? `${dt.getHours().toString().padStart(2, '0')}:00`
          : `${dt.getDate()}/${dt.getMonth()+1} ${dt.getHours().toString().padStart(2, '0')}:00`;
        return {
          h: label,
          pm25: d.value
        };
      })
    : [];

  // Fallback data khi chưa có data thật
  const s = detail || {
    province_name: effectiveProvinceName,
    aqi: 0,
    aqi_level: 0,
    pm2_5: 0, pm10: 0, carbon_monoxide: 0, nitrogen_dioxide: 0, sulphur_dioxide: 0, ozone: 0
  };

  const regionalData = React.useMemo(() => {
    const res = {
      "Bắc": { pm25: 0, pm10: 0, o3: 0, count: 0 },
      "Trung": { pm25: 0, pm10: 0, o3: 0, count: 0 },
      "Nam": { pm25: 0, pm10: 0, o3: 0, count: 0 }
    };
    const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim() : '';
    mapDataArray.forEach((d) => {
      const p = provinces.find(prov => normalize(prov.name) === normalize(d.province_name));
      const region = p?.region;
      if (region && res[region]) {
         res[region].pm25 += d.pm2_5 || 0;
         res[region].pm10 += d.pm10 || 0;
         res[region].o3 += d.ozone || 0;
         res[region].count += 1;
      }
    });
    return [
      { region: "Miền Bắc", pm25: res["Bắc"].count ? res["Bắc"].pm25/res["Bắc"].count : 0, pm10: res["Bắc"].count ? res["Bắc"].pm10/res["Bắc"].count : 0, o3: res["Bắc"].count ? res["Bắc"].o3/res["Bắc"].count : 0 },
      { region: "Miền Trung", pm25: res["Trung"].count ? res["Trung"].pm25/res["Trung"].count : 0, pm10: res["Trung"].count ? res["Trung"].pm10/res["Trung"].count : 0, o3: res["Trung"].count ? res["Trung"].o3/res["Trung"].count : 0 },
      { region: "Miền Nam", pm25: res["Nam"].count ? res["Nam"].pm25/res["Nam"].count : 0, pm10: res["Nam"].count ? res["Nam"].pm10/res["Nam"].count : 0, o3: res["Nam"].count ? res["Nam"].o3/res["Nam"].count : 0 }
    ];
  }, [mapDataArray]);

  const pollutantData = [
    { name: "PM2.5", value: s.pm2_5 || 0, fill: C.warning },
    { name: "PM10", value: s.pm10 || 0, fill: C.danger },
    { name: "O₃", value: s.ozone || 0, fill: C.sky },
    { name: "NO₂", value: s.nitrogen_dioxide || 0, fill: C.violet },
    { name: "SO₂", value: s.sulphur_dioxide || 0, fill: C.success },
    { name: "CO", value: s.carbon_monoxide || 0, fill: C.emerald },
  ];

  // Simple SVG Vietnam shape (schematic, not real GeoJSON)
  // Map hardcoded cities with their actual AQI if available
  const vnProvinces = [
    {name:"Hà Nội",x:230,y:140},{name:"Hải Phòng",x:260,y:150},{name:"Bắc Ninh",x:240,y:130},
    {name:"TP.HCM",x:220,y:420},{name:"Bình Dương",x:210,y:400},{name:"Đà Nẵng",x:230,y:280},
    {name:"Huế",x:220,y:255},{name:"Cần Thơ",x:200,y:440},{name:"Đồng Nai",x:240,y:415},
    {name:"Hưng Yên",x:245,y:155},
  ].map(p => {
    const real = mapDataArray.find(md => md.province_name === p.name);
    return { ...p, aqi: real ? Math.round(real.aqi) : 0 };
  });

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      <TabFilterBar showDateRange showProvince showMetric />
      {/* Map + Detail */}
      <section>
        <SectionHeader title="Bản đồ Chất lượng Không khí" sub="Nhấp vào tỉnh để xem chi tiết"/>
        <div className="responsive-grid grid-cols-2" style={{gap: 20}}>
          {/* Leaflet Map */}
          <div style={{...glassCard,padding:0, position:"relative", overflow:"hidden", height: 460}}>
             <VietnamMap onProvinceClick={(name) => {
               const p = mapDataArray.find(x => x.province_name === name);
               if (p) setProvinces([{ id: p.province_id, name: p.province_name }]);
             }} />
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
                <span style={{background:`${aqiColor(s.aqi)}22`,border:`1px solid ${aqiColor(s.aqi)}44`,borderRadius:6,padding:"2px 10px",fontSize: 14,color:aqiColor(s.aqi)}}>{AQI_LABELS[Math.min(s.aqi_level||0, 5)]}</span>
              </div>
            </div>
            <div className="responsive-grid grid-cols-3" style={{gap: 10, marginBottom: 16}}>
              {[
                {label:"PM2.5",val:`${s.pm2_5?.toFixed(1)||'--'} µg/m³`,color:C.sky},
                {label:"PM10",val:`${s.pm10?.toFixed(1)||'--'} µg/m³`,color:C.warning},
                {label:"CO",val:`${s.carbon_monoxide?.toFixed(1)||'--'} mg/m³`,color:C.violet},
                {label:"NO₂",val:`${s.nitrogen_dioxide?.toFixed(1)||'--'} µg/m³`,color:"#f97316"},
                {label:"SO₂",val:`${s.sulphur_dioxide?.toFixed(1)||'--'} µg/m³`,color:C.success},
                {label:"O₃",val:`${s.ozone?.toFixed(1)||'--'} µg/m³`,color:"#a3e635"},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px",border:`1px solid ${C.border}`}}>
                  <p style={{color:C.muted,fontSize: 13,margin:"0 0 4px",...headFont}}>{label}</p>
                  <p style={{color,fontSize: 16,fontWeight:700,margin:0,...monoFont}}>{val}</p>
                </div>
              ))}
            </div>
            <p style={{color:C.muted,fontSize: 14,marginBottom:8,...headFont}}>
              Xu hướng PM2.5 — {startDate === endDate ? '24h' : 'Kỳ báo cáo'}
            </p>
            <ResponsiveContainer width="100%" height={100}>
              {isTrendDetailLoading ? (
                <div style={{color: C.muted, textAlign: 'center', marginTop: 40, fontSize: 14}}>Loading...</div>
              ) : (
                <AreaChart data={realHourlyData} margin={{top:0,right:0,bottom:0,left:-30}}>
                  <defs>
                    <linearGradient id="provGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.sky} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={C.sky} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="h" tick={{fill:C.muted,fontSize: 12}} axisLine={false} tickLine={false} interval={Math.floor(realHourlyData.length / 6) || 1}/>
                  <YAxis hide/>
                  <Tooltip content={<DarkTooltip/>} cursor={{fill: "rgba(255,255,255,0.02)"}}/>
                  <Area type="monotone" dataKey="pm25" stroke={C.sky} strokeWidth={2} fill="url(#provGrad)" dot={false} name="PM2.5"/>
                </AreaChart>
              )}
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
                  <th key={h} style={{color:C.muted,fontSize: 13,fontWeight:600,padding:"12px 16px",textAlign:"left",...headFont}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapDataArray.length > 0 ? [...mapDataArray].sort((a,b)=>b.aqi-a.aqi).slice(0, 15).map((p,i)=>(
                <tr key={i} style={{borderBottom:`1px solid rgba(255,255,255,0.03)`,transition:"background 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(56,189,248,0.04)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={{padding:"10px 16px",color:C.muted,fontSize: 14,...monoFont}}>{i+1}</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize: 15,...headFont}}>{p.province_name}</td>
                  <td style={{padding:"10px 16px"}}>
                    <span style={{background:`${aqiColor(p.aqi)}18`,color:aqiColor(p.aqi),borderRadius:6,padding:"3px 10px",fontSize: 14,fontWeight:700,...monoFont}}>{Math.round(p.aqi)}</span>
                  </td>
                  <td style={{padding:"10px 16px",color:aqiColor(p.aqi),fontSize: 14,...headFont}}>{AQI_LABELS[Math.min(p.aqi_level||0, 5)]}</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize: 14,...monoFont}}>{p.pm2_5?.toFixed(1) || '--'} µg/m³</td>
                  <td style={{padding:"10px 16px",color:C.text,fontSize: 14,...monoFont}}>{p.pm10?.toFixed(1) || '--'} µg/m³</td>
                  <td style={{padding:"10px 16px",color:C.muted,fontSize: 13,...headFont}}>{p.time ? new Date(p.time).toLocaleTimeString('vi-VN') : '--'}</td>
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
        <div className="responsive-grid grid-cols-2">
          <div style={{...glassCard}}>
            <SectionHeader title="So sánh 3 miền (Hiện tại)"/>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionalData} margin={{top:10,right:20,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="region" tick={{fill:C.muted,fontSize: 14}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize: 13}} axisLine={false} tickLine={false}/>
                <Tooltip content={<DarkTooltip/>} cursor={{fill: "rgba(255,255,255,0.02)"}}/>
                <Bar dataKey="pm25" name="PM2.5" fill={C.sky} radius={[4,4,0,0]} barSize={18}/>
                <Bar dataKey="pm10" name="PM10" fill={C.violet} radius={[4,4,0,0]} barSize={18}/>
                <Bar dataKey="o3" name="O₃" fill={C.success} radius={[4,4,0,0]} barSize={18}/>
              </BarChart>
            </ResponsiveContainer>
            <div style={{display:"flex",gap:16,marginTop:8}}>
              {[{c:C.sky,l:"PM2.5"},{c:C.violet,l:"PM10"},{c:C.success,l:"O₃"}].map(({c,l})=>(
                <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize: 13,color:C.muted}}>
                  <span style={{width:10,height:10,borderRadius:2,background:c,display:"inline-block"}}/>
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div style={{...glassCard}}>
            <SectionHeader title={`Thành phần ô nhiễm: ${s.province_name}`}/>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pollutantData} margin={{top:10,right:20,bottom:0,left:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="name" tick={{fill:C.muted,fontSize: 14}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.muted,fontSize: 13}} axisLine={false} tickLine={false}/>
                <Tooltip content={<DarkTooltip/>} cursor={{fill: "rgba(255,255,255,0.02)"}}/>
                <Bar dataKey="value" radius={[4,4,0,0]} barSize={24}>
                  {pollutantData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Hourly polar simulation via bar */}
      <section>
        <SectionHeader title={startDate === endDate ? "Xu hướng PM2.5 theo giờ hôm nay" : "Xu hướng PM2.5 trong kỳ"}/>
        <div style={{...glassCard}}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={realHourlyData.length > 0 ? realHourlyData : []} margin={{top:10,right:20,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="h" tick={{fill:C.muted,fontSize: 12}} axisLine={false} tickLine={false} interval={Math.floor((realHourlyData.length || 24) / 10) || 1}/>
              <YAxis tick={{fill:C.muted,fontSize: 13}} axisLine={false} tickLine={false}/>
              <Tooltip content={<DarkTooltip/>} cursor={{fill: "rgba(255,255,255,0.02)"}}/>
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
