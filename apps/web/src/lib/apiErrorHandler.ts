import { HttpStatusCode } from '../components/ui/ErrorPage.js';

export interface ApiErrorResult {
  statusCode: HttpStatusCode | number;
  statusText: string;
  code?: string;
  message: string;
  userMessage: string;
  correlationId?: string;
  retryAfterSeconds?: number;
  details?: Array<{ field?: string; message: string }> | string[];
  actionRecommendation: 'sign_in' | 'retry' | 'refresh_data' | 'review_form' | 'cooldown' | 'contact_admin' | 'none';
  isNetworkError?: boolean;
}

/**
 * Maps raw HTTP responses or JavaScript errors to structured, user-safe API error objects.
 * 
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * A 404 API response (e.g. GET /api/shops/:id) indicates a missing database resource,
 * NOT a missing frontend route. It MUST NEVER redirect the user to the application's 404 page.
 */
export async function parseApiError(errorOrResponse: unknown): Promise<ApiErrorResult> {
  // 1. Handle Fetch Response object
  if (errorOrResponse instanceof Response) {
    const res = errorOrResponse;
    const statusCode = res.status;
    const correlationId = res.headers.get('x-correlation-id') || undefined;
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

    let payload: any = null;
    try {
      const text = await res.clone().text();
      payload = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON response (e.g. HTML or gateway error)
    }

    const rawMessage = payload?.error?.message || payload?.message || payload?.error || res.statusText;
    const code = payload?.error?.code || payload?.code || undefined;
    const details = payload?.error?.details || payload?.details || undefined;

    return buildStructuredError(statusCode, rawMessage, correlationId, retryAfterSeconds, details, code);
  }

  // 2. Handle standard Error objects
  if (errorOrResponse instanceof Error) {
    const err = errorOrResponse;
    const msg = err.message || 'An unexpected error occurred';
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || isOffline) {
      return {
        statusCode: 503,
        statusText: 'Service Unavailable',
        message: msg,
        userMessage: 'Unable to reach the server. Please check your internet connection.',
        actionRecommendation: 'retry',
        isNetworkError: true
      };
    }

    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        statusCode: 408,
        statusText: 'Request Timeout',
        message: msg,
        userMessage: 'The request took too long to complete. Please try again.',
        actionRecommendation: 'retry'
      };
    }

    if (msg.includes('expired') || msg.includes('Unauthorized')) {
      return {
        statusCode: 401,
        statusText: 'Unauthorized',
        message: msg,
        userMessage: 'Your session has expired. Please sign in again.',
        actionRecommendation: 'sign_in'
      };
    }

    return {
      statusCode: 500,
      statusText: 'Internal Error',
      message: msg,
      userMessage: 'An unexpected application error occurred. Please try again.',
      actionRecommendation: 'retry'
    };
  }

  // 3. Fallback for unknown objects
  return {
    statusCode: 500,
    statusText: 'Unknown Error',
    message: String(errorOrResponse),
    userMessage: 'An unexpected error occurred.',
    actionRecommendation: 'none'
  };
}

function buildStructuredError(
  statusCode: number,
  rawMessage?: string,
  correlationId?: string,
  retryAfterSeconds?: number,
  details?: any,
  code?: string
): ApiErrorResult {
  let userMessage = '';
  let recommendation: ApiErrorResult['actionRecommendation'] = 'none';

  switch (statusCode) {
    case 400:
      userMessage = rawMessage || 'The submitted information is invalid. Please check your inputs.';
      recommendation = 'review_form';
      break;

    case 401:
      userMessage = 'Your session has expired or you need to sign in to continue.';
      recommendation = 'sign_in';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rtr:session-expired'));
      }
      break;

    case 403:
      userMessage = "You don't have permission to access this resource or perform this action.";
      recommendation = 'contact_admin';
      break;

    case 404:
      // CRUCIAL: Missing API entity (e.g. shop deleted by another user) - DO NOT redirect to 404 page!
      userMessage = rawMessage || 'The requested record or resource was not found. It may have been removed.';
      recommendation = 'refresh_data';
      break;

    case 408:
      userMessage = 'The request timed out. Your entries have been preserved. Please retry.';
      recommendation = 'retry';
      break;

    case 409:
      userMessage = rawMessage || 'This update conflicts with a concurrent change. Please refresh the latest records.';
      recommendation = 'refresh_data';
      break;

    case 422:
      userMessage = rawMessage || 'Some submitted information needs correction.';
      recommendation = 'review_form';
      break;

    case 429:
      userMessage = retryAfterSeconds
        ? `Too many requests. Please wait ${retryAfterSeconds} seconds before trying again.`
        : 'Too many requests. Please wait a moment before trying again.';
      recommendation = 'cooldown';
      break;

    case 500:
      userMessage = 'An unexpected server error occurred. Your data is safe. Please try again.';
      recommendation = 'retry';
      break;

    case 502:
      userMessage = 'The server received an invalid upstream response. Please retry in a moment.';
      recommendation = 'retry';
      break;

    case 503:
      userMessage = 'Service is temporarily unavailable due to maintenance. Please try again shortly.';
      recommendation = 'retry';
      break;

    case 504:
      userMessage = 'Server response timed out. Non-idempotent operations were not repeated.';
      recommendation = 'retry';
      break;

    default:
      userMessage = rawMessage || 'An unexpected error occurred. Please try again.';
      recommendation = statusCode >= 500 ? 'retry' : 'none';
  }

  return {
    statusCode,
    statusText: getStatusText(statusCode),
    code,
    message: rawMessage || userMessage,
    userMessage,
    correlationId,
    retryAfterSeconds,
    details,
    actionRecommendation: recommendation
  };
}

function getStatusText(status: number): string {
  switch (status) {
    case 400: return 'Bad Request';
    case 401: return 'Unauthorized';
    case 403: return 'Forbidden';
    case 404: return 'Not Found';
    case 408: return 'Request Timeout';
    case 409: return 'Conflict';
    case 422: return 'Unprocessable Entity';
    case 429: return 'Too Many Requests';
    case 500: return 'Internal Server Error';
    case 502: return 'Bad Gateway';
    case 503: return 'Service Unavailable';
    case 504: return 'Gateway Timeout';
    default: return 'Request Error';
  }
}
