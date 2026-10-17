import { Shield } from 'lucide-react';
import RoleLogin from '@/components/RoleLogin';

export default function AdminLogin() {
  return (
    <RoleLogin
      config={{
        role: 'admin',
        redirectTo: '/admin/dashboard',
        // The admin portal deliberately does not bounce an already-signed-in
        // user, matching the previous standalone AdminLogin page.
        redirectIfSignedIn: false,
        badgeClassName: 'bg-info',
        BadgeIcon: Shield,
        badgeLabel: 'Admin Portal',
        title: 'Administrator Login',
        subtitle: 'Platform management console.',
        emailLabel: 'Email',
        SubmitIcon: Shield,
        submitLabel: 'Sign In as Admin',
        footer: {
          type: 'notice',
          text: 'Restricted area. Authorized personnel only.',
        },
      }}
    />
  );
}
