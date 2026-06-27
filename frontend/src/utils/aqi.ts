// src/utils/aqi.ts
// AQI utility functions — tính toán, phân loại, màu sắc

export type AqiLevel =
  | 'good'
  | 'fair'
  | 'moderate'
  | 'poor'
  | 'very_poor'
  | 'extremely_poor'
  | 'unknown'

export interface AqiInfo {
  level:       AqiLevel
  label:       string
  labelVi:     string
  color:       string        // hex color
  textColor:   string        // foreground for badge
  bgClass:     string        // CSS var
}

const AQI_MAP: Record<AqiLevel, AqiInfo> = {
  good:            { level: 'good',            label: 'Good',            labelVi: 'Tốt',             color: '#50f0e6', textColor: '#0f172a', bgClass: 'var(--aqi-good)' },
  fair:            { level: 'fair',            label: 'Fair',            labelVi: 'Khá tốt',         color: '#50ccaa', textColor: '#0f172a', bgClass: 'var(--aqi-fair)' },
  moderate:        { level: 'moderate',        label: 'Moderate',        labelVi: 'Trung bình',      color: '#f0e641', textColor: '#0f172a', bgClass: 'var(--aqi-moderate)' },
  poor:            { level: 'poor',            label: 'Poor',            labelVi: 'Kém',             color: '#ff5050', textColor: '#ffffff', bgClass: 'var(--aqi-poor)' },
  very_poor:       { level: 'very_poor',       label: 'Very Poor',       labelVi: 'Rất kém',         color: '#960032', textColor: '#ffffff', bgClass: 'var(--aqi-very-poor)' },
  extremely_poor:  { level: 'extremely_poor',  label: 'Extremely Poor',  labelVi: 'Nguy hiểm',       color: '#7d2181', textColor: '#ffffff', bgClass: 'var(--aqi-extremely-poor)' },
  unknown:         { level: 'unknown',         label: 'Unknown',         labelVi: 'Không rõ',        color: '#475569', textColor: '#f1f5f9', bgClass: 'var(--surface-muted)' },
}

export function getAqiInfo(level: string): AqiInfo {
  return AQI_MAP[level as AqiLevel] ?? AQI_MAP.unknown
}

export function classifyAqi(value: number | null | undefined): AqiLevel {
  if (value == null) return 'unknown'
  if (value <= 20)  return 'good'
  if (value <= 40)  return 'fair'
  if (value <= 60)  return 'moderate'
  if (value <= 80)  return 'poor'
  if (value <= 100) return 'very_poor'
  return 'extremely_poor'
}

export const METRIC_LABELS: Record<string, string> = {
  pm2_5:            'PM2.5 (µg/m³)',
  pm10:             'PM10 (µg/m³)',
  carbon_monoxide:  'CO (µg/m³)',
  nitrogen_dioxide: 'NO₂ (µg/m³)',
  sulphur_dioxide:  'SO₂ (µg/m³)',
  ozone:            'O₃ (µg/m³)',
  dust:             'Bụi thô (µg/m³)',
  european_aqi:     'AQI',
}

export const METRICS = Object.keys(METRIC_LABELS)
