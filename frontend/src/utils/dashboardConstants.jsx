import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ScatterChart, Scatter,
  ReferenceLine, Legend, ComposedChart
} from "recharts";
// ─── COLORS ───────────────────────────────────────────────────────────────────
export const C = {
  bg: "#050a14",
  card: "#0d1626",
  sky: "#38bdf8",
  violet: "#a78bfa",
  danger: "#f87171",
  success: "#34d399",
  warning: "#fbbf24",
  text: "#e2e8f0",
  muted: "#64748b",
  border: "rgba(99,179,237,0.12)",
  emerald: "#10b981",
};

export const AQI_COLORS = ["#34d399","#a3e635","#fbbf24","#f97316","#f87171","#dc2626"];
export const AQI_LABELS = ["Tốt","Trung bình","Kém","Xấu","Rất xấu","Nguy hiểm"];

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
export const generate30Days = () => Array.from({length:30},(_,i)=>({
  day: `T${i+1}`,
  aqi: Math.round(55+Math.sin(i*0.4)*18+Math.random()*12),
  pm25: Math.round(20+Math.sin(i*0.3)*8+Math.random()*6),
}));

export const hourlyData = Array.from({length:24},(_,i)=>({
  h: `${i}h`,
  pm25: Math.round(15+Math.sin((i-6)*0.5)*12+Math.random()*5),
  o3: Math.round(40+Math.sin((i-12)*0.4)*20+Math.random()*8),
  no2: Math.round(30+Math.sin((i-7)*0.6)*15+Math.random()*7),
}));

export const provinces = [
  {name:"Hà Nội",aqi:78,pm25:34,pm10:55,level:3,region:"Bắc"},
  {name:"Hải Phòng",aqi:72,pm25:30,pm10:50,level:3,region:"Bắc"},
  {name:"Bắc Ninh",aqi:68,pm25:28,pm10:46,level:2,region:"Bắc"},
  {name:"Hưng Yên",aqi:65,pm25:26,pm10:44,level:2,region:"Bắc"},
  {name:"TP.HCM",aqi:65,pm25:24,pm10:40,level:2,region:"Nam"},
  {name:"Bình Dương",aqi:62,pm25:22,pm10:38,level:2,region:"Nam"},
  {name:"Đồng Nai",aqi:58,pm25:20,pm10:35,level:2,region:"Nam"},
  {name:"Đà Nẵng",aqi:34,pm25:12,pm10:22,level:0,region:"Trung"},
  {name:"Huế",aqi:38,pm25:14,pm10:24,level:1,region:"Trung"},
  {name:"Cần Thơ",aqi:45,pm25:16,pm10:28,level:1,region:"Nam"},
];

export const compareData = Array.from({length:30},(_,i)=>({
  day: `T${i+1}`,
  hanoi: Math.round(70+Math.sin(i*0.4)*15+Math.random()*10),
  hcm: Math.round(58+Math.sin(i*0.35)*12+Math.random()*8),
  danang: Math.round(30+Math.sin(i*0.5)*8+Math.random()*5),
}));

export const heatmapData = (() => {
  const d=[];
  const months=["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];
  const baselines=[85,80,72,60,52,38,32,35,42,55,68,78];
  months.forEach((m,mi)=>{
    for(let day=1;day<=31;day++){
      const v=baselines[mi]+Math.round((Math.random()-0.5)*20);
      d.push({month:m,day,aqi:Math.max(10,Math.min(150,v))});
    }
  });
  return d;
})();

export const alertsData = [
  {time:"27/06 08:30",province:"Hà Nội",metric:"PM2.5",value:89,zscore:3.82,level:"Rất cao"},
  {time:"27/06 06:15",province:"Bắc Ninh",metric:"NO₂",value:68,zscore:3.21,level:"Cao"},
  {time:"26/06 22:00",province:"Hải Phòng",metric:"PM10",value:112,zscore:2.95,level:"Cao"},
  {time:"26/06 17:45",province:"TP.HCM",metric:"O₃",value:145,zscore:2.71,level:"Cao"},
  {time:"26/06 14:20",province:"Hà Nội",metric:"CO",value:12.4,zscore:3.44,level:"Rất cao"},
  {time:"25/06 09:00",province:"Bình Dương",metric:"SO₂",value:34,zscore:2.58,level:"Cao"},
];

export const correlationData = {
  vars:["PM2.5","PM10","CO","NO₂","SO₂","O₃","AQI"],
  matrix:[
    [1.00,0.87,0.73,0.68,0.62,-0.31,0.94],
    [0.87,1.00,0.65,0.71,0.58,-0.28,0.89],
    [0.73,0.65,1.00,0.82,0.55,-0.22,0.76],
    [0.68,0.71,0.82,1.00,0.48,-0.19,0.72],
    [0.62,0.58,0.55,0.48,1.00,-0.35,0.65],
    [-0.31,-0.28,-0.22,-0.19,-0.35,1.00,-0.29],
    [0.94,0.89,0.76,0.72,0.65,-0.29,1.00],
  ]
};

export const radarData = [
  {metric:"PM2.5",hanoi:88,hcm:65,danang:35},
  {metric:"PM10",hanoi:75,hcm:58,danang:40},
  {metric:"CO",hanoi:70,hcm:55,danang:30},
  {metric:"NO₂",hanoi:80,hcm:60,danang:25},
  {metric:"SO₂",hanoi:65,hcm:50,danang:20},
  {metric:"O₃",hanoi:45,hcm:55,danang:60},
];

export const weekHeatmap = (() => {
  const days=["T2","T3","T4","T5","T6","T7","CN"];
  const d=[];
  days.forEach((day,di)=>{
    for(let h=0;h<24;h++){
      const rush=(h>=7&&h<=9)||(h>=17&&h<=19);
      const weekday=di<5;
      d.push({day,h,aqi:Math.round(30+(rush?35:0)+(weekday?15:0)+Math.random()*15)});
    }
  });
  return d;
})();

export const zscore30 = Array.from({length:30},(_,i)=>({
  day:`T${i+1}`,
  z:+(1.2+Math.sin(i*0.4)*1.5+Math.random()*0.8).toFixed(2),
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export const aqiColor = (v) => {
  if(v<=50) return C.success;
  if(v<=100) return "#a3e635";
  if(v<=150) return C.warning;
  if(v<=200) return "#f97316";
  if(v<=300) return C.danger;
  return "#dc2626";
};

export const glassCard = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: "20px 24px",
};

export const monoFont = {fontFamily:"'JetBrains Mono',monospace"};
export const headFont = {fontFamily:"'Space Grotesk',sans-serif"};

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
    <div style={{background:"#0d1626",border:`1px solid rgba(56,189,248,0.25)`,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.text,...monoFont}}>
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
      <p style={{color:C.muted,fontSize:12,margin:0,...headFont}}>{label}</p>
      <span style={{fontSize:18}}>{icon}</span>
    </div>
    <p style={{fontSize:32,fontWeight:700,color,margin:"4px 0 8px",...monoFont}}>{value}<span style={{fontSize:14,color:C.muted,fontWeight:400}}> {unit}</span></p>
    <Sparkline data={sparkData||Array.from({length:7},()=>({aqi:Math.round(40+Math.random()*40)}))} color={color}/>
  </div>
);

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
export const SectionHeader = ({title,sub}) => (
  <div style={{marginBottom:20}}>
    <h2 style={{color:C.text,fontSize:18,fontWeight:700,margin:0,...headFont}}>{title}</h2>
    {sub&&<p style={{color:C.muted,fontSize:12,margin:"4px 0 0",...monoFont}}>{sub}</p>}
  </div>
);

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
export const chatHistory = [
  {role:"ai", text:"✦ Xin chào! Tôi là AirViz AI. Hỏi tôi về chất lượng không khí tại bất kỳ tỉnh nào.", time:"08:00"},
  {role:"user", text:"PM2.5 ở Hà Nội tuần này cao hơn bình thường không?", time:"08:01"},
  {role:"ai", text:"✦ Có, PM2.5 trung bình tuần này tại Hà Nội là 34.2 µg/m³, cao hơn 28% so với trung bình 30 ngày (26.7 µg/m³). Ghi nhận 3 đỉnh bất thường vào ngày 23, 25 và 27/06.", time:"08:01", hasChart:true},
  {role:"user", text:"So sánh với TP.HCM?", time:"08:02"},
  {role:"ai", text:"✦ TP.HCM tuần này trung bình 21.4 µg/m³ — thấp hơn Hà Nội 37.6%. Cả hai đều dưới ngưỡng WHO (25 µg/m³) ngoại trừ 2 giờ cao điểm tại Hà Nội.", time:"08:02", hasCompare:true},
];

export const miniBarData = [
  {d:"T2",v:28},{d:"T3",v:31},{d:"T4",v:34},{d:"T5",v:29},{d:"T6",v:38},{d:"T7",v:35},{d:"CN",v:34}
];
export const miniCompareData = [
  {d:"T2",hn:28,hcm:20},{d:"T3",hn:31,hcm:22},{d:"T4",hn:34,hcm:19},{d:"T5",hn:29,hcm:21},{d:"T6",hn:38,hcm:24},{d:"T7",hn:35,hcm:21},{d:"CN",hn:34,hcm:22}
];

export const ChatPanel = ({onClose}) => {
  const [messages,setMessages] = useState(chatHistory);
  const [input,setInput] = useState("");
  const [showApproval,setShowApproval] = useState(false);
  const [pendingQuery,setPendingQuery] = useState("");
  const [isLoading,setIsLoading] = useState(false);
  const endRef = useRef(null);
  const conversationRef = useRef(chatHistory.map(m=>({role:m.role==="ai"?"assistant":"user",content:m.text})));

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[messages,showApproval]);

  const callAPI = async(userMsg) => {
    conversationRef.current.push({role:"user",content:userMsg});
    setIsLoading(true);
    try {
      const sysprompt = `Bạn là AirViz AI, trợ lý phân tích chất lượng không khí tại Việt Nam. Trả lời ngắn gọn bằng tiếng Việt. Bắt đầu mỗi câu trả lời bằng ✦. Dữ liệu mẫu: Hà Nội AQI TB: 78, PM2.5 TB: 34 µg/m³; TP.HCM AQI TB: 65, PM2.5 TB: 24 µg/m³; Đà Nẵng AQI TB: 34, PM2.5 TB: 12 µg/m³. Khi cần truy vấn dữ liệu, hãy đề xuất câu SQL và nói rằng bạn cần chạy truy vấn.`;
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          system:sysprompt,
          messages:conversationRef.current,
        })
      });
      const data = await resp.json();
      const aiText = data.content?.[0]?.text||"✦ Xin lỗi, có lỗi xảy ra.";
      
      if(aiText.toLowerCase().includes("select")||aiText.toLowerCase().includes("sql")) {
        const sqlMatch = aiText.match(/SELECT[\s\S]+?(?:;|$)/i);
        if(sqlMatch) {
          setPendingQuery(sqlMatch[0]);
          setShowApproval(true);
          conversationRef.current.push({role:"assistant",content:aiText});
          setMessages(prev=>[...prev,{role:"ai",text:aiText,time:new Date().toLocaleTimeString("vi",{hour:"2-digit",minute:"2-digit"})}]);
          setIsLoading(false);
          return;
        }
      }
      conversationRef.current.push({role:"assistant",content:aiText});
      setMessages(prev=>[...prev,{role:"ai",text:aiText,time:new Date().toLocaleTimeString("vi",{hour:"2-digit",minute:"2-digit"})}]);
    } catch(e) {
      setMessages(prev=>[...prev,{role:"ai",text:"✦ Xin lỗi, không thể kết nối. Vui lòng thử lại.",time:"--:--"}]);
    }
    setIsLoading(false);
  };

  const send = async() => {
    if(!input.trim()) return;
    const msg = input;
    setInput("");
    setMessages(prev=>[...prev,{role:"user",text:msg,time:new Date().toLocaleTimeString("vi",{hour:"2-digit",minute:"2-digit"})}]);
    await callAPI(msg);
  };

  const quickAsk = (q) => {setInput(q);};

  const approveQuery = async() => {
    setShowApproval(false);
    setMessages(prev=>[...prev,{role:"ai",text:`✦ Đã thực thi truy vấn. Kết quả: Tìm thấy 47 bản ghi bất thường trong 30 ngày qua. Tỉnh nhiều nhất: Hà Nội (8 lần), Hải Phòng (6 lần), Bắc Ninh (5 lần).`,time:new Date().toLocaleTimeString("vi",{hour:"2-digit",minute:"2-digit"})}]);
  };

  return (
    <div style={{position:"fixed",bottom:100,right:28,width:380,height:540,background:"rgba(13,22,38,0.97)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:"20px 20px 4px 4px",display:"flex",flexDirection:"column",zIndex:1000,backdropFilter:"blur(20px)",boxShadow:"0 -8px 40px rgba(56,189,248,0.1)"}}>
      {/* Header */}
      <div style={{padding:"16px 18px 12px",borderBottom:"1px solid rgba(56,189,248,0.1)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{margin:0,fontSize:15,fontWeight:700,background:`linear-gradient(90deg,${C.sky},${C.violet})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",...headFont}}>✦ AirViz AI</p>
            <p style={{margin:0,fontSize:11,color:C.muted}}>Trợ lý phân tích dữ liệu</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:4}}>×</button>
        </div>
        <div style={{height:1,background:`linear-gradient(90deg,${C.sky},${C.violet})`,marginTop:12,opacity:0.5}}/>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
            {m.role==="user"?(
              <div style={{background:`linear-gradient(135deg,${C.sky},${C.violet})`,borderRadius:"16px 16px 4px 16px",padding:"8px 14px",maxWidth:"80%",fontSize:13,color:"#fff",...headFont}}>{m.text}</div>
            ):(
              <div style={{background:"#0a1628",border:`1px solid rgba(56,189,248,0.15)`,borderRadius:"16px 16px 16px 4px",padding:"10px 14px",maxWidth:"90%",fontSize:13,color:C.sky,...headFont}}>
                {m.text}
                {m.hasChart&&(
                  <div style={{marginTop:10,height:70}}>
                    <ResponsiveContainer width="100%" height={70}>
                      <BarChart data={miniBarData} margin={{top:0,right:0,bottom:0,left:-20}}>
                        <XAxis dataKey="d" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                        <Bar dataKey="v" fill={C.sky} radius={[3,3,0,0]}>
                          <Cell key="who" fill={C.warning}/>{/* just color example */}
                        </Bar>
                        <ReferenceLine y={25} stroke={C.warning} strokeDasharray="3 3" strokeWidth={1}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {m.hasCompare&&(
                  <div style={{marginTop:10,height:70}}>
                    <ResponsiveContainer width="100%" height={70}>
                      <LineChart data={miniCompareData} margin={{top:0,right:0,bottom:0,left:-20}}>
                        <XAxis dataKey="d" tick={{fontSize:9,fill:C.muted}} axisLine={false} tickLine={false}/>
                        <Line dataKey="hn" stroke={C.sky} strokeWidth={1.5} dot={false}/>
                        <Line dataKey="hcm" stroke={C.violet} strokeWidth={1.5} dot={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
            <span style={{fontSize:10,color:C.muted,marginTop:2,...monoFont}}>{m.time}</span>
          </div>
        ))}

        {showApproval&&(
          <div style={{border:`1px solid ${C.warning}44`,borderRadius:12,padding:12,background:"rgba(251,191,36,0.05)"}}>
            <p style={{color:C.warning,fontSize:12,margin:"0 0 8px",fontWeight:600}}>⚠️ AI muốn thực thi truy vấn sau:</p>
            <pre style={{background:"#050a14",borderRadius:8,padding:8,fontSize:10,color:"#a3e635",margin:"0 0 10px",overflow:"auto",...monoFont}}>{pendingQuery||"SELECT province, COUNT(*) as anomalies\nFROM air_quality\nWHERE z_score > 2.5\nGROUP BY province\nORDER BY anomalies DESC\nLIMIT 10;"}</pre>
            <p style={{color:C.muted,fontSize:10,margin:"0 0 8px"}}>Kiểm tra truy vấn trước khi cho phép thực thi</p>
            <div style={{display:"flex",gap:8}}>
              <button onClick={approveQuery} style={{flex:1,background:`${C.success}22`,border:`1px solid ${C.success}44`,borderRadius:8,color:C.success,fontSize:12,padding:"6px 0",cursor:"pointer"}}>✓ Cho phép</button>
              <button onClick={()=>setShowApproval(false)} style={{flex:1,background:`${C.danger}22`,border:`1px solid ${C.danger}44`,borderRadius:8,color:C.danger,fontSize:12,padding:"6px 0",cursor:"pointer"}}>✗ Từ chối</button>
            </div>
          </div>
        )}

        {isLoading&&(
          <div style={{display:"flex",alignItems:"center",gap:8,color:C.muted,fontSize:12}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.sky,animation:"pulse 1s infinite"}}/>
            AI đang phân tích...
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Quick chips */}
      <div style={{padding:"8px 14px 0",display:"flex",gap:6,flexWrap:"wrap"}}>
        {["PM2.5 hôm nay","Top tỉnh ô nhiễm","Bất thường gần đây"].map(q=>(
          <button key={q} onClick={()=>quickAsk(q)} style={{background:"rgba(56,189,248,0.08)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:20,color:C.sky,fontSize:11,padding:"4px 10px",cursor:"pointer",...headFont}}>{q}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{padding:"10px 14px 14px",display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Hỏi về dữ liệu không khí..."
          style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(56,189,248,0.2)",borderRadius:12,padding:"8px 12px",color:C.text,fontSize:13,outline:"none",...headFont}}/>
        <button onClick={send} style={{background:`linear-gradient(135deg,${C.sky},${C.violet})`,border:"none",borderRadius:10,width:36,height:36,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16}}>↑</button>
      </div>
    </div>
  );
};

// ─── TABS ─────────────────────────────────────────────────────────────────────
export const TABS = ["∷ Overview","⬡ Map","∿ Analysis","⟺ Compare","⚡ Alerts"];

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
