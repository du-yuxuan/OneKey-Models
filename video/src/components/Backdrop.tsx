import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

/**
 * 全片统一的浅色底：静态点阵 + 两团缓慢漂移的强调色柔光 + 顶部品牌细线。
 * 点阵与柔光全部用 radial 渐变（不使用线性色渐变），柔光极低透明度，
 * 浅底上只留极轻的层次，不会糊成脏灰。
 * 全部由 useCurrentFrame 驱动，绝不使用 CSS animation。
 */
export const Backdrop: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const frame = useCurrentFrame();
  const t = (frame + seed * 37) / 60;

  const x1 = 26 + Math.sin(t * 0.42) * 9;
  const y1 = 22 + Math.cos(t * 0.31) * 7;
  const x2 = 76 + Math.cos(t * 0.27 + 1.2) * 8;
  const y2 = 78 + Math.sin(t * 0.36 + 0.6) * 6;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {/* 静态点阵 */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(22,26,34,0.10) 1.1px, transparent 1.2px)",
          backgroundSize: "64px 64px",
          maskImage:
            "radial-gradient(circle at 50% 45%, #000 0%, rgba(0,0,0,0.55) 55%, transparent 88%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 45%, #000 0%, rgba(0,0,0,0.55) 55%, transparent 88%)",
          opacity: 0.75,
        }}
      />
      {/* 强调色柔光 1 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(46vw 46vw at ${x1}% ${y1}%, ${COLORS.accent}14 0%, ${COLORS.accent}05 42%, transparent 70%)`,
        }}
      />
      {/* 次强调色柔光 2 */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(44vw 44vw at ${x2}% ${y2}%, ${COLORS.accentMoss}12 0%, ${COLORS.accentDeep}08 45%, transparent 72%)`,
        }}
      />
      {/* 顶部品牌细线 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: COLORS.accent,
          opacity: 0.55,
        }}
      />
      {/* 四角极轻的白角，压住画面边缘 */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(22,26,34,0.05) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
