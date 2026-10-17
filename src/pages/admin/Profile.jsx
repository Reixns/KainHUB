import { Shield, User, Mail, Phone } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge } from '@/components/UI';

export default function AdminProfile() {
  const { auth } = useApp();
  const user = auth.user;
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-ink mb-4">My Profile</h1>
      <Card className="p-6 text-center mb-4">
        <div className="w-20 h-20 bg-cat-blue/10 rounded-full mx-auto flex items-center justify-center text-4xl mb-3">{(user.fullName || '?').slice(0,1).toUpperCase()}</div>
        <h2 className="text-xl font-bold">{user.fullName}</h2>
        <p className="text-sm text-muted">{user.email}</p>
        <Badge color="blue"><Shield className="w-3 h-3" /> PLATFORM ADMIN</Badge>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Account Information</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center"><User className="w-4 h-4 text-muted" /></div><div><div className="text-xs text-muted">Name</div><div className="font-medium">{user.fullName}</div></div></div>
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-muted"><Mail className="w-4 h-4" /></div><div><div className="text-xs text-muted">Email</div><div className="font-medium">{user.email}</div></div></div>
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center text-muted"><Phone className="w-4 h-4" /></div><div><div className="text-xs text-muted">Mobile</div><div className="font-medium">{user.mobile}</div></div></div>
        </div>
      </Card>
    </div>
  );
}
