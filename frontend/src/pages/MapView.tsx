import { useState } from 'react';
import VietnamMap from '../components/map/VietnamMap';
import { dashboardApi } from '../api/dashboard';
import { useQuery } from '@tanstack/react-query';

export default function MapView() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(null);

  // Khi click vào tỉnh, gọi API lấy chi tiết
  const { data: provinceDetail, isLoading } = useQuery({
    queryKey: ['provinceDetail', selectedProvinceId],
    queryFn: () => dashboardApi.getProvinceDetail(selectedProvinceId!),
    enabled: !!selectedProvinceId, // Chỉ chạy khi có ID
  });

  return (
    <div className="page-enter flex h-[calc(100vh-100px)] gap-4">
      {/* Cột trái: Bản đồ (Chiếm 70%) */}
      <div className="flex-1 flex flex-col">
        <h1 className="text-2xl font-bold mb-1">🗺️ Bản đồ Chất lượng Không khí</h1>
        <p className="text-gray-500 text-sm mb-4">Cập nhật theo thời gian thực tại 63 tỉnh thành</p>

        <div className="card flex-1 p-0 overflow-hidden relative">
          <VietnamMap onProvinceClick={(id) => setSelectedProvinceId(id)} />
        </div>
      </div>

      {/* Cột phải: Panel chi tiết (Chiếm 30%) */}
      <div className="w-80 flex flex-col gap-4">
        <div className="card h-full">
          <h2 className="font-bold text-lg border-b pb-2 mb-4">Chi tiết tỉnh</h2>

          {!selectedProvinceId ? (
            <p className="text-gray-400 text-sm italic">Hãy click vào một tỉnh trên bản đồ để xem chi tiết.</p>
          ) : isLoading ? (
            <p className="text-gray-500">Đang tải dữ liệu...</p>
          ) : provinceDetail ? (
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold text-blue-600">{provinceDetail.province_name}</h3>

              <div className="bg-gray-50 p-4 rounded-lg flex flex-col items-center">
                <span className="text-sm text-gray-500">Chỉ số AQI</span>
                <span className="text-4xl font-black" style={{ color: getAQIColor(provinceDetail.aqi) }}>
                  {Math.round(provinceDetail.aqi)}
                </span>
                <span className="font-semibold">{provinceDetail.aqi_level}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border p-2 rounded"><b className="text-gray-500 block">PM2.5</b>{provinceDetail.pm2_5} µg/m³</div>
                <div className="border p-2 rounded"><b className="text-gray-500 block">PM10</b>{provinceDetail.pm10} µg/m³</div>
                <div className="border p-2 rounded"><b className="text-gray-500 block">O3</b>{provinceDetail.ozone} µg/m³</div>
                <div className="border p-2 rounded"><b className="text-gray-500 block">CO</b>{provinceDetail.carbon_monoxide}</div>
              </div>
            </div>
          ) : (
            <p className="text-red-500">Lỗi không tìm thấy dữ liệu.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper nhỏ để tô màu chữ cho panel
const getAQIColor = (aqi: number) => {
  if (!aqi) return '#000';
  if (aqi <= 50) return '#00e400';
  if (aqi <= 100) return '#cccc00'; // vàng sậm hơn chút để dễ đọc chữ
  if (aqi <= 150) return '#ff7e00';
  if (aqi <= 200) return '#ff0000';
  if (aqi <= 300) return '#8f3f97';
  return '#7e0023';
};
