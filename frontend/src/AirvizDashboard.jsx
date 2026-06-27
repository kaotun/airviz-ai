import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ScatterChart, Scatter,
  ReferenceLine, Legend, ComposedChart
} from "recharts";
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, analyticsApi } from './api/dashboard';
import { useFilterStore } from './store/filterStore';

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
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

const AQI_COLORS = ["#34d399","#a3e635","#fbbf24","#f97316","#f87171","#dc2626"];
const AQI_LABELS = ["Tốt","Trung bình","Kém","Xấu","Rất xấu","Nguy hiểm"];

// ─── SAMPLE DATA ──────────────────────────────────────────────────────────────
const generate30Days = () => Array.from({length:30},(_,i)=>({
  day: `T${i+1}`,
  aqi: Math.round(55+Math.sin(i*0.4)*18+Math.random()*12),
  pm25: Math.round(20+Math.sin(i*0.3)*8+Math.random()*6),
}));

const hourlyData = Array.from({length:24},(_,i)=>({
  h: `${i}h`,
  pm25: Math.round(15+Math.sin((i-6)*0.5)*12+Math.random()*5),
  o3: Math.round(40+Math.sin((i-12)*0.4)*20+Math.random()*8),
  no2: Math.round(30+Math.sin((i-7)*0.6)*15+Math.random()*7),
}));

const provinces = [
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

const compareData = Array.from({length:30},(_,i)=>({
  day: `T${i+1}`,
  hanoi: Math.round(70+Math.sin(i*0.4)*15+Math.random()*10),
  hcm: Math.round(58+Math.sin(i*0.35)*12+Math.random()*8),
  danang: Math.round(30+Math.sin(i*0.5)*8+Math.random()*5),
}));

const heatmapData = (() => {
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

const alertsData = [
  {time:"27/06 08:30",province:"Hà Nội",metric:"PM2.5",value:89,zscore:3.82,level:"Rất cao"},
  {time:"27/06 06:15",province:"Bắc Ninh",metric:"NO₂",value:68,zscore:3.21,level:"Cao"},
  {time:"26/06 22:00",province:"Hải Phòng",metric:"PM10",value:112,zscore:2.95,level:"Cao"},
  {time:"26/06 17:45",province:"TP.HCM",metric:"O₃",value:145,zscore:2.71,level:"Cao"},
  {time:"26/06 14:20",province:"Hà Nội",metric:"CO",value:12.4,zscore:3.44,level:"Rất cao"},
  {time:"25/06 09:00",province:"Bình Dương",metric:"SO₂",value:34,zscore:2.58,level:"Cao"},
];

const correlationData = {
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

const radarData = [
  {metric:"PM2.5",hanoi:88,hcm:65,danang:35},
  {metric:"PM10",hanoi:75,hcm:58,danang:40},
  {metric:"CO",hanoi:70,hcm:55,danang:30},
  {metric:"NO₂",hanoi:80,hcm:60,danang:25},
  {metric:"SO₂",hanoi:65,hcm:50,danang:20},
  {metric:"O₃",hanoi:45,hcm:55,danang:60},
];

const weekHeatmap = (() => {
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

const zscore30 = Array.from({length:30},(_,i)=>({
  day:`T${i+1}`,
  z:+(1.2+Math.sin(i*0.4)*1.5+Math.random()*0.8).toFixed(2),
}));

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const aqiColor = (v) => {
  if(v<=50) return C.success;
  if(v<=100) return "#a3e635";
  if(v<=150) return C.warning;
  if(v<=200) return "#f97316";
  if(v<=300) return C.danger;
  return "#dc2626";
};

const glassCard = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: "20px 24px",
};

const monoFont = {fontFamily:"'JetBrains Mono',monospace"};
const headFont = {fontFamily:"'Space Grotesk',sans-serif"};

const chartDefaults = {
  background:"transparent",
  gridColor:"rgba(255,255,255,0.04)",
  axisColor: C.muted,
  tooltipBg: "#0d1626",
  tooltipBorder: "rgba(56,189,248,0.25)",
};

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
const DarkTooltip = ({active,payload,label}) => {
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
const Sparkline = ({data,color=C.sky,height=40}) => (
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
const KPICard = ({label,value,unit,color,sparkData,icon}) => (
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
const SectionHeader = ({title,sub}) => (
  <div style={{marginBottom:20}}>
    <h2 style={{color:C.text,fontSize:18,fontWeight:700,margin:0,...headFont}}>{title}</h2>
    {sub&&<p style={{color:C.muted,fontSize:12,margin:"4px 0 0",...monoFont}}>{sub}</p>}
  </div>
);

// ─── CHAT PANEL ───────────────────────────────────────────────────────────────
const chatHistory = [
  {role:"ai", text:"✦ Xin chào! Tôi là AirViz AI. Hỏi tôi về chất lượng không khí tại bất kỳ tỉnh nào.", time:"08:00"},
  {role:"user", text:"PM2.5 ở Hà Nội tuần này cao hơn bình thường không?", time:"08:01"},
  {role:"ai", text:"✦ Có, PM2.5 trung bình tuần này tại Hà Nội là 34.2 µg/m³, cao hơn 28% so với trung bình 30 ngày (26.7 µg/m³). Ghi nhận 3 đỉnh bất thường vào ngày 23, 25 và 27/06.", time:"08:01", hasChart:true},
  {role:"user", text:"So sánh với TP.HCM?", time:"08:02"},
  {role:"ai", text:"✦ TP.HCM tuần này trung bình 21.4 µg/m³ — thấp hơn Hà Nội 37.6%. Cả hai đều dưới ngưỡng WHO (25 µg/m³) ngoại trừ 2 giờ cao điểm tại Hà Nội.", time:"08:02", hasCompare:true},
];

const miniBarData = [
  {d:"T2",v:28},{d:"T3",v:31},{d:"T4",v:34},{d:"T5",v:29},{d:"T6",v:38},{d:"T7",v:35},{d:"CN",v:34}
];
const miniCompareData = [
  {d:"T2",hn:28,hcm:20},{d:"T3",hn:31,hcm:22},{d:"T4",hn:34,hcm:19},{d:"T5",hn:29,hcm:21},{d:"T6",hn:38,hcm:24},{d:"T7",hn:35,hcm:21},{d:"CN",hn:34,hcm:22}
];

const ChatPanel = ({onClose}) => {
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
const TABS = ["∷ Overview","⬡ Map","∿ Analysis","⟺ Compare","⚡ Alerts"];

// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────
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
          {/* SVG Map */}
          <div style={{...glassCard,padding:16}}>
            <svg viewBox="0 0 340 550" style={{width:"100%",height:460}}>
              {/* Vietnam simplified shape */}
              <path d="M200,20 Q240,30 260,60 Q280,90 270,120 Q280,150 270,180 Q280,220 260,260 Q270,300 250,330 Q260,360 240,390 Q250,420 230,450 Q220,480 200,500 Q180,480 170,450 Q150,420 160,390 Q140,360 150,330 Q130,300 140,260 Q120,220 130,180 Q120,150 130,120 Q120,90 140,60 Q160,30 200,20Z"
                fill="rgba(56,189,248,0.04)" stroke="rgba(56,189,248,0.2)" strokeWidth={1}/>
              {vnProvinces.map(p=>(
                <g key={p.name} onClick={()=>setSelectedName(p.name)} style={{cursor:"pointer"}}>
                  <circle cx={p.x} cy={p.y} r={selectedName===p.name?14:10} fill={aqiColor(p.aqi)} fillOpacity={0.8} stroke={selectedName===p.name?C.sky:"rgba(255,255,255,0.2)"} strokeWidth={selectedName===p.name?2:0.5}/>
                  <text x={p.x} y={p.y+4} textAnchor="middle" fontSize={7} fill="#fff" fontWeight="bold">{p.aqi || '--'}</text>
                  {selectedName===p.name&&(
                    <text x={p.x} y={p.y+22} textAnchor="middle" fontSize={9} fill={C.sky}>{p.name}</text>
                  )}
                </g>
              ))}
              {/* Legend */}
              <g transform="translate(10,460)">
                {AQI_COLORS.map((c,i)=>(
                  <g key={i} transform={`translate(${i*50},0)`}>
                    <rect width={14} height={10} rx={2} fill={c}/>
                    <text x={16} y={9} fontSize={8} fill={C.muted}>{AQI_LABELS[i].slice(0,3)}</text>
                  </g>
                ))}
              </g>
            </svg>
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

// ─── COMPARE TAB ──────────────────────────────────────────────────────────────
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

// ─── LIVE CLOCK ───────────────────────────────────────────────────────────────
const LiveClock = () => {
  const [time,setTime] = useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(t);},[]);
  return <span style={{...monoFont,fontSize:13,color:C.muted}}>{time.toLocaleTimeString("vi-VN")}</span>;
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AirVizDashboard() {
  const [tab,setTab] = useState(0);
  const [chatOpen,setChatOpen] = useState(false);

  const tabContent = [<OverviewTab/>,<MapTab/>,<AnalysisTab/>,<CompareTab/>,<AlertsTab/>];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Space Grotesk',sans-serif",position:"relative"}}>
      {/* Dot grid background */}
      <div style={{position:"fixed",inset:0,backgroundImage:"radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px)",backgroundSize:"28px 28px",pointerEvents:"none",zIndex:0}}/>

      {/* Navbar */}
      <nav style={{position:"sticky",top:0,zIndex:50,background:"rgba(5,10,20,0.9)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.border}`,padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20,background:`linear-gradient(135deg,${C.sky},${C.violet})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontWeight:800}}>◈ AirViz.AI</span>
        </div>
        <div style={{display:"flex",gap:4}}>
          {TABS.map((t,i)=>(
            <button key={i} onClick={()=>setTab(i)}
              style={{background:tab===i?`rgba(56,189,248,0.12)`:"transparent",border:`1px solid ${tab===i?C.sky:"transparent"}`,borderRadius:8,padding:"6px 16px",color:tab===i?C.sky:C.muted,fontSize:13,cursor:"pointer",transition:"all 0.2s",...headFont}}>
              {t}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <LiveClock/>
          <span style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.success,...headFont}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:C.success,animation:"pulse 2s infinite",display:"inline-block"}}/>
            LIVE
          </span>
        </div>
      </nav>

      {/* Filter strip */}
      <div style={{position:"sticky",top:56,zIndex:40,background:"rgba(5,10,20,0.85)",backdropFilter:"blur(12px)",borderBottom:`1px solid ${C.border}`,padding:"10px 32px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {["Hôm nay","7 ngày","30 ngày","YTD"].map(d=>(
          <button key={d} style={{background:"rgba(56,189,248,0.08)",border:`1px solid rgba(56,189,248,0.15)`,borderRadius:16,padding:"4px 12px",color:C.sky,fontSize:11,cursor:"pointer",...monoFont}}>{d}</button>
        ))}
        <select style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:16,padding:"4px 12px",color:C.text,fontSize:11,outline:"none",...monoFont}}>
          <option>Tất cả tỉnh</option>
          {provinces.map(p=><option key={p.name}>{p.name}</option>)}
        </select>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {["PM2.5","PM10","CO","NO₂","SO₂","O₃","Dust"].map(m=>(
            <span key={m} style={{background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:12,padding:"3px 10px",fontSize:11,color:C.violet,cursor:"pointer",...monoFont}}>{m}</span>
          ))}
        </div>
        <span style={{marginLeft:"auto",color:C.muted,fontSize:11,...monoFont}}>63 tỉnh · 1,372,000 bản ghi</span>
      </div>

      {/* Content */}
      <main style={{padding:"32px",maxWidth:1400,margin:"0 auto",position:"relative",zIndex:1}}>
        {tabContent[tab]}
      </main>

      {/* Chat bubble */}
      <button onClick={()=>setChatOpen(o=>!o)}
        style={{position:"fixed",bottom:28,right:28,width:56,height:56,borderRadius:"50%",background:`linear-gradient(135deg,${C.sky},${C.violet})`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:`0 0 24px rgba(56,189,248,0.3)`,zIndex:999,animation:"chatPulse 3s ease-in-out infinite"}}
        title="Hỏi AirViz AI">
        ✦
      </button>

      {chatOpen&&<ChatPanel onClose={()=>setChatOpen(false)}/>}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes chatPulse { 0%,100%{box-shadow:0 0 24px rgba(56,189,248,0.3)} 50%{box-shadow:0 0 40px rgba(56,189,248,0.5)} }
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,0.02)}
        ::-webkit-scrollbar-thumb{background:rgba(56,189,248,0.2);border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(56,189,248,0.4)}
        *{box-sizing:border-box}
        button:hover{opacity:0.9}
        input:focus{border-color:rgba(56,189,248,0.5)!important}
      `}</style>
    </div>
  );
}
