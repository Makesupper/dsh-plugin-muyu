import type { Context } from './shims.js'
import { Config, type MuyuConfig } from './config.js'
import { MuyuService } from './services/muyu-service.js'
import { registerMuyuClientApi } from './services/client-api.js'
import { createMuyuTools } from './tools/index.js'

export const name = 'muyu'
export const inject = ['tools']
export { Config }

export function apply(ctx: Context, config: MuyuConfig = {}) {
  // 1. 初始化核心领域服务并通过 provide 注册，由 Cordis 自动管理生命周期与状态
  const muyu = new MuyuService(ctx, config)
  ctx.provide('muyu', muyu)

  // 2. 监听 DSH 会话事件，仅在 assistant/message 完成时提取真实 usage，避免 assistant/attempt 重试重复计数
  if (typeof ctx.on === 'function') {
    ctx.effect(() => {
      return ctx.on('session/event', (_session: any, event: any) => {
        if (event?.type !== 'assistant/message') return
        const u = event.data?.usage
        if (!u) return
        const tokens =
          (Number(u.inputTokens) || 0) +
          (Number(u.outputTokens) || 0) +
          (Number(u.cacheReadTokens) || 0) +
          (Number(u.cacheWriteTokens) || 0)
        if (tokens > 0) {
          try {
            muyu.consumeTokens(tokens)
          } catch (error) {
            console.warn('[dsh-plugin-muyu] failed to record session token usage:', error)
          }
        }
      })
    })
  }

  // 3. 把同一份服务端功德簿暴露给前端挂件：窗口只读取/写入这里，不再维护第二本账。
  if (typeof (ctx as any).inject === 'function') {
    ;(ctx as any).inject(['webServer'], (webCtx: Context) => {
      webCtx.effect(() => registerMuyuClientApi(webCtx.webServer, muyu))
    })
  }

  // 4. 注册 DSH Tools，使用 ctx.effect 保留注册 disposer，防止 HMR 热重载时报重名冲突
  const tools = createMuyuTools(muyu)
  for (const tool of tools) {
    ctx.effect(() => {
      return ctx.tools.register(tool)
    })
  }

  console.log('[dsh-plugin-muyu] 电子木鱼与禅修诵经插件加载成功！已注册 6 个修持与 Token 功德工具。')
}
