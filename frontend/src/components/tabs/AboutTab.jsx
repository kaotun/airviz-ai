import React from 'react';
import { C, monoFont, headFont, glassCard, SectionHeader } from '../../utils/dashboardConstants';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } from 'recharts';

export default function AboutTab() {
  const features = [
    { name: 'Khả dụng API', val: 95 },
    { name: 'Tốc độ phản hồi', val: 90 },
    { name: 'Chính xác dữ liệu', val: 98 },
    { name: 'Khả năng AI', val: 85 },
    { name: 'Hiệu suất UI', val: 92 },
    { name: 'Tính năng RAG', val: 88 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Hero Section */}
      <section style={{ ...glassCard, textAlign: "center", padding: "60px 20px" }}>
        <h1 style={{ ...headFont, fontSize: 36, fontWeight: 800, margin: "0 0 16px", background: `linear-gradient(135deg, ${C.sky}, ${C.violet})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          AirViz.AI v2.0
        </h1>
        <p style={{ ...headFont, fontSize: 18, color: C.muted, maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
          Hệ thống giám sát và phân tích Chất lượng Không khí Tích hợp Trợ lý Trí tuệ Nhân tạo thế hệ mới, được thiết kế cho việc phân tích vĩ mô và hỗ trợ ra quyết định.
        </p>
      </section>

      {/* Info Cards */}
      <section>
        <div className="responsive-grid grid-cols-3">
          {[
            { title: "Mục Tiêu Dự Án", content: "AirViz.AI hướng tới việc cung cấp một nền tảng phân tích chất lượng không khí toàn diện, giúp các nhà hoạch định chính sách và nhà nghiên cứu tiếp cận dữ liệu nhanh chóng thông qua báo cáo trực quan và công nghệ AI đàm thoại.", icon: "🎯" },
            { title: "Công Nghệ Cốt Lõi", content: "Sử dụng ReactJS cho Frontend tương tác cao, FastAPI (Python) cho Backend mạnh mẽ, TimescaleDB để xử lý hàng triệu bản ghi Time-series, và tích hợp LLM (Large Language Model) cho Trợ lý ảo AI qua kỹ thuật RAG.", icon: "⚙️" },
            { title: "Nguồn Dữ Liệu", content: "Dữ liệu được làm sạch và chuẩn hoá từ các trạm quan trắc trên toàn Việt Nam. Hệ thống hiện đang lưu trữ và phân tích hơn 1.3 triệu bản ghi đo đạc các chỉ số PM2.5, PM10, CO, NO2...", icon: "📊" },
          ].map((item, i) => (
            <div key={i} style={{ ...glassCard }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{item.icon}</div>
              <h3 style={{ ...headFont, fontSize: 20, color: C.text, margin: "0 0 12px" }}>{item.title}</h3>
              <p style={{ ...headFont, fontSize: 15, color: C.muted, lineHeight: 1.6, margin: 0 }}>{item.content}</p>
            </div>
          ))}
        </div>
      </section>

      {/* System Architecture Radar */}
      <section style={{ ...glassCard }}>
        <SectionHeader title="Đánh Giá Kiến Trúc Hệ Thống" />
        <div style={{ height: 350, marginTop: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={features}>
              <PolarGrid stroke={C.border} />
              <PolarAngleAxis dataKey="name" tick={{ fill: C.muted, fontSize: 14 }} />
              <Radar name="AirViz.AI Core" dataKey="val" stroke={C.sky} fill={C.sky} fillOpacity={0.4} />
              <Tooltip contentStyle={{ backgroundColor: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>
      
      {/* Footer */}
      <section style={{ textAlign: "center", padding: "40px 0" }}>
        <p style={{ ...monoFont, fontSize: 14, color: C.muted }}>
          © 2026 AirViz.AI Data Visualization Project. Phát triển cho Bài tập lớn.
        </p>
      </section>
    </div>
  );
}
