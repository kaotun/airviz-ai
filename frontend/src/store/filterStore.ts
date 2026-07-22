// src/store/filterStore.ts
// Global filter state — tất cả charts subscribe vào đây
// Thay đổi filter → toàn bộ dashboard tự động re-fetch

import { create } from 'zustand'
import { format, subDays } from 'date-fns'

interface ProvinceSelection {
  id: number;
  name: string;
}

interface FilterState {
  // Khoảng thời gian
  startDate: string
  endDate:   string

  // Tỉnh được chọn (array rỗng = toàn quốc)
  selectedProvinces: ProvinceSelection[]

  // Metric đang xem (cho tab Phân tích)
  selectedMetric: string

  // Actions
  setDateRange:    (start: string, end: string) => void
  setProvinces:    (provinces: ProvinceSelection[]) => void
  toggleProvince:  (province: ProvinceSelection) => void
  setMetric:       (metric: string) => void
  resetFilters:    () => void
}

const latestDate = new Date('2026-07-06T00:00:00')
const today      = format(latestDate, 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(latestDate, 30), 'yyyy-MM-dd')

export const useFilterStore = create<FilterState>((set) => ({
  startDate:            today,
  endDate:              today,
  selectedProvinces:    [],
  selectedMetric:       'pm2_5',

  setDateRange: (start, end) =>
    set({ startDate: start, endDate: end }),

  setProvinces: (provinces) =>
    set({ selectedProvinces: provinces }),

  toggleProvince: (province) =>
    set((state) => {
      const exists = state.selectedProvinces.find(p => p.id === province.id);
      if (exists) {
        return { selectedProvinces: state.selectedProvinces.filter(p => p.id !== province.id) };
      } else {
        // Tối đa 3 tỉnh theo yêu cầu tab so sánh
        const newProvinces = [...state.selectedProvinces, province];
        return { selectedProvinces: newProvinces.slice(-3) };
      }
    }),

  setMetric: (metric) =>
    set({ selectedMetric: metric }),

  resetFilters: () =>
    set({
      startDate:            today,
      endDate:              today,
      selectedProvinces:    [],
      selectedMetric:       'pm2_5',
    }),
}))
