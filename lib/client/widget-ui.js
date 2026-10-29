/**
 * Muyu Floating Widget UI Component
 * Features:
 * - Clean, consolidated single-row capsule dock in expanded mode (Auto, Voice, Merit, Settings, Collapse)
 * - Unified Zen Settings Sheet (禅修设置) with segmented tabs for Sutra, Sound Preset, and Voice
 * - Mini Zen Mode when collapsed: draggable header pill + compact sutra bubble + mini wooden fish + expand button
 * - Scoped DOM & full lifecycle cleanup on unmount()
 */
import { MUYU_FISH_BASE64, MUYU_MALLET_BASE64 } from './muyu-texture-b64.js';
import { formatMeritCount, formatTokenCount, formatTokenLabel } from '../format.js';
let activeInstanceUnmount = null;
export function createMuyuFloatingPet(options) {
    if (activeInstanceUnmount) {
        try {
            activeInstanceUnmount();
        }
        catch { }
        activeInstanceUnmount = null;
    }
    const existing = document.getElementById('dsh-muyu-floating-pet');
    if (existing) {
        existing.remove();
    }
    const container = document.createElement('div');
    container.id = 'dsh-muyu-floating-pet';
    container.className = 'dsh-muyu-pet-root';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', '电子木鱼禅修挂件');
    let isCollapsed = false;
    let voiceEnabled = options.initialVoiceEnabled ?? true;
    let soundEnabled = options.initialSoundEnabled ?? true;
    let currentSettingsTab = 'sutra';
    const sparkTimers = new Set();
    const style = document.createElement('style');
    style.textContent = `
    .dsh-muyu-pet-root {
      --muyu-bg-surface: var(--dsw-alias-bg-surface, rgba(26, 18, 12, 0.94));
      --muyu-bg-elevated: var(--dsw-alias-bg-elevated, #221912);
      --muyu-border: var(--dsw-alias-border-default, rgba(212, 163, 89, 0.42));
      --muyu-text-primary: var(--dsw-alias-text-primary, #f7e3b5);
      --muyu-text-secondary: var(--dsw-alias-text-secondary, #dfba78);
      --muyu-accent: var(--dsw-alias-accent-primary, #ffd700);
      position: fixed;
      right: 28px;
      bottom: 36px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      user-select: none;
      -webkit-user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
      transition: transform 0.18s ease;
    }

    /* Top anchor: drag handle + sutra bubble (always visible in both expanded & collapsed modes) */
    .dsh-muyu-header-anchor {
      position: relative;
      width: 228px;
      min-height: 68px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      margin-bottom: 6px;
      pointer-events: none;
      transition: width 0.2s ease, min-height 0.2s ease;
    }
    .dsh-muyu-pet-root.is-collapsed .dsh-muyu-header-anchor {
      width: 176px;
      min-height: 48px;
      margin-bottom: 4px;
    }

    .dsh-muyu-top-bar {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
    }

    .dsh-muyu-drag-handle {
      cursor: grab;
      background: var(--muyu-bg-surface);
      color: var(--muyu-text-secondary);
      font-size: 10.5px;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid var(--muyu-border);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      transition: border-color 0.15s, color 0.15s;
    }
    .dsh-muyu-drag-handle:hover {
      border-color: rgba(255, 215, 0, 0.65);
      color: var(--muyu-accent);
    }
    .dsh-muyu-drag-handle:active {
      cursor: grabbing;
    }

    .dsh-muyu-collapse-pill {
      cursor: pointer;
      background: var(--muyu-bg-surface);
      color: var(--muyu-text-secondary);
      font-size: 10.5px;
      padding: 2px 7px;
      border-radius: 999px;
      border: 1px solid var(--muyu-border);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
      line-height: 1.3;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .dsh-muyu-collapse-pill:hover {
      background: rgba(68, 48, 30, 0.95);
      color: var(--muyu-accent);
      border-color: rgba(255, 215, 0, 0.65);
    }

    .dsh-muyu-bubble {
      pointer-events: auto;
      max-width: 224px;
      min-height: 26px;
      max-height: 48px;
      overflow: hidden;
      padding: 5px 11px;
      border-radius: 11px;
      background: var(--muyu-bg-surface);
      border: 1px solid var(--muyu-border);
      color: var(--muyu-text-primary);
      font-size: 11.5px;
      line-height: 1.38;
      text-align: center;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.48);
      backdrop-filter: blur(8px);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      transition: font-size 0.2s ease, padding 0.2s ease, max-width 0.2s ease;
    }
    .dsh-muyu-pet-root.is-collapsed .dsh-muyu-bubble {
      max-width: 172px;
      min-height: 20px;
      max-height: 34px;
      padding: 3px 8px;
      font-size: 10px;
      line-height: 1.3;
      border-radius: 9px;
      -webkit-line-clamp: 2;
    }

    /* 3D Wooden Fish Stage */
    .dsh-muyu-stage {
      position: relative;
      width: 132px;
      height: 94px;
      border-radius: 24px;
      background: radial-gradient(circle at 50% 42%, rgba(82, 54, 34, 0.92), rgba(24, 16, 10, 0.96));
      border: 1.5px solid var(--muyu-border);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.62), inset 0 1px 6px rgba(255, 215, 138, 0.22);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.12s ease, width 0.2s ease, height 0.2s ease, border-radius 0.2s ease;
    }
    .dsh-muyu-stage:focus-visible {
      outline: 2px solid var(--muyu-accent);
      outline-offset: 2px;
    }
    .dsh-muyu-pet-root.is-collapsed .dsh-muyu-stage {
      width: 66px;
      height: 52px;
      border-radius: 18px;
    }

    .dsh-muyu-fish-img {
      width: 104px;
      height: 68px;
      object-fit: contain;
      pointer-events: none;
      transition: transform 0.09s ease, width 0.2s ease, height 0.2s ease;
      filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.6));
    }
    .dsh-muyu-pet-root.is-collapsed .dsh-muyu-fish-img {
      width: 52px;
      height: 36px;
    }

    .dsh-muyu-mallet-img {
      position: absolute;
      width: 64px;
      height: 35px;
      object-fit: contain;
      pointer-events: none;
      display: none;
      z-index: 5;
      /* Grip near the mallet head so the head follows the cursor/strike point. */
      transform-origin: 70% 50%;
      transform: translate(-70%, -50%) rotate(38deg) scale(1);
      transition: transform 0.08s cubic-bezier(0.22, 1, 0.36, 1);
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.55));
    }
    .dsh-muyu-pet-root.is-collapsed .dsh-muyu-mallet-img {
      width: 40px;
      height: 22px;
    }

    .dsh-muyu-merit-badge {
      position: absolute;
      bottom: -8px;
      background: linear-gradient(135deg, #422c18, #24170c);
      color: var(--muyu-accent);
      border: 1px solid rgba(255, 215, 0, 0.55);
      border-radius: 999px;
      padding: 1px 9px;
      font-size: 10.5px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      white-space: nowrap;
      transition: font-size 0.2s ease, padding 0.2s ease;
    }
    .dsh-muyu-pet-root.is-collapsed .dsh-muyu-merit-badge {
      font-size: 9.5px;
      padding: 0px 7px;
      bottom: -7px;
    }

    /* Consolidated Single-Row Dock Capsule + Integrated Token Footer */
    .dsh-muyu-dock-card {
      margin-top: 11px;
      background: var(--muyu-bg-surface);
      border: 1px solid var(--muyu-border);
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.48);
      backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 3px;
    }
    .dsh-muyu-pet-root.is-collapsed .dsh-muyu-dock-card {
      display: none;
    }

    .dsh-muyu-toolbar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      white-space: nowrap;
    }

    .dsh-muyu-btn {
      background: rgba(255, 255, 255, 0.03);
      color: var(--muyu-text-secondary);
      border: 1px solid transparent;
      border-radius: 8px;
      padding: 3px 8px;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .dsh-muyu-btn:hover, .dsh-muyu-btn:focus-visible {
      background: rgba(212, 163, 89, 0.18);
      color: var(--muyu-accent);
      border-color: rgba(255, 215, 0, 0.45);
      outline: none;
    }
    .dsh-muyu-btn.is-active {
      background: rgba(255, 215, 0, 0.15);
      color: var(--muyu-accent);
      border-color: rgba(255, 215, 0, 0.55);
      font-weight: 600;
    }

    .dsh-muyu-token-bar {
      font-size: 9.5px;
      color: #c4a46e;
      border-top: 1px solid rgba(212, 163, 89, 0.18);
      padding: 2px 6px 1px;
      text-align: center;
      white-space: nowrap;
      letter-spacing: 0.2px;
      cursor: pointer;
    }
    .dsh-muyu-token-bar:hover {
      color: var(--muyu-accent);
    }

    .dsh-muyu-sparkle {
      position: fixed;
      transform: translate(-50%, -10px);
      color: var(--muyu-accent);
      font-size: 13px;
      font-weight: 700;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.85), 0 0 8px rgba(255, 215, 0, 0.55);
      pointer-events: none;
      z-index: 1000001;
      animation: dsh-muyu-float-up 0.85s ease-out forwards;
      white-space: nowrap;
    }

    @keyframes dsh-muyu-float-up {
      0% { opacity: 1; transform: translate(-50%, -6px) scale(0.92); }
      100% { opacity: 0; transform: translate(-50%, -44px) scale(1.08); }
    }

    /* Modal Dialog & Segmented Tabs */
    .dsh-muyu-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.62);
      z-index: 1000000;
      display: none;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(3px);
    }

    .dsh-muyu-modal-card {
      width: 348px;
      max-width: 90vw;
      max-height: 76vh;
      background: var(--muyu-bg-elevated);
      border: 1px solid var(--muyu-border);
      border-radius: 14px;
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.75);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: var(--muyu-text-primary);
    }

    .dsh-muyu-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 11px 16px;
      border-bottom: 1px solid rgba(212, 163, 89, 0.22);
      font-weight: 600;
      font-size: 13.5px;
      color: var(--muyu-accent);
    }

    .dsh-muyu-modal-close {
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: var(--muyu-text-secondary);
      padding: 2px 6px;
      border-radius: 6px;
    }
    .dsh-muyu-modal-close:hover {
      color: #fff;
    }

    .dsh-muyu-tabs {
      display: flex;
      gap: 4px;
      padding: 8px 16px 0;
      border-bottom: 1px solid rgba(212, 163, 89, 0.16);
      background: rgba(0, 0, 0, 0.18);
    }

    .dsh-muyu-tab-btn {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: #bba688;
      font-size: 12px;
      font-weight: 500;
      padding: 6px 4px 8px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .dsh-muyu-tab-btn:hover {
      color: var(--muyu-text-primary);
    }
    .dsh-muyu-tab-btn.active {
      color: var(--muyu-accent);
      border-bottom-color: var(--muyu-accent);
      font-weight: 600;
    }

    .dsh-muyu-modal-body {
      padding: 12px 16px;
      overflow-y: auto;
      font-size: 12px;
    }

    .dsh-muyu-list-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 11px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(212, 163, 89, 0.18);
      margin-bottom: 8px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .dsh-muyu-list-item:hover, .dsh-muyu-list-item.active {
      background: rgba(212, 163, 89, 0.16);
      border-color: rgba(255, 215, 0, 0.55);
    }
  `;
    container.appendChild(style);
    // 1. Header Anchor (Drag Handle + Collapse Pill + Sutra Speech Bubble — visible in both modes)
    const headerAnchor = document.createElement('div');
    headerAnchor.className = 'dsh-muyu-header-anchor';
    const topBar = document.createElement('div');
    topBar.className = 'dsh-muyu-top-bar';
    const dragHandle = document.createElement('div');
    dragHandle.className = 'dsh-muyu-drag-handle';
    dragHandle.setAttribute('role', 'button');
    dragHandle.setAttribute('tabindex', '0');
    dragHandle.setAttribute('aria-label', '按住拖动木鱼挂件位置');
    dragHandle.textContent = '✥ 禅修木鱼';
    topBar.appendChild(dragHandle);
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'dsh-muyu-collapse-pill';
    toggleBtn.setAttribute('aria-label', '收起或展开木鱼控制面板');
    toggleBtn.title = '收起为迷你木鱼（保留经文与拖动）';
    toggleBtn.textContent = '收起';
    topBar.appendChild(toggleBtn);
    const soundBtn = document.createElement('button');
    soundBtn.type = 'button';
    soundBtn.className = 'dsh-muyu-collapse-pill dsh-muyu-sound-pill';
    soundBtn.setAttribute('aria-label', '切换木鱼敲击音效开关');
    soundBtn.title = soundEnabled ? '木鱼音效：开' : '木鱼音效：静音';
    soundBtn.setAttribute('aria-pressed', String(soundEnabled));
    soundBtn.textContent = soundEnabled ? '🔔' : '🔕';
    topBar.appendChild(soundBtn);
    headerAnchor.appendChild(topBar);
    const speechBubble = document.createElement('div');
    speechBubble.className = 'dsh-muyu-bubble';
    speechBubble.textContent = '观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。';
    headerAnchor.appendChild(speechBubble);
    container.appendChild(headerAnchor);
    // 2. 3D Wooden Fish Stage
    const stage = document.createElement('div');
    stage.className = 'dsh-muyu-stage';
    stage.setAttribute('role', 'button');
    stage.setAttribute('tabindex', '0');
    stage.setAttribute('aria-label', '敲击木鱼积攒功德');
    const fishImg = document.createElement('img');
    fishImg.className = 'dsh-muyu-fish-img';
    fishImg.src = MUYU_FISH_BASE64;
    fishImg.alt = '木鱼';
    stage.appendChild(fishImg);
    const malletImg = document.createElement('img');
    malletImg.className = 'dsh-muyu-mallet-img';
    malletImg.src = MUYU_MALLET_BASE64;
    malletImg.alt = '木槌';
    stage.appendChild(malletImg);
    const meritBadge = document.createElement('div');
    meritBadge.className = 'dsh-muyu-merit-badge';
    meritBadge.textContent = '功德 0';
    meritBadge.title = '点击查看服务端功德簿';
    meritBadge.style.cursor = 'pointer';
    stage.appendChild(meritBadge);
    container.appendChild(stage);
    // 3. Consolidated Dock Card (4 clean buttons in 1 row + Token status footer)
    const dockCard = document.createElement('div');
    dockCard.className = 'dsh-muyu-dock-card';
    const toolbar = document.createElement('div');
    toolbar.className = 'dsh-muyu-toolbar';
    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'dsh-muyu-btn';
    autoBtn.setAttribute('aria-label', '切换自动修持敲击');
    autoBtn.textContent = '▶ 自动';
    toolbar.appendChild(autoBtn);
    const voiceBtn = document.createElement('button');
    voiceBtn.type = 'button';
    voiceBtn.className = `dsh-muyu-btn ${voiceEnabled ? 'is-active' : ''}`;
    voiceBtn.setAttribute('aria-label', '切换诵经语音开关');
    voiceBtn.textContent = voiceEnabled ? '🔊 诵经' : '🔇 诵经';
    toolbar.appendChild(voiceBtn);
    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'dsh-muyu-btn';
    settingsBtn.setAttribute('aria-label', '打开选经、音色与发音人设置');
    settingsBtn.textContent = '⚙ 禅修设置';
    toolbar.appendChild(settingsBtn);
    const meritBtn = document.createElement('button');
    meritBtn.type = 'button';
    meritBtn.className = 'dsh-muyu-btn';
    meritBtn.setAttribute('aria-label', '查看服务端功德簿');
    meritBtn.textContent = '📿 功德簿';
    toolbar.appendChild(meritBtn);
    dockCard.appendChild(toolbar);
    // Token Usage Status Bar integrated inside the dock card
    const tokenBar = document.createElement('div');
    tokenBar.className = 'dsh-muyu-token-bar';
    tokenBar.title = '点击查看功德与 Token 详情';
    tokenBar.textContent = '⚡ 度化: 0 Tokens · 功德: 0';
    dockCard.appendChild(tokenBar);
    container.appendChild(dockCard);
    // 4. Modal Sheet (Scoped inside container)
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'dsh-muyu-modal-backdrop';
    modalBackdrop.setAttribute('role', 'dialog');
    modalBackdrop.setAttribute('aria-modal', 'true');
    const modalCard = document.createElement('div');
    modalCard.className = 'dsh-muyu-modal-card';
    const modalHeader = document.createElement('div');
    modalHeader.className = 'dsh-muyu-modal-header';
    const modalTitle = document.createElement('span');
    modalTitle.textContent = '弹窗';
    const modalClose = document.createElement('button');
    modalClose.type = 'button';
    modalClose.className = 'dsh-muyu-modal-close';
    modalClose.setAttribute('aria-label', '关闭弹窗');
    modalClose.textContent = '×';
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(modalClose);
    const modalTabs = document.createElement('div');
    modalTabs.className = 'dsh-muyu-tabs';
    modalTabs.style.display = 'none';
    const modalBody = document.createElement('div');
    modalBody.className = 'dsh-muyu-modal-body';
    modalCard.appendChild(modalHeader);
    modalCard.appendChild(modalTabs);
    modalCard.appendChild(modalBody);
    modalBackdrop.appendChild(modalCard);
    container.appendChild(modalBackdrop);
    const closeModal = () => {
        modalBackdrop.style.display = 'none';
    };
    modalClose.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop)
            closeModal();
    });
    // Mallet Cursor Tracking & Knock Animation
    stage.addEventListener('mouseenter', (e) => {
        const rect = stage.getBoundingClientRect();
        malletImg.style.left = `${e.clientX - rect.left}px`;
        malletImg.style.top = `${e.clientY - rect.top}px`;
        malletImg.style.display = 'block';
    });
    stage.addEventListener('mouseleave', () => {
        malletImg.style.display = 'none';
    });
    stage.addEventListener('mousemove', (e) => {
        const rect = stage.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        malletImg.style.left = `${x}px`;
        malletImg.style.top = `${y}px`;
    });
    function animateKnock() {
        malletImg.style.transform = 'translate(-70%, -42%) rotate(-14deg) scale(0.94)';
        fishImg.style.transform = 'scale(0.92)';
        const t = setTimeout(() => {
            sparkTimers.delete(t);
            malletImg.style.transform = 'translate(-70%, -50%) rotate(38deg) scale(1)';
            fishImg.style.transform = 'scale(1)';
        }, 110);
        sparkTimers.add(t);
    }
    const triggerUserKnock = () => {
        animateKnock();
        triggerKnockEffect();
        if (options.onKnock) {
            options.onKnock();
        }
    };
    stage.addEventListener('click', triggerUserKnock);
    stage.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerUserKnock();
        }
    });
    // Dragging (works in both expanded and collapsed modes!)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    dragHandle.addEventListener('pointerdown', (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        const rect = container.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.left = `${initialLeft}px`;
        container.style.top = `${initialTop}px`;
    });
    const onWindowPointerMove = (e) => {
        if (!isDragging)
            return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        container.style.left = `${initialLeft + dx}px`;
        container.style.top = `${initialTop + dy}px`;
    };
    const onWindowPointerUp = () => {
        isDragging = false;
    };
    const onWindowKeyDown = (e) => {
        if (e.key === 'Escape' && modalBackdrop.style.display === 'flex') {
            closeModal();
        }
    };
    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('keydown', onWindowKeyDown);
    // Auto Knock Button
    autoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (options.onToggleAuto) {
            options.onToggleAuto();
        }
    });
    // Voice Toggle (sutra speech only; independent from the wooden-fish sound)
    voiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        voiceEnabled = !voiceEnabled;
        voiceBtn.textContent = voiceEnabled ? '🔊 诵经' : '🔇 诵经';
        voiceBtn.className = `dsh-muyu-btn ${voiceEnabled ? 'is-active' : ''}`;
        if (options.onToggleVoice) {
            options.onToggleVoice(voiceEnabled);
        }
    });
    // Wooden-fish sound toggle
    soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? '🔔' : '🔕';
        soundBtn.title = soundEnabled ? '木鱼音效：开' : '木鱼音效：静音';
        soundBtn.setAttribute('aria-pressed', String(soundEnabled));
        if (options.onToggleSound) {
            options.onToggleSound(soundEnabled);
        }
    });
    // Unified Zen Settings Modal (Tabs: 📜 选经 | 🔔 音色 | 🎙️ 发音人 | ⚡ Token)
    const renderSettingsTabContent = () => {
        modalBody.replaceChildren();
        if (currentSettingsTab === 'sutra') {
            options.sutraList.forEach((book) => {
                const item = document.createElement('div');
                const isCurrent = book.id === options.currentBookId;
                item.className = `dsh-muyu-list-item ${isCurrent ? 'active' : ''}`;
                const leftCol = document.createElement('div');
                const titleDiv = document.createElement('div');
                titleDiv.style.cssText = 'font-weight: 600; color: #ffd88a;';
                titleDiv.textContent = `《${book.title}》 ${isCurrent ? '👉 (修持中)' : ''}`;
                const summaryDiv = document.createElement('div');
                summaryDiv.style.cssText = 'font-size: 11px; color: #bba688; margin-top: 3px;';
                summaryDiv.textContent = book.summary;
                leftCol.appendChild(titleDiv);
                leftCol.appendChild(summaryDiv);
                const rightCol = document.createElement('div');
                rightCol.style.cssText = 'font-size: 11px; color: #e6c88b; white-space: nowrap; margin-left: 8px;';
                rightCol.textContent = `${book.sentences.length} 句`;
                item.appendChild(leftCol);
                item.appendChild(rightCol);
                item.addEventListener('click', () => {
                    options.currentBookId = book.id;
                    if (options.onSelectSutra) {
                        options.onSelectSutra(book.id);
                    }
                    renderSettingsTabContent();
                });
                modalBody.appendChild(item);
            });
            return;
        }
        if (currentSettingsTab === 'sound') {
            const presets = options.getSoundPresets ? options.getSoundPresets() : [];
            const currentSound = options.getCurrentSoundId ? options.getCurrentSoundId() : 'sandalwood';
            presets.forEach((preset) => {
                const item = document.createElement('div');
                const isCurrent = preset.id === currentSound;
                item.className = `dsh-muyu-list-item ${isCurrent ? 'active' : ''}`;
                const leftCol = document.createElement('div');
                const titleDiv = document.createElement('div');
                titleDiv.style.cssText = 'font-weight: 600; color: #ffd88a;';
                titleDiv.textContent = `${preset.name} ${isCurrent ? '👉 (使用中)' : ''}`;
                const descDiv = document.createElement('div');
                descDiv.style.cssText = 'font-size: 11px; color: #bba688; margin-top: 2px;';
                descDiv.textContent = preset.description;
                leftCol.appendChild(titleDiv);
                leftCol.appendChild(descDiv);
                const rightCol = document.createElement('div');
                rightCol.style.cssText = `font-size: 12px; color: ${isCurrent ? '#ffd700' : '#e6c88b'}; font-weight: ${isCurrent ? 'bold' : 'normal'}; white-space: nowrap; margin-left: 8px;`;
                rightCol.textContent = isCurrent ? '已选' : '试听选择';
                item.appendChild(leftCol);
                item.appendChild(rightCol);
                item.addEventListener('click', () => {
                    if (options.onSelectSound) {
                        options.onSelectSound(preset.id);
                    }
                    renderSettingsTabContent();
                });
                modalBody.appendChild(item);
            });
            return;
        }
        if (currentSettingsTab === 'token') {
            const currentStep = options.getTokensPerMerit ? options.getTokensPerMerit() : 10000;
            const tipBox = document.createElement('div');
            tipBox.style.cssText = 'font-size: 11px; color: #ffd88a; margin-bottom: 12px; padding: 6px 10px; background: rgba(212,163,89,0.15); border-radius: 6px; border: 1px solid rgba(212,163,89,0.3); line-height: 1.5;';
            tipBox.textContent = '正数：每 N Tokens 增加 1 功德；负数：每 |N| Tokens 扣 1 功德（趣味模式）。范围 ±1 ~ ±10,000,000。';
            modalBody.appendChild(tipBox);
            if (options.isTokensPerMeritSupported && !options.isTokensPerMeritSupported()) {
                tipBox.textContent = '当前 DSH Host 还未加载 Token 阈值接口。请重启 DSH 宿主后刷新页面，再调整阈值。';
                tipBox.style.color = '#ff8a6a';
                tipBox.style.background = 'rgba(255, 90, 60, 0.12)';
                tipBox.style.borderColor = 'rgba(255, 120, 90, 0.4)';
                return;
            }
            const currentLine = document.createElement('div');
            currentLine.style.cssText = 'font-size: 12px; color: #dfba78; margin-bottom: 8px;';
            currentLine.textContent = `当前设置：${formatMeritCount(currentStep)} Tokens / 功德`;
            modalBody.appendChild(currentLine);
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'dsh-muyu-token-input';
            input.min = '-10000000';
            input.max = '10000000';
            input.step = '1';
            input.value = String(currentStep);
            input.style.cssText = 'width: 100%; box-sizing: border-box; background: #1b130d; color: #f7e3b5; border: 1px solid rgba(212,163,89,0.45); border-radius: 8px; padding: 8px; font-size: 14px; margin-bottom: 8px;';
            modalBody.appendChild(input);
            const status = document.createElement('div');
            status.style.cssText = 'font-size: 11px; color: #c4a46e; min-height: 16px; margin-bottom: 8px;';
            modalBody.appendChild(status);
            const presets = document.createElement('div');
            presets.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;';
            for (const preset of [1000, 10000, 100000, -10000]) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'dsh-muyu-btn';
                btn.textContent = preset > 0 ? `${formatTokenCount(preset)}/功德` : `扣 ${formatTokenCount(Math.abs(preset))}/功德`;
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    input.value = String(preset);
                });
                presets.appendChild(btn);
            }
            modalBody.appendChild(presets);
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'dsh-muyu-btn is-active';
            saveBtn.textContent = '保存 Token 设置';
            saveBtn.style.cssText = 'width: 100%; justify-content: center; padding: 8px;';
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const value = Number(input.value);
                if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 10000000) {
                    status.textContent = '请输入非零值，范围 ±1 ~ ±10,000,000';
                    status.style.color = '#ff8a6a';
                    return;
                }
                status.textContent = '保存中…';
                status.style.color = '#c4a46e';
                let result;
                try {
                    result = options.onSetTokensPerMerit?.(Math.trunc(value));
                }
                catch {
                    result = false;
                }
                if (result && typeof result.then === 'function') {
                    ;
                    result
                        .then(ok => {
                        status.textContent = ok ? '已保存，下一段 Token 将按新阈值计算' : '保存失败，请稍后重试';
                        status.style.color = ok ? '#9fd18b' : '#ff8a6a';
                        currentLine.textContent = `当前设置：${formatMeritCount(Math.trunc(value))} Tokens / 功德`;
                    })
                        .catch(() => {
                        status.textContent = '保存失败，请稍后重试';
                        status.style.color = '#ff8a6a';
                    });
                }
                else {
                    status.textContent = '已保存，下一段 Token 将按新阈值计算';
                    status.style.color = '#9fd18b';
                    currentLine.textContent = `当前设置：${formatMeritCount(Math.trunc(value))} Tokens / 功德`;
                }
            });
            modalBody.appendChild(saveBtn);
            return;
        }
        if (currentSettingsTab === 'voice') {
            const voices = options.getVoiceList ? options.getVoiceList() : [];
            const currentId = options.getCurrentVoiceId ? options.getCurrentVoiceId() : '';
            if (voices.length === 0) {
                const emptyTip = document.createElement('div');
                emptyTip.style.cssText = 'color: #888; text-align: center; padding: 16px 0;';
                emptyTip.textContent = '当前浏览器正在加载系统语音包，请稍后再试';
                modalBody.appendChild(emptyTip);
            }
            else {
                const tipBox = document.createElement('div');
                tipBox.style.cssText = 'font-size: 11px; color: #ffd88a; margin-bottom: 12px; padding: 6px 10px; background: rgba(212,163,89,0.15); border-radius: 6px; border: 1px solid rgba(212,163,89,0.3);';
                tipBox.textContent = '✨ 默认推荐：粤语女声（幽雅庄严、梵音清净）。点击即可切换发音人。';
                modalBody.appendChild(tipBox);
                voices.forEach((v) => {
                    const item = document.createElement('div');
                    const isCurrent = v.id === currentId;
                    item.className = `dsh-muyu-list-item ${isCurrent ? 'active' : ''}`;
                    const leftCol = document.createElement('div');
                    const nameDiv = document.createElement('div');
                    nameDiv.style.cssText = 'font-weight: 600; color: #ffd88a;';
                    nameDiv.textContent = `${v.name} ${v.isCantonese ? '🌸 [粤语推荐]' : ''} ${isCurrent ? '👉 (使用中)' : ''}`;
                    const descDiv = document.createElement('div');
                    descDiv.style.cssText = 'font-size: 11px; color: #bba688; margin-top: 2px;';
                    descDiv.textContent = `${v.description} · ${v.lang}`;
                    leftCol.appendChild(nameDiv);
                    leftCol.appendChild(descDiv);
                    const rightCol = document.createElement('div');
                    rightCol.style.cssText = `font-size: 12px; color: ${isCurrent ? '#ffd700' : '#e6c88b'}; font-weight: ${isCurrent ? 'bold' : 'normal'}; white-space: nowrap; margin-left: 8px;`;
                    rightCol.textContent = isCurrent ? '已选' : '选择';
                    item.appendChild(leftCol);
                    item.appendChild(rightCol);
                    item.addEventListener('click', () => {
                        if (options.onSelectVoice) {
                            options.onSelectVoice(v.id);
                        }
                        renderSettingsTabContent();
                    });
                    modalBody.appendChild(item);
                });
            }
        }
    };
    const openSettingsModal = (initialTab = 'sutra') => {
        currentSettingsTab = initialTab;
        modalTitle.textContent = '⚙ 禅修设置（经典 · 音色 · 发音人 · Token）';
        modalTabs.style.display = 'flex';
        modalTabs.replaceChildren();
        const tabs = [
            { id: 'sutra', label: '📜 传世经典' },
            { id: 'sound', label: '🔔 音色切换' },
            { id: 'voice', label: '🎙️ 诵经语音' },
            { id: 'token', label: '⚡ Token' }
        ];
        tabs.forEach((tab) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `dsh-muyu-tab-btn ${currentSettingsTab === tab.id ? 'active' : ''}`;
            btn.textContent = tab.label;
            btn.addEventListener('click', () => {
                currentSettingsTab = tab.id;
                Array.from(modalTabs.children).forEach((child, idx) => {
                    child.className = `dsh-muyu-tab-btn ${tabs[idx].id === currentSettingsTab ? 'active' : ''}`;
                });
                renderSettingsTabContent();
            });
            modalTabs.appendChild(btn);
        });
        renderSettingsTabContent();
        modalBackdrop.style.display = 'flex';
    };
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettingsModal(currentSettingsTab);
    });
    // Merit Record Sheet (服务端功德簿)
    const openMeritModal = (e) => {
        e.stopPropagation();
        options.onOpenMerit?.();
        modalTitle.textContent = '📿 服务端功德簿';
        modalTabs.style.display = 'none';
        modalBody.replaceChildren();
        const stats = options.getMeritRecords();
        const noteBanner = document.createElement('div');
        noteBanner.style.cssText = 'font-size: 10px; color: #c4a46e; margin-bottom: 10px; line-height: 1.4;';
        noteBanner.textContent = '注：挂件与服务端工具共用同一份功德簿（~/.dsh/muyu-data/merit_history.json），与 muyu_get_merit 查询结果一致。';
        modalBody.appendChild(noteBanner);
        const summaryBox = document.createElement('div');
        summaryBox.style.cssText = `
      display: flex;
      justify-content: space-around;
      background: #231b14;
      border: 1px solid rgba(212, 163, 89, 0.35);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 14px;
      text-align: center;
    `;
        const makeCol = (label, meritVal, tokenVal) => {
            const col = document.createElement('div');
            const l = document.createElement('div');
            l.style.cssText = 'font-size: 11px; color: #dfba78;';
            l.textContent = label;
            const m = document.createElement('div');
            m.style.cssText = 'font-size: 20px; font-weight: bold; color: #ffd700; margin-top: 2px;';
            m.textContent = meritVal;
            const t = document.createElement('div');
            t.style.cssText = 'font-size: 9px; color: #c4a46e; margin-top: 2px;';
            t.textContent = `⚡ ${formatTokenLabel(tokenVal)}`;
            col.appendChild(l);
            col.appendChild(m);
            col.appendChild(t);
            return col;
        };
        const divider = document.createElement('div');
        divider.style.cssText = 'width: 1px; background: rgba(212,163,89,0.3);';
        const todayMeritText = stats.todayMerit >= 0 ? `+${formatMeritCount(stats.todayMerit)}` : formatMeritCount(stats.todayMerit);
        summaryBox.appendChild(makeCol('今日功德', todayMeritText, stats.todayTokens ?? 0));
        summaryBox.appendChild(divider);
        summaryBox.appendChild(makeCol('累计总功德', formatMeritCount(stats.totalMerit), stats.totalTokens ?? 0));
        modalBody.appendChild(summaryBox);
        const listTitle = document.createElement('div');
        listTitle.style.cssText = 'font-weight: 600; color: #dfba78; margin-bottom: 8px;';
        listTitle.textContent = '📅 按日修持明细';
        modalBody.appendChild(listTitle);
        if (stats.records && stats.records.length > 0) {
            stats.records.forEach((rec) => {
                const item = document.createElement('div');
                item.className = 'dsh-muyu-list-item';
                const left = document.createElement('div');
                const dateSpan = document.createElement('span');
                dateSpan.style.fontWeight = '600';
                dateSpan.textContent = rec.displayDate;
                const keySpan = document.createElement('span');
                keySpan.style.cssText = 'font-size: 10px; color: #999; margin-left: 6px;';
                keySpan.textContent = `(${rec.dateKey})`;
                left.appendChild(dateSpan);
                left.appendChild(keySpan);
                if (rec.tokens && rec.tokens > 0) {
                    const tokDiv = document.createElement('div');
                    tokDiv.style.cssText = 'font-size: 10px; color: #c4a46e; margin-top: 2px;';
                    tokDiv.textContent = `⚡ 度化 ${formatTokenLabel(rec.tokens)}`;
                    left.appendChild(tokDiv);
                }
                const right = document.createElement('div');
                right.style.cssText = 'font-size: 13px; font-weight: bold; color: #ffd700;';
                right.textContent = `${rec.count >= 0 ? '+' : ''}${formatMeritCount(rec.count)} 功德`;
                item.appendChild(left);
                item.appendChild(right);
                modalBody.appendChild(item);
            });
        }
        else {
            const emptyTip = document.createElement('div');
            emptyTip.style.cssText = 'color: #888; text-align: center; padding: 14px 0;';
            emptyTip.textContent = '今日尚无敲击记录，轻敲木鱼开启修行吧';
            modalBody.appendChild(emptyTip);
        }
        modalBackdrop.style.display = 'flex';
    };
    meritBtn.addEventListener('click', openMeritModal);
    tokenBar.addEventListener('click', openMeritModal);
    // The merit badge sits inside the fish stage; stop the click from bubbling into a knock.
    meritBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        openMeritModal(e);
    });
    // Expand / Collapse Toggle (Collapsed mode keeps mini sutra bubble + drag handle + mini fish)
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;
        container.classList.toggle('is-collapsed', isCollapsed);
        toggleBtn.textContent = isCollapsed ? '展开' : '收起';
        toggleBtn.title = isCollapsed ? '展开禅修控制栏' : '收起为迷你木鱼（保留经文与拖动）';
    });
    function triggerKnockEffect(text = '功德 +1') {
        const rect = stage.getBoundingClientRect();
        const spark = document.createElement('div');
        spark.className = 'dsh-muyu-sparkle';
        spark.textContent = text;
        spark.style.left = `${rect.left + rect.width / 2}px`;
        spark.style.top = `${rect.top}px`;
        container.appendChild(spark);
        const timer = setTimeout(() => {
            sparkTimers.delete(timer);
            spark.remove();
        }, 850);
        sparkTimers.add(timer);
    }
    const unmount = () => {
        window.removeEventListener('pointermove', onWindowPointerMove);
        window.removeEventListener('pointerup', onWindowPointerUp);
        window.removeEventListener('keydown', onWindowKeyDown);
        for (const timer of sparkTimers) {
            clearTimeout(timer);
        }
        sparkTimers.clear();
        container.remove();
        if (activeInstanceUnmount === unmount) {
            activeInstanceUnmount = null;
        }
    };
    activeInstanceUnmount = unmount;
    return {
        mount(target = document.body) {
            target.appendChild(container);
        },
        unmount,
        update(merit, sentence, isAutoRunning, tokenStats) {
            meritBadge.textContent = `功德 ${formatMeritCount(merit)}`;
            speechBubble.textContent = sentence;
            if (typeof isAutoRunning === 'boolean') {
                autoBtn.textContent = isAutoRunning ? '⏹ 停止' : '▶ 自动';
                autoBtn.className = `dsh-muyu-btn ${isAutoRunning ? 'is-active' : ''}`;
            }
            if (tokenStats) {
                tokenBar.textContent = `⚡ 度化: ${formatTokenLabel(tokenStats.todayTokens)} · 功德: ${formatMeritCount(merit)}`;
            }
        },
        triggerKnockEffect,
        animateKnock
    };
}
//# sourceMappingURL=widget-ui.js.map