// The server-answer piece loads when Send is pressed (D-43). A failed load is not remembered: the next send asks again.
export type QuoteSendAnswers = typeof import('./QuoteSendAnswers');

export const loadQuoteSendAnswers = (): Promise<QuoteSendAnswers> => import('./QuoteSendAnswers');
