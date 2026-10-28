import type { MuyuService } from '../services/muyu-service.js';
import type { MuyuSoundType } from '../types.js';
export declare function createMuyuTools(muyu: MuyuService): ({
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            count: {
                type: string;
                description: string;
            };
            sound: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: never[];
    };
    output: {
        schema: {
            type: string;
        };
        render: (_args: any, res: any) => {
            type: string;
            text: string;
        }[];
    };
    execute(args: any): Promise<{
        amount: number;
        todayMerit: number;
        totalMerit: number;
        currentSentence: import("../types.js").SutraSentence;
        nextSentence: import("../types.js").SutraSentence;
        cycleCompleted: boolean;
        completedCycles: number;
        soundType: MuyuSoundType;
        soundFile: string;
        voicePrompt: {
            text: string;
            lang: string;
            rate: number;
            pitch: number;
        };
        soundDisplayName: string;
    }>;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            cycle: {
                type: string;
                description: string;
            };
            intervalMs: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    output: {
        schema: {
            type: string;
        };
        render: (_args: any, res: any) => {
            type: string;
            text: string;
        }[];
    };
    execute(args: any): Promise<{
        running: boolean;
        targetCount: number;
        currentCount: number;
        intervalMs: number;
        cycleTitle: string;
        startTime?: number;
        action: string;
    }>;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {};
        required: never[];
    };
    output: {
        schema: {
            type: string;
        };
        render: (_args: any, res: any) => {
            type: string;
            text: string;
        }[];
    };
    execute(): Promise<import("../types.js").MeritStats>;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            bookId: {
                type: string;
                description: string;
            };
        };
        required: never[];
    };
    output: {
        schema: {
            type: string;
        };
        render: (_args: any, res: any) => {
            type: string;
            text: string;
        }[];
    };
    execute(args: any): Promise<{
        selected: boolean;
        currentBook: import("../types.js").SutraBook;
        currentSentence: import("../types.js").SutraSentence;
        availableBooks: {
            id: string;
            title: string;
            summary: string;
            sentences: string[];
        }[];
    }>;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            type: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: never[];
    };
    output: {
        schema: {
            type: string;
        };
        render: (_args: any, res: any) => {
            type: string;
            text: string;
        }[];
    };
    execute(args: any): Promise<{
        currentSound: import("../types.js").SoundDefinition;
        soundFilePath: string;
    }>;
})[];
//# sourceMappingURL=index.d.ts.map