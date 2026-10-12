/** Android (Google Haritalar) için koyu, sade harita stili; iOS kendi koyu temasını kullanır. */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0b1120' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a93b8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#070b16' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1c2540' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2238' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f1526' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a3152' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#151c30' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050913' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4a6b' }] },
];
