import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  spring,
} from "remotion";
import { COLORS, FONT, PANEL_SHADOW } from "../theme";
import { Backdrop } from "../components/Backdrop";
import { LogoMark } from "../components/Logo";
import { Kicker, Reveal, Subtitle } from "../components/ui";

/** 场景 3 · 20-28s · OneKey-Models 登场 */
export const Scene3Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // logo 从 0.5 缩放到 1.06 再回 1，spring 带一点点回弹
  const pop = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, stiffness: 90, mass: 1.1 },
  });
  const scale = 0.5 + 0.56 * pop;
  const glow = interpolate(frame, [6, 40], [0, 1.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // logo 背后扩散环
  const ringP = interpolate(frame, [18, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const title = spring({ frame: frame - 24, fps, config: { damping: 200 } });
  const sub = spring({ frame: frame - 46, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={3} />
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", gap: 0 }}
      >
        {/* 扩散环 */}
        {[0, 1, 2].map((i) => {
          const p = Math.max(0, Math.min(1, ringP * 1.6 - i * 0.28));
          if (p <= 0) {
            return null;
          }
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 420 + p * 520,
                height: 420 + p * 520,
                marginLeft: -(420 + p * 520) / 2,
                marginTop: -(420 + p * 520) / 2,
                borderRadius: 999,
                border: `2px solid ${COLORS.accent}`,
                opacity: 0.3 * (1 - p),
              }}
            />
          );
        })}

        <Reveal delay={0} distance={0} style={{ marginBottom: 48 }}>
          <Kicker color={COLORS.accent}>DeepSeek Harness 插件</Kicker>
        </Reveal>

        {/* logo */}
        <div
          style={{
            transform: `scale(${scale})`,
            opacity: Math.min(1, pop * 1.4),
          }}
        >
          <LogoMark size={228} uid="s3" glow={glow} />
        </div>

        {/* 主标题 */}
        <div
          style={{
            marginTop: 56,
            opacity: title,
            transform: `translateY(${(1 - title) * 26}px)`,
            fontSize: 104,
            fontWeight: 800,
            letterSpacing: -2.6,
            lineHeight: 1.12,
            textAlign: "center",
          }}
        >
          <span style={{ color: COLORS.accent }}>一键接入 108 个大模型</span>
        </div>

        {/* 副标题 */}
        <div
          style={{
            marginTop: 30,
            opacity: sub,
            transform: `translateY(${(1 - sub) * 20}px)`,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 34px",
            borderRadius: 999,
            background: COLORS.panel,
            border: `1px solid ${COLORS.borderSoft}`,
            boxShadow: PANEL_SHADOW,
          }}
        >
          <span style={{ fontSize: 32, color: COLORS.muted }}>API 支持由</span>
          <span
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: COLORS.accentDeep,
            }}
          >
            TokenDance
          </span>
          <span style={{ fontSize: 32, color: COLORS.muted }}>提供</span>
        </div>

        <div style={{ marginTop: 44 }}>
          <Subtitle delay={70}>
            装上之后，模型选择器里直接多出 108 个选项。
          </Subtitle>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
