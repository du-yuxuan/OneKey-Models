import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { COLORS, FONT, MONO, PANEL_SHADOW } from "../theme";

/** 帧驱动的入场：spring 控制不透明度 + 位移。delay 为延迟帧数。 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  damping?: number;
  stiffness?: number;
  mass?: number;
  style?: React.CSSProperties;
}> = ({
  children,
  delay = 0,
  distance = 30,
  damping = 200,
  stiffness = 110,
  mass = 0.7,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping, stiffness, mass },
  });
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * distance}px)`,
        fontFamily: FONT,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 场景顶部小标签 */
export const Kicker: React.FC<{
  children: React.ReactNode;
  color?: string;
}> = ({ children, color = COLORS.accentMoss }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 18px",
      borderRadius: 999,
      border: `1px solid ${color}44`,
      background: `${color}14`,
      color,
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: 2,
      fontFamily: FONT,
    }}
  >
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        display: "inline-block",
      }}
    />
    {children}
  </div>
);

/** 通用浅色卡片 */
export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
  padding?: number;
}> = ({ children, style, accent, padding = 30 }) => (
  <div
    style={{
      background: COLORS.panel,
      border: `1px solid ${accent ? `${accent}55` : COLORS.border}`,
      borderRadius: 22,
      padding,
      boxShadow: accent
        ? `0 1px 2px rgba(22,26,34,0.06), 0 18px 60px -28px ${accent}66`
        : PANEL_SHADOW,
      fontFamily: FONT,
      ...style,
    }}
  >
    {children}
  </div>
);

/** 底部字幕条（中文口播字幕） */
export const Subtitle: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, mass: 0.6 },
  });
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * 18}px)`,
        fontFamily: FONT,
        fontSize: 34,
        fontWeight: 600,
        color: COLORS.text,
        textAlign: "center",
        lineHeight: 1.5,
        letterSpacing: 0.5,
      }}
    >
      {children}
    </div>
  );
};

/** 逐帧打字机（光标色跟随调用处，仅用于深色终端） */
export const Typewriter: React.FC<{
  text: string;
  startFrame?: number;
  framesPerChar?: number;
  style?: React.CSSProperties;
  cursorColor?: string;
}> = ({
  text,
  startFrame = 0,
  framesPerChar = 1.4,
  style,
  cursorColor = COLORS.accentMoss,
}) => {
  const frame = useCurrentFrame();
  const done = Math.max(0, frame - startFrame);
  const n = Math.min(text.length, Math.floor(done / framesPerChar));
  return (
    <span style={{ fontFamily: MONO, whiteSpace: "pre-wrap", ...style }}>
      {text.slice(0, n)}
      <span
        style={{
          display: "inline-block",
          width: 12,
          height: "1.05em",
          verticalAlign: "-0.18em",
          marginLeft: 3,
          background: cursorColor,
          opacity:
            n >= text.length ? (Math.floor(frame / 8) % 2 === 0 ? 1 : 0) : 1,
        }}
      />
    </span>
  );
};

/** 勾选框动画 */
export const CheckMark: React.FC<{
  progress: number;
  size?: number;
  color?: string;
}> = ({ progress, size = 44, color = COLORS.ok }) => {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="12"
        stroke={color}
        strokeWidth="3"
        opacity={0.35 + 0.65 * p}
        fill={`${color}1F`}
      />
      <path
        d="M13 25 L21 33 L35 17"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - p}
      />
    </svg>
  );
};

/** 大叉（场景 1 的"打叉"） */
export const CrossMark: React.FC<{ progress: number; size?: number }> = ({
  progress,
  size = 56,
}) => {
  const p = Math.max(0, Math.min(1, progress));
  const arm = 18 * p;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill={COLORS.warn} opacity={0.16 * p} />
      <circle
        cx="28"
        cy="28"
        r="26"
        stroke={COLORS.warn}
        strokeWidth="2.5"
        opacity={0.85 * p}
        strokeDasharray={164}
        strokeDashoffset={164 * (1 - p)}
        transform="rotate(-90 28 28)"
      />
      <path
        d={`M${28 - arm} ${28 - arm} L${28 + arm} ${28 + arm}`}
        stroke={COLORS.warn}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d={`M${28 - arm} ${28 + arm} L${28 + arm} ${28 - arm}`}
        stroke={COLORS.warn}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  );
};
