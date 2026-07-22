import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, analyticsApi } from './api/dashboard';
import { useFilterStore } from './store/filterStore';
import {
  C, provinces, monoFont, headFont, TABS
} from './utils/dashboardConstants';
import OverviewTab from './components/tabs/OverviewTab';
import MapTab from './components/tabs/MapTab';
import AnalysisTab from './components/tabs/AnalysisTab';
import CompareTab from './components/tabs/CompareTab';
import AlertsTab from './components/tabs/AlertsTab';
import AboutTab from './components/tabs/AboutTab';

import ChatBox from './components/ai/ChatBox';

export default function AirVizDashboard() {
  const [tab, setTab] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [theme, setTheme] = useState('dark');
  const { startDate, endDate, setDateRange } = useFilterStore();

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const LiveClock = () => (
    <span style={{ fontSize: 13, color: C.muted, ...monoFont }}>
      {time.toLocaleTimeString('vi-VN')}
    </span>
  );

  const tabContent = [<OverviewTab/>,<MapTab/>,<AnalysisTab/>,<CompareTab/>,<AlertsTab/>,<AboutTab/>];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'Inter',sans-serif",position:"relative"}}>
      {/* Dot grid background */}
      <div style={{position:"fixed",inset:0,backgroundImage:"radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px)",backgroundSize:"28px 28px",pointerEvents:"none",zIndex:0}}/>

      {/* Navbar */}
      <nav style={{
        position:"sticky",top:0,zIndex:50,
        background: theme === 'dark' ? "rgba(5,10,20,0.9)" : "rgba(255,255,255,0.9)",
        backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.border}`,
        padding:"0 32px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"
      }}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:20,background:`linear-gradient(135deg,${C.sky},${C.violet})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontWeight:800}}>◈ AirViz.AI</span>
        </div>
        <div style={{display:"flex",gap:4}}>
          {TABS.map((t,i)=>(
            <button key={i} onClick={()=>setTab(i)}
              style={{
                background:tab===i?`rgba(56,189,248,0.12)`:"transparent",
                border:`1px solid ${tab===i?C.sky:"transparent"}`,
                borderRadius:8,padding:"6px 16px",
                color:tab===i?C.sky:C.muted,fontSize:14, fontWeight: tab===i ? 600 : 500,
                cursor:"pointer",transition:"all 0.2s",...headFont
              }}>
              {t}
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          
          <div style={{display: "flex", gap: 12, alignItems: 'center'}}>
            {/* Search Bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              borderRadius: 20, padding: '6px 16px',
              border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
            }}>
              <span style={{color: C.muted, fontSize: 14}}>🔍</span>
              <input 
                placeholder="Ctrl+K để tìm..."
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: C.text, fontSize: 13, width: 120, ...monoFont
                }}
              />
            </div>
            
            {/* Action Buttons */}
            <div style={{display: 'flex', gap: 8}}>
              {/* Theme Toggle */}
              <button 
                onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: 'none', color: theme === 'dark' ? '#fbbf24' : '#f59e0b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, cursor: 'pointer', transition: 'all 0.2s'
                }}
                title="Đổi giao diện"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
              
              {/* Notification Icon */}
              <button 
                style={{
                  width: 36, height: 36, borderRadius: '50%', position: 'relative',
                  background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: 'none', color: C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', transition: 'all 0.2s'
                }} 
                title="Thông báo"
              >
                🔔
                <span style={{position: 'absolute', top: 8, right: 8, width: 6, height: 6, background: C.danger, borderRadius: '50%'}}></span>
              </button>
              
              {/* Settings Icon */}
              <button 
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  border: 'none', color: C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, cursor: 'pointer', transition: 'all 0.2s'
                }} 
                title="Cài đặt"
              >
                ⚙️
              </button>
            </div>
          </div>

          <div style={{width: 1, height: 24, background: C.border, margin: '0 4px'}} />

          <LiveClock/>
          <span style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.success,...headFont}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:C.success,animation:"pulse 2s infinite",display:"inline-block"}}/>
            LIVE
          </span>
        </div>
      </nav>



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

      {chatOpen && <ChatBox onClose={() => setChatOpen(false)} />}

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
