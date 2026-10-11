import React from "react";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

import { TOTAL_FRAMES } from "./theme";
import { Scene1Pain } from "./scenes/Scene1Pain";
import { Scene2Gateway } from "./scenes/Scene2Gateway";
import { Scene3Reveal } from "./scenes/Scene3Reveal";
import { Scene4Steps } from "./scenes/Scene4Steps";
import { Scene5Image } from "./scenes/Scene5Image";
import { Scene5BVideo } from "./scenes/Scene5BVideo";
import { Scene6Jev } from "./scenes/Scene6Jev";
import { Scene7Install } from "./scenes/Scene7Install";
import { Scene8Outro } from "./scenes/Scene8Outro";

/**
 * TransitionSeries 的总长度 = Σduration - Σ(transition 帧数)。
 * 每个 transition 会吃掉前后两段各 OVERLAP 帧，让它们重叠播放。
 *
 * 9 场景时间轴（OVERLAP=12）：
 *   1 Pain     内容 0–239
 *   2 Gateway  内容 240–599
 *   3 Reveal   内容 600–839
 *   4 Steps    内容 840–1259
 *   5 Image    内容 1260–1619
 *   5B Video   内容 1620–1979
 *   6 Jev      内容 1980–2279
 *   7 Install  内容 2280–2489
 *   8 Outro    内容 2490–2639
 *
 * 每段 durationInFrames = 内容帧数 + 12（末尾 12 帧是它自己的出场上过渡）：
 *   D = [252, 372, 252, 432, 372, 372, 312, 222, 120]
 *   ΣD = 2706，8 个过渡 × 12 = 96，2706 - 96 = 2610 ✓（= theme.TOTAL_FRAMES）
 */
const OVERLAP = 12;
const D = [252, 372, 252, 432, 372, 372, 312, 222, 120] as const;

// 构建期自检：时长对不上就直接抛，不让错误静默渲染成一个长度不对的片子
const SUM_D = D.reduce((a, b) => a + b, 0);
const NET = SUM_D - OVERLAP * (D.length - 1);
if (NET !== TOTAL_FRAMES) {
  throw new Error(
    `时间轴对不上：ΣD=${SUM_D} - ${D.length - 1}×${OVERLAP} = ${NET}，应为 ${TOTAL_FRAMES}`,
  );
}

// 构建期自检：每段起始绝对帧必须与规格表一致
const EXPECTED_START = [0, 240, 600, 840, 1260, 1620, 1980, 2280, 2490];
let cursor = 0;
D.forEach((dur, i) => {
  if (cursor !== EXPECTED_START[i]) {
    throw new Error(
      `场景${i + 1} 起始帧 ${cursor} ≠ 预期 ${EXPECTED_START[i]}`,
    );
  }
  cursor += dur - OVERLAP;
});

/** 主时间轴：9 场景 + 8 过渡，精确 2610 帧（87 秒） */
export const OneKeyIntro: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={D[0]}>
        <Scene1Pain />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: OVERLAP })}
      />
      <TransitionSeries.Sequence durationInFrames={D[1]}>
        <Scene2Gateway />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={springTiming({
          config: { damping: 200, stiffness: 90, mass: 0.7 },
          durationInFrames: OVERLAP,
        })}
      />
      <TransitionSeries.Sequence durationInFrames={D[2]}>
        <Scene3Reveal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: OVERLAP })}
      />
      <TransitionSeries.Sequence durationInFrames={D[3]}>
        <Scene4Steps />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: OVERLAP })}
      />
      <TransitionSeries.Sequence durationInFrames={D[4]}>
        <Scene5Image />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: OVERLAP })}
      />
      <TransitionSeries.Sequence durationInFrames={D[5]}>
        <Scene5BVideo />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={springTiming({
          config: { damping: 200 },
          durationInFrames: OVERLAP,
        })}
      />
      <TransitionSeries.Sequence durationInFrames={D[6]}>
        <Scene6Jev />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: OVERLAP })}
      />
      <TransitionSeries.Sequence durationInFrames={D[7]}>
        <Scene7Install />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: OVERLAP })}
      />
      <TransitionSeries.Sequence durationInFrames={D[8]}>
        <Scene8Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
