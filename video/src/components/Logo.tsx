import React from "react";
import { Img, staticFile } from "remotion";
import { COLORS } from "../theme";

/**
 * 官方 logo（用户设计稿，随仓库分发）：
 *   logo/onekey-models-logo.png  源图 1254×1254
 *   video/public/logo.png        渲染副本 1024×1024（remotion 只能读 public 目录）
 * 透明底、蓝鲸 ∞ + 插头 + 模型图标簇，不带任何底色矩形，因此：
 *   - 不叠 borderRadius / 背景（会与透明底形成接缝）；
 *   - 发光统一改为中性深色投影 rgba(22,26,34,0.16)，不用品牌色 glow。
 * rotation 保留是为了让 mark 轻微倾斜进场。
 */

export const LogoMark: React.FC<{
  size?: number;
  uid?: string;
  glow?: number;
  rotation?: number;
}> = ({ size = 120, uid = "a", glow = 1, rotation = 0 }) => {
  return (
    <Img
      src={staticFile("logo.png")}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        transform: `rotate(${rotation}deg)`,
        filter:
          glow > 0 ? "drop-shadow(0 8px 20px rgba(22,26,34,0.16))" : "none",
      }}
    />
  );
};

/** 横版字标：新 logo 无横版文字标，文字用 BrandWord 实色渲染 */
export const LogoLockup: React.FC<{
  markSize?: number;
  fontSize?: number;
  uid?: string;
  glow?: number;
  rotation?: number;
}> = ({ markSize = 108, fontSize = 74, uid = "a", glow = 1, rotation = 0 }) => {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: markSize * 0.32 }}
    >
      <LogoMark size={markSize} uid={uid} glow={glow} rotation={rotation} />
      <BrandWord fontSize={fontSize}>OneKey-Models</BrandWord>
    </div>
  );
};

/** 品牌实色文字（无图时用作标题，保留以便场景自由取用） */
export const BrandWord: React.FC<{
  children: React.ReactNode;
  fontSize: number;
  weight?: number;
  letterSpacing?: number;
  opacity?: number;
}> = ({
  children,
  fontSize,
  weight = 800,
  letterSpacing = -2,
  opacity = 1,
}) => (
  <div
    style={{
      fontSize,
      fontWeight: weight,
      letterSpacing,
      opacity,
      lineHeight: 1.08,
      whiteSpace: "nowrap",
      color: COLORS.accent,
    }}
  >
    {children}
  </div>
);
