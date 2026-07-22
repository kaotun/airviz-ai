// src/components/ai/ApprovalPanel.jsx
// Panel phê duyệt SQL — hiển thị câu SQL được AI sinh ra
// và cho phép người dùng Approve / Reject trước khi thực thi

import React, { useState } from 'react';
import { C, monoFont, headFont } from '../../utils/dashboardConstants';

const ApprovalPanel = ({ sql, logId, onApprove, onReject, isExecuting }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      border: `1px solid rgba(251,191,36,0.3)`,
      borderRadius: 12,
      padding: 14,
      background: 'rgba(251,191,36,0.04)',
      marginTop: 4,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ color: C.warning, fontSize: 14, fontWeight: 600, ...headFont }}>
            AI muốn thực thi truy vấn SQL
          </span>
        </div>
        <button
          onClick={handleCopy}
          style={{
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
            borderRadius: 6, color: copied ? C.success : C.muted,
            fontSize: 12, padding: '3px 8px', cursor: 'pointer', ...monoFont,
          }}
        >
          {copied ? '✓ Đã sao chép' : 'Sao chép'}
        </button>
      </div>

      {/* SQL Code Block */}
      <div style={{
        background: C.bg,
        border: `1px solid rgba(163,230,53,0.15)`,
        borderRadius: 8, padding: '10px 12px',
        marginBottom: 10, position: 'relative', overflow: 'auto',
        maxHeight: 180,
      }}>
        <pre style={{
          margin: 0, fontSize: 13, color: '#a3e635',
          lineHeight: 1.6, ...monoFont, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {sql}
        </pre>
      </div>

      {/* Warning note */}
      <p style={{ color: C.muted, fontSize: 12, margin: '0 0 10px', ...monoFont }}>
        💡 Kiểm tra câu SQL ở trên trước khi cho phép thực thi. Chỉ cho phép lệnh SELECT.
      </p>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onApprove}
          disabled={isExecuting}
          style={{
            flex: 1,
            background: isExecuting ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.12)',
            border: `1px solid rgba(52,211,153,0.4)`,
            borderRadius: 8, color: C.success,
            fontSize: 14, padding: '8px 0', cursor: isExecuting ? 'wait' : 'pointer',
            fontWeight: 600, transition: 'all 0.2s', ...headFont,
          }}
          onMouseEnter={e => !isExecuting && (e.target.style.background = 'rgba(52,211,153,0.2)')}
          onMouseLeave={e => (e.target.style.background = isExecuting ? 'rgba(52,211,153,0.05)' : 'rgba(52,211,153,0.12)')}
        >
          {isExecuting ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, animation: 'pulse 1s infinite', display: 'inline-block' }} />
              Đang thực thi...
            </span>
          ) : '✓ Cho phép thực thi'}
        </button>
        <button
          onClick={onReject}
          disabled={isExecuting}
          style={{
            flex: 1,
            background: 'rgba(248,113,113,0.08)',
            border: `1px solid rgba(248,113,113,0.3)`,
            borderRadius: 8, color: C.danger,
            fontSize: 14, padding: '8px 0', cursor: isExecuting ? 'not-allowed' : 'pointer',
            fontWeight: 600, transition: 'all 0.2s', ...headFont,
          }}
          onMouseEnter={e => !isExecuting && (e.target.style.background = 'rgba(248,113,113,0.15)')}
          onMouseLeave={e => (e.target.style.background = 'rgba(248,113,113,0.08)')}
        >
          ✗ Từ chối
        </button>
      </div>
    </div>
  );
};

export default ApprovalPanel;
