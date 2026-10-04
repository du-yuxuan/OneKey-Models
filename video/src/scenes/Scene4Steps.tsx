import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT, ACCENTS, MONO } from "../theme";
import { STEPS } from "../data";
import { Backdrop } from "../components/Backdrop";
import { Kicker, Reveal, Subtitle, CheckMark } from "../components/ui";

/** 步骤图标（全部为帧驱动 SVG / div，不用外部素材） */
const StepIcon: React.FC<{ kind: string; progress: number; color: string }> = ({
  kind,
  progress,
  color,
}) => {
  const p = Math.max(0, Math.min(1, progress));

  if (kind === "browser") {
    // 浏览器窗口 + 进度条填充
    return (
      <svg width={78} height={64} viewBox="0 0 78 64" fill="none">
        <rect
          x="3"
          y="5"
          width="72"
          height="54"
          rx="12"
          stroke={color}
          strokeWidth="3"
          opacity={0.35 + 0.65 * p}
        />
        <path d="M3 21 H75" stroke={color} strokeWidth="3" opacity={0.5} />
        <circle cx="14" cy="13" r="3" fill={color} opacity={0.75 * p} />
        <circle cx="24" cy="13" r="3" fill={color} opacity={0.5 * p} />
        <rect
          x="12"
          y="30"
          width={54 * p}
          height="8"
          rx="4"
          fill={color}
          opacity={0.85}
        />
        <rect
          x="12"
          y="44"
          width={34 * p}
          height="6"
          rx="3"
          fill={color}
          opacity={0.45}
        />
      </svg>
    );
  }

  if (kind === "check") {
    // 空框 -> 打勾
    return (
      <svg width={70} height={70} viewBox="0 0 48 48" fill="none">
        <rect
          x="4"
          y="4"
          width="40"
          height="40"
          rx="11"
          stroke={color}
          strokeWidth="3"
          opacity={0.3 + 0.7 * p}
          fill={`${color}14`}
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
  }

  // done：圆环 + 大勾
  return (
    <svg width={74} height={74} viewBox="0 0 48 48" fill="none">
      <circle
        cx="24"
        cy="24"
        r="21"
        stroke={color}
        strokeWidth="3"
        opacity={0.45}
        strokeDasharray={132}
        strokeDashoffset={132 * (1 - p)}
        transform="rotate(-90 24 24)"
      />
      <path
        d="M14 25 L21 32 L34 17"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - Math.max(0, Math.min(1, (p - 0.45) / 0.55))}
      />
    </svg>
  );
};

/** 场景 4 · 28-42s · 三步搞定 */
export const Scene4Steps: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  void fps;

  // 每张卡：翻入（rotateY）+ 淡入
  const cardIn = STEPS.map((_, i) =>
    interpolate(frame, [20 + i * 46, 62 + i * 46], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const iconP = STEPS.map((_, i) =>
    interpolate(frame, [44 + i * 46, 88 + i * 46], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // 底部状态条：第三步完成后点亮
  const barP = interpolate(frame, [176, 214], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={4} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 92 }}>
        <Reveal delay={0}>
          <Kicker color={COLORS.accentMoss}>只要三步</Kicker>
        </Reveal>

        <div
          style={{
            marginTop: 24,
            fontSize: 66,
            fontWeight: 800,
            letterSpacing: -1.4,
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          三步，模型选择器就绪
        </div>

        {/* 三张卡 */}
        <div
          style={{
            display: "flex",
            gap: 46,
            marginTop: 64,
            perspective: 1800,
          }}
        >
          {STEPS.map((s, i) => {
            const t = cardIn[i];
            const accent = ACCENTS[i];
            const rotY = (1 - t) * 72;
            return (
              <div
                key={s.no}
                style={{
                  width: 468,
                  padding: "38px 40px 42px",
                  borderRadius: 26,
                  background: COLORS.panel,
                  border: `1.5px solid ${t > 0.02 ? `${accent}66` : COLORS.borderSoft}`,
                  boxShadow: t > 0.02 ? `0 30px 80px -40px ${accent}` : "none",
                  opacity: Math.min(1, t * 1.5),
                  transform: `rotateY(${rotY}deg) translateY(${(1 - t) * 20}px)`,
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 26,
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      background: `${accent}1F`,
                      border: `1px solid ${accent}55`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      fontWeight: 800,
                      color: accent,
                    }}
                  >
                    {s.no}
                  </div>
                  <StepIcon kind={s.icon} progress={iconP[i]} color={accent} />
                </div>
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 800,
                    letterSpacing: -0.8,
                    color: COLORS.text,
                  }}
                >
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 25,
                    color: COLORS.muted,
                    marginTop: 12,
                    lineHeight: 1.45,
                  }}
                >
                  {s.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部状态条 */}
        <div
          style={{
            marginTop: 62,
            width: 1080,
            height: 74,
            borderRadius: 18,
            background: `${COLORS.ok}14`,
            border: `1.5px solid ${COLORS.ok}${Math.round(
              (0.25 + 0.35 * barP) * 255,
            )
              .toString(16)
              .padStart(2, "0")}`,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            gap: 20,
            opacity: 0.35 + 0.65 * barP,
            overflow: "hidden",
          }}
        >
          <div style={{ opacity: barP }}>
            <CheckMark progress={barP} size={40} />
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 27,
              color: COLORS.ok,
              fontWeight: 600,
            }}
          >
            模型选择器已就绪
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontFamily: MONO,
              fontSize: 23,
              color: COLORS.muted,
            }}
          >
            {barP > 0.02 ? "108 models available" : "　"}
          </div>
          {/* 进度填充 */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              width: 1080 * barP,
              background: COLORS.ok,
              opacity: 0.7,
            }}
          />
        </div>

        <div style={{ marginTop: 30 }}>
          <Subtitle delay={200}>
            不用充值，不用抄文档，按钮点完就能用。
          </Subtitle>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
