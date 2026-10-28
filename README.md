# dsh-plugin-muyu (DeepSeek Harness 电子木鱼与禅修诵经插件)

基于 [DeepSeek Harness 插件开发规范](https://deepseek-harness.github.io/deepseek-harness/develop/basic/) 构建的跨平台木鱼诵经修持组合包（Bundle）。

从原生 iOS 木鱼项目无缝迁移，提供木鱼音效敲击、经文随动滚动、跨平台自然语音诵念（兼容 Windows 与 iOS）、佛教圆满周期自动敲击控制与功德簿按日持久化记录。

---

## 🌟 核心特性

1. **跨平台诵经声音处理 (Windows & iOS 通用)**：
   - 采用标准 Web Speech 协议与沉稳禅调语速（`rate: 0.8`, `pitch: 0.95`），直接映射原 iOS `AVSpeechSynthesizer` 听感。
   - 在 **Windows**（Edge / Chrome 神经语音）与 **iOS**（Safari / PWA / WebKit）中开箱即用，零延迟且无需额外配置云端 TTS Key。
2. **传世经文经典宝库**：
   - 内置《般若波罗蜜多心经》、《金刚经》、《大悲心陀罗尼神咒》、《六字真言与禅偈》、《药师灌顶真言》、《准提神咒》、《往生咒》、《楞严咒心赞偈》。
3. **三种真实木鱼与磬音音色**：
   - `sandalwood`：紫檀沉音（浑厚沉稳，声如古庙老木，定心凝神）
   - `whitewood`：清脆白木（轻盈通透，高频脆爽，提神醒脑）
   - `bell`：古刹清磬（悠扬致远，余音绕梁，震荡心扉）
4. **佛教圆满修持周期**：
   - 9 次（九九归一）、21 次（真言圆满）、49 次（祈福安康）、108 次（悉断百八烦恼）、1080 次（千佛功德）及无尽修持。
5. **功德簿持久化统计**：
   - 今日修行功德与历劫功德实时汇总，按日自动索引分桶，默认持久化至 `~/.dsh/muyu-data/`。
6. **符合 DeepSeek Harness 官方规范**：
   - 声明 `dsh.bundle`，支持 `--patch` 覆盖层和 `dsh plugin add` 安装。
   - 使用 `ctx.effect` 自动释放后台自动敲击定时器，支持无泄漏热重载（HMR）。

---

## 📦 安装与配置

### 方式一：在开发环境中作为 Overlay 加载

在 DeepSeek Harness 项目中使用 `--patch` 载入 `cordis.patch.yml`：

```sh
pnpm dsh web --patch ./dsh-plugin-muyu/cordis.patch.yml
```

### 方式二：安装进 DSH Profile

```sh
dsh plugin --profile default add ./dsh-plugin-muyu
```

### 配置选项 (`cordis.yml` / `cordis.patch.yml`)

```yaml
- insert:
    - id: muyu
      name: dsh-plugin-muyu
      config:
        defaultSutra: 'heart_sutra'       # 默认经文 ID
        defaultSound: 'sandalwood'        # 默认音色：sandalwood | whitewood | bell
        autoKnockIntervalMs: 1200         # 自动敲击间隔毫秒数
        voiceEnabled: true                # 是否启用跨平台诵经语音
        voiceRate: 0.8                    # 诵经语速 (0.1 ~ 2.0)
        voicePitch: 0.95                  # 诵经声调 (0.1 ~ 2.0)
        volume: 1.0                       # 播放音量
```

---

## 🛠️ 注册的 DSH Tools

| 工具名称 | 功能描述 |
|---|---|
| `muyu_knock` | 敲击木鱼积攒功德，推进经文诵念句子，返回音效与回向文 |
| `muyu_auto_knock` | 启动或停止自动敲木鱼，支持指定 9/21/108 次圆满周期与敲击频率 |
| `muyu_get_merit` | 查看今日功德、历劫累积功德及按日历史明细 |
| `muyu_select_sutra` | 浏览经文宝库或切换当前诵读修持的经典经咒 |
| `muyu_play_sound` | 获取与切换紫檀沉音、清脆白木或古刹清磬音色 |

---

## 🧪 自动化测试

```sh
node --test dsh-plugin-muyu/tests/muyu.test.js
```
