import type { Context } from './shims.js'
import { Config, type MuyuConfig } from './config.js'
import { MuyuService } from './services/muyu-service.js'
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
          muyu.consumeTokens(tokens)
        }
      })
    })
  }

  // 3. 注册 DSH Tools，使用 ctx.effect 保留注册 disposer，防止 HMR 热重载时报重名冲突
  const tools = createMuyuTools(muyu)
  for (const tool of tools) {
    ctx.effect(() => {
      return ctx.tools.register(tool)
    })
  }

  console.log('[dsh-plugin-muyu] 电子木鱼与禅修诵经插件加载成功！已注册 6 个修持与 Token 功德工具。')
}
