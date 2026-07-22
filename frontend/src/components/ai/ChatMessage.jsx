// src/components/ai/ChatMessage.jsx
// Render một tin nhắn trong chat với hỗ trợ Markdown và mini ResultTable

import React, { useState } from 'react';
import { C, monoFont, headFont } from '../../utils/dashboardConstants';

// ── Mini Result Table ───────────────────────────────────────────────────────────
const ResultTable = ({ columns, rows, truncated, rowCount }) => {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visibleRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      {/* Header info */}
      <div style={{
        padding: '6px 12px', background: 'rgba(56,189,248,0.06)',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: C.sky, fontSize: 14, ...headFont }}>
          📊 Kết quả: {rowCount} dòng{truncated ? ` (hiển thị ${rows.length})` : ''}
        </span>
        {truncated && (
          <span style={{ color: C.warning, fontSize: 12, ...monoFont }}>
            ⚠ Bị cắt bớt tại {rows.length} dòng
          </span>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: 280 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
              {columns.map(col => (
                <th key={col} style={{
                  padding: '6px 10px', textAlign: 'left',
                  color: C.muted, ...headFont,
                  borderBottom: `1px solid ${C.border}`,
                  whiteSpace: 'nowrap',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={i} style={{
                borderBottom: `1px solid rgba(255,255,255,0.03)`,
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}>
                {columns.map(col => (
                  <td key={col} style={{
                    padding: '5px 10px', color: C.text, ...monoFont,
                    maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {row[col] == null ? (
                      <span style={{ color: C.muted }}>—</span>
                    ) : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '6px 12px', display: 'flex', gap: 6,
          alignItems: 'center', borderTop: `1px solid ${C.border}`,
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              background: 'rgba(56,189,248,0.1)', border: `1px solid ${C.border}`,
              borderRadius: 6, color: page === 0 ? C.muted : C.sky,
              fontSize: 14, padding: '2px 8px', cursor: page === 0 ? 'default' : 'pointer',
            }}
          >‹</button>
          <span style={{ color: C.muted, fontSize: 14, ...monoFont }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{
              background: 'rgba(56,189,248,0.1)', border: `1px solid ${C.border}`,
              borderRadius: 6, color: page === totalPages - 1 ? C.muted : C.sky,
              fontSize: 14, padding: '2px 8px',
              cursor: page === totalPages - 1 ? 'default' : 'pointer',
            }}
          >›</button>
        </div>
      )}
    </div>
  );
};

// ── Simple Markdown Renderer ────────────────────────────────────────────────────
// Parse markdown cơ bản (bold, italic, code, newline) mà không cần thư viện ngoài
const SimpleMarkdown = ({ text, color }) => {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*([\s\S]+?)\*\*/);
    // Inline code `code`
    const codeMatch = remaining.match(/^([\s\S]*?)`([^`]+)`/);
    // Line break
    const newlineIdx = remaining.indexOf('\n');

    let nextBold = boldMatch ? boldMatch[0].length : Infinity;
    let nextCode = codeMatch ? codeMatch[0].length : Infinity;
    let nextNL = newlineIdx >= 0 ? newlineIdx : Infinity;

    if (nextBold === Infinity && nextCode === Infinity && nextNL === Infinity) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    const first = Math.min(nextBold, nextCode, nextNL);

    if (first === nextNL) {
      if (newlineIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, newlineIdx)}</span>);
      parts.push(<br key={key++} />);
      remaining = remaining.slice(newlineIdx + 1);
    } else if (first === nextBold && boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++} style={{ color: C.sky }}>{boldMatch[2]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
    } else if (first === nextCode && codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(
        <code key={key++} style={{
          background: C.bg, borderRadius: 4, border: `1px solid ${C.border}`,
          padding: '3px 8px', fontSize: '0.95em', color: C.sky, ...monoFont,
        }}>
          {codeMatch[2]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining[0]}</span>);
      remaining = remaining.slice(1);
    }
  }

  return <span style={{ color, lineHeight: 1.6 }}>{parts}</span>;
};

// ── Typing Indicator ────────────────────────────────────────────────────────────
export const TypingIndicator = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{
      display: 'flex', gap: 4, background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: '4px 16px 16px 16px', padding: '10px 14px',
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: C.sky,
          animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
    <span style={{ fontSize: 14, color: C.muted, ...monoFont }}>AirViz AI đang phân tích...</span>
    <style>{`
      @keyframes typingBounce {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-6px); opacity: 1; }
      }
    `}</style>
  </div>
);

// ── Main ChatMessage Component ──────────────────────────────────────────────────
const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const { text, time, queryResult } = message;

  if (isUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.sky}, ${C.violet})`,
          borderRadius: '16px 16px 4px 16px',
          padding: '10px 15px', maxWidth: '82%', fontSize: 18, color: '#fff', ...headFont,
        }}>
          {text}
        </div>
        <span style={{ fontSize: 12, color: C.muted, marginTop: 3, ...monoFont }}>{time}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{
        background: 'transparent',
        border: `1px solid ${C.border}`,
        borderRadius: '4px 16px 16px 16px',
        padding: '12px 16px', maxWidth: '92%', fontSize: 18,
        color: C.text, ...headFont,
      }}>
        <SimpleMarkdown text={text} color={C.text} />
        {/* Hiển thị kết quả bảng nếu có */}
        {queryResult && !queryResult.error && queryResult.columns?.length > 0 && (
          <ResultTable
            columns={queryResult.columns}
            rows={queryResult.rows}
            rowCount={queryResult.row_count}
            truncated={queryResult.truncated}
          />
        )}
        {queryResult?.error && (
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'rgba(248,113,113,0.08)',
            border: `1px solid rgba(248,113,113,0.25)`,
            borderRadius: 8, fontSize: 14, color: C.danger, ...monoFont,
          }}>
            ⚠ {queryResult.error}
          </div>
        )}
      </div>
      <span style={{ fontSize: 12, color: C.muted, marginTop: 3, ...monoFont }}>{time}</span>
    </div>
  );
};

export default ChatMessage;
