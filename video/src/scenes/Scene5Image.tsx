import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT, MONO } from "../theme";
import { Backdrop } from "../components/Backdrop";
import { Kicker, Reveal, Subtitle } from "../components/ui";

/**
 * 抽象图：纯 CSS 几何块 + radial-gradient，不依赖任何外部图片文件。
 * 这张"AI 出图"整体画在一张深色卡片（COLORS.ink）里 —— 浅底页面上它是唯一的焦点对比区。
 * 硬约束：全片禁用线性色渐变，因此天空/山脊/雾都用实色块 + radial 渐变重新实现，
 * 但保留原来的构图逻辑（月盘在上、光带斜切、前后两道山脊、底部雾、前景光点）。
 */

/** 生成中的占位网格（点阵，用 radial 渐变画点，不用线性色渐变画线） */
const GEN_GRID =
  "radial-gradient(circle at center, rgba(247,248,250,0.16) 1.2px, transparent 1.3px)";

const AbstractArt: React.FC<{ reveal: number }> = ({ reveal }) => {
  const r = Math.max(0, Math.min(1, reveal));
  const clip = `inset(0 ${(1 - r) * 100}% 0 0)`;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        clipPath: clip,
        overflow: "hidden",
        background: COLORS.ink,
      }}
    >
      {/* 天空辉光（月盘周围的天光） */}
      <div
        style={{
          position: "absolute",
          right: "2%",
          top: "-6%",
          width: "62%",
          height: "78%",
          background:
            "radial-gradient(circle at 50% 46%, rgba(111,198,206,0.30) 0%, rgba(111,198,206,0.10) 38%, rgba(22,26,34,0) 68%)",
        }}
      />
      {/* 大圆盘（月） */}
      <div
        style={{
          position: "absolute",
          right: "14%",
          top: "12%",
          width: "34%",
          aspectRatio: "1",
          borderRadius: 999,
          background:
            "radial-gradient(circle at 36% 32%, #EAF7F8, #6FC6CE 46%, #17505B 78%)",
          boxShadow: "0 0 90px rgba(111,198,206,0.42)",
          opacity: 0.92,
        }}
      />
      {/* 光带（斜切，两段实色叠加，无渐变） */}
      <div
        style={{
          position: "absolute",
          left: "-10%",
          top: "52%",
          width: "130%",
          height: "13%",
          transform: "rotate(-9deg)",
          background: "rgba(111,198,206,0.30)",
          filter: "blur(16px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "6%",
          top: "50%",
          width: "96%",
          height: "6%",
          transform: "rotate(-9deg)",
          background: "rgba(224,246,248,0.34)",
          filter: "blur(20px)",
        }}
      />
      {/* 山脊 1 */}
      <div
        style={{
          position: "absolute",
          left: "-6%",
          bottom: "18%",
          width: "76%",
          height: "42%",
          background: "#1D3A45",
          clipPath: "polygon(0 100%, 26% 22%, 44% 62%, 66% 8%, 100% 100%)",
          opacity: 0.96,
        }}
      />
      {/* 山脊 1 的受光面 */}
      <div
        style={{
          position: "absolute",
          left: "-6%",
          bottom: "18%",
          width: "76%",
          height: "42%",
          background:
            "radial-gradient(ellipse at 62% 4%, rgba(111,198,206,0.34) 0%, rgba(111,198,206,0) 46%)",
          clipPath: "polygon(0 100%, 26% 22%, 44% 62%, 66% 8%, 100% 100%)",
          opacity: 0.96,
        }}
      />
      {/* 山脊 2 */}
      <div
        style={{
          position: "absolute",
          left: "38%",
          bottom: "8%",
          width: "72%",
          height: "38%",
          background: "#122631",
          clipPath: "polygon(0 100%, 22% 34%, 48% 74%, 72% 26%, 100% 100%)",
        }}
      />
      {/* 前景光点 */}
      {[
        { l: "18%", b: "16%", s: 7, c: "#6FC6CE" },
        { l: "30%", b: "28%", s: 4, c: "#8FBFB4" },
        { l: "62%", b: "12%", s: 5, c: "#FFFFFF" },
        { l: "76%", b: "34%", s: 6, c: "#4E8B93" },
        { l: "48%", b: "40%", s: 4, c: "#6FC6CE" },
        { l: "86%", b: "58%", s: 5, c: "#FFFFFF" },
      ].map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: d.l,
            bottom: d.b,
            width: d.s,
            height: d.s,
            borderRadius: 999,
            background: d.c,
            boxShadow: `0 0 ${d.s * 3}px ${d.c}`,
            opacity: 0.85,
          }}
        />
      ))}
      {/* 底部雾（自下而上的椭圆辉光） */}
      <div
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          bottom: "-18%",
          height: "62%",
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(6,10,16,0.86) 0%, rgba(6,10,16,0.55) 44%, rgba(6,10,16,0) 76%)",
        }}
      />
    </div>
  );
};

/** 场景 5 · 42-54s · 生图也能用 */
export const Scene5Image: React.FC = () => {
  const frame = useCurrentFrame();

  const panelIn = interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 扫描线：0-120 帧从顶扫到底
  const scanTop = interpolate(frame, [24, 132], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanning =
    frame < 136
      ? 1
      : interpolate(frame, [136, 152], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // 图片渐显
  const artReveal = interpolate(frame, [128, 188], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 状态文案
  const statusText =
    frame < 40
      ? "排队中…"
      : frame < 90
        ? "生成中 46%"
        : frame < 130
          ? "生成中 88%"
          : "完成 ✓";
  const done = artReveal > 0.9;

  // 能力标签
  const tags = ["生图", "对话", "多模态"];
  const tagIn = tags.map((_, i) =>
    interpolate(frame, [196 + i * 16, 226 + i * 16], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={5} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 86 }}>
        <Reveal delay={0}>
          <Kicker color={COLORS.accentDeep}>不只是聊天</Kicker>
        </Reveal>

        <div
          style={{
            marginTop: 22,
            fontSize: 62,
            fontWeight: 800,
            letterSpacing: -1.4,
            textAlign: "center",
            lineHeight: 1.2,
            color: COLORS.text,
          }}
        >
          让它画一张试试
        </div>

        {/* 图片面板：整块深色卡片，是浅底页面上的焦点 */}
        <div
          style={{
            marginTop: 44,
            width: 1120,
            height: 480,
            borderRadius: 26,
            background: COLORS.ink,
            border: `1.5px solid ${COLORS.ink}`,
            position: "relative",
            overflow: "hidden",
            opacity: panelIn,
            transform: `translateY(${(1 - panelIn) * 30}px) scale(${0.96 + 0.04 * panelIn})`,
            boxShadow:
              "0 40px 110px -50px rgba(0,0,0,0.95), 0 1px 2px rgba(22,26,34,0.08)",
          }}
        >
          {/* 生成中的网格底 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: GEN_GRID,
              backgroundSize: "48px 48px",
              opacity: 1 - artReveal,
            }}
          />

          {/* 抽象图 */}
          <AbstractArt reveal={artReveal} />

          {/* 扫描线（实色亮线，无渐变） */}
          {scanning > 0.01 ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${scanTop}%`,
                height: 4,
                background: COLORS.bgSoft,
                boxShadow: `0 0 26px ${COLORS.accent}`,
                opacity: scanning,
              }}
            />
          ) : null}

          {/* 状态条（深色卡片上的浅字） */}
          <div
            style={{
              position: "absolute",
              left: 22,
              right: 22,
              bottom: 18,
              height: 62,
              borderRadius: 14,
              background: "rgba(8,11,18,0.74)",
              border: "1px solid rgba(247,248,250,0.16)",
              display: "flex",
              alignItems: "center",
              padding: "0 22px",
              gap: 16,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: done ? COLORS.ok : COLORS.accentMoss,
                boxShadow: `0 0 12px ${done ? COLORS.ok : COLORS.accentMoss}`,
              }}
            />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 24,
                color: COLORS.bgSoft,
                fontWeight: 600,
              }}
            >
              Seedream 5.0 出图
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: MONO,
                fontSize: 23,
                color: done ? COLORS.bgSoft : COLORS.dim,
              }}
            >
              {done ? "完成 ✓" : statusText}
            </span>
          </div>
        </div>

        {/* 能力标签 */}
        <div style={{ display: "flex", gap: 18, marginTop: 38 }}>
          {tags.map((t, i) => (
            <div
              key={t}
              style={{
                padding: "13px 32px",
                borderRadius: 999,
                background: `${COLORS.accentMoss}14`,
                border: `1px solid ${COLORS.accentMoss}44`,
                color: COLORS.accentMoss,
                fontSize: 28,
                fontWeight: 700,
                opacity: tagIn[i],
                transform: `translateY(${(1 - tagIn[i]) * 14}px)`,
              }}
            >
              {t}
            </div>
          ))}
          <div
            style={{
              padding: "13px 32px",
              borderRadius: 999,
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.text,
              background: COLORS.bgSoft,
              border: `1px solid ${COLORS.border}`,
              opacity: tagIn[2],
            }}
          >
            全部支持
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Subtitle delay={228}>
            生图、对话、多模态，同一个插件里全都能用。
          </Subtitle>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
