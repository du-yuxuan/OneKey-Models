/**
 * OneKey-Models — Client half.
 *
 * Renders the plugin's page inside the plugin manager's `plugins.bundle.config`
 * slot (keyed by the package name, so it appears on this bundle's own detail
 * page): one-click API-key authorisation, the live model catalog with tick
 * boxes, apply-to-router, and an advanced panel for the remaining settings.
 *
 * It talks to the Host half over same-origin `/api/onekey-models` routes rather
 * than a typed Remote binding, for the reason dsh-our-free-model documents:
 * those routes are served by this same host process on every target kernel, so
 * there is no generated `/remote` artefact to mount, and the client-side
 * `$mount` refuses anything whose codec is not strict anyway. The Host half owns
 * the trust fence; this file never sees a key — no response carries one.
 *
 * No React import: the browser module table hands React to the factory, exactly
 * as the host-plugin skill's template does.
 *
 * @module client
 */
window.__ModuleLoader__.load({
  id: 'onekey-models',
  factory(require) {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const { createElement: h, Fragment, useCallback, useEffect, useMemo, useRef, useState } = React

    const NS = 'plugins.onekeyModels'
    const PACKAGE = 'onekey-models'
    const API = '/api/onekey-models'
    const inject = ['slots', 'locale']
    const TOKENDANCE = 'https://tokendance.space'
    const TOKENDANCE_LOGO = 'https://tokendance.space/TokenDance%E5%93%81%E7%89%8C%E5%9B%BE%E6%A0%87-%E9%80%8F%E6%98%8E%E5%BA%95.svg'

    /**
     * Flat dictionaries. `locale/*.json` only carries the plugin-card
     * meta.title/meta.description the host reads without activating us; every
     * string this page renders lives here, because this module renders it.
     */
    const DICT = {
      zh: {
        'title': 'OneKey-Models',
        'subtitle': '一键接入 TokenDance，把最新最热的大模型装进你的模型列表',
        'poweredBy': 'TokenDance 提供 API 支持',
        'step.key': '第 1 步 · 获取 API Key',
        'step.list': '第 2 步 · 挑选要显示的模型',
        'step.apply': '第 3 步 · 应用到模型列表',
        'step.advanced': '高级设置',
        'key.off': '尚未配置 API Key',
        'key.on': 'API Key 已配置（{ref}）',
        'key.get': '一键获取 API Key',
        'key.getting': '正在准备授权…',
        'key.open': '打开 TokenDance 授权页',
        'key.openHint': '点击后在新标签页登录 TokenDance 并同意授权，页面会自动跳回本机完成绑定。',
        'key.codeLabel': '授权码（可选）',
        'key.codePh': '粘贴授权页显示的 10 分钟授权码，可跳过自动跳回',
        'key.finish': '完成授权',
        'key.finishing': '等待授权完成…',
        'key.cancel': '取消授权',
        'key.clear': '清除本地 Key',
        'key.cleared': '本地 Key 已清除',
        'key.done': 'API Key 已保存到本地',
        'key.fail': '授权未完成：{msg}',
        'list.refresh': '刷新模型目录',
        'list.refreshing': '刷新中…',
        'list.search': '搜索模型 id / 名称…',
        'list.showing': '显示 {n} / {total} 个模型',
        'list.empty': '目录里没有匹配的模型',
        'list.save': '保存显示配置',
        'list.saving': '保存中…',
        'list.saved': '显示配置已保存',
        'list.atLeastOne': '至少保留一个显示的模型',
        'list.imageInput': '图片输入',
        'list.toolOnly': '仅工具调用',
        'list.routeable': '可对话',
        'list.noKeyWarn': '先完成第 1 步，配置才能生效到模型列表',
        'cap.all': '全部',
        'cap.chat': '对话',
        'cap.image': '生图',
        'cap.video': '视频',
        'cap.jev': 'Jev',
        'cap.speech': '语音',
        'cap.other': '其他',
        'badge.image': '生图',
        'badge.video': '视频',
        'badge.jev': 'Jev',
        'badge.embedding': '向量',
        'badge.rerank': '重排',
        'badge.speech': '语音',
        'badge.audio': '听写',
        'badge.music': '音乐',
        'badge.search': '搜索',
        'apply.run': '一键应用到模型列表',
        'apply.running': '应用中…',
        'apply.done': '已写入 {n} 个模型（隐藏 {hidden} 个）',
        'apply.needKey': '请先完成第 1 步获取 API Key',
        'apply.needModels': '请先在第 2 步至少勾选一个模型',
        'apply.notRouted': '模型列表尚未写入本插件的配置',
        'apply.routed': '模型列表已配置 {n} 个模型',
        'adv.providerRoute': 'Provider ID',
        'adv.routeHint': '模型列表里这个提供方的固定标识，创建后不可修改',
        'adv.displayName': '显示名称',
        'adv.baseURL': '网关地址',
        'adv.keyName': 'Key 名称',
        'adv.appUrl': '应用归因地址（app_url）',
        'adv.authOrigin': '授权页地址',
        'adv.modelsDevUrl': 'models.dev 目录地址',
        'adv.toolTimeoutMs': '工具超时（毫秒）',
        'adv.autoConfigure': '授权后自动写入模型列表',
        'adv.enableCatalogTool': '启用模型目录工具',
        'adv.enableImageTool': '启用生图工具',
        'adv.enableJevTool': '启用 Jev 工具',
        'adv.save': '保存高级设置',
        'adv.saving': '保存中…',
        'adv.saved': '高级设置已保存',
        'adv.noChange': '没有需要保存的改动',
        'adv.rejected': '以下字段未通过校验：{list}',
        'td.what': 'TokenDance 是什么？',
        'step.account': '账户 · 余额 / 兑换 / 充值',
        'acct.balance': '余额',
        'acct.balanceTip': '来自 TokenDance 开放平台，随调用实时扣减',
        'acct.refresh': '刷新',
        'acct.redeemPh': '输入兑换码',
        'acct.redeem': '兑换',
        'acct.redeemDone': '兑换成功，到账 {yuan} 元',
        'acct.topup': '充值',
        'acct.amount': '金额（元）',
        'acct.createSession': '生成支付二维码',
        'acct.scan': '微信 / 支付宝扫码支付',
        'acct.alipay': '在手机支付宝中打开',
        'acct.waiting': '等待支付中…',
        'acct.paid': '支付成功，额度已到账',
        'acct.expired': '支付会话已过期，请重新发起',
        'acct.close': '关闭',
        'acct.usage': '最近调用',
        'acct.usageEmpty': '暂无调用记录',
        'acct.needKey': '完成第 1 步后即可使用账户功能',
        'acct.payHint': '扫码后本页自动确认到账；未到账前请勿重复发起',
        'acct.recoverTopup': '余额不足，请先充值',
        'acct.recoverReauth': '授权已失效，请重新获取 API Key',
        'acct.recoverQuota': '额度已用尽，请等待周期刷新或重新授权',
        'td.body': 'TokenDance 是一个模型聚合网关：一个地址、一把 Key，就能调用市面上最新最热的大模型（GLM、DeepSeek、Kimi、Qwen、MiniMax 等），支持对话、生图、多模态、Jev 判定等多种能力。本插件的模型目录与调用全部由 TokenDance 提供支持，配置只保存在你自己的电脑上。',
        'td.visit': '访问 tokendance.space',
        'common.loading': '加载中…',
        'common.error': '出错了：{msg}',
        'common.retry': '重试',
        'common.caps': '能力',
        'common.ctx': '上下文',
        'common.source': '目录信息来自 TokenDance 实时目录与 models.dev',
      },
      en: {
        'title': 'OneKey-Models',
        'subtitle': 'One click to connect TokenDance and put the newest hot models into your model list',
        'poweredBy': 'API support powered by TokenDance',
        'step.key': 'Step 1 · Get an API key',
        'step.list': 'Step 2 · Pick the models to show',
        'step.apply': 'Step 3 · Apply to the model list',
        'step.advanced': 'Advanced',
        'key.off': 'No API key configured yet',
        'key.on': 'API key configured ({ref})',
        'key.get': 'Get an API key in one click',
        'key.getting': 'Preparing authorisation…',
        'key.open': 'Open the TokenDance authorisation page',
        'key.openHint': 'Sign in to TokenDance and approve in the new tab; the page jumps back here to finish binding automatically.',
        'key.codeLabel': 'Authorisation code (optional)',
        'key.codePh': 'Paste the 10-minute code shown on the page to skip the automatic jump-back',
        'key.finish': 'Finish authorisation',
        'key.finishing': 'Waiting for authorisation…',
        'key.cancel': 'Cancel',
        'key.clear': 'Clear local key',
        'key.cleared': 'Local key cleared',
        'key.done': 'API key saved locally',
        'key.fail': 'Authorisation not finished: {msg}',
        'list.refresh': 'Refresh catalog',
        'list.refreshing': 'Refreshing…',
        'list.search': 'Search model id / name…',
        'list.showing': 'Showing {n} / {total} models',
        'list.empty': 'No matching model in the catalog',
        'list.save': 'Save display config',
        'list.saving': 'Saving…',
        'list.saved': 'Display config saved',
        'list.atLeastOne': 'Keep at least one model visible',
        'list.imageInput': 'Image input',
        'list.toolOnly': 'Tool only',
        'list.routeable': 'Chat-capable',
        'list.noKeyWarn': 'Finish step 1 first so the config reaches the model list',
        'cap.all': 'All',
        'cap.chat': 'Chat',
        'cap.image': 'Image',
        'cap.video': 'Video',
        'cap.jev': 'Jev',
        'cap.speech': 'Speech',
        'cap.other': 'Other',
        'badge.image': 'Image',
        'badge.video': 'Video',
        'badge.jev': 'Jev',
        'badge.embedding': 'Embedding',
        'badge.rerank': 'Rerank',
        'badge.speech': 'TTS',
        'badge.audio': 'ASR',
        'badge.music': 'Music',
        'badge.search': 'Search',
        'apply.run': 'Apply to the model list',
        'apply.running': 'Applying…',
        'apply.done': 'Wrote {n} models (hid {hidden})',
        'apply.needKey': 'Finish step 1 to get an API key first',
        'apply.needModels': 'Tick at least one model in step 2 first',
        'apply.notRouted': 'This plugin has not written to the model list yet',
        'apply.routed': 'Model list configured with {n} models',
        'adv.providerRoute': 'Provider ID',
        'adv.routeHint': 'Fixed lowercase identifier in the model list; it cannot be renamed later',
        'adv.displayName': 'Display name',
        'adv.baseURL': 'Gateway base URL',
        'adv.keyName': 'Key name',
        'adv.appUrl': 'App attribution URL (app_url)',
        'adv.authOrigin': 'Authorisation origin',
        'adv.modelsDevUrl': 'models.dev catalog URL',
        'adv.toolTimeoutMs': 'Tool timeout (ms)',
        'adv.autoConfigure': 'Auto-apply the model list after authorising',
        'adv.enableCatalogTool': 'Enable catalog tool',
        'adv.enableImageTool': 'Enable image tool',
        'adv.enableJevTool': 'Enable Jev tool',
        'adv.save': 'Save advanced settings',
        'adv.saving': 'Saving…',
        'adv.saved': 'Advanced settings saved',
        'adv.noChange': 'Nothing changed to save',
        'adv.rejected': 'These fields failed validation: {list}',
        'step.account': 'Account · Balance / Redeem / Top up',
        'acct.balance': 'Balance',
        'acct.balanceTip': 'From the TokenDance open platform; consumed per call',
        'acct.refresh': 'Refresh',
        'acct.redeemPh': 'Enter a redemption code',
        'acct.redeem': 'Redeem',
        'acct.redeemDone': 'Redeemed {yuan} yuan',
        'acct.topup': 'Top up',
        'acct.amount': 'Amount (yuan)',
        'acct.createSession': 'Show payment QR code',
        'acct.scan': 'Scan with WeChat / Alipay to pay',
        'acct.alipay': 'Open in Alipay (mobile)',
        'acct.waiting': 'Waiting for payment…',
        'acct.paid': 'Payment received — credits added',
        'acct.expired': 'Payment session expired; start a new one',
        'acct.close': 'Close',
        'acct.usage': 'Recent calls',
        'acct.usageEmpty': 'No calls yet',
        'acct.needKey': 'Finish step 1 to use account features',
        'acct.payHint': 'The page confirms the payment automatically once it lands; do not start a second session before it does',
        'acct.recoverTopup': 'Balance exhausted — top up first',
        'acct.recoverReauth': 'Key invalid or expired — re-authorise',
        'acct.recoverQuota': 'Quota reached — wait for the reset or re-authorise',
        'td.what': 'What is TokenDance?',
        'td.body': 'TokenDance is a model aggregation gateway: one endpoint and one key for the newest hot models (GLM, DeepSeek, Kimi, Qwen, MiniMax and more), covering chat, image generation, multimodal input and Jev judgement. This plugin is powered by TokenDance for its catalog and calls, and every configuration stays on your own machine.',
        'td.visit': 'Visit tokendance.space',
        'common.loading': 'Loading…',
        'common.error': 'Something went wrong: {msg}',
        'common.retry': 'Retry',
        'common.caps': 'Caps',
        'common.ctx': 'Context',
        'common.source': 'Catalog from the live TokenDance directory and models.dev',
      },
    }

    const CSS = `
.om-page { display: flex; flex-direction: column; gap: 16px; color: var(--dsw-alias-label-primary); font-family: var(--dsw-font-family); }
.om-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.om-logo { width: 34px; height: 34px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-settings-card-fill); border: 1px solid var(--dsw-alias-border-l1); display: grid; place-items: center; flex: none; }
.om-h1 { font-size: 18px; font-weight: 650; margin: 0; }
.om-sub { font-size: var(--dsw-font-xs-13); color: var(--dsw-alias-label-secondary); margin: 2px 0 0; }
.om-badge { display: inline-flex; align-items: center; gap: 6px; font-size: var(--dsw-font-xxs-12); padding: 3px 10px; border-radius: 999px; background: var(--dsw-alias-settings-card-fill); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); text-decoration: none; }
.om-badge:hover { background: var(--dsw-alias-interactive-bg-hover); }
.om-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); flex: none; }
.om-card { background: var(--dsw-alias-settings-card-fill); border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-lg); padding: 16px; }
.om-step { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.om-num { width: 20px; height: 20px; border-radius: 50%; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-inverted); font-size: 12px; display: grid; place-items: center; flex: none; }
.om-rowline { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.om-pill { display: inline-flex; align-items: center; gap: 6px; font-size: var(--dsw-font-xs-13); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); }
.om-pill.on { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.om-pill.warn { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.om-btn { font: inherit; font-size: var(--dsw-font-xs-13); padding: 7px 14px; border-radius: var(--dsw-radius-md); border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; }
.om-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.om-btn:disabled { opacity: 0.5; cursor: default; }
.om-btn.primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-inverted); }
.om-btn.primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.om-btn.danger { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.om-btn:focus-visible, .om-input:focus-visible, .om-check:focus-visible, a:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color); outline-offset: 1px; }
.om-input { font: inherit; font-size: var(--dsw-font-xs-13); padding: 7px 10px; border-radius: var(--dsw-radius-md); border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); min-width: 0; }
.om-input::placeholder { color: var(--dsw-alias-label-caption); }
.om-note { font-size: var(--dsw-font-xs-13); color: var(--dsw-alias-label-tertiary); margin: 8px 0 0; }
.om-msg { font-size: var(--dsw-font-xs-13); padding: 8px 12px; border-radius: var(--dsw-radius-md); border: 1px solid var(--dsw-alias-border-l1); }
.om-msg.ok { color: var(--dsw-alias-state-success-primary); }
.om-msg.err { color: var(--dsw-alias-state-error-primary); }
.om-chips { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
.om-chip { font: inherit; font-size: var(--dsw-font-xxs-12); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.om-chip:hover { background: var(--dsw-alias-interactive-bg-hover); }
.om-chip.on { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-inverted); }
.om-list { border-top: 1px solid var(--dsw-alias-border-l1); max-height: 420px; overflow: auto; }
.om-model { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.om-model:hover { background: var(--dsw-alias-interactive-bg-hover); }
.om-check { accent-color: var(--dsw-alias-button-primary-fill); width: 15px; height: 15px; flex: none; cursor: pointer; }
.om-mid { flex: 1; min-width: 0; }
.om-mid-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.om-id { font-size: var(--dsw-font-xs-13); font-weight: 600; }
.om-name { font-size: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-secondary); }
.om-ctx { font-size: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-caption); }
.om-tags { display: flex; gap: 4px; flex-wrap: wrap; }
.om-tag { font-size: var(--dsw-font-xxs-12); padding: 1px 7px; border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); }
.om-tag.tool { color: var(--dsw-alias-state-warn-primary); }
.om-toggle { font: inherit; font-size: var(--dsw-font-xxs-12); padding: 3px 9px; border-radius: 999px; border: 1px dashed var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-tertiary); cursor: pointer; flex: none; }
.om-toggle.on { border-style: solid; border-color: var(--dsw-alias-state-success-primary); color: var(--dsw-alias-state-success-primary); }
.om-tail { display: flex; align-items: center; gap: 10px; justify-content: space-between; margin-top: 12px; flex-wrap: wrap; }
.om-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.om-field { display: flex; flex-direction: column; gap: 5px; }
.om-field > label { font-size: var(--dsw-font-xxs-12); color: var(--dsw-alias-label-secondary); }
.om-checks { display: flex; flex-direction: column; gap: 8px; }
.om-checks label { display: flex; align-items: center; gap: 8px; font-size: var(--dsw-font-xs-13); cursor: pointer; }
.om-td { display: flex; gap: 14px; align-items: flex-start; }
.om-td-logo { width: 44px; height: 44px; border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1); display: grid; place-items: center; flex: none; overflow: hidden; }
.om-td-logo img { max-width: 34px; max-height: 34px; }
.om-td h4 { margin: 0 0 6px; font-size: 14px; }
.om-td p { margin: 0; font-size: var(--dsw-font-xs-13); color: var(--dsw-alias-label-secondary); line-height: 1.7; }
.om-link { color: var(--dsw-alias-link); text-decoration: none; }
.om-link:hover { text-decoration: underline; }
.om-empty { padding: 24px; text-align: center; color: var(--dsw-alias-label-caption); font-size: var(--dsw-font-xs-13); }
`

    // ── helpers ────────────────────────────────────────────────────────────

    /** One JSON round-trip to the Host half; never throws. */
    async function api(path, options = {}) {
      try {
        const init = { method: options.method ?? 'GET', cache: 'no-store', redirect: 'error' }
        if (options.body !== undefined) {
          init.headers = { 'content-type': 'application/json' }
          init.body = JSON.stringify(options.body)
        }
        const res = await fetch(`${API}${path}`, init)
        let data = null
        try { data = await res.json() } catch { data = null }
        return { status: res.status, ok: res.ok, data }
      } catch (error) {
        return { status: 0, ok: false, data: { error: String(error?.message ?? error) } }
      }
    }

    /** "参数替换" — tiny `{name}` interpolation shared by both locales. */
    const fill = (text, params) =>
      String(text).replace(/\{(\w+)\}/g, (_, key) => String(params?.[key] ?? `{${key}}`))

    const fallbackT = (key, params) => {
      const lang = String(document.documentElement.lang ?? '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
      return fill(DICT[lang]?.[key] ?? DICT.en[key] ?? key, params)
    }

    const fmtCtx = (n) => (typeof n === 'number' && n > 0 ? `${Math.round(n / 1000)}K` : '')

    const CAP_FILTERS = ['all', 'chat', 'image', 'video', 'jev', 'speech', 'other']

    const matchesFilter = (m, filter) => {
      if (filter === 'all') return true
      if (filter === 'chat') return Boolean(m.routeable)
      if (filter === 'other') {
        return !m.routeable && !['image', 'video', 'jev', 'speech'].some((c) => m.capabilities?.includes(c))
      }
      return Boolean(m.capabilities?.includes(filter))
    }

    const ADV_FIELDS = [
      'providerRoute', 'displayName', 'baseURL', 'keyName', 'authOrigin',
      'modelsDevUrl', 'toolTimeoutMs', 'autoConfigure', 'enableCatalogTool',
      'enableImageTool', 'enableJevTool',
    ]

    // ── the page ───────────────────────────────────────────────────────────

    function OneKeyModelsPage(props) {
      const t = typeof props.t === 'function' ? props.t : fallbackT

      const [status, setStatus] = useState(null)
      const [error, setError] = useState('')
      const [busy, setBusy] = useState('')
      const [msg, setMsg] = useState(null) // { kind: 'ok' | 'err', text }
      const [auth, setAuth] = useState(null) // { url, callbackUrl, keyName } from /auth/start
      const [code, setCode] = useState('')
      const [query, setQuery] = useState('')
      const [filter, setFilter] = useState('all')
      const [visible, setVisible] = useState(null) // Set<id> | null → lazily seeded from status
      const [imgIn, setImgIn] = useState(null) // Set<id> | null
      const [draft, setDraft] = useState(null) // advanced-form copy of editable settings
      const alive = useRef(true)

      useEffect(() => () => { alive.current = false }, [])

      const load = useCallback(async () => {
        const r = await api('/status')
        if (!alive.current) return
        if (!r.ok || !r.data?.ok) {
          setError(r.data?.error ?? `HTTP ${r.status}`)
          return
        }
        setError('')
        setStatus(r.data)
      }, [])

      useEffect(() => { void load() }, [load])

      // Seed the tick-box sets once per status arrival the first time only, so
      // a refresh never clobbers edits the user is in the middle of making.
      useEffect(() => {
        if (!status) return
        const routeable = (status.catalog?.models ?? []).filter((m) => m.routeable).map((m) => m.id)
        if (visible === null) {
          const saved = status.settings?.visibleModels ?? []
          setVisible(new Set(saved.length ? saved : routeable))
        }
        if (imgIn === null) setImgIn(new Set(status.settings?.imageInputModels ?? []))
        if (draft === null) {
          const pick = {}
          for (const key of ADV_FIELDS) pick[key] = status.settings?.[key] ?? ''
          setDraft(pick)
        }
      }, [status, visible, imgIn, draft])

      // Symptom-2 fix (m03888): when a key exists but no provider row has been
      // published yet, apply once automatically so models show up in the
      // model selector without the user having to find step 3 by hand.
      const autoApplied = useRef(false)
      useEffect(() => {
        if (!status || autoApplied.current) return
        const keyOk = Boolean(status.key?.configured)
        const routedOk = Boolean(status.routed?.present)
        const modelsOk = (status.catalog?.models ?? []).some((m) => m.routeable)
        const autoOk = status.settings?.autoConfigure !== false
        if (keyOk && !routedOk && modelsOk && autoOk) {
          autoApplied.current = true
          void (async () => {
            const r = await api('/apply', { method: 'POST', body: {} })
            if (r.data?.ok) void load()
          })()
        }
      }, [status])

      const models = useMemo(() => status?.catalog?.models ?? [], [status])
      const routeableIds = useMemo(() => models.filter((m) => m.routeable).map((m) => m.id), [models])

      const shown = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return models.filter((m) => {
          if (!matchesFilter(m, filter)) return false
          if (!needle) return true
          return String(m.id).toLowerCase().includes(needle) ||
            String(m.name ?? '').toLowerCase().includes(needle)
        })
      }, [models, query, filter])

      const keyConfigured = Boolean(status?.key?.configured)
      const routed = status?.routed?.present ? status.routed : null

      const act = useCallback(async (which, path, body, onSuccess) => {
        setBusy(which)
        setMsg(null)
        const r = await api(path, body === undefined ? {} : { method: 'POST', body })
        if (!alive.current) return
        setBusy('')
        if (r.ok && (r.data?.ok ?? true)) onSuccess?.(r.data ?? {})
        else setMsg({ kind: 'err', text: fill(t('common.error'), { msg: r.data?.error ?? r.data?.problem ?? `HTTP ${r.status}` }) })
      }, [t])

      const startAuth = () => act('auth-start', '/auth/start', {}, (data) => {
        setAuth({ url: data.url, callbackUrl: data.callbackUrl, keyName: data.keyName })
        setCode('')
      })

      const finishAuth = () => act('auth-finish', '/auth/finish', code.trim() ? { code: code.trim() } : {}, () => {
        setAuth(null)
        setCode('')
        setMsg({ kind: 'ok', text: t('key.done') })
        void load()
      })

      const cancelAuth = () => act('auth-cancel', '/auth/cancel', {}, () => {
        setAuth(null)
        setMsg(null)
      })

      const clearKey = () => act('key-clear', '/key/clear', {}, () => {
        setMsg({ kind: 'ok', text: t('key.cleared') })
        void load()
      })

      const refreshCatalog = () => act('refresh', '/catalog/refresh', {}, () => void load())

      const saveList = () => {
        if (visible && visible.size === 0) {
          setMsg({ kind: 'err', text: t('list.atLeastOne') })
          return
        }
        act('save', '/config', {
          visibleModels: visible ? [...visible] : [],
          imageInputModels: imgIn ? [...imgIn] : [],
        }, (data) => {
          setMsg({ kind: 'ok', text: t('list.saved') })
          if (data.settings) setStatus((s) => (s ? { ...s, settings: data.settings } : s))
        })
      }

      const applyNow = () => act('apply', '/apply', {}, (data) => {
        setMsg({ kind: 'ok', text: fill(t('apply.done'), { n: data.modelCount ?? 0, hidden: data.hidden ?? 0 }) })
        void load()
      })

      const saveAdvanced = () => {
        const patch = {}
        for (const key of ADV_FIELDS) {
          if (String(draft?.[key] ?? '') !== String(status?.settings?.[key] ?? '')) patch[key] = draft[key]
        }
        if (Object.keys(patch).length === 0) {
          setMsg({ kind: 'ok', text: t('adv.noChange') })
          return
        }
        act('adv', '/config', patch, (data) => {
          setMsg(data.rejected?.length
            ? { kind: 'err', text: fill(t('adv.rejected'), { list: data.rejected.join(', ') }) }
            : { kind: 'ok', text: t('adv.saved') })
          if (data.settings) {
            setStatus((s) => (s ? { ...s, settings: data.settings } : s))
            const next = {}
            for (const key of ADV_FIELDS) next[key] = data.settings?.[key] ?? ''
            setDraft(next)
          }
        })
      }

      const toggleVisible = (id) =>
        setVisible((prev) => {
          const next = new Set(prev ?? routeableIds)
          next.has(id) ? next.delete(id) : next.add(id)
          return next
        })

      const toggleImage = (id) =>
        setImgIn((prev) => {
          const next = new Set(prev ?? [])
          next.has(id) ? next.delete(id) : next.add(id)
          return next
        })

      if (error) {
        return h('div', { className: 'om-page' },
          h('div', { className: 'om-msg err' }, fill(t('common.error'), { msg: error })),
          h('div', null, h('button', { className: 'om-btn', onClick: () => void load() }, t('common.retry'))))
      }
      if (!status) return h('div', { className: 'om-page' }, h('div', { className: 'om-note' }, t('common.loading')))

      const visibleCount = visible?.size ?? routeableIds.length
      const canApply = keyConfigured && visibleCount > 0

      return h('div', { className: 'om-page' },

        // ── header ──
        h('div', { className: 'om-head' },
          h('div', { className: 'om-logo' },
            h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true' },
              h('path', {
                d: 'M14 3a7 7 0 1 0-6.3 10.05L9 14.35V17h2.5v2h2v2h4v-4.7l-4.15-4.15A7 7 0 0 0 14 3Zm-5 7a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z',
                fill: 'var(--dsw-alias-button-primary-fill)',
              }))),
          h('div', null,
            h('h2', { className: 'om-h1' }, t('title')),
            h('p', { className: 'om-sub' }, t('subtitle'))),
          h('a', {
            className: 'om-badge', href: TOKENDANCE, target: '_blank', rel: 'noreferrer',
            title: t('td.what'),
          }, h('span', { className: 'om-dot' }), t('poweredBy'))),

        msg ? h('div', { className: `om-msg ${msg.kind}` }, msg.text) : null,

        // ── step 1: key ──
        h('section', { className: 'om-card' },
          h('div', { className: 'om-step' }, h('span', { className: 'om-num' }, '1'), t('step.key')),
          h('div', { className: 'om-rowline' },
            keyConfigured
              ? h(Fragment, null,
                h('span', { className: 'om-pill on' }, h('span', { className: 'om-dot' }), fill(t('key.on'), { ref: status.key.ref })),
                h('button', {
                  className: 'om-btn danger', disabled: busy === 'key-clear',
                  onClick: clearKey,
                }, t('key.clear')))
              : h(Fragment, null,
                h('button', {
                  className: 'om-btn primary', disabled: busy === 'auth-start',
                  onClick: startAuth,
                }, busy === 'auth-start' ? t('key.getting') : t('key.get')),
                auth?.url ? h('a', {
                  className: 'om-btn', href: auth.url, target: '_blank', rel: 'noreferrer',
                }, t('key.open')) : null)),
          auth ? h(Fragment, null,
            h('p', { className: 'om-note' }, t('key.openHint')),
            h('div', { className: 'om-rowline', style: { marginTop: '10px' } },
              h('input', {
                className: 'om-input', style: { flex: '1 1 260px' },
                placeholder: t('key.codePh'), value: code,
                onChange: (e) => setCode(e.target.value),
                'aria-label': t('key.codeLabel'),
              }),
              h('button', {
                className: 'om-btn primary', disabled: busy === 'auth-finish',
                onClick: finishAuth,
              }, busy === 'auth-finish' ? t('key.finishing') : t('key.finish')),
              h('button', {
                className: 'om-btn', disabled: busy === 'auth-cancel',
                onClick: cancelAuth,
              }, t('key.cancel')))) : null,
          !keyConfigured ? h('p', { className: 'om-note' }, t('list.noKeyWarn')) : null),

        // ── step 2: pick models ──
        h('section', { className: 'om-card' },
          h('div', { className: 'om-step' }, h('span', { className: 'om-num' }, '2'), t('step.list')),
          h('div', { className: 'om-rowline' },
            h('input', {
              className: 'om-input', style: { flex: '1 1 220px' },
              placeholder: t('list.search'), value: query,
              onChange: (e) => setQuery(e.target.value),
            }),
            h('button', { className: 'om-btn', disabled: busy === 'refresh', onClick: refreshCatalog },
              busy === 'refresh' ? t('list.refreshing') : t('list.refresh'))),
          h('div', { className: 'om-chips' },
            CAP_FILTERS.map((key) =>
              h('button', {
                key, className: `om-chip${filter === key ? ' on' : ''}`,
                onClick: () => setFilter(key),
              }, t(`cap.${key}`)))),
          shown.length === 0
            ? h('div', { className: 'om-empty' }, t('list.empty'))
            : h('div', { className: 'om-list' },
              shown.map((m) => h('div', { key: m.id, className: 'om-model' },
                h('input', {
                  className: 'om-check', type: 'checkbox',
                  checked: Boolean(visible?.has(m.id)),
                  disabled: !m.routeable,
                  onChange: () => toggleVisible(m.id),
                  'aria-label': m.id,
                }),
                h('div', { className: 'om-mid' },
                  h('div', { className: 'om-mid-top' },
                    h('span', { className: 'om-id' }, m.id),
                    m.name && m.name !== m.id ? h('span', { className: 'om-name' }, m.name) : null,
                    fmtCtx(m.contextWindow) ? h('span', { className: 'om-ctx' }, `${t('common.ctx')} ${fmtCtx(m.contextWindow)}`) : null),
                  h('div', { className: 'om-tags' },
                    (m.capabilities ?? []).map((c) => h('span', { key: c, className: 'om-tag' }, t(`badge.${c}`))),
                    !m.routeable ? h('span', { className: 'om-tag tool' }, t('list.toolOnly')) : null)),
                m.routeable
                  ? h('button', {
                    className: `om-toggle${imgIn?.has(m.id) ? ' on' : ''}`,
                    onClick: () => toggleImage(m.id),
                    title: t('list.imageInput'),
                  }, t('list.imageInput'))
                  : null))),
          h('div', { className: 'om-tail' },
            h('span', { className: 'om-note', style: { margin: 0 } },
              fill(t('list.showing'), { n: visibleCount, total: routeableIds.length })),
            h('button', { className: 'om-btn primary', disabled: busy === 'save', onClick: saveList },
              busy === 'save' ? t('list.saving') : t('list.save')))),

        // ── step 3: apply ──
        h('section', { className: 'om-card' },
          h('div', { className: 'om-step' }, h('span', { className: 'om-num' }, '3'), t('step.apply')),
          h('div', { className: 'om-rowline' },
            h('button', {
              className: 'om-btn primary', disabled: !canApply || busy === 'apply',
              onClick: applyNow,
            }, busy === 'apply' ? t('apply.running') : t('apply.run')),
            routed
              ? h('span', { className: 'om-pill on' }, fill(t('apply.routed'), { n: routed.modelIds.length }))
              : h('span', { className: 'om-pill warn' }, t('apply.notRouted'))),
          !keyConfigured ? h('p', { className: 'om-note' }, t('apply.needKey'))
            : visibleCount === 0 ? h('p', { className: 'om-note' }, t('apply.needModels')) : null),

        // ── account: balance / redeem / top-up ──
        // Rendered as a real element, never called inline: calling it made its
        // hooks part of this component's sequence, so the `if (!status)` early
        // return below meant they only ran from the second render on — React
        // error #310 (rendered more hooks than the previous render).
        h(AccountSection, {
          status, busy, t, fill, api,
          onMessage: setMsg,
          onBusy: (v) => setBusy(v ? 'acct' : ''),
        }),
        // ── advanced ──
        h('details', { className: 'om-card' },
          h('summary', { className: 'om-step', style: { cursor: 'pointer' } }, t('step.advanced')),
          h('div', { className: 'om-grid', style: { marginTop: '12px' } },
            advField(t, 'providerRoute', draft, setDraft, t('adv.routeHint')),
            advField(t, 'displayName', draft, setDraft),
            advField(t, 'baseURL', draft, setDraft),
            advField(t, 'keyName', draft, setDraft),
            // appUrl removed from the form: attribution is fixed in code.
            advField(t, 'authOrigin', draft, setDraft),
            advField(t, 'modelsDevUrl', draft, setDraft),
            advField(t, 'toolTimeoutMs', draft, setDraft, undefined, 'number')),
          h('div', { className: 'om-checks', style: { marginTop: '12px' } },
            advCheck(t, 'autoConfigure', draft, setDraft),
            advCheck(t, 'enableCatalogTool', draft, setDraft),
            advCheck(t, 'enableImageTool', draft, setDraft),
            advCheck(t, 'enableJevTool', draft, setDraft)),
          h('div', { className: 'om-tail' },
            h('span', null),
            h('button', { className: 'om-btn primary', disabled: busy === 'adv' || !draft, onClick: saveAdvanced },
              busy === 'adv' ? t('adv.saving') : t('adv.save')))),

        // ── TokenDance explainer ──
        h('section', { className: 'om-card om-td' },
          h('div', { className: 'om-td-logo' },
            h('img', {
              src: TOKENDANCE_LOGO, alt: 'TokenDance',
              onError: (e) => { e.currentTarget.style.display = 'none' },
            })),
          h('div', null,
            h('h4', null, t('td.what')),
            h('p', null, t('td.body')),
            h('p', { style: { marginTop: '8px' } },
              h('a', { className: 'om-link', href: TOKENDANCE, target: '_blank', rel: 'noreferrer' }, t('td.visit')),
              h('span', { className: 'om-ctx', style: { marginLeft: '10px' } }, t('common.source'))))))
    }

    /**
     * Account area: balance, redemption codes and top-up (Agent payment).
     * All requests go through the plugin HTTP server with the stored key; the
     * key itself never reaches this page.
     */
    function AccountSection({ status, busy, t, fill, api, onMessage, onBusy }) {
      const hasKey = Boolean(status?.key?.configured)
      const [balance, setBalance] = useState(null) // { balance, balanceYuan, ... }
      const [usage, setUsage] = useState(null) // items[]
      const [code, setCode] = useState('')
      const [amount, setAmount] = useState('10')
      const [session, setSession] = useState(null) // normalized payment session
      const [qr, setQr] = useState('') // svg from /portal/payment
      const pollRef = useRef(null)
      useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

      // Portal failures may carry TokenDance-Recovery-Action
      // (docs/api-key-oauth.md#recover-key): turn it into the next step for the
      // user instead of a bare upstream error.
      const recoveryMsg = (r) => {
        const base = r.data?.error ?? `HTTP ${r.status}`
        const hint = {
          top_up_balance: t('acct.recoverTopup'),
          reauthorize_api_key: t('acct.recoverReauth'),
          api_key_quota: t('acct.recoverQuota'),
        }[r.data?.recovery]
        return hint === undefined ? base : `${base} — ${hint}`
      }
      const loadBalance = async () => {
        onBusy(true)
        const r = await api('/portal/balance')
        onBusy(false)
        if (r.data?.ok) setBalance(r.data)
        else if (r.status !== 0) onMessage({ kind: 'err', text: fill(t('common.error'), { msg: recoveryMsg(r) }) })
      }
      const loadUsage = async () => {
        const r = await api('/portal/usage?limit=10')
        if (r.data?.ok) setUsage(r.data.items ?? [])
      }
      // Seed once a key exists. Effect deps stay minimal on purpose: this is a
      // one-shot seed per key-arrival, not a balance subscription.
      useEffect(() => {
        if (!hasKey) return
        void loadBalance()
        void loadUsage()
      }, [hasKey])

      const redeem = async () => {
        if (!code.trim()) return
        onBusy(true)
        const r = await api('/portal/redeem', { method: 'POST', body: { code: code.trim() } })
        onBusy(false)
        if (r.data?.ok) {
          onMessage({ kind: 'ok', text: fill(t('acct.redeemDone'), { yuan: r.data.creditsYuan }) })
          setCode('')
          void loadBalance()
        } else {
          onMessage({ kind: 'err', text: fill(t('common.error'), { msg: recoveryMsg(r) }) })
        }
      }

      const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
      const startPolling = (sessionId) => {
        stopPolling()
        pollRef.current = setInterval(async () => {
          const r = await api('/portal/payment', { method: 'POST', body: { action: 'status', sessionId } })
          const s = r.data
          if (!s?.ok) return // transient errors keep polling until expiry
          if (s.session?.status === 'paid') {
            stopPolling()
            setSession(s.session)
            onMessage({ kind: 'ok', text: t('acct.paid') })
            void loadBalance()
          } else if (s.session?.status !== 'pending') {
            stopPolling()
            setSession(s.session)
          } else if (s.session?.expired) {
            stopPolling()
            setSession(s.session)
          }
        }, 3000)
      }
      const startPayment = async () => {
        const amountYuan = Math.round(Number(amount))
        if (!Number.isFinite(amountYuan) || amountYuan < 1) return
        onBusy(true)
        const r = await api('/portal/payment', { method: 'POST', body: { amount: amountYuan } })
        onBusy(false)
        if (!r.data?.ok) {
          onMessage({ kind: 'err', text: fill(t('common.error'), { msg: recoveryMsg(r) }) })
          return
        }
        setSession(r.data.session)
        const qrRes = await api('/portal/payment', { method: 'POST', body: { action: 'qr', content: r.data.session.paymentUrl } })
        setQr(qrRes.data?.ok ? qrRes.data.svg : '')
        startPolling(r.data.session.id)
      }
      const closePayment = () => { stopPolling(); setSession(null); setQr('') }

      if (!hasKey) {
        return h('section', { className: 'om-card' },
          h('div', { className: 'om-step' }, h('span', { className: 'om-num' }, '4'), t('step.account')),
          h('p', { className: 'om-note' }, t('acct.needKey')))
      }
      return h('section', { className: 'om-card' },
        h('div', { className: 'om-step' }, h('span', { className: 'om-num' }, '4'), t('step.account')),
        h('div', { className: 'om-rowline' },
          h('span', { className: 'om-pill on' },
            h('span', { className: 'om-dot' }),
// `loadBalance` stores the whole envelope, so the amount lives one
            // level down under `balance` — reading it off the envelope rendered
            // a permanent placeholder instead of the live figure.
            `${t('acct.balance')} ¥${balance?.balance?.balanceYuan ?? '—'}`),
          h('button', { className: 'om-btn', disabled: busy === 'acct', onClick: () => void loadBalance() }, t('acct.refresh'))),
        h('p', { className: 'om-note', style: { margin: '4px 0 0' } }, t('acct.balanceTip')),

        h('div', { className: 'om-rowline', style: { marginTop: '12px' } },
          h('input', {
            className: 'om-input', style: { flex: '1 1 200px' },
            placeholder: t('acct.redeemPh'), value: code,
            onChange: (e) => setCode(e.target.value),
          }),
          h('button', { className: 'om-btn', disabled: busy === 'acct' || !code.trim(), onClick: () => void redeem() }, t('acct.redeem'))),

        h('div', { className: 'om-rowline', style: { marginTop: '12px' } },
          h('input', {
            className: 'om-input', style: { flex: '1 1 120px', maxWidth: '160px' },
            type: 'number', min: 1, step: 1, value: amount,
            onChange: (e) => setAmount(e.target.value),
            'aria-label': t('acct.amount'),
          }),
          h('button', { className: 'om-btn primary', disabled: busy === 'acct' || session, onClick: () => void startPayment() },
            session ? t('acct.waiting') : t('acct.createSession'))),
        session ? h(Fragment, null,
          qr ? h('div', { className: 'om-qr', style: { marginTop: '12px', textAlign: 'center' },
            // SVG comes from the host half; injected as raw markup, never user input.
            dangerouslySetInnerHTML: { __html: qr } }) : null,
          h('p', { className: 'om-note', style: { textAlign: 'center', margin: '8px 0 0' } },
            session.status === 'paid' ? t('acct.paid')
              : session.expired ? t('acct.expired') : t('acct.scan')),
          session.alipayUrl ? h('p', { style: { textAlign: 'center', margin: '8px 0 0' } },
            h('a', { className: 'om-link', href: session.alipayUrl }, t('acct.alipay'))) : null,
          h('p', { className: 'om-note', style: { textAlign: 'center', margin: '4px 0 0' } }, t('acct.payHint')),
          h('div', { style: { textAlign: 'center', marginTop: '8px' } },
            h('button', { className: 'om-btn', onClick: closePayment }, t('acct.close')))) : null,

        h('div', { style: { marginTop: '14px' } },
          h('div', { className: 'om-step', style: { fontSize: '12px' } }, t('acct.usage')),
          usage === null ? null
            : usage.length === 0 ? h('div', { className: 'om-empty' }, t('acct.usageEmpty'))
              : h('div', { className: 'om-list' },
                usage.map((u) => h('div', { key: u.id, className: 'om-model' },
                  h('div', { className: 'om-mid' },
                    h('div', { className: 'om-mid-top' },
                      h('span', { className: 'om-id' }, u.modelId ?? u.model_id ?? '—'),
                      h('span', { className: 'om-ctx' }, `¥${((u.cost ?? 0) / 1e6).toFixed(4)}`)),
                    h('div', { className: 'om-tags' },
                      h('span', { className: 'om-tag' }, u.providerName ?? u.provider_name ?? ''),
                      h('span', { className: 'om-tag' }, String(u.totalTokens ?? u.total_tokens ?? 0)),
                      h('span', { className: 'om-tag' }, new Date(u.createdAt ?? u.created_at).toLocaleString())))))))
      )
    }
    function advField(t, key, draft, setDraft, hint, type = 'text') {
      return h('div', { className: 'om-field' },
        h('label', { htmlFor: `om-${key}` }, t(`adv.${key}`)),
        h('input', {
          id: `om-${key}`, className: 'om-input', type,
          value: String(draft?.[key] ?? ''),
          onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.value })),
        }),
        hint ? h('span', { className: 'om-ctx' }, hint) : null)
    }

    /** One checkbox of the advanced form. */
    function advCheck(t, key, draft, setDraft) {
      return h('label', { key },
        h('input', {
          className: 'om-check', type: 'checkbox',
          checked: Boolean(draft?.[key]),
          onChange: (e) => setDraft((d) => ({ ...d, [key]: e.target.checked })),
        }),
        t(`adv.${key}`))
    }

    // ── host wiring ────────────────────────────────────────────────────────

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }), 'onekey-models: dictionaries')

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', PACKAGE)
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'onekey-models: styles')

      // The Settings home page builds its nav from the `settings.section` list
      // slot: client-ui-settings-general reads `options.id` / `options.order` /
      // `options.label` off each entry and renders the active one with `{ close }`
      // as props. Registering only `plugins.bundle.config` left our page behind
      // the plugin-manager detail view, so the Settings window showed nothing.
      const navT = ctx.locale.bind(NS)
      ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: PACKAGE,
        order: 60,
        label: () => navT('title'),
        locale: NS,
      }, OneKeyModelsPage)), 'onekey-models: settings entry')

      // The plugin manager renders `plugins.bundle.config` keyed by package
      // name on this bundle's detail page; declaring `locale: NS` makes the kit
      // hand the component a `t` for free.
      ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config',
        key: PACKAGE,
        locale: NS,
      }, OneKeyModelsPage)), 'onekey-models: page')
    }

    exports.name = PACKAGE
    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
