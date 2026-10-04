import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT, MONO, PANEL_SHADOW } from "../theme";
import { JEV_QUESTIONS } from "../data";
import { Backdrop } from "../components/Backdrop";
import { Kicker, Reveal, CheckMark, Subtitle } from "../components/ui";

/** 场景 6 · 54-64s · Jev 智能判断 */
export const Scene6Jev: React.FC = () => {
  const frame = useCurrentFrame();

  // 三张问句卡依次飞入（从右滑入 + 淡入）
  const cardIn = JEV_QUESTIONS.map((_, i) =>
    interpolate(frame, [16 + i * 34, 54 + i * 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // 答案栏随后展开
  const answerIn = JEV_QUESTIONS.map((_, i) =>
    interpolate(frame, [46 + i * 34, 86 + i * 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  // 打勾
  const tickP = JEV_QUESTIONS.map((_, i) =>
    interpolate(frame, [58 + i * 34, 90 + i * 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const verdict = interpolate(frame, [150, 186], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={6} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 84 }}>
        <Reveal delay={0}>
          <Kicker color={COLORS.accent}>Jev 智能判断</Kicker>
        </Reveal>

        <div
          style={{
            marginTop: 20,
            fontSize: 58,
            fontWeight: 800,
            letterSpacing: -1.2,
            textAlign: "center",
            lineHeight: 1.22,
            color: COLORS.text,
          }}
        >
          不只会写代码，还会替你拿主意
        </div>

        {/* 三条问答 */}
        <div
          style={{
            marginTop: 46,
            width: 1300,
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {JEV_QUESTIONS.map((item, i) => {
            const t = cardIn[i];
            const a = answerIn[i];
            return (
              <div
                key={item.q}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  padding: "24px 30px",
                  borderRadius: 20,
                  background: COLORS.panel,
                  border: `1.5px solid ${COLORS.borderSoft}`,
                  boxShadow: PANEL_SHADOW,
                  opacity: t,
                  transform: `translateX(${(1 - t) * 70}px)`,
                }}
              >
                {/* 问 */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: `${COLORS.accent}1F`,
                      border: `1px solid ${COLORS.accent}40`,
                      color: COLORS.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    ?
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      letterSpacing: -0.4,
                      color: COLORS.text,
                    }}
                  >
                    {item.q}
                  </div>
                </div>

                {/* 箭头 */}
                <div style={{ fontSize: 32, color: COLORS.dim }}>→</div>

                {/* 答 */}
                <div
                  style={{
                    width: 480,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    opacity: a,
                    transform: `translateX(${(1 - a) * 26}px)`,
                  }}
                >
                  <CheckMark progress={tickP[i]} size={38} />
                  <div
                    style={{
                      fontFamily: MONO,
                      fontSize: 25,
                      color: COLORS.ok,
                      fontWeight: 600,
                    }}
                  >
                    {item.a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 结论条 */}
        <div
          style={{
            marginTop: 46,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "20px 40px",
            borderRadius: 999,
            background: COLORS.panel,
            border: `1.5px solid ${COLORS.accent}33`,
            boxShadow: `0 1px 2px rgba(22,26,34,0.06), 0 18px 60px -28px ${COLORS.accent}66`,
            opacity: verdict,
            transform: `translateY(${(1 - verdict) * 22}px) scale(${0.96 + 0.04 * verdict})`,
          }}
        >
          <span style={{ fontSize: 34, color: COLORS.text, fontWeight: 700 }}>
            TokenDance 模型也能当裁判
          </span>
          <span style={{ fontSize: 30, color: COLORS.muted }}>
            · 三连判断，一次跑完
          </span>
        </div>

        <div style={{ marginTop: 26 }}>
          <Subtitle delay={176}>把判断也外包给模型，你只管看结论。</Subtitle>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
