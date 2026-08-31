export type VocabAnswerMatch = "exact" | "close" | "wrong";
export declare const VOCAB_ANSWER_MAX_TYPOS = 3;
export declare function normalizeVocabAnswer(raw: string): string;
export declare function evaluateVocabAnswer(userAnswer: string, expected: string, alternateAnswers?: string[], maxTypos?: number): VocabAnswerMatch;
//# sourceMappingURL=vocabReviewAnswer.d.ts.map