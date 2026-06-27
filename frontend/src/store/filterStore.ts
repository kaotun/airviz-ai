// src/store/filterStore.ts
// Global filter state — tất cả charts subscribe vào đây
// Thay đổi filter → toàn bộ dashboard tự động re-fetch

import { create } from 'zustand'
import { format, subDays } from 'date-fns'

interface FilterState {
  // Khoảng thời gian
  startDate: string
  endDate:   string

  // Tỉnh được chọn (null = toàn quốc)
  selectedProvinceId: number | null
  selectedProvinceName: string | null

  // Metric đang xem (cho tab Phân tích)
  selectedMetric: string

  // Actions
  setDateRange:    (start: string, end: string) => void
  setProvince:     (id: number | null, name: string | null) => void
  setMetric:       (metric: string) => void
  resetFilters:    () => void
}

const today      = format(new Date(), 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

export const useFilterStore = create<FilterState>((set) => ({
  startDate:            thirtyDaysAgo,
  endDate:              today,
  selectedProvinceId:   null,
  selectedProvinceName: null,
  selectedMetric:       'pm2_5',

  setDateRange: (start, end) =>
    set({ startDate: start, endDate: end }),

  setProvince: (id, name) =>
    set({ selectedProvinceId: id, selectedProvinceName: name }),

  setMetric: (metric) =>
    set({ selectedMetric: metric }),

  resetFilters: () =>
    set({
      startDate:            thirtyDaysAgo,
      endDate:              today,
      selectedProvinceId:   null,
      selectedProvinceName: null,
      selectedMetric:       'pm2_5',
    }),
}))
