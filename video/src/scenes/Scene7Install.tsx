import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT, MONO, ACCENTS, PANEL_SHADOW } from "../theme";
import { INSTALL_CMD, MODEL_NAMES } from "../data";
import { Backdrop } from "../components/Backdrop";
import { Kicker, Reveal, Typewriter, Subtitle } from "../components/ui";

const FULL_CMD = `${INSTALL_CMD} target=./OneKey-Models`;

/**
 * 终端是全片唯一保留的深色区域（底 COLORS.ink）。
 * 深底上必须用浅字：新 token 里 COLORS.ink 与 COLORS.text 同为 #161A22，
 * 直接用 text 会得到隐形文字，因此终端前景统一走下面这组浅色前景色。
 */
const TERM_FG = "#F2F4F7"; // 主文字
const TERM_MUTED = "#A9B2C0"; // 次要文字
const TERM_ACCENT = "#5FD3DE"; // 强调（青色系提亮版）
const TERM_OK = "#6FCF97"; // 成功（绿色系提亮版）

/** 场景 7 · 64-71s · 装上就能用 */
export const Scene7Install: React.FC = () => {
  const frame = useCurrentFrame();

  // 命令行打完所需帧数：按 1.6 帧/字符
  const cmdChars = FULL_CMD.length;
  const cmdDoneAt = Math.ceil(cmdChars * 1.6);

  // 输出行
  const outLines = [
    { t: "install_bundle ok · 2 files", c: TERM_MUTED },
    { t: "register: onekey-models", c: TERM_ACCENT },
    { t: "catalog loaded · 108 models", c: TERM_OK },
  ];
  const outIn = outLines.map((_, i) =>
    interpolate(
      frame,
      [cmdDoneAt + 6 + i * 11, cmdDoneAt + 22 + i * 11],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    ),
  );

  // 模型下拉框展开
  const dropAt = cmdDoneAt + 42;
  const dropOpen = interpolate(frame, [dropAt, dropAt + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dropItems = MODEL_NAMES.slice(0, 6);
  const itemIn = dropItems.map((_, i) =>
    interpolate(frame, [dropAt + 20 + i * 6, dropAt + 34 + i * 6], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={7} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 80 }}>
        <Reveal delay={0}>
          <Kicker color={COLORS.ok}>装上就能用</Kicker>
        </Reveal>

        <div
          style={{
            marginTop: 18,
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: -1.1,
            textAlign: "center",
            color: COLORS.text,
          }}
        >
          一行命令，模型全到位
        </div>

        {/* 终端窗口：全片唯一深色块 */}
        <div
          style={{
            marginTop: 40,
            width: 1420,
            borderRadius: 20,
            background: COLORS.ink,
            border: `1px solid ${COLORS.ink}`,
            overflow: "hidden",
            boxShadow:
              "0 40px 110px -50px rgba(0,0,0,0.95), 0 1px 2px rgba(22,26,34,0.08)",
          }}
        >
          {/* 标题栏 */}
          <div
            style={{
              height: 54,
              background: "rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(247,248,250,0.10)",
              display: "flex",
              alignItems: "center",
              padding: "0 22px",
              gap: 10,
            }}
          >
            {["#FB7185", "#FBBF24", "#34D399"].map((c) => (
              <span
                key={c}
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 999,
                  background: c,
                  opacity: 0.85,
                }}
              />
            ))}
            <span
              style={{
                marginLeft: 16,
                fontFamily: MONO,
                fontSize: 20,
                color: TERM_MUTED,
              }}
            >
              dsh — plugin install
            </span>
          </div>

          {/* 终端主体 */}
          <div
            style={{
              padding: "28px 32px",
              fontFamily: MONO,
              fontSize: 26,
              lineHeight: 1.62,
              color: TERM_FG,
              minHeight: 190,
            }}
          >
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ color: TERM_OK, fontWeight: 700 }}>$</span>
              <Typewriter
                text={FULL_CMD}
                framesPerChar={1.6}
                cursorColor={TERM_ACCENT}
              />
            </div>
            {outLines.map((l, i) => (
              <div
                key={l.t}
                style={{
                  opacity: outIn[i],
                  transform: `translateX(${(1 - outIn[i]) * -14}px)`,
                  color: l.c,
                  marginTop: 6,
                  paddingLeft: 38,
                }}
              >
                {l.t}
              </div>
            ))}
          </div>
        </div>

        {/* 模型下拉框：浅色卡片 */}
        <div
          style={{
            marginTop: 34,
            width: 1420,
            borderRadius: 18,
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            boxShadow: PANEL_SHADOW,
            padding: "20px 26px",
            opacity: interpolate(frame, [dropAt - 10, dropAt], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 25,
              color: COLORS.muted,
              marginBottom: dropOpen > 0.02 ? 16 : 0,
            }}
          >
            <span style={{ color: COLORS.text, fontWeight: 700, fontSize: 28 }}>
              模型选择器
            </span>
            <span style={{ color: COLORS.dim }}>·</span>
            <span style={{ fontFamily: MONO }}>
              已展开 {Math.floor(dropOpen * 108)} / 108
            </span>
            <span
              style={{
                marginLeft: "auto",
                width: 0,
                height: 0,
                borderLeft: "9px solid transparent",
                borderRight: "9px solid transparent",
                borderTop: "12px solid " + COLORS.accent,
                transform: `rotate(${dropOpen > 0.5 ? 180 : 0}deg)`,
                transition: "none",
              }}
            />
          </div>

          {dropOpen > 0.02 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {dropItems.map((name, i) => (
                <span
                  key={name}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    background: `${ACCENTS[i % 3]}1A`,
                    border: `1px solid ${ACCENTS[i % 3]}44`,
                    color: COLORS.text,
                    fontFamily: MONO,
                    fontSize: 22,
                    opacity: itemIn[i],
                    transform: `translateY(${(1 - itemIn[i]) * 10}px)`,
                  }}
                >
                  {name}
                </span>
              ))}
              <span
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  color: COLORS.dim,
                  fontFamily: MONO,
                  fontSize: 22,
                  opacity: itemIn[dropItems.length - 1],
                }}
              >
                …还有 102 个
              </span>
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 24 }}>
          <Subtitle delay={dropAt + 60}>
            不用改配置，装完模型选择器里直接多出 108 个。
          </Subtitle>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
