# Changelog

## 0.2.0 — 2026-10-30

首个正式发布版本。

### 核心功能

- 电子木鱼悬浮挂件：手敲、自动修持、8 部经文逐句流转、三种木鱼/清磬音色、粤语/普通话诵经语音。
- 会话 Token 自动度化功德：监听 `session/event` 的 `assistant/message` usage，完整记账 `todayTokens` / `totalTokens`，单次最多触发 108 敲。
- 单一服务端账本：挂件与服务端工具共用 `merit_history.json`，不再维护浏览器本地功德账本。
- 前端 **⚙ 禅修设置 → ⚡ Token**：运行时调整 `tokensPerMerit`，支持负数进入扣功德趣味模式（功德可为负）。
- Token 显示：`k` / `M`，达到 108M 显示 `1圆满`；功德显示千分逗号。
- 木鱼敲击音效与诵经语音可独立静音；木槌握点/大小与经文气泡推进节奏可调。

### 稳定性与安全

- 多宿主并发写账本：`<ledger>.lock` + pid/token + 重读增量 + 原子回写；持锁进程崩溃可安全接管，锁忙时抛 `MeritStorageBusyError`，不做无锁覆盖。
- `/dsh-muyu/*` POST 校验 `Origin` / `Host` / `Content-Type`，请求体上限 8 KiB；未知宿主 API 回退 loopback-only 并打印警告。
- `muyu_feed_tokens` 单次输入上限 `108 × abs(tokensPerMerit)`，防止 pending 积压；历史/调小 step 的 pending 启动时折算成功德。
- 当前经文、句序、音色、Token 阈值持久化到 `<ledger>.state.json`；配置新增 `resetRuntimeState`。

### 构建与测试

- 构建脚本移除硬编码工具链路径，支持 `$TSC`、本地/上级 `node_modules/.bin/tsc`，无 tsc 时回退 Node `stripTypeScriptTypes`。
- `npm test`：17 项测试全部通过。

## 0.1.0

- 初始开源版本：木鱼挂件、经文、音色、诵经语音与基础功德持久化。
