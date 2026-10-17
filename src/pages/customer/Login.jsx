import RoleLogin from '@/components/RoleLogin';

export default function CustomerLogin() {
  return (
    <RoleLogin
      config={{
        role: 'customer',
        redirectTo: '/customer',
        redirectIfSignedIn: true,
        badgeClassName: 'bg-brand',
        BadgeIcon: () => <span aria-hidden="true">🍴</span>,
        badgeLabel: 'Customer Portal',
        title: 'Welcome back!',
        subtitle: 'Sign in with your email and password.',
        emailLabel: 'Email Address',
        submitLabel: 'Sign In',
        footer: {
          type: 'register',
          prompt: "Don't have an account?",
          to: '/customer/register',
          linkLabel: 'Create Account',
          linkClassName: 'text-brand-strong',
        },
      }}
    />
  );
}
