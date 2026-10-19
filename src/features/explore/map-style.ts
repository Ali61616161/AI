/**
 * Koyu harita stili (Google Haritalar). Sade ama boş değil: parklar, su, binalar, ana ilgi
 * noktaları (müze, anıt, park, ibadet yeri) ve toplu taşıma durakları görünür; dükkân ve iş
 * yeri etiketleri gizlenir. Açık mod için özel stil gerekmez, Google'ın kendi açık haritası kullanılır.
 */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a5b0d0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#070b16' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#25304f' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#151e36' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0d1830' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#12352c' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6fbf9a' }] },
  { featureType: 'poi.attraction', elementType: 'labels.text.fill', stylers: [{ color: '#f2a679' }] },
  { featureType: 'poi.government', elementType: 'labels.text.fill', stylers: [{ color: '#a5b0d0' }] },
  { featureType: 'poi.medical', elementType: 'labels.text.fill', stylers: [{ color: '#e88a8a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#202a47' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#b7c0dd' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2a3558' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a4670' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#2f3b63' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#8fb3ff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a2a4a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6f93c8' }] },
];
