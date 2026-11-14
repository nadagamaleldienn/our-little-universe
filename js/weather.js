// Weather modes. The Cozy Corner stage (js/scene.js) draws the weather itself with CSS-animated
// shapes (copied from design/Main.dc.html); this module only holds the palettes, the labels for the
// weather selector, and owns the data-weather attribute on <html> (used for the page glow).
// Setting ids stay as they were saved: rain | sunrise | snow | night | storm ("night" is the board's "starry").

export const WEATHERS = {
  rain: { label: 'Rain', board: 'rain' },
  sunrise: { label: 'Dawn', board: 'sunrise' },
  snow: { label: 'Snow', board: 'snow' },
  night: { label: 'Stars', board: 'starry' },
  storm: { label: 'Storm', board: 'storm' }
};

// Room palette per mode (verbatim from the board's WX table).
export const WX = {
  rain: { wall: 'linear-gradient(180deg,#34265F 0%,#2B1F52 60%,#241A45 100%)', floor: 'linear-gradient(180deg,#2E2250,#1A1233)', frame: '#4B3A86', sky: 'linear-gradient(180deg,#4A4FA8 0%,#3B3F8F 35%,#2E2F6E 70%,#262757 100%)', bld: '#1C1945', cloud: '#5A5FB0', gk: 1, spill: 'rgba(140,147,217,.14)', halo: 'rgba(246,201,69,.07)' },
  sunrise: { wall: 'linear-gradient(180deg,#5E4896 0%,#4F3C86 60%,#43326F 100%)', floor: 'linear-gradient(180deg,#3A2B62,#2A1F4A)', frame: '#7C63C9', sky: 'linear-gradient(180deg,#B9A6EC 0%,#D4B4E4 28%,#F0C2B4 55%,#F7D98A 80%,#F6C945 100%)', bld: '#5B43A8', cloud: '#F0C2B4', gk: 0.5, spill: 'rgba(247,217,138,.22)', halo: 'rgba(246,201,69,.05)' },
  snow: { wall: 'linear-gradient(180deg,#463F72 0%,#3A3560 60%,#2F2A52 100%)', floor: 'linear-gradient(180deg,#2E2850,#201B3C)', frame: '#8E7AD6', sky: 'linear-gradient(180deg,#8F8BB5 0%,#A9A5C8 50%,#CBC8DD 100%)', bld: '#4A4670', cloud: '#E3E0F2', gk: 1.7, spill: 'rgba(220,210,247,.16)', halo: 'rgba(246,201,69,.12)' },
  starry: { wall: 'linear-gradient(180deg,#2E2160 0%,#271B4C 60%,#1F1640 100%)', floor: 'linear-gradient(180deg,#201642,#150E2B)', frame: '#4B3A86', sky: 'linear-gradient(180deg,#140E3A 0%,#251B5C 55%,#3A2B84 100%)', bld: '#150F36', cloud: '#2B2068', gk: 1, spill: 'rgba(185,166,236,.12)', halo: 'rgba(246,201,69,.06)' },
  storm: { wall: 'linear-gradient(180deg,#2A1F50 0%,#231A44 60%,#1B1436 100%)', floor: 'linear-gradient(180deg,#1C1438,#110B22)', frame: '#3D2C74', sky: 'linear-gradient(180deg,#1D1C45 0%,#262552 50%,#16152E 100%)', bld: '#120F2B', cloud: '#3A396F', gk: 0.8, spill: 'rgba(140,147,217,.10)', halo: 'rgba(246,201,69,.05)' }
};

// Wallpaper / wainscot / rail colours: [stripe rgb, stripe a, dot rgb, dot a, wainscot, rail]
export const WALL = {
  rain: ['124,99,201', 0.08, '246,201,69', 0.22, 'rgba(14,9,30,.30)', '#5B43A8'],
  sunrise: ['246,201,69', 0.06, '255,231,154', 0.26, 'rgba(46,34,80,.38)', '#8E7AD6'],
  snow: ['185,166,236', 0.09, '255,255,255', 0.20, 'rgba(14,9,30,.24)', '#7C63C9'],
  starry: ['91,67,168', 0.12, '255,231,154', 0.26, 'rgba(10,6,28,.36)', '#4B3A86'],
  storm: ['61,44,116', 0.12, '185,166,236', 0.16, 'rgba(8,5,22,.38)', '#3D2C74']
};

export const boardKey = (name) => (WEATHERS[name] || WEATHERS.rain).board;

export function applyWeatherTheme(name) {
  document.documentElement.dataset.weather = WEATHERS[name] ? name : 'rain';
}
