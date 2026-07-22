import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ScatterChart, Scatter,
  ReferenceLine, Legend, ComposedChart
} from "recharts";
// ─── COLORS ───────────────────────────────────────────────────────────────────
export const C = {
  bg: "var(--bg)",
  card: "var(--card)",
  sky: "#38bdf8",
  violet: "#a78bfa",
  danger: "#f87171",
  success: "#34d399",
  warning: "#fbbf24",
  text: "var(--text)",
  muted: "var(--muted)",
  border: "var(--border)",
  emerald: "#10b981",
};

export const AQI_COLORS = ["#10b981", "#eab308", "#f97316", "#ef4444", "#a855f7", "#881337"];
export const AQI_LABELS = ["Tốt","Trung bình","Kém","Xấu","Rất xấu","Nguy hiểm"];

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────

export const provinces = [
  // Miền Bắc (25)
  { name: "Hà Nội", region: "Bắc" }, { name: "Hải Phòng", region: "Bắc" }, { name: "Bắc Ninh", region: "Bắc" }, { name: "Hưng Yên", region: "Bắc" }, { name: "Hải Dương", region: "Bắc" }, { name: "Hà Nam", region: "Bắc" }, { name: "Nam Định", region: "Bắc" }, { name: "Thái Bình", region: "Bắc" }, { name: "Ninh Bình", region: "Bắc" }, { name: "Vĩnh Phúc", region: "Bắc" }, { name: "Hà Giang", region: "Bắc" }, { name: "Cao Bằng", region: "Bắc" }, { name: "Bắc Kạn", region: "Bắc" }, { name: "Lạng Sơn", region: "Bắc" }, { name: "Tuyên Quang", region: "Bắc" }, { name: "Thái Nguyên", region: "Bắc" }, { name: "Phú Thọ", region: "Bắc" }, { name: "Bắc Giang", region: "Bắc" }, { name: "Quảng Ninh", region: "Bắc" }, { name: "Lào Cai", region: "Bắc" }, { name: "Yên Bái", region: "Bắc" }, { name: "Điện Biên", region: "Bắc" }, { name: "Hoà Bình", region: "Bắc" }, { name: "Lai Châu", region: "Bắc" }, { name: "Sơn La", region: "Bắc" },
  // Miền Trung (19)
  { name: "Thanh Hóa", region: "Trung" }, { name: "Nghệ An", region: "Trung" }, { name: "Hà Tĩnh", region: "Trung" }, { name: "Quảng Bình", region: "Trung" }, { name: "Quảng Trị", region: "Trung" }, { name: "Thừa Thiên Huế", region: "Trung" }, { name: "Đà Nẵng", region: "Trung" }, { name: "Quảng Nam", region: "Trung" }, { name: "Quảng Ngãi", region: "Trung" }, { name: "Bình Định", region: "Trung" }, { name: "Phú Yên", region: "Trung" }, { name: "Khánh Hòa", region: "Trung" }, { name: "Ninh Thuận", region: "Trung" }, { name: "Bình Thuận", region: "Trung" }, { name: "Kon Tum", region: "Trung" }, { name: "Gia Lai", region: "Trung" }, { name: "Đắk Lắk", region: "Trung" }, { name: "Đắk Nông", region: "Trung" }, { name: "Lâm Đồng", region: "Trung" },
  // Miền Nam (19)
  { name: "TP.HCM", region: "Nam" }, { name: "Thành phố Hồ Chí Minh", region: "Nam" }, { name: "Cần Thơ", region: "Nam" }, { name: "Bình Phước", region: "Nam" }, { name: "Tây Ninh", region: "Nam" }, { name: "Bình Dương", region: "Nam" }, { name: "Đồng Nai", region: "Nam" }, { name: "Bà Rịa - Vũng Tàu", region: "Nam" }, { name: "Long An", region: "Nam" }, { name: "Đồng Tháp", region: "Nam" }, { name: "Tiền Giang", region: "Nam" }, { name: "An Giang", region: "Nam" }, { name: "Bến Tre", region: "Nam" }, { name: "Vĩnh Long", region: "Nam" }, { name: "Trà Vinh", region: "Nam" }, { name: "Hậu Giang", region: "Nam" }, { name: "Kiên Giang", region: "Nam" }, { name: "Sóc Trăng", region: "Nam" }, { name: "Bạc Liêu", region: "Nam" }, { name: "Cà Mau", region: "Nam" }
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export const aqiColor = (v) => {
  if(v<=50) return AQI_COLORS[0];
  if(v<=100) return AQI_COLORS[1];
  if(v<=150) return AQI_COLORS[2];
  if(v<=200) return AQI_COLORS[3];
  if(v<=300) return AQI_COLORS[4];
  return AQI_COLORS[5];
};

export const glassCard = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: "20px 24px",
};

export const monoFont = {fontFamily:"'JetBrains Mono',monospace"};
export const headFont = {fontFamily:"'Inter',sans-serif"};

export const chartDefaults = {
  background:"transparent",
  gridColor:"rgba(255,255,255,0.04)",
  axisColor: C.muted,
  tooltipBg: "#0d1626",
  tooltipBorder: "rgba(56,189,248,0.25)",
};

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
export const DarkTooltip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize: 14,color:C.text,...monoFont}}>
      <p style={{color:C.muted,marginBottom:4}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color||C.sky,margin:"2px 0"}}>{p.name}: <strong>{typeof p.value==="number"?p.value.toFixed(1):p.value}</strong></p>
      ))}
    </div>
  );
};

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
export const Sparkline = ({data,color=C.sky,height=40}) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{top:2,right:0,bottom:0,left:0}}>
      <defs>
        <linearGradient id={`sg${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
          <stop offset="95%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="aqi" stroke={color} strokeWidth={1.5} fill={`url(#sg${color.replace("#","")})`} dot={false}/>
    </AreaChart>
  </ResponsiveContainer>
);

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
export const KPICard = ({label,value,unit,color,sparkData,icon}) => (
  <div style={{...glassCard, position:"relative", overflow:"hidden", transition:"box-shadow 0.3s"}}
    onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 24px ${color}22`}
    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
      <p style={{color:C.muted,fontSize: 14,margin:0,...headFont}}>{label}</p>
      <span style={{fontSize:18}}>{icon}</span>
    </div>
    <p style={{fontSize:32,fontWeight:700,color,margin:"4px 0 8px",...monoFont}}>{value}<span style={{fontSize: 16,color:C.muted,fontWeight:400}}> {unit}</span></p>
    {sparkData && <Sparkline data={sparkData} color={color}/>}
  </div>
);

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
export const SectionHeader = ({title,sub,children}) => (
  <div style={{marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
    <div>
      <h3 style={{color:C.text,fontSize:18,fontWeight:700,margin:"0 0 4px",...headFont}}>{title}</h3>
      <p style={{color:C.muted,fontSize: 15,margin:0,...headFont}}>{sub}</p>
    </div>
    {children && <div>{children}</div>}
  </div>
);

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
// ChatPanel đã được chuyển sang components/ai/ChatBox.jsx
// Export null để tránh lỗi import nếu còn code cũ tham chiếu.
export const ChatPanel = null;

// ─── TABS ─────────────────────────────────────────────────────────────────────
export const TABS = ["∷ Tổng quan","⬡ Bản đồ","∿ Phân tích","⟺ So sánh","⚡ Cảnh báo","ℹ Giới thiệu"];

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
