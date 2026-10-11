/**
 * @typedef {{code: string, message: string, context?: Record<string, unknown>, [key: string]: unknown}} ApiErrorData
 * @typedef {{key: string, label?: string, type?: string}} ExtractionField
 * @typedef {{extractionData?: Record<string, unknown>, extractionCompletedAt?: string | null}} ExtractionArticle
 * @typedef {Omit<RequestInit, 'body'> & {body?: any, skipErrorLog?: boolean, suppressErrorStatuses?: number[]}} ApiRequestOptions
 */
export {};
