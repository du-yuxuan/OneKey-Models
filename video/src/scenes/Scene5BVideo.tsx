import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONT, MONO } from "../theme";
import { Backdrop } from "../components/Backdrop";
import { Kicker, Reveal, Subtitle } from "../components/ui";

/**
 * 场景 5B · 生视频也能用。
 *
 * 与 Scene5Image 同一节奏骨架：左侧一张 16:9 "播放器"（播放键、进度条、
 * 时间码），右侧展示提交→轮询→续跑的对话语义。播放器不嵌入任何真实
 * 视频——进度条走完即出一张抽象"成片"缩略（实色块 + radial 光，与
 * Scene5Image 的抽象画同一约束：全片禁线性渐变）。
 */

/** "成片"缩略：深色底 + 几何鲸鱼剪影 + 波纹，纯实色/radial。 */
const ClipThumb: React.FC<{ show: number }> = ({ show }) => {
  const s = Math.max(0, Math.min(1, show));
  if (s <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: s,
      }}
    >
      {/* 海面辉光 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 70% 30%, rgba(0,112,240,0.28) 0%, rgba(22,26,34,0) 58%)",
        }}
      />
      {/* 鲸鱼剪影：身体 + 尾鳍，两个圆角块拼 */}
      <div
        style={{
          position: "absolute",
          left: "18%",
          top: "42%",
          width: "46%",
          height: "17%",
          borderRadius: 999,
          background: "#0E2A46",
          transform: "rotate(-6deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "58%",
          top: "36%",
          width: "16%",
          height: "24%",
          background: "#0E2A46",
          clipPath: "polygon(0 42%, 100% 0, 100% 100%)",
          transform: "rotate(12deg)",
        }}
      />
      {/* 背鳍 */}
      <div
        style={{
          position: "absolute",
          left: "36%",
          top: "34%",
          width: "7%",
          height: "11%",
          background: "#0E2A46",
          clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
        }}
      />
      {/* 两道波纹 */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${20 + i * 9}%`,
            top: `${58 + i * 6}%`,
            width: `${34 - i * 8}%`,
            height: 3,
            borderRadius: 999,
            background: `rgba(111,198,206,${0.5 - i * 0.18})`,
            transform: "rotate(-6deg)",
          }}
        />
      ))}
      {/* 光点 */}
      {[
        { l: "26%", t: "70%", s: 5 },
        { l: "48%", t: "74%", s: 4 },
        { l: "70%", t: "66%", s: 6 },
      ].map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: d.l,
            top: d.t,
            width: d.s,
            height: d.s,
            borderRadius: 999,
            background: "#6FC6CE",
            boxShadow: `0 0 ${d.s * 3}px rgba(111,198,206,0.8)`,
          }}
        />
      ))}
    </div>
  );
};

/** 一行对话式的轮询记录。 */
const PollRow: React.FC<{
  label: string;
  value: string;
  inAt: number;
  frame: number;
  tone?: "run" | "done" | "new";
}> = ({ label, value, inAt, frame, tone = "run" }) => {
  const p = interpolate(frame, [inAt, inAt + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const color =
    tone === "done" ? COLORS.accentMoss : tone === "new" ? COLORS.accentDeep : COLORS.muted;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        fontFamily: MONO,
        fontSize: 24,
        opacity: p,
        transform: `translateX(${(1 - p) * 18}px)`,
      }}
    >
      <span style={{ color: COLORS.muted, width: 150 }}>{label}</span>
      <span style={{ color, fontWeight: tone === "run" ? 500 : 700 }}>{value}</span>
    </div>
  );
};

/** 场景 5B · 生视频：提交 → 轮询 → 续跑 → 成片 */
export const Scene5BVideo: React.FC = () => {
  const frame = useCurrentFrame();

  const panelIn = interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 进度条：前 60% 慢慢走，60-84 帧停一拍（模拟超时），续跑后走完
  const bar =
    frame < 60
      ? interpolate(frame, [10, 60], [0, 58], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : frame < 84
        ? 58
        : interpolate(frame, [84, 150], [58, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // 播放键在成片出现后淡出
  const playFade =
    bar >= 100
      ? interpolate(frame, [150, 168], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 1;
  const clipShow =
    bar >= 100
      ? interpolate(frame, [152, 184], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0;

  const statusText =
    frame < 10
      ? "提交任务…"
      : frame < 60
        ? `生成中 ${Math.round(bar)}%`
        : frame < 84
          ? "超时 · 生成仍在云端继续"
          : frame < 150
            ? `续跑 taskId… ${Math.round(bar)}%`
            : "完成 ✓";

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <Backdrop seed={7} />
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 86 }}>
        <Reveal delay={0}>
          <Kicker color={COLORS.accentDeep}>生视频</Kicker>
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
          让它拍一段鲸鱼
        </div>

        <div
          style={{
            marginTop: 44,
            display: "flex",
            gap: 36,
            alignItems: "stretch",
          }}
        >
          {/* 播放器 */}
          <div
            style={{
              width: 660,
              height: 396,
              borderRadius: 22,
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
            {/* 成片缩略 */}
            <ClipThumb show={clipShow} />

            {/* 播放键（生成中显示） */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: playFade * (1 - clipShow),
              }}
            >
              <div
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 999,
                  background: "rgba(247,248,250,0.10)",
                  border: "2px solid rgba(247,248,250,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 0,
                    height: 0,
                    marginLeft: 8,
                    borderTop: "26px solid transparent",
                    borderBottom: "26px solid transparent",
                    borderLeft: "42px solid rgba(247,248,250,0.92)",
                  }}
                />
              </div>
            </div>

            {/* 底部控制条 */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "18px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "rgba(12,15,20,0.55)",
              }}
            >
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: "rgba(247,248,250,0.18)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${bar}%`,
                    borderRadius: 999,
                    background: bar >= 100 ? COLORS.accentMoss : "#6FC6CE",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: MONO,
                  fontSize: 20,
                  color: "rgba(247,248,250,0.8)",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>seedance · 16:9 · 5s</span>
                  <span style={{ color: bar >= 100 ? COLORS.accentMoss : "#6FC6CE" }}>{statusText}</span>
                </span>
                <span>00:0{Math.floor((bar / 100) * 5)} / 00:05</span>
              </div>
            </div>
          </div>

          {/* 右侧：异步语义 */}
          <div
            style={{
              width: 560,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 18,
              opacity: panelIn,
              transform: `translateY(${(1 - panelIn) * 30}px)`,
            }}
          >
            <PollRow label="提交" value="POST /generations/tasks" inAt={44} frame={frame} tone="new" />
            <PollRow label="轮询" value="GET /tasks/{id} → 58%" inAt={78} frame={frame} />
            <PollRow label="超时不是失败" value="taskId 保留，云端继续跑" inAt={112} frame={frame} />
            <PollRow label="续跑" value="再调一次，直到完成" inAt={146} frame={frame} />
            <PollRow label="成片" value="24h 内下载或转存" inAt={172} frame={frame} tone="done" />
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Subtitle delay={210}>
            对话里说一句，Agent 提交任务、盯进度、取回成片。
          </Subtitle>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
