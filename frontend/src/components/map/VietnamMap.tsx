import React, { useEffect, useState } from 'react';
import { MapContainer, GeoJSON, CircleMarker, Marker } from 'react-leaflet';
import { dashboardApi } from '../../api/dashboard';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';

// Hàm màu AQI (đã điều chỉnh cho chế độ nền tối)
const getAQIColor = (aqi: number) => {
    if (!aqi) return 'rgba(56,189,248,0.08)'; // Sáng hơn một chút so với 0.04
    if (aqi <= 50) return '#34d399';  
    if (aqi <= 100) return '#a3e635'; 
    if (aqi <= 150) return '#fbbf24'; 
    if (aqi <= 200) return '#f97316'; 
    if (aqi <= 300) return '#f87171'; 
    return '#dc2626'; 
};

// Tìm tâm của Bounding Box
const getBoundingBoxCenter = (geometry: any) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const processCoord = (coord: any) => {
        if (typeof coord[0] === 'number') {
            minX = Math.min(minX, coord[0]);
            maxX = Math.max(maxX, coord[0]);
            minY = Math.min(minY, coord[1]);
            maxY = Math.max(maxY, coord[1]);
        } else {
            coord.forEach(processCoord);
        }
    };
    processCoord(geometry.coordinates);
    return [ (minY + maxY) / 2, (minX + maxX) / 2 ]; // Trả về [lat, lng]
};

export default function VietnamMap({ onProvinceClick }: { onProvinceClick: (name: string) => void }) {
    const [geoData, setGeoData] = useState<any>(null);
    const [centers, setCenters] = useState<any[]>([]);

    useEffect(() => {
        fetch('/vietnam.geojson')
            .then((res) => res.json())
            .then((data) => setGeoData(data));
    }, []);

    const { data: mapData } = useQuery({
        queryKey: ['mapData'],
        queryFn: () => dashboardApi.getMapData()
    });

    if (!geoData) return <div style={{color:'white', padding: 20}}>Đang tải bản đồ...</div>;

    const features = geoData.features.map((feature: any) => {
        const rawName = feature.properties.Name || feature.properties.name || '';
        const normalize = (str: string) => {
            if (!str) return '';
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
        };

        const aqiData = mapData?.find((p: any) => normalize(p.province_name) === normalize(rawName));
        const provinceName = aqiData ? aqiData.province_name : rawName; 

        return {
            ...feature,
            properties: {
                ...feature.properties,
                name: provinceName,
                aqi: aqiData?.aqi,
                province_id: aqiData?.province_id
            }
        };
    });

    const styledGeoJSON = { ...geoData, features };

    // Lấy tâm các tỉnh sau khi có feature
    if (centers.length === 0 && features.length > 0) {
        const computedCenters = features.map((f: any) => ({
            name: f.properties.name,
            center: getBoundingBoxCenter(f.geometry)
        }));
        setCenters(computedCenters);
    }

    const starIcon = L.divIcon({
        html: '<div style="font-size: 14px; text-shadow: 0 0 5px yellow; margin-top: -6px; margin-left: -6px;">⭐</div>',
        className: '',
    });

    const centralCities = ["TP.HCM", "Hải Phòng", "Đà Nẵng", "Cần Thơ", "Thành phố Hồ Chí Minh"];

    return (
        <div style={{ height: '100%', width: '100%', position: 'relative', filter: 'drop-shadow(0 0 12px rgba(56,189,248,0.3))' }}>
            <MapContainer
                center={[16.0, 106.0]}
                zoom={5}
                style={{ height: '100%', width: '100%', background: 'transparent' }}
                zoomControl={false}
                attributionControl={false}
            >
                <GeoJSON
                    data={styledGeoJSON as any}
                    style={(feature: any) => ({
                        fillColor: getAQIColor(feature.properties.aqi),
                        weight: feature.properties.aqi ? 1.5 : 0.8,
                        opacity: 1,
                        color: feature.properties.aqi ? 'rgba(255,255,255,0.4)' : 'rgba(56,189,248,0.4)',
                        fillOpacity: feature.properties.aqi ? 1 : 0.5
                    })}
                    onEachFeature={(feature, layer) => {
                        const name = feature.properties.name;
                        const aqi = feature.properties.aqi;
                        
                        layer.bindTooltip(`
                            <div style="text-align:center; font-family: 'Space Grotesk', sans-serif;">
                                <b>${name}</b><br/>
                                ${aqi ? `AQI: <b>${Math.round(aqi)}</b>` : 'Chưa có dữ liệu'}
                            </div>
                        `, { sticky: true, className: 'custom-tooltip' });

                        layer.on({
                            click: () => {
                                if (name) onProvinceClick(name);
                            },
                            mouseover: (e) => {
                                e.target.setStyle({ weight: 2.5, fillOpacity: 1, color: '#fff' });
                                e.target.bringToFront();
                            },
                            mouseout: (e) => {
                                e.target.setStyle({
                                    weight: feature.properties.aqi ? 1.5 : 0.8,
                                    fillOpacity: feature.properties.aqi ? 1 : 0.5,
                                    color: feature.properties.aqi ? 'rgba(255,255,255,0.4)' : 'rgba(56,189,248,0.4)'
                                });
                            }
                        });
                    }}
                />

                {/* Render markers */}
                {centers.map((c, i) => {
                    const isCapital = c.name === "Hà Nội" || c.name === "Ha Noi";
                    const isCentral = centralCities.includes(c.name);

                    if (isCapital) {
                        return <Marker key={i} position={c.center} icon={starIcon} interactive={false} />;
                    } else if (isCentral) {
                        return <CircleMarker key={i} center={c.center} radius={4} fillColor="#fbbf24" color="#fff" weight={1} fillOpacity={1} interactive={false} />;
                    }
                    return null; // Không hiện chấm cho các tỉnh khác
                })}

            </MapContainer>

            {/* Legend bảng màu */}
            <div className="absolute bottom-4 left-4 z-[400] bg-white p-3 rounded-lg shadow-md text-xs">
                <h4 className="font-bold mb-2">Chỉ số AQI</h4>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-[#00e400]"></span> Tốt (0-50)</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-[#ffff00]"></span> Trung bình (51-100)</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-[#ff7e00]"></span> Kém (101-150)</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-[#ff0000]"></span> Xấu (151-200)</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-[#8f3f97]"></span> Rất xấu (201-300)</div>
                    <div className="flex items-center gap-2"><span className="w-4 h-4 bg-[#7e0023]"></span> Nguy hại (301+)</div>
                </div>
            </div>
        </div>
    );
}
