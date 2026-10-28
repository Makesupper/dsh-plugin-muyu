import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeritStorage } from './merit-storage.js';
import { ChantService } from './chant-service.js';
import { soundLibrary } from '../data/sounds.js';
export class MuyuService {
    ctx;
    config;
    storage;
    chantService;
    currentSound = 'sandalwood';
    autoKnockTimer = null;
    autoStatus = {
        running: false,
        targetCount: 0,
        currentCount: 0,
        intervalMs: 1200,
        cycleTitle: '无尽修持'
    };
    assetsDir;
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.storage = new MeritStorage(config.storagePath);
        this.chantService = new ChantService(config.defaultSutra);
        this.currentSound = config.defaultSound || 'sandalwood';
        // 解析 assets/sounds 绝对路径
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        this.assetsDir = path.resolve(__dirname, '../../assets/sounds');
        // ctx.effect 确保插件被卸载或热重载时自动停止定时器
        this.ctx.effect(() => {
            return () => {
                this.stopAutoKnock();
            };
        });
    }
    getSoundType() {
        return this.currentSound;
    }
    setSoundType(type) {
        if (soundLibrary[type]) {
            this.currentSound = type;
            return true;
        }
        return false;
    }
    getSoundFile(type) {
        const targetType = type || this.currentSound;
        const def = soundLibrary[targetType] || soundLibrary.sandalwood;
        return path.join(this.assetsDir, def.fileName);
    }
    knock(amount = 1) {
        const { todayMerit, totalMerit } = this.storage.addMerit(amount);
        const { current, next, cycleCompleted, completedCycles } = this.chantService.advanceSentence();
        const soundFile = this.getSoundFile();
        return {
            amount,
            todayMerit,
            totalMerit,
            currentSentence: current,
            nextSentence: next,
            cycleCompleted,
            completedCycles,
            soundType: this.currentSound,
            soundFile,
            voicePrompt: {
                text: current.text + '　', // 与 iOS 一致添加全角空格缓冲防爆音
                lang: 'zh-CN',
                rate: this.config.voiceRate ?? 0.8,
                pitch: this.config.voicePitch ?? 0.95
            }
        };
    }
    startAutoKnock(targetCount = 0, intervalMs, cycleTitle) {
        this.stopAutoKnock();
        const interval = intervalMs || this.config.autoKnockIntervalMs || 1200;
        this.autoStatus = {
            running: true,
            targetCount,
            currentCount: 0,
            intervalMs: interval,
            cycleTitle: cycleTitle || (targetCount === 0 ? '无尽修持' : `${targetCount} 次圆满`),
            startTime: Date.now()
        };
        this.autoKnockTimer = setInterval(() => {
            this.knock(1);
            this.autoStatus.currentCount += 1;
            if (this.autoStatus.targetCount > 0 && this.autoStatus.currentCount >= this.autoStatus.targetCount) {
                this.stopAutoKnock();
            }
        }, interval);
        return { ...this.autoStatus };
    }
    stopAutoKnock() {
        if (this.autoKnockTimer) {
            clearInterval(this.autoKnockTimer);
            this.autoKnockTimer = null;
        }
        this.autoStatus.running = false;
        return { ...this.autoStatus };
    }
    getAutoKnockStatus() {
        return { ...this.autoStatus };
    }
    getMeritStats() {
        return this.storage.getStats();
    }
    getSutra() {
        return this.chantService.getBook();
    }
    getAllSutras() {
        return this.chantService.getAllBooks();
    }
    selectSutra(bookId) {
        return this.chantService.setBook(bookId);
    }
    getCurrentSentence() {
        return this.chantService.getCurrentSentence();
    }
}
//# sourceMappingURL=muyu-service.js.map