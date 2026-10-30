import React from 'react';
import { ErrorPage } from '../components/ui/ErrorPage.js';

export interface NotFoundProps {
  isAuthenticated?: boolean;
  userRole?: 'owner' | 'demo';
  invalidPath?: string;
  onGoBack?: () => void;
  onGoToDashboard?: () => void;
}

export const NotFound: React.FC<NotFoundProps> = ({
  isAuthenticated,
  invalidPath,
  onGoBack,
  onGoToDashboard
}) => {
  return (
    <ErrorPage
      statusCode={404}
      isAuthenticated={isAuthenticated}
      invalidPath={invalidPath}
      onGoBack={onGoBack}
      onGoToDashboard={onGoToDashboard}
    />
  );
};

export default NotFound;
