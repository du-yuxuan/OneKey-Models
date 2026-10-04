/**
 * 视频用的确定性数据。禁止 Math.random / Date.now —— 渲染必须帧确定。
 */

/** 场景 1：让人痛苦的平台（灰掉 + 打叉） */
export const PAIN_PLATFORMS = [
  { name: "智谱 GLM", cta: "去注册账号" },
  { name: "DeepSeek", cta: "再注册一个" },
  { name: "通义千问", cta: "还有第三个" },
] as const;

/** 场景 2：主推模型（按 brief 原文），其余由下面确定性生成补齐到 108 */
const FEATURED = [
  "GLM-5.3",
  "DeepSeek-V4",
  "Kimi-K3",
  "Qwen3.8",
  "MiniMax-M3",
  "Seedance 2.5",
  "Seedream 5.0",
  "Doubao-Pro",
  "Ernie-5.1",
  "Hunyuan-Turbo",
  "Llama-4",
  "Mistral-L3",
] as const;

const FAMILIES = [
  "GLM",
  "DeepSeek",
  "Kimi",
  "Qwen",
  "MiniMax",
  "Seed",
  "Doubao",
  "Ernie",
  "Hunyuan",
  "Llama",
  "Mistral",
  "Grok",
  "Gemini",
  "GPT",
  "Claude",
  "Baichuan",
  "Yi",
  "Step",
  "Flux",
  "Kling",
  "Gemma",
  "Phi",
  "Nova",
  "Intern",
  "Telechat",
  "PanGu",
  "BGE",
  "ChatGLM",
  "Aquila",
  "Falcon",
  "WizardLM",
  "XVERSE",
  "Orion",
  "CogView",
] as const;

const VARIANTS = ["Pro", "Turbo", "Max", "Flash", "Lite", "Air"] as const;

/** 精确 108 条，前 12 条是 brief 点名的旗舰模型 */
export const MODEL_NAMES: string[] = (() => {
  const seen = new Set<string>(FEATURED.map((n) => n.toLowerCase()));
  const out: string[] = [...FEATURED];
  let fi = 0;
  let vi = 0;
  while (out.length < 108) {
    const name = `${FAMILIES[fi % FAMILIES.length]}-${VARIANTS[vi % VARIANTS.length]}`;
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
    fi += 1;
    if (fi % FAMILIES.length === 0) {
      vi += 1;
    }
  }
  return out;
})();

/** 场景 4：三步 */
export const STEPS = [
  { no: "1", title: "登录授权", desc: "浏览器里点一下 OAuth", icon: "browser" },
  { no: "2", title: "勾选你要的模型", desc: "要哪个勾哪个", icon: "check" },
  { no: "3", title: "完成", desc: "模型选择器里直接选", icon: "done" },
] as const;

/** 场景 6：Jev 三连问 + 判定 */
export const JEV_QUESTIONS = [
  { q: "这段代码该保留吗？", a: "保留 · 有价值", tone: "ok" },
  { q: "这个依赖安全吗？", a: "不引入 · 无必要", tone: "ok" },
  { q: "改哪里影响最小？", a: "改 src/catalog.js · 最小影响", tone: "ok" },
] as const;

export const INSTALL_CMD = "plugin_manager action=install_bundle";
export const REPO_URL = "github.com/du-yuxuan/OneKey-Models";
