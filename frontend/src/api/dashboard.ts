// src/api/dashboard.ts
// Tất cả gọi API liên quan đến dashboard

import { api } from './client'

export const dashboardApi = {
  getOverview: (startDate: string, endDate: string) =>
    api.get('/dashboard/overview', { params: { start_date: startDate, end_date: endDate } })
       .then(r => r.data),

  getMapData: () =>
    api.get('/dashboard/map').then(r => r.data),

  getProvinceDetail: (provinceId: number) =>
    api.get(`/dashboard/province/${provinceId}`).then(r => r.data),

  getTrend: (startDate: string, endDate: string, provinceId?: number) =>
    api.get('/dashboard/trend', {
      params: { start_date: startDate, end_date: endDate, province_id: provinceId }
    }).then(r => r.data),

  getTimeseries: (params: {
    metric: string
    province_id?: number | null
    start_date: string
    end_date: string
  }) => api.get('/dashboard/timeseries', { params }).then(r => r.data),

  getTopPolluted: (startDate: string, endDate: string, limit = 5) =>
    api.get('/dashboard/top-polluted', {
      params: { start_date: startDate, end_date: endDate, limit }
    }).then(r => r.data),

  getComparison: (provinceIds: number[], metric: string, startDate: string, endDate: string) =>
    api.get('/dashboard/comparison', {
      params: {
        province_ids: provinceIds.join(','),
        metric: metric,
        start_date: startDate,
        end_date: endDate,
      }
    }).then(r => r.data),
}

export const analyticsApi = {
  getAnomalies: (params: {
    province_id?: number
    metric?: string
    threshold?: number
    start_date: string
    end_date: string
  }) => api.get('/analytics/anomalies', { params }).then(r => r.data),

  getCorrelation: (params: {
    province_id?: number
    start_date: string
    end_date: string
  }) => api.get('/analytics/correlation', { params }).then(r => r.data),
}

export const aiApi = {
  /** Gửi câu hỏi → AI phân loại intent + sinh SQL hoặc trả lời trực tiếp */
  chat: (params: {
    message: string
    session_id?: string
    context?: Record<string, unknown>
  }) => api.post('/ai/chat', params).then(r => r.data),

  /** Thực thi SQL sau khi người dùng Approve */
  execute: (params: { log_id: string; approved_by?: string }) =>
    api.post('/ai/execute', params).then(r => r.data),

  /** Lấy lịch sử chat theo session */
  getLogs: (sessionId: string, limit = 20) =>
    api.get(`/ai/logs/${sessionId}`, { params: { limit } }).then(r => r.data),

  /** Kiểm tra Gemini API connection */
  health: () => api.get('/ai/health').then(r => r.data),
}
