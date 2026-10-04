import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  spring,
} from "remotion";
import { COLORS, FONT, MONO, PANEL_SHADOW } from "../theme";
import { REPO_URL } from "../data";
import { Backdrop } from "../components/Backdrop";
import { LogoMark } from "../components/Logo";
import { Subtitle } from "../components/ui";

/** 场景 8 · 71-75s · 收尾 */
export const Scene8Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({
    frame: frame - 2,
    fps,
    config: { damping: 16, stiffness: 100, mass: 1 },
  });
  const title = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  const hint = spring({ frame: frame - 40, fps, config: { damping: 200 } });
  const url = spring({ frame: frame - 56, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={8} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${0.55 + 0.45 * pop})`,
            opacity: Math.min(1, pop * 1.3),
          }}
        >
          <LogoMark size={172} uid="s8" glow={1.2} />
        </div>

        {/* 标题：品牌实色文字，不再用渐变裁切 */}
        <div
          style={{
            marginTop: 40,
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: -2.2,
            opacity: title,
            transform: `translateY(${(1 - title) * 22}px)`,
            color: COLORS.accent,
          }}
        >
          OneKey-Models
        </div>

        <div
          style={{
            marginTop: 26,
            opacity: hint,
            transform: `translateY(${(1 - hint) * 16}px)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 32px",
            borderRadius: 999,
            background: COLORS.panel,
            border: `1px solid ${COLORS.borderSoft}`,
            boxShadow: PANEL_SHADOW,
          }}
        >
          <span style={{ fontSize: 30, color: COLORS.muted }}>安装：</span>
          <span style={{ fontFamily: MONO, fontSize: 27, color: COLORS.text }}>
            plugin_manager action=install_bundle
          </span>
        </div>

        {/* GitHub 地址 */}
        <div
          style={{
            marginTop: 26,
            opacity: url,
            transform: `translateY(${(1 - url) * 16}px)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "16px 36px",
            borderRadius: 999,
            background: COLORS.panel,
            border: `1.5px solid ${COLORS.accent}33`,
            boxShadow: `0 1px 2px rgba(22,26,34,0.06), 0 18px 60px -28px ${COLORS.accent}66`,
          }}
        >
          <span
            style={{
              fontSize: 30,
              color: COLORS.text,
              fontFamily: MONO,
              fontWeight: 600,
            }}
          >
            {REPO_URL}
          </span>
        </div>

        <div style={{ marginTop: 30 }}>
          <Subtitle delay={72}>108 个模型，一次装好。</Subtitle>
        </div>

        {/* 尾帧呼吸感：底部品牌条（实色，无渐变） */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            left: "50%",
            marginLeft: -260,
            width: 520,
            height: 4,
            borderRadius: 999,
            background: COLORS.accent,
            opacity: interpolate(frame, [70, 110], [0, 0.9], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
