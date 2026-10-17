import { Store } from 'lucide-react';
import RoleLogin from '@/components/RoleLogin';

export default function VendorLogin() {
  return (
    <RoleLogin
      config={{
        role: 'vendor',
        redirectTo: '/vendor/dashboard',
        redirectIfSignedIn: true,
        badgeClassName: 'bg-success',
        BadgeIcon: Store,
        badgeLabel: 'Vendor Portal',
        title: 'Vendor Login',
        subtitle: 'Sign in with your email and password.',
        emailLabel: 'Email Address',
        submitLabel: 'Sign In',
        footer: {
          type: 'register',
          prompt: "Don't have a vendor account?",
          to: '/vendor/register',
          linkLabel: 'Register your shop',
          linkClassName: 'text-violet-300',
        },
      }}
    />
  );
}
