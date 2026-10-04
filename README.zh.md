<p align="center">
  <img src="logo/onekey-models-logo.png" alt="OneKey-Models" width="220" />
</p>

<h1 align="center">OneKey-Models</h1>

<p align="center">
  <b>一键接入 TokenDance 全部 108 个最新大模型</b><br/>
  适用于 <a href="https://github.com/deepseek-ai/DeepSeek-Harness">DeepSeek Harness</a>
</p>

<p align="center">
  <a href="README.md">English</a> · 简体中文
</p>

<p align="center">
  <a href="#安装">安装</a> ·
  <a href="#功能">功能</a> ·
  <a href="#什么是-tokendance">什么是 TokenDance？</a> ·
  <a href="#工作原理">工作原理</a> ·
  <a href="#测试">测试</a> ·
  <a href="#介绍视频">介绍视频</a>
</p>

---

**API 支持由 [TokenDance](https://tokendance.space) 提供。** 本插件是 TokenDance API 平台的独立客户端，与 TokenDance 无隶属或背书关系。

## 安装

克隆仓库，然后作为 DSH bundle 安装：

```bash
git clone https://github.com/du-yuxuan/OneKey-Models.git
```

**在 DSH 对话里**让 agent 安装：

```text
install_bundle target=/absolute/path/to/OneKey-Models
```

**或用 CLI**（会创建/使用一个 profile）：

```bash
node <dsh>/lib/bin.js plugin --profile <profile-name> add /absolute/path/to/OneKey-Models
```

安装后重启 DeepSeek Harness（或对应 profile 会话）。设置页出现在 **Settings → Plugins → OneKey-Models**。

> 需要 Node.js ≥ 22.19.0。分发走本 GitHub 仓库 + `install_bundle`，未发布到 npm。

## 功能

| | 功能 | 说明 |
|---|---|---|
| 1 | **API Key 管理** | OAuth（PKCE）登录打开 TokenDance 授权页，换回的 Key 本地保存进 DSH 凭据库，**绝不出现在源码或日志里**。 |
| 2 | **模型列表配置** | 从 `https://tokendance.space/gateway/v1/models` 实时拉取模型目录，可多选、可决定哪些模型显示在模型选择器里（空选 = 全部显示）。 |
| 3 | **特殊模型配置** | 生图模型接到对应应用（`openai:image-generations` / `ark:image-generations`）；Jev 判断模型接到 `typesafe:systemone` 协议；另有视频、语音、音频、音乐、搜索、embedding、rerank 模型。 |
| 4 | **基础能力** | 对话、生图、多模态（文本 + 图片）输入开箱即用，既出现在模型选择器，也暴露为 4 个内置工具（`tokendance_models`、`tokendance_chat`、`tokendance_image`、`tokendance_jev`）。 |

模型富信息（logo、价格、上下文长度、发布日期、模态）自动从 [models.dev](https://models.dev) 同步。

### 目录一览

```
catalog: 108 models from https://tokendance.space/gateway/v1/models
  jev 2 · image 3 · video 18 · embedding 2 · rerank 1
  speech 3 · audio 3 · music 2 · search 3
  routable 71 models
✓ catalog check passed (108 models, 71 routable)
```

`routable` = 协议能映射到 DSH 线协议（`openai-completions` / `openai-responses` / `anthropic-messages`）、因而会出现在模型选择器里的模型。

## 什么是 TokenDance？

**TokenDance 是一个 AI 模型聚合网关**——你可以把它理解成通往多个大模型的同一扇门：

- **1 个 Key，1 个地址**——注册一次拿到一个 API Key，把任意兼容 SDK 指向同一个地址。
- **108 个最新最热模型**——GLM、DeepSeek、Kimi、Qwen、MiniMax、Seedance、豆包等等，持续更新。
- **按量计费**——不用逐家注册、逐家管理 Key 和账单。

一句话版：不用再去十几家 AI 厂商注册、复制十几把 Key，注册一次 TokenDance，这个插件把每个模型直接接进 DeepSeek Harness 的模型选择器。

接线的活它替你干了：**装上 → 登录一次 → 勾选模型 → 选择器里直接出现。**

## 工作原理

```text
┌─────────────────┐   OAuth (PKCE)    ┌──────────────────────┐
│ DeepSeek Harness │ ───────────────▶ │ tokendance.space      │
│  OneKey-Models   │ ◀─────────────── │  授权页                │
└────────┬────────┘   API Key（本地）  └──────────────────────┘
         │                                          ▲
         │  写入 provider 配置块                      │ GET /gateway/v1/models
         ▼                                          │ （实时目录）
┌─────────────────┐                                 │
│   llm-pi-ai      │ ────────────────────────────────┘
│   providers.     │
│   tokendance     │ ──▶ 模型选择器：108 模型，71 可路由
└─────────────────┘
```

1. **登录**——插件打开 TokenDance 授权 URL，在回环回调上收到一次性授权码，换成 API Key 后经 DSH 凭据服务保存（`~/.dsh/.credentials.yaml`，权限 `600`）。
2. **选模型**——拉取实时目录、用 models.dev 富化，写进 `llm-pi-ai` 设置命名空间的 provider 块。
3. **用起来**——选中的模型出现在模型选择器；生图和 Jev 模型另有专属工具。

所有本地 HTTP 端点都套着回环 + `sec-fetch-site` 信任栅栏（入站请求必须来自本地上游，绝不接受跨站页面）。

## 测试

```bash
npm test              # 57 个单元测试（node:test）
npm run check:catalog # 实时目录验收（108 模型，71 可路由）
```

单元测试覆盖配置归一化、目录映射、设置 patch 白名单、Jev 问题校验、PKCE/OAuth URL 构造、信任栅栏、凭据辅助函数，以及 HTTP 层（对着本地替身网关跑，**不需要真实 Key**）。

## 介绍视频

<p align="center"><img src="out/intro-poster.png" alt="介绍视频封面" width="640" /></p>

75 秒介绍视频（1920×1080，30 fps）：[`out/intro.mp4`](out/intro.mp4) —— 用 [Remotion](https://www.remotion.dev/) 制作，源码在 [`video/`](video/)。

## 插件页面

设置页上带有 **「API 支持由 TokenDance 提供」** 字样、TokenDance 品牌图标，以及面向小白的 TokenDance 介绍。

## 仓库结构

```text
index.js            Host 侧：设置、OAuth、目录、HTTP 路由、工具
client.js           Client 侧：设置页（slot + locale 注册）
src/                config、catalog、credentials、http、image、jev、
                    oauth、patch、pi-ai、tools、trust
locale/             中英双语元数据
test/               node:test 测试集
scripts/            check-catalog.mjs、oauth-once.mjs
logo/               品牌资产
video/              Remotion 工程
out/                intro.mp4 + 封面
```

## 许可证

[MIT](LICENSE)。“TokenDance”为其各自权利人的商标；本项目与 TokenDance 无隶属或背书关系，它所配置的 API 访问由 TokenDance 提供。
