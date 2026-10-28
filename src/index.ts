import type { Context } from './shims.js'
import { Config, type MuyuConfig } from './config.js'
import { MuyuService } from './services/muyu-service.js'
import { createMuyuTools } from './tools/index.js'

export const name = 'muyu'
export const inject = ['tools']
export { Config }

export function apply(ctx: Context, config: MuyuConfig) {
  // 1. 初始化核心领域服务并通过 provide 注册，由 Cordis 自动管理生命周期与状态
  const muyu = new MuyuService(ctx, config)
  ctx.provide('muyu', muyu)

  // 2. 注册 DSH Tools，使用 ctx.effect 保留注册 disposer，防止 HMR 热重载时报重名冲突
  const tools = createMuyuTools(muyu)
  for (const tool of tools) {
    ctx.effect(() => {
      return ctx.tools.register(tool)
    })
  }

  console.log('[dsh-plugin-muyu] 电子木鱼与禅修诵经插件加载成功！已注册 5 个修持工具。')
}
