/**
 * Card copy and the locale-namespace declaration for the keyed toolview.
 * The namespace key is the single registration identity shared with
 * `src/client/index.ts` (the component imports it from here so the two never
 * drift, mirroring ui-tool's own NS module). Companion facts live here too so
 * they follow the active UI language through the standard lookup chain.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

/** Locale namespace of the weather toolview row. */
export const NS = 'weather.toolview'

const zh = {
  title: '当前天气',
  feelsLike: '体感',
  humidity: '湿度',
  wind: '风速',
  updatedAt: '更新于',
  running: '正在查询天气…',
  error: '天气查询失败',
  day: '白天',
  night: '夜间',
  autoLocated: '自动定位',
  soundOn: '关闭音效',
  soundOff: '开启音效',
  soundHint: '点击开启环境音效',
  companions: '今日伙伴',
  fact: '小知识',
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
  refresh: '刷新',
  hideAmbient: '隐藏氛围',
  showAmbient: '显示氛围',
  cityPlaceholder: '输入城市…',
  citySubmit: '定位',
  loading: '加载中…',
  errorText: '天气获取失败',
  patHint: '摸摸它',
  ambientOff: '氛围已隐藏',
  manualWeather: '手动天气',
  realtime: '实时',
  darkMode: '深色',
  lightMode: '浅色',
  factClearSpring: '蝴蝶翅膀上的鳞粉在阳光下会闪闪发光，那是它独特的"身份证"。',
  factClearSummer: '向日葵的花盘在幼年期会跟着太阳转，成熟后就固定朝东了。',
  factClearAutumn: '秋天树叶变红变黄，是因为叶绿素分解后露出了原本被遮盖的色素。',
  factClearWinter: '常青树不落叶，是因为针状叶表面有蜡质层，能锁住水分抗严寒。',
  factPartly: '云朵是白色的，是因为云滴把阳光中所有颜色的光都散射了回来。',
  factCloudy: '阴天空气湿度大、气压偏低，蜗牛会从壳里探出头来散步。',
  factFog: '雾其实是悬浮在空中的小水滴，太阳升起升温后就会慢慢消散。',
  factDrizzle: '雨后蘑菇疯长，是因为菌丝吸饱了水分，一夜之间就能撑起菌盖。',
  factRain: '彩虹是阳光在雨滴里折射两次、反射一次的结果，所以红色在外、紫色在内。',
  factSnow: '雪花几乎都是六角形，因为水分子结晶时总是按六边形对称排列。',
  factThunder: '闪电比雷声先到：光速约每秒 30 万公里，声速只有约 340 米。',
}

const en = {
  title: 'Current weather',
  feelsLike: 'Feels like',
  humidity: 'Humidity',
  wind: 'Wind',
  updatedAt: 'Updated',
  running: 'Fetching weather…',
  error: 'Weather query failed',
  day: 'day',
  night: 'night',
  autoLocated: 'Auto-located',
  soundOn: 'Mute sound',
  soundOff: 'Sound on',
  soundHint: 'Click to enable ambient sound',
  companions: 'Companions',
  fact: 'Did you know',
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  refresh: 'Refresh',
  hideAmbient: 'Hide ambience',
  showAmbient: 'Show ambience',
  cityPlaceholder: 'Type a city…',
  citySubmit: 'Locate',
  loading: 'Loading…',
  errorText: 'Weather fetch failed',
  patHint: 'Pet it',
  ambientOff: 'Ambience hidden',
  manualWeather: 'Manual weather',
  realtime: 'Live',
  darkMode: 'Dark',
  lightMode: 'Light',
  factClearSpring: 'The tiny scales on a butterfly\'s wings shimmer in sunlight — each pattern is its unique ID card.',
  factClearSummer: 'Young sunflower heads track the sun; once mature, they settle facing east.',
  factClearAutumn: 'Leaves turn red and yellow in autumn when chlorophyll breaks down and reveals the pigments beneath.',
  factClearWinter: 'Evergreens keep their needles because a waxy coat locks in moisture against the cold.',
  factPartly: 'Clouds look white because cloud droplets scatter every color of sunlight back at us.',
  factCloudy: 'On overcast days the air is humid and pressure low — that is when snails come out for a stroll.',
  factFog: 'Fog is just tiny water droplets suspended in air; it disperses as the morning sun warms the ground.',
  factDrizzle: 'Mushrooms sprint after rain: hydrated mycelium can push up a cap overnight.',
  factRain: 'A rainbow forms when sunlight refracts twice and reflects once inside raindrops — red on the outside, violet inside.',
  factSnow: 'Snowflakes are almost always hexagonal because water molecules crystallize in six-fold symmetry.',
  factThunder: 'Lightning beats thunder because light travels ~300,000 km/s while sound crawls at ~340 m/s.',
}

/** Copy keys of the weather toolview namespace. */
export type WeatherCardKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The weather toolview row's copy. */
    'weather.toolview': WeatherCardKey
  }
}

export { zh, en }
