# dsh-plugin-muyu (DeepSeek Harness 电子木鱼与禅修诵经插件)

基于 [DeepSeek Harness 插件开发规范](https://deepseek-harness.github.io/deepseek-harness/develop/basic/) 与 [Cordis 架构指南](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/) 构建的跨平台电子木鱼诵经与 Token 功德修持插件（Bundle）。

提供 3D 木鱼敲击挂件、8 部传世经文逐句流转、跨平台粤语/普通话诵经语音合成、三种物理音色（紫檀沉音、清脆白木、古刹清磬）、会话 Token 自动度化功德与按日持久化功德簿。

---

## 🌟 核心特性

1. **会话 Token 自动度化功德（Token-to-Merit Engine）**：
   - 服务端监听 DSH 原生 `session/event` 中的 `assistant/message` 消息 `usage`（自动汇总 `inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens`，忽略 `assistant/attempt` 重试以免重复记账）。
   - 默认每累计消耗 `10,000 Tokens` 自动敲响木鱼 1 次、功德 `+1`；未满阈值的余数持久化保存在 `pendingTokens` 缓冲池中，跨宿主重启不丢失。
   - 单次大额 Token 突增采用批量单次原子写盘（`knockBatch`），单次封顶触发 `108` 敲，杜绝事件循环阻塞。
2. **传世经文经典宝库（客户端与服务端共享唯一权威源）**：
   - 内置《般若波罗蜜多心经》（玄奘译本 14 句）、《金刚般若波罗蜜经》、《大悲心陀罗尼神咒》、《六字真言与禅林名偈》、《药师灌顶真言》、《准提神咒》、《往生咒》、《楞严咒心赞偈》。
3. **三种木鱼与古刹清磬音色**：
   - `sandalwood`：紫檀沉音（浑厚沉稳，声如古庙老木，定心凝神）
   - `whitewood`：清脆白木（轻盈通透，高频脆爽，提神醒脑）
   - `bell`：古刹清磬（悠扬致远，梵音泛音列谐振，余音绕梁）
4. **跨平台自然诵经语音（粤语女声优先）**：
   - 自动识别系统粤语女声（`zh-HK` / `yue` / Sinji）或普通话女声，动态跟随所选发音人的真实语种标签（`voice.lang`）。
5. **原子化功德簿持久化**：
   - 按路径优先级 `显式 storagePath > $DSH_HOME/muyu-data/merit_history.json > ~/.dsh/muyu-data/merit_history.json` 存储。
   - 采用 `*.tmp` + `renameSync` 原子写盘；若遇到意外损坏的 JSON 文件，自动隔离备份为 `.corrupt-<timestamp>`，保障历史数据安全。
   - *单宿主说明*：服务端账本假设单活跃 DSH 宿主进程运行，多进程并发写采用后写覆盖（Last-Write-Wins）。

---

## 📊 账本与配置作用域说明

当前版本包含两套独立维护的修持计数：
- **服务端工具账本**（`~/.dsh/muyu-data/merit_history.json`）：记录通过 `session/event` 自动计量的模型 Token 功德，以及调用 `muyu_knock` / `muyu_auto_knock` / `muyu_feed_tokens` 产生的功德，可通过 `muyu_get_merit` 查询。
- **客户端挂件本机账本**（浏览器 `localStorage['dsh_muyu_client_merit']`）：记录用户在悬浮木鱼挂件上手敲、挂件自动修持及前端连击的本机交互功德，在挂件“功德簿”弹窗中展示。

### 配置项矩阵 (`cordis.patch.yml`)

| 配置项 | 类型与默认值 | 作用域 | 说明 |
|---|---|---|---|
| `defaultSutra` | `string` (`'heart_sutra'`) | 服务端工具 | 服务端初始诵读经文 ID（挂件端在面板中选择并记忆到 `localStorage`） |
| `defaultSound` | `'sandalwood' \| 'whitewood' \| 'bell'` | 服务端工具 | 服务端默认音色（挂件端可通过“音色”按钮实时切换合成音色） |
| `autoKnockIntervalMs` | `number` (`1200`, 范围 `200~60000`) | 服务端工具 | `muyu_auto_knock` 默认敲击间隔毫秒数 |
| `autoKnockMaxDurationMs` | `number` (`1800000`, 默认 30 分钟) | 服务端工具 | `muyu_auto_knock` 无尽修持单次最大持续时长，到时自动停止 |
| `voiceEnabled` | `boolean` (`true`) | 服务端工具 | 服务端语音提示开关（挂件端通过工具栏“诵经: 开/静音”独立控制） |
| `voiceRate` | `number` (`0.8`, 范围 `0.1~2.0`) | 服务端工具 | 服务端返回 `voicePrompt.rate` 语速参数 |
| `voicePitch` | `number` (`0.95`, 范围 `0.1~2.0`) | 服务端工具 | 服务端返回 `voicePrompt.pitch` 音调参数 |
| `volume` | `number` (`1.0`, 范围 `0.0~1.0`) | 服务端工具 | 服务端返回 `voicePrompt.volume` 音量参数 |
| `storagePath` | `string` (可选，支持 `~`) | 服务端工具 | 自定义功德簿 JSON 存储路径 |
| `tokenKnockEnabled` | `boolean` (`true`) | 服务端工具 | 是否开启按会话 Token 消耗自动敲木鱼攒功德 |
| `tokensPerMerit` | `number` (`10000`) | 服务端工具 | 每积攒 1 点功德所需的 Token 消耗阈值 |

---

## 🛠️ 注册的 6 个 DSH Tools

| 工具名称 | 功能描述 |
|---|---|
| `muyu_knock` | 敲击木鱼积攒服务端功德（`count` 范围 1~108，每次调用推进 1 句经文诵念），返回当前经文与音效信息 |
| `muyu_auto_knock` | 启动（`start`）、停止（`stop`）或查询（`status`）自动敲木鱼任务，支持 0/9/21/49/108/1080 周期与超时保护 |
| `muyu_get_merit` | 查看服务端今日功德、历劫总功德、今日/历劫度化 Token、蓄力余数 `pendingTokens` 及按日明细 |
| `muyu_select_sutra` | 浏览 8 部经典目录摘要或切换当前诵读修持的经典经咒 |
| `muyu_play_sound` | 获取或切换紫檀沉音、清脆白木、古刹清磬音色 |
| `muyu_feed_tokens` | 外部或手动补记 Token 消耗量（日常对话已由 `session/event` 自动计量，无需重复调用） |

---

## 📦 安装、构建与测试

### 1. 构建与测试

```sh
npm run build   # 从 src/ 编译生成 lib/**/*.js、.d.ts 以及浏览器单文件包 lib/client.js
npm test        # 自动执行 pretest 构建并运行全部单元测试
```

### 2. 在 DeepSeek Harness 中加载

可通过 `--patch` 载入 `cordis.patch.yml`，或在 DSH Desktop 的 Profile（如 `~/.dsh/profiles/desktop`）中通过 Plugin Manager / `pnpm` 链接安装本目录：

```sh
pnpm dsh web --patch ./dsh-plugin-muyu/cordis.patch.yml
```
