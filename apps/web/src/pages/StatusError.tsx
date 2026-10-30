import React from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { ErrorPage, HttpStatusCode } from '../components/ui/ErrorPage.js';

export const StatusError: React.FC = () => {
  const [searchParams] = useSearchParams();
  const params = useParams<{ code?: string }>();

  // Determine status code from URL path (:code) or query string (?status=...)
  const rawCode = params.code || searchParams.get('status') || '500';
  const parsedCode = parseInt(rawCode, 10);
  const statusCode: HttpStatusCode = (!isNaN(parsedCode) ? parsedCode : 500) as HttpStatusCode;

  const correlationId = searchParams.get('ref') || searchParams.get('correlationId');
  const customMessage = searchParams.get('msg') || searchParams.get('message') || undefined;
  const cooldown = searchParams.get('retryAfter') ? parseInt(searchParams.get('retryAfter')!, 10) : undefined;

  return (
    <ErrorPage
      statusCode={statusCode}
      description={customMessage}
      correlationId={correlationId}
      retryAfterSeconds={cooldown}
    />
  );
};

export default StatusError;
