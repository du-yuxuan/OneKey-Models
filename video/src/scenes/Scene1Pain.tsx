import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, PANEL_SHADOW } from "../theme";
import { PAIN_PLATFORMS } from "../data";
import { Backdrop } from "../components/Backdrop";
import { Kicker, CrossMark, Subtitle } from "../components/ui";

/** 场景 1 · 0-8s · 痛点：多平台重复注册 */
export const Scene1Pain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 三张平台卡依次堆叠，随后被打叉
  const cardIn = PAIN_PLATFORMS.map((_, i) =>
    spring({
      frame: frame - 26 - i * 20,
      fps,
      config: { damping: 200, mass: 0.7 },
    }),
  );
  const crossAt = 92;
  const cross = PAIN_PLATFORMS.map((_, i) =>
    interpolate(frame, [crossAt + i * 16, crossAt + 26 + i * 16], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const titleIn = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const dim = interpolate(frame, [crossAt + 40, crossAt + 80], [1, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 卡片位置：三张横向错落堆叠
  const slots = [
    { x: -400, y: -46, rot: -3 },
    { x: 0, y: 6, rot: 0 },
    { x: 400, y: -28, rot: 3 },
  ];

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={1} />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          gap: 54,
          padding: "0 120px",
        }}
      >
        <div
          style={{
            opacity: titleIn,
            transform: `translateY(${(1 - titleIn) * -24}px)`,
          }}
        >
          <Kicker color={COLORS.warn}>老办法</Kicker>
        </div>

        {/* 平台卡堆叠 */}
        <div
          style={{
            position: "relative",
            width: 1180,
            height: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {PAIN_PLATFORMS.map((p, i) => {
            const s = cardIn[i];
            const slot = slots[i];
            return (
              <div
                key={p.name}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 560,
                  padding: "30px 36px",
                  borderRadius: 24,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.borderSoft}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  opacity: s * dim,
                  transform: `translate(-50%, -50%) translate(${slot.x * s}px, ${
                    slot.y * s
                  }px) rotate(${slot.rot * s}deg) scale(${0.9 + 0.1 * s})`,
                  boxShadow: PANEL_SHADOW,
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.borderSoft}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    fontWeight: 800,
                    color: COLORS.dim,
                    flexShrink: 0,
                  }}
                >
                  {p.name.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 700,
                      color: COLORS.muted,
                      lineHeight: 1.2,
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    style={{ fontSize: 24, color: COLORS.dim, marginTop: 8 }}
                  >
                    {p.cta}
                  </div>
                </div>
                <div style={{ opacity: cross[i] }}>
                  <CrossMark progress={cross[i]} size={54} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 痛点文案 */}
        <div style={{ textAlign: "center", opacity: dim }}>
          <div
            style={{
              fontSize: 66,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.28,
              color: COLORS.text,
            }}
          >
            想用 GLM？
            <span style={{ color: COLORS.dim, fontWeight: 500 }}>
              {" "}
              去注册。
            </span>
          </div>
          <div
            style={{
              fontSize: 66,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.28,
              marginTop: 6,
              color: COLORS.text,
            }}
          >
            想用 DeepSeek？
            <span style={{ color: COLORS.dim, fontWeight: 500 }}>
              {" "}
              再注册。
            </span>
          </div>
          <div
            style={{
              marginTop: 22,
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 26px",
              borderRadius: 999,
              background: `${COLORS.warn}12`,
              border: `1px solid ${COLORS.warn}3D`,
              color: COLORS.warn,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: COLORS.warn,
              }}
            />
            注册 · 充值 · 抄文档 × N
          </div>
        </div>

        <Subtitle delay={150}>换一家模型，就要重来一遍。</Subtitle>
      </AbsoluteFill>

      {/* 底部品牌细条 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: COLORS.accent,
          opacity: 0.4,
        }}
      />
    </AbsoluteFill>
  );
};
