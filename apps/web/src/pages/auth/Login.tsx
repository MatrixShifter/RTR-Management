import React, { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

interface LoginProps {
  onLoginSuccess: (user: { id: string; email: string; name: string; role: 'owner' | 'employee'; assignedShop?: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    setTimeout(() => {
      setIsLoading(false);
      // Demo credentials handling
      if (email.includes('owner')) {
        onLoginSuccess({
          id: 'u0000000-0000-0000-0000-000000000001',
          email: 'owner@rtrmobiles.com',
          name: 'Rajesh (Owner)',
          role: 'owner'
        });
      } else {
        onLoginSuccess({
          id: 'u0000000-0000-0000-0000-000000000002',
          email: 'emp.store1@rtrmobiles.com',
          name: 'Arun Kumar',
          role: 'employee',
          assignedShop: 'Apex Mobiles & Telecom'
        });
      }
    }, 500);
  };

  const handleQuickDemoLogin = (role: 'owner' | 'employee') => {
    if (role === 'owner') {
      onLoginSuccess({
        id: 'u0000000-0000-0000-0000-000000000001',
        email: 'owner@rtrmobiles.com',
        name: 'Rajesh (Owner)',
        role: 'owner'
      });
    } else {
      onLoginSuccess({
        id: 'u0000000-0000-0000-0000-000000000002',
        email: 'emp.store1@rtrmobiles.com',
        name: 'Arun Kumar',
        role: 'employee',
        assignedShop: 'Apex Mobiles & Telecom'
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-crimpston-navy text-white flex items-center justify-center font-black text-xl mx-auto shadow-md border border-slate-700">
          RTR
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
          RTR Wholesale Management
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Mobile Accessories Distribution, Stock Ledger & Payment Tracking
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {errorMsg && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {errorMsg}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@rtrmobiles.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />

            <Button type="submit" variant="primary" size="md" isLoading={isLoading} className="w-full">
              <span>Sign In to Workspace</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-crimpston-electric" />
              <span>Development Testing Accounts</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoLogin('owner')}
              >
                Sign In as Owner
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoLogin('employee')}
              >
                Sign In as Employee
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
