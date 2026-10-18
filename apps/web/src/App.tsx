import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar.js';
import { OwnerDashboard } from './pages/owner/OwnerDashboard.js';
import { DeliveryManagement } from './pages/owner/DeliveryManagement.js';
import { StockLedger } from './pages/owner/StockLedger.js';
import { CatalogManagement } from './pages/owner/CatalogManagement.js';
import { PaymentTracking } from './pages/owner/PaymentTracking.js';
import { EmployeeReporting } from './pages/employee/EmployeeReporting.js';
import { Login } from './pages/auth/Login.js';

const queryClient = new QueryClient();

interface UserState {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'employee';
  assignedShop?: string;
}

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserState | null>({
    id: 'u0000000-0000-0000-0000-000000000001',
    email: 'owner@rtrmobiles.com',
    name: 'Rajesh (Owner)',
    role: 'owner'
  });

  const handleSignOut = () => {
    setCurrentUser(null);
  };

  const handleSignIn = (user: UserState) => {
    setCurrentUser(user);
  };

  if (!currentUser) {
    return <Login onLoginSuccess={handleSignIn} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-crimpston-offwhite text-slate-800 flex flex-col">
          <Navbar
            userRole={currentUser.role}
            userName={currentUser.name}
            assignedShopName={currentUser.assignedShop}
            onSignOut={handleSignOut}
          />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              {currentUser.role === 'owner' ? (
                <>
                  <Route path="/" element={<OwnerDashboard />} />
                  <Route path="/deliveries" element={<DeliveryManagement />} />
                  <Route path="/stock-ledger" element={<StockLedger />} />
                  <Route path="/payments" element={<PaymentTracking />} />
                  <Route path="/management" element={<CatalogManagement />} />
                  <Route path="/employee" element={<EmployeeReporting />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </>
              ) : (
                <>
                  <Route path="/employee" element={<EmployeeReporting />} />
                  <Route path="*" element={<Navigate to="/employee" replace />} />
                </>
              )}
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
