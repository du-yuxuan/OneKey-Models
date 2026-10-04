/**
 * OneKey-Models 介绍视频 · 设计系统
 * 浅色主题：底 #F7F8FA（与 logo 透明底搭配），强调色 取自用户设计稿 logo 的蓝 #0070F0。
 * 无品牌渐变；深色仅用于场景 5 的出图卡片与场景 7 的终端块。
 * 全部字体走系统字族保证中文渲染。
 */
export const COLORS = {
  bg: "#F7F8FA",
  bgSoft: "#FFFFFF",
  panel: "#FFFFFF",
  panelStrong: "#FFFFFF",
  border: "#E4E7EC",
  borderSoft: "#EDEFF2",
  text: "#161A22",
  muted: "#5A6472",
  dim: "#8A93A2",
  accent: "#0070F0",
  accentDeep: "#0A3FA8",
  accentMoss: "#0E9FD8",
  ink: "#161A22",
  ok: "#2E7D5B",
  warn: "#C2452D",
} as const;

/** 浅底上浮起一层卡片的统一轻阴影 */
export const PANEL_SHADOW =
  "0 1px 2px rgba(22,26,34,0.06), 0 8px 24px rgba(22,26,34,0.05)";

export const FONT =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Hiragino Sans GB', system-ui, 'Helvetica Neue', Arial, sans-serif";

export const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'PingFang SC', monospace";

export const BRAND_TEXT = {
  color: COLORS.accent,
  backgroundImage: "none",
  WebkitBackgroundClip: "border-box",
  backgroundClip: "border-box",
} as const;

/** 三色轮转，给徽章/卡片做节奏变化 */
export const ACCENTS = [
  COLORS.accent,
  COLORS.accentDeep,
  COLORS.accentMoss,
] as const;

export const SCENE_COUNT = 8;
export const TOTAL_FRAMES = 2250;
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
