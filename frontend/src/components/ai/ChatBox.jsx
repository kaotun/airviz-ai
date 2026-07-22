// src/components/ai/ChatBox.jsx
// AI Chatbox hoàn chỉnh — kết nối Backend Gemini Text2SQL thật
// Thay thế ChatPanel placeholder cũ trong dashboardConstants.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFilterStore } from '../../store/filterStore';
import { aiApi } from '../../api/dashboard';
import { C, headFont, monoFont } from '../../utils/dashboardConstants';
import ChatMessage, { TypingIndicator } from './ChatMessage';
import ApprovalPanel from './ApprovalPanel';

// ── Quick prompts chip suggestions ─────────────────────────────────────────────
const QUICK_PROMPTS = [
  'PM2.5 cao nhất hôm nay?',
  'Top 5 tỉnh ô nhiễm nhất?',
  'AQI Hà Nội tuần này?',
  'So sánh Hà Nội và TP.HCM?',
  'Bất thường gần đây?',
];

// ── Helper: tạo session_id duy nhất mỗi lần mở trang ──────────────────────────
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const formatTime = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// ── Welcome message ─────────────────────────────────────────────────────────────
const WELCOME = {
  id: 'welcome',
  role: 'ai',
  text: '✦ Xin chào! Tôi là **AirViz AI**, trợ lý phân tích chất lượng không khí.\n\nHỏi tôi về dữ liệu AQI, PM2.5, xu hướng ô nhiễm hoặc so sánh các tỉnh. Tôi sẽ truy vấn trực tiếp từ cơ sở dữ liệu và trả về kết quả thực tế!',
  time: formatTime(),
};

// ── ChatBox Component ───────────────────────────────────────────────────────────
const ChatBox = ({ onClose }) => {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(null); // { logId, sql }
  const [isExecuting, setIsExecuting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Lấy context dashboard hiện tại từ Zustand store
  const { selectedProvinceId, selectedProvinceName, selectedMetric, startDate, endDate } = useFilterStore();
  const dashboardContext = {
    province_id: selectedProvinceId,
    province_name: selectedProvinceName,
    metric: selectedMetric,
    start_date: startDate,
    end_date: endDate,
  };

  // Auto scroll xuống tin nhắn mới nhất
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingApproval, isLoading]);

  // Focus input khi mở chat
  useEffect(() => {
    if (!isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isMinimized]);

  // ── Gửi tin nhắn ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: text.trim(),
      time: formatTime(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setPendingApproval(null); // reset approval cũ nếu có

    try {
      const data = await aiApi.chat({
        message: text.trim(),
        session_id: SESSION_ID,
        context: dashboardContext,
      });

      const aiMsg = {
        id: Date.now() + 1,
        role: 'ai',
        text: data.response,
        time: formatTime(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Nếu cần approval → hiển thị ApprovalPanel
      if (data.needs_approval && data.generated_sql) {
        setPendingApproval({
          logId: data.log_id,
          sql: data.generated_sql,
        });
      }
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'ai',
        text: '✦ Xin lỗi, không thể kết nối với AI lúc này. Vui lòng kiểm tra backend và thử lại.',
        time: formatTime(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, dashboardContext]);

  // ── Approve SQL → thực thi ────────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!pendingApproval || isExecuting) return;
    setIsExecuting(true);

    try {
      const result = await aiApi.execute({ log_id: pendingApproval.logId });
      setPendingApproval(null);

      if (result.error) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'ai',
          text: `✦ Truy vấn thực thi nhưng gặp lỗi:`,
          time: formatTime(),
          queryResult: result,
        }]);
      } else {
        const summary = result.row_count === 0
          ? '✦ Truy vấn thành công nhưng không có dữ liệu nào phù hợp với điều kiện lọc.'
          : `✦ Đã lấy được **${result.row_count} dòng** kết quả từ cơ sở dữ liệu.${result.truncated ? ' *(Bị giới hạn tối đa 500 dòng)*' : ''}`;

        setMessages(prev => [...prev, {
          id: Date.now(),
          role: 'ai',
          text: summary,
          time: formatTime(),
          queryResult: result,
        }]);
      }
    } catch (err) {
      setPendingApproval(null);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'ai',
        text: '✦ Không thể thực thi truy vấn. Vui lòng thử lại hoặc hỏi theo cách khác.',
        time: formatTime(),
      }]);
    } finally {
      setIsExecuting(false);
    }
  }, [pendingApproval, isExecuting]);

  // ── Reject SQL ────────────────────────────────────────────────────────────────
  const handleReject = useCallback(() => {
    setPendingApproval(null);
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'ai',
      text: '✦ Đã hủy truy vấn. Bạn có muốn thử hỏi theo cách khác không?',
      time: formatTime(),
    }]);
  }, []);

  // ── Keyboard handler ──────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed',
      bottom: 100, right: 28,
      width: 400,
      height: isMinimized ? 56 : 560,
      background: C.card,
      border: `1px solid rgba(56,189,248,0.25)`,
      borderRadius: isMinimized ? 16 : '20px 20px 6px 6px',
      display: 'flex', flexDirection: 'column',
      zIndex: 1000,
      backdropFilter: 'blur(24px)',
      boxShadow: '0 -8px 50px rgba(56,189,248,0.12), 0 4px 20px rgba(0,0,0,0.4)',
      transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 18px',
        borderBottom: isMinimized ? 'none' : `1px solid rgba(56,189,248,0.1)`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Status dot */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isLoading ? C.warning : C.success,
              animation: 'pulse 2s infinite',
            }} />
            <div>
              <p style={{
                margin: 0, fontSize: 16, fontWeight: 700,
                background: `linear-gradient(90deg, ${C.sky}, ${C.violet})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                ...headFont,
              }}>✦ AirViz AI</p>
              {!isMinimized && (
                <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
                  {isLoading ? 'Đang phân tích...' : 'Trợ lý phân tích dữ liệu'}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setIsMinimized(m => !m)}
              title={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}
              style={{
                background: 'none', border: 'none', color: C.muted,
                cursor: 'pointer', fontSize: 16, padding: '2px 6px',
                lineHeight: 1,
              }}
            >
              {isMinimized ? '□' : '─'}
            </button>
            <button
              onClick={onClose}
              title="Đóng"
              style={{
                background: 'none', border: 'none', color: C.muted,
                cursor: 'pointer', fontSize: 18, padding: '2px 6px',
                lineHeight: 1,
              }}
            >×</button>
          </div>
        </div>
        {/* Gradient divider */}
        {!isMinimized && (
          <div style={{
            height: 1,
            background: `linear-gradient(90deg, ${C.sky}40, ${C.violet}40, transparent)`,
            marginTop: 12,
          }} />
        )}
      </div>

      {/* ── Messages Area ── */}
      {!isMinimized && (
        <div style={{
          flex: 1, overflowY: 'auto', padding: '14px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* SQL Approval Panel */}
          {pendingApproval && (
            <ApprovalPanel
              sql={pendingApproval.sql}
              logId={pendingApproval.logId}
              onApprove={handleApprove}
              onReject={handleReject}
              isExecuting={isExecuting}
            />
          )}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}

          <div ref={endRef} />
        </div>
      )}

      {/* ── Quick Prompts ── */}
      {!isMinimized && (
        <div style={{
          padding: '8px 14px 0', flexShrink: 0,
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          {QUICK_PROMPTS.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              style={{
                background: 'rgba(56,189,248,0.08)',
                border: `1px solid rgba(56,189,248,0.15)`,
                borderRadius: 20, color: C.sky, fontSize: 14,
                padding: '8px 14px', cursor: isLoading ? 'not-allowed' : 'pointer',
                ...headFont, transition: 'all 0.15s', opacity: isLoading ? 0.5 : 1,
              }}
              onMouseEnter={e => !isLoading && (e.target.style.background = 'rgba(56,189,248,0.15)')}
              onMouseLeave={e => (e.target.style.background = 'rgba(56,189,248,0.07)')}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Input Area ── */}
      {!isMinimized && (
        <div style={{
          padding: '10px 14px 14px',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi về dữ liệu không khí..."
            disabled={isLoading}
            style={{
              flex: 1, background: 'transparent',
              border: `1px solid ${input ? C.sky : C.border}`,
              borderRadius: 12, padding: '10px 14px',
              color: C.text, fontSize: 18, outline: 'none',
              transition: 'border-color 0.2s', ...headFont,
              opacity: isLoading ? 0.7 : 1,
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            title="Gửi (Enter)"
            style={{
              background: input.trim() && !isLoading
                ? `linear-gradient(135deg, ${C.sky}, ${C.violet})`
                : 'rgba(56,189,248,0.15)',
              border: 'none', borderRadius: 10,
              width: 38, height: 38, cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16, flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            ↑
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatBox;
