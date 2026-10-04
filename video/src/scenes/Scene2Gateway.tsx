import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT, ACCENTS, MONO } from "../theme";
import { MODEL_NAMES } from "../data";
import { Backdrop } from "../components/Backdrop";
import { Kicker, Reveal, Subtitle } from "../components/ui";

/** 徽章网格：4 列 x 5 行 = 20 个可见位，前 12 是旗舰模型，其余作为"…等"填充 */
const VISIBLE = MODEL_NAMES.slice(0, 20);

/** 场景 2 · 8-20s · TokenDance 是什么 */
export const Scene2Gateway: React.FC = () => {
  const frame = useCurrentFrame();

  const gatewayIn = RevealSpring(frame);
  const counter = Math.floor(
    interpolate(frame, [130, 250], [0, 108], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // 光束：向外扩散
  const beamSpread = interpolate(frame, [70, 190], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={2} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 96 }}>
        <Reveal delay={2}>
          <Kicker color={COLORS.accentDeep}>TokenDance</Kicker>
        </Reveal>

        <div
          style={{
            marginTop: 26,
            fontSize: 60,
            fontWeight: 800,
            letterSpacing: -1,
            textAlign: "center",
            lineHeight: 1.25,
            color: COLORS.text,
          }}
        >
          一个 Key，一个地址
          <br />
          <span style={{ color: COLORS.accentMoss }}>调用全部大模型</span>
        </div>

        {/* 中央网关 + 光束 */}
        <div
          style={{
            position: "relative",
            marginTop: 40,
            width: 1560,
            height: 470,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* 光束（由中心向外，实色低透明度，无渐变） */}
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i / 12) * Math.PI * 2;
            const len = 150 + beamSpread * 300;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: len,
                  height: 3,
                  transformOrigin: "left center",
                  transform: `rotate(${(ang * 180) / Math.PI}deg)`,
                  backgroundColor: ACCENTS[i % 3],
                  opacity: 0.24 * beamSpread,
                  filter: "blur(1px)",
                }}
              />
            );
          })}

          {/* 网关卡片 */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              padding: "40px 56px",
              borderRadius: 28,
              background: COLORS.panel,
              border: `1.5px solid ${COLORS.border}`,
              boxShadow: `0 1px 2px rgba(22,26,34,0.06), 0 30px 90px -40px ${COLORS.accentDeep}59`,
              textAlign: "center",
              opacity: gatewayIn.opacity,
              transform: `translateY(${gatewayIn.y}px) scale(${gatewayIn.scale})`,
            }}
          >
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 4,
                color: COLORS.muted,
                marginBottom: 14,
              }}
            >
              AI 模型聚合网关
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: -0.5,
                color: COLORS.text,
              }}
            >
              TokenDance
            </div>
            <div
              style={{
                marginTop: 16,
                fontFamily: MONO,
                fontSize: 22,
                color: COLORS.accentDeep,
              }}
            >
              1 key · 1 base_url · 按量计费
            </div>
            <div
              style={{
                marginTop: 20,
                fontSize: 72,
                fontWeight: 800,
                color: COLORS.accent,
                letterSpacing: -2,
              }}
            >
              {counter}
              <span style={{ fontSize: 40 }}> 个模型</span>
            </div>
          </div>
        </div>

        {/* 徽章网格 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, 1fr)",
            gap: 12,
            width: 1620,
            marginTop: -8,
          }}
        >
          {VISIBLE.map((name, i) => {
            const s = interpolate(frame, [96 + i * 5, 122 + i * 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const accent = ACCENTS[i % 3];
            return (
              <div
                key={name}
                style={{
                  opacity: s,
                  transform: `translateY(${(1 - s) * 18}px)`,
                  padding: "13px 10px",
                  borderRadius: 13,
                  background: `${accent}14`,
                  border: `1px solid ${accent}3D`,
                  color: COLORS.text,
                  fontSize: 19,
                  fontWeight: 650,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {name}
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 26,
            fontSize: 24,
            color: COLORS.dim,
            fontFamily: FONT,
          }}
        >
          GLM · DeepSeek · Kimi · Qwen · MiniMax · Seedance · Doubao · …等 108
          个
        </div>

        <div style={{ marginTop: 18 }}>
          <Subtitle delay={190}>不用注册十来个平台，一个 Key 全都有。</Subtitle>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 本地小工具：避免重复写 spring 样板 */
const RevealSpring = (frame: number) => {
  // 纯函数式插值，帧确定
  const s = interpolate(frame, [12, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const eased = 1 - Math.pow(1 - s, 3);
  return {
    opacity: eased,
    y: (1 - eased) * 34,
    scale: 0.92 + 0.08 * eased,
  };
};
