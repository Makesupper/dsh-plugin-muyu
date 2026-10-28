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
export interface SutraItem {
    id: string;
    title: string;
    summary: string;
    sentences: string[];
}
export interface MeritHistoryItem {
    dateKey: string;
    displayDate: string;
    count: number;
}
export interface WidgetOptions {
    onKnock?: () => void;
    onToggleAuto?: () => void;
    onToggleVoice?: (enabled: boolean) => void;
    onSelectSutra?: (bookId: string) => void;
    sutraList: SutraItem[];
    currentBookId: string;
    getMeritRecords: () => {
        todayMerit: number;
        totalMerit: number;
        records: MeritHistoryItem[];
    };
}
export declare function createMuyuFloatingPet(options: WidgetOptions): {
    mount(target?: HTMLElement): void;
    unmount(): void;
    update(merit: number, sentence: string, isAutoRunning?: boolean): void;
    triggerKnockEffect: (text?: string) => void;
    animateKnock: () => void;
};
//# sourceMappingURL=widget-ui.d.ts.map