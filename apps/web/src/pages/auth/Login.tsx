import React, { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';

import { getShops } from '../../services/db.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';

interface LoginProps {
  onLoginSuccess: (user: { id: string; email: string; name: string; role: 'owner' | 'employee'; assignedShop?: string }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const performSignIn = async (userEmail: string, userPass: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userEmail.trim(),
        password: userPass,
      });

      if (authError) {
        setErrorMsg(authError.message || 'Invalid email or password.');
        return false;
      }

      if (authData.user) {
        // Query business membership
        const { data: membership } = await supabase
          .from('business_memberships')
          .select('role')
          .eq('user_id', authData.user.id)
          .maybeSingle();

        const role = membership?.role === 'owner' ? 'owner' : 'employee';

        let assignedShopName: string | undefined;
        if (role === 'employee') {
          const { data: shopMember } = await supabase
            .from('shop_memberships')
            .select('shop_id')
            .eq('user_id', authData.user.id)
            .maybeSingle();

          if (shopMember?.shop_id) {
            const { data: shopData } = await supabase
              .from('shops')
              .select('name')
              .eq('id', shopMember.shop_id)
              .maybeSingle();
            assignedShopName = shopData?.name;
          }
        }

        onLoginSuccess({
          id: authData.user.id,
          email: authData.user.email || userEmail.trim(),
          name: authData.user.user_metadata?.full_name || (role === 'owner' ? 'Business Owner' : 'Store Staff'),
          role,
          assignedShop: assignedShopName
        });
        return true;
      }
    }

    // Fallback if Supabase is offline or unconfigured
    const isOwnerRole = userEmail.toLowerCase().includes('owner') || !userEmail.toLowerCase().includes('employee');
    if (isOwnerRole) {
      onLoginSuccess({
        id: 'b46689e9-754e-49b5-b79b-ebc1ee42538f',
        email: userEmail.trim(),
        name: 'Business Owner',
        role: 'owner'
      });
    } else {
      const shops = await getShops();
      onLoginSuccess({
        id: '41adecf8-91aa-46e7-9dd4-13a332014f88',
        email: userEmail.trim(),
        name: 'Store Staff',
        role: 'employee',
        assignedShop: shops.length > 0 ? shops[0]?.name : undefined
      });
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      await performSignIn(email, password);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to authenticate.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async (role: 'owner' | 'employee') => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      if (role === 'owner') {
        await performSignIn('owner@rtrmobiles.com', 'password123');
      } else {
        await performSignIn('staff@rtrmobiles.com', 'password123');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign in demo user.');
    } finally {
      setIsLoading(false);
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
