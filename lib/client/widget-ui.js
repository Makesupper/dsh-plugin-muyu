/**
 * Muyu Floating Widget UI Component (QQ-Pet style floating companion)
 * Features:
 * - Real 3D Mallet & 3D Wooden Fish rendered from SceneKit assets!
 * - Realistic mallet angle holding (naturally tilted ~-32deg, hits down to +18deg on click).
 * - Fixed Stage Anchor: The speech bubble expands UPWARDS or is housed in a fixed-height layout,
 *   so the Muyu body NEVER jumps or shifts when sentences wrap into multiple lines!
 * - Smooth drag handle (dedicated drag pill, clicking fish won't drift or displace)
 * - Complete sentence recitation (continuous reading, not cut off by repeated taps)
 * - Built-in Merit Record Sheet (历劫功德簿)
 * - Built-in Sutra Library Selector (传世经典宝库)
 * - Expand / Collapse toggle without losing state
 */
import { MUYU_FISH_BASE64, MUYU_MALLET_BASE64 } from './muyu-texture-b64.js';
export function createMuyuFloatingPet(options) {
    const existing = document.getElementById('dsh-muyu-floating-pet');
    if (existing) {
        existing.remove();
    }
    const container = document.createElement('div');
    container.id = 'dsh-muyu-floating-pet';
    container.className = 'dsh-muyu-pet-root';
    let isCollapsed = false;
    let voiceEnabled = true;
    const style = document.createElement('style');
    style.textContent = `
    .dsh-muyu-pet-root {
      position: fixed;
      right: 32px;
      bottom: 45px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      user-select: none;
      -webkit-user-select: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", sans-serif;
      touch-action: none;
      pointer-events: auto;
      filter: drop-shadow(0 14px 34px rgba(0, 0, 0, 0.65));
    }

    /* Fixed upward anchor container: Speech bubble grows UPWARD without pushing the Muyu down! */
    .dsh-muyu-header-anchor {
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      min-height: 28px;
    }

    /* Speech Bubble anchored above the fish */
    .dsh-muyu-speech {
      max-width: 260px;
      min-width: 160px;
      background: rgba(22, 17, 13, 0.96);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #ffd88a;
      border: 1px solid rgba(212, 163, 89, 0.6);
      padding: 9px 15px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.48;
      text-align: center;
      margin-bottom: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.55);
      position: relative;
      animation: muyuSpeechFloat 3s ease-in-out infinite alternate;
      pointer-events: none;
      transition: opacity 0.2s ease-out;
    }
    .dsh-muyu-speech::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-top: 6px solid rgba(22, 17, 13, 0.96);
    }

    /* Drag Handle Pill */
    .dsh-muyu-drag-handle {
      background: rgba(30, 24, 20, 0.9);
      border: 1px solid rgba(212, 163, 89, 0.4);
      color: #dfba78;
      font-size: 11px;
      padding: 2px 10px;
      border-radius: 10px;
      cursor: grab;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }
    .dsh-muyu-drag-handle:active {
      cursor: grabbing;
      background: rgba(45, 35, 25, 0.95);
    }

    /* Main 3D Wood Scene Stage (Strictly fixed dimensions so position is immutable) */
    .dsh-muyu-stage {
      position: relative;
      width: 168px;
      height: 124px;
      cursor: none; /* Hide standard arrow to display authentic 3D Mallet */
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 28px;
      background: radial-gradient(circle at 45% 40%, rgba(90, 48, 25, 0.35) 0%, rgba(18, 10, 5, 0.7) 85%);
      border: 1px solid rgba(212, 163, 89, 0.38);
      box-shadow: inset 0 2px 8px rgba(255, 215, 140, 0.18), 0 8px 24px rgba(0, 0, 0, 0.5);
      overflow: visible;
      flex-shrink: 0;
    }

    /* 3D Fish Body Asset */
    .dsh-muyu-fish-img {
      width: 108px;
      height: 70px;
      object-fit: contain;
      pointer-events: none;
      filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.75));
      transition: transform 0.05s ease-out;
    }

    /* Real 3D Mallet Asset: compact short wooden stick with round head */
    .dsh-muyu-mallet-img {
      position: absolute;
      width: 52px;
      height: 26px;
      object-fit: contain;
      pointer-events: none;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.75));
      /* Pivot around right handle grip: hammer head (left side) held up gracefully */
      transform-origin: 90% 50%;
      transform: translate(-88%, -50%) rotate(38deg);
      transition: transform 0.06s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 10;
      display: none;
    }

    /* Merit Badge */
    .dsh-muyu-merit-badge {
      position: absolute;
      bottom: -6px;
      background: linear-gradient(135deg, #d4a359, #b8860b);
      color: #1a0f00;
      font-size: 11px;
      font-weight: 700;
      padding: 1px 9px;
      border-radius: 12px;
      border: 1px solid #fce7b2;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
      letter-spacing: 0.5px;
      z-index: 5;
    }

    /* Actions Bar */
    .dsh-muyu-toolbar {
      display: flex;
      gap: 5px;
      margin-top: 10px;
      opacity: 0.92;
      transition: opacity 0.2s;
      flex-shrink: 0;
    }
    .dsh-muyu-toolbar:hover {
      opacity: 1;
    }
    .dsh-muyu-btn {
      background: rgba(28, 23, 19, 0.92);
      border: 1px solid rgba(212, 163, 89, 0.4);
      color: #e6c88b;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      cursor: pointer;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: all 0.15s;
    }
    .dsh-muyu-btn:hover {
      background: rgba(212, 163, 89, 0.3);
      border-color: #ffd88a;
      color: #fff;
    }

    /* Floating Golden Text Animation */
    .dsh-muyu-sparkle {
      position: absolute;
      color: #ffd700;
      font-size: 18px;
      font-weight: 800;
      pointer-events: none;
      animation: muyuRiseUp 0.85s ease-out forwards;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.9), 0 0 20px rgba(255, 165, 0, 0.5);
      z-index: 1000000;
    }

    /* Modal Sheets (功德簿与经文库) */
    .dsh-muyu-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 1000001;
      display: none;
      align-items: center;
      justify-content: center;
    }
    .dsh-muyu-modal-card {
      width: 420px;
      max-height: 520px;
      background: #17120e;
      border: 1px solid rgba(212, 163, 89, 0.5);
      border-radius: 16px;
      color: #eeddbb;
      display: flex;
      flex-direction: column;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
      overflow: hidden;
      font-size: 13px;
    }
    .dsh-muyu-modal-header {
      padding: 14px 18px;
      background: #231b14;
      border-bottom: 1px solid rgba(212, 163, 89, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
      font-size: 15px;
      color: #f7d594;
    }
    .dsh-muyu-modal-close {
      cursor: pointer;
      color: #dfba78;
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
    }
    .dsh-muyu-modal-close:hover {
      color: #fff;
    }
    .dsh-muyu-modal-body {
      padding: 16px 18px;
      overflow-y: auto;
      flex: 1;
    }
    .dsh-muyu-list-item {
      padding: 10px 12px;
      background: rgba(45, 34, 25, 0.5);
      border: 1px solid rgba(212, 163, 89, 0.2);
      border-radius: 8px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .dsh-muyu-list-item:hover {
      background: rgba(212, 163, 89, 0.2);
      border-color: #ffd88a;
    }
    .dsh-muyu-list-item.active {
      border-color: #ffd700;
      background: rgba(212, 163, 89, 0.3);
    }

    @keyframes muyuRiseUp {
      0% { opacity: 1; transform: translate(-50%, 0) scale(0.8); }
      50% { opacity: 1; transform: translate(-50%, -32px) scale(1.2); }
      100% { opacity: 0; transform: translate(-50%, -64px) scale(1.35); }
    }
    @keyframes muyuSpeechFloat {
      0% { transform: translateY(0); }
      100% { transform: translateY(-4px); }
    }
  `;
    container.appendChild(style);
    // 1. Header Anchor Container (Holds Speech Bubble and Drag Handle, never pushing stage down)
    const headerAnchor = document.createElement('div');
    headerAnchor.className = 'dsh-muyu-header-anchor';
    const speechBubble = document.createElement('div');
    speechBubble.className = 'dsh-muyu-speech';
    speechBubble.textContent = '观自在菩萨，行深般若波罗蜜多时，照见五蕴皆空，度一切苦厄。';
    headerAnchor.appendChild(speechBubble);
    const dragHandle = document.createElement('div');
    dragHandle.className = 'dsh-muyu-drag-handle';
    dragHandle.innerHTML = '⋮⋮ 拖拽';
    headerAnchor.appendChild(dragHandle);
    container.appendChild(headerAnchor);
    // 2. Stage Container with 3D Fish and inclined 3D Mallet
    const stage = document.createElement('div');
    stage.className = 'dsh-muyu-stage';
    stage.title = '挥动木槌，点击叩击木鱼';
    const fishImg = document.createElement('img');
    fishImg.className = 'dsh-muyu-fish-img';
    fishImg.src = MUYU_FISH_BASE64;
    fishImg.alt = '3D 禅意木鱼';
    stage.appendChild(fishImg);
    const malletImg = document.createElement('img');
    malletImg.className = 'dsh-muyu-mallet-img';
    malletImg.src = MUYU_MALLET_BASE64;
    malletImg.alt = '3D 敲击木槌';
    stage.appendChild(malletImg);
    const meritBadge = document.createElement('div');
    meritBadge.className = 'dsh-muyu-merit-badge';
    meritBadge.textContent = '功德 0';
    stage.appendChild(meritBadge);
    container.appendChild(stage);
    // 3. Mini Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'dsh-muyu-toolbar';
    const autoBtn = document.createElement('button');
    autoBtn.className = 'dsh-muyu-btn';
    autoBtn.textContent = '自动修持';
    toolbar.appendChild(autoBtn);
    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'dsh-muyu-btn';
    voiceBtn.textContent = '诵经: 开';
    toolbar.appendChild(voiceBtn);
    const sutraBtn = document.createElement('button');
    sutraBtn.className = 'dsh-muyu-btn';
    sutraBtn.textContent = '选经';
    toolbar.appendChild(sutraBtn);
    const meritBtn = document.createElement('button');
    meritBtn.className = 'dsh-muyu-btn';
    meritBtn.textContent = '功德簿';
    toolbar.appendChild(meritBtn);
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'dsh-muyu-btn';
    toggleBtn.textContent = '收起';
    toolbar.appendChild(toggleBtn);
    container.appendChild(toolbar);
    // 4. Modal Sheets
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'dsh-muyu-modal-backdrop';
    const modalCard = document.createElement('div');
    modalCard.className = 'dsh-muyu-modal-card';
    const modalHeader = document.createElement('div');
    modalHeader.className = 'dsh-muyu-modal-header';
    const modalTitle = document.createElement('span');
    modalTitle.textContent = '弹窗';
    const modalClose = document.createElement('span');
    modalClose.className = 'dsh-muyu-modal-close';
    modalClose.innerHTML = '&times;';
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(modalClose);
    const modalBody = document.createElement('div');
    modalBody.className = 'dsh-muyu-modal-body';
    modalCard.appendChild(modalHeader);
    modalCard.appendChild(modalBody);
    modalBackdrop.appendChild(modalCard);
    document.body.appendChild(modalBackdrop);
    const closeModal = () => {
        modalBackdrop.style.display = 'none';
    };
    modalClose.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop)
            closeModal();
    });
    // --- Mallet Cursor Tracking & Realistic Tilted Knock Animation ---
    stage.addEventListener('mouseenter', () => {
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
        // Hammer head swings down from up-left (+38deg) downwards to strike (-14deg)
        malletImg.style.transform = 'translate(-88%, -50%) rotate(-14deg) scale(0.93)';
        fishImg.style.transform = 'scale(0.92)';
        setTimeout(() => {
            // Rebound back up to raised ready position (+38deg)
            malletImg.style.transform = 'translate(-88%, -50%) rotate(38deg) scale(1)';
            fishImg.style.transform = 'scale(1)';
        }, 110);
    }
    // Knock Event
    stage.addEventListener('click', () => {
        animateKnock();
        triggerKnockEffect();
        if (options.onKnock) {
            options.onKnock();
        }
    });
    // Dragging Handled by Dedicated Handle Only
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
        dragHandle.setPointerCapture(e.pointerId);
    });
    window.addEventListener('pointermove', (e) => {
        if (!isDragging)
            return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        container.style.left = `${initialLeft + dx}px`;
        container.style.top = `${initialTop + dy}px`;
    });
    window.addEventListener('pointerup', (e) => {
        if (!isDragging)
            return;
        isDragging = false;
        try {
            dragHandle.releasePointerCapture(e.pointerId);
        }
        catch { }
    });
    // Auto Knock Toggle
    autoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (options.onToggleAuto) {
            options.onToggleAuto();
        }
    });
    // Voice Toggle
    voiceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        voiceEnabled = !voiceEnabled;
        voiceBtn.textContent = voiceEnabled ? '诵经: 开' : '诵经: 静音';
        voiceBtn.style.color = voiceEnabled ? '#e6c88b' : '#999';
        if (options.onToggleVoice) {
            options.onToggleVoice(voiceEnabled);
        }
    });
    // Sutra Book Selector Sheet
    sutraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modalTitle.textContent = '📜 传世经典宝库';
        modalBody.innerHTML = '';
        options.sutraList.forEach((book) => {
            const item = document.createElement('div');
            const isCurrent = book.id === options.currentBookId;
            item.className = `dsh-muyu-list-item ${isCurrent ? 'active' : ''}`;
            item.innerHTML = `
        <div>
          <div style="font-weight: 600; color: #ffd88a;">《${book.title}》 ${isCurrent ? '👉 (修持中)' : ''}</div>
          <div style="font-size: 11px; color: #bba688; margin-top: 3px;">${book.summary}</div>
        </div>
        <div style="font-size: 11px; color: #e6c88b;">${book.sentences.length} 句</div>
      `;
            item.addEventListener('click', () => {
                options.currentBookId = book.id;
                if (options.onSelectSutra) {
                    options.onSelectSutra(book.id);
                }
                closeModal();
            });
            modalBody.appendChild(item);
        });
        modalBackdrop.style.display = 'flex';
    });
    // Merit Record Sheet (功德簿)
    meritBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modalTitle.textContent = '📿 历劫功德簿';
        modalBody.innerHTML = '';
        const stats = options.getMeritRecords();
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
        summaryBox.innerHTML = `
      <div>
        <div style="font-size: 11px; color: #dfba78;">今日修行功德</div>
        <div style="font-size: 22px; font-weight: bold; color: #ffd700; margin-top: 2px;">+${stats.todayMerit}</div>
      </div>
      <div style="width: 1px; background: rgba(212,163,89,0.3);"></div>
      <div>
        <div style="font-size: 11px; color: #dfba78;">历劫累积总功德</div>
        <div style="font-size: 22px; font-weight: bold; color: #ffd700; margin-top: 2px;">${stats.totalMerit}</div>
      </div>
    `;
        modalBody.appendChild(summaryBox);
        const listTitle = document.createElement('div');
        listTitle.style.cssText = 'font-weight: 600; color: #dfba78; margin-bottom: 8px;';
        listTitle.textContent = '📅 按日功德明细';
        modalBody.appendChild(listTitle);
        if (stats.records && stats.records.length > 0) {
            stats.records.forEach((rec) => {
                const item = document.createElement('div');
                item.className = 'dsh-muyu-list-item';
                item.innerHTML = `
          <div>
            <span style="font-weight: 600;">${rec.displayDate}</span>
            <span style="font-size: 10px; color: #999; margin-left: 6px;">(${rec.dateKey})</span>
          </div>
          <div style="font-size: 14px; font-weight: bold; color: #ffd700;">+${rec.count} 功德</div>
        `;
                modalBody.appendChild(item);
            });
        }
        else {
            const emptyTip = document.createElement('div');
            emptyTip.style.cssText = 'color: #999; text-align: center; padding: 20px;';
            emptyTip.textContent = '暂无历史功德记录，快去叩木鱼修持吧！';
            modalBody.appendChild(emptyTip);
        }
        modalBackdrop.style.display = 'flex';
    });
    // Expand / Collapse Toggle
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            headerAnchor.style.display = 'none';
            autoBtn.style.display = 'none';
            voiceBtn.style.display = 'none';
            sutraBtn.style.display = 'none';
            meritBtn.style.display = 'none';
            stage.style.width = '52px';
            stage.style.height = '52px';
            stage.style.borderRadius = '50%';
            fishImg.style.width = '42px';
            fishImg.style.height = '36px';
            meritBadge.style.display = 'none';
            toggleBtn.textContent = '展开';
        }
        else {
            headerAnchor.style.display = 'flex';
            autoBtn.style.display = 'inline-block';
            voiceBtn.style.display = 'inline-block';
            sutraBtn.style.display = 'inline-block';
            meritBtn.style.display = 'inline-block';
            stage.style.width = '134px';
            stage.style.height = '98px';
            stage.style.borderRadius = '26px';
            fishImg.style.width = '108px';
            fishImg.style.height = '70px';
            meritBadge.style.display = 'block';
            toggleBtn.textContent = '收起';
        }
    });
    function triggerKnockEffect(text = '功德 +1') {
        const rect = stage.getBoundingClientRect();
        const spark = document.createElement('div');
        spark.className = 'dsh-muyu-sparkle';
        spark.textContent = text;
        spark.style.left = `${rect.left + rect.width / 2}px`;
        spark.style.top = `${rect.top}px`;
        document.body.appendChild(spark);
        setTimeout(() => {
            spark.remove();
        }, 850);
    }
    return {
        mount(target = document.body) {
            target.appendChild(container);
        },
        unmount() {
            container.remove();
            modalBackdrop.remove();
        },
        update(merit, sentence, isAutoRunning) {
            meritBadge.textContent = `功德 ${merit}`;
            speechBubble.textContent = sentence;
            if (typeof isAutoRunning === 'boolean') {
                autoBtn.textContent = isAutoRunning ? '停止自动' : '自动修持';
                autoBtn.style.color = isAutoRunning ? '#ffd700' : '#e6c88b';
            }
        },
        triggerKnockEffect,
        animateKnock
    };
}
//# sourceMappingURL=widget-ui.js.map