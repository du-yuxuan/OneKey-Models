import React from "react";
import { Composition } from "remotion";
import { OneKeyIntro } from "./OneKeyIntro";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OneKeyIntro"
        component={OneKeyIntro}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
