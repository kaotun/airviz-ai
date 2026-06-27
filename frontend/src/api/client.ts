// src/api/client.ts
// Axios instance dùng chung cho toàn bộ app
// Proxy Vite đã cấu hình /api → http://127.0.0.1:8001

import axios from 'axios'

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// Response interceptor: chuẩn hóa lỗi
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.error?.message ??
      err.message ??
      'Unknown error'
    return Promise.reject(new Error(message))
  }
)
