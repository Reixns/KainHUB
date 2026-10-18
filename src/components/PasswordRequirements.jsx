import { CheckCircle2, CircleX } from 'lucide-react';
import { getPasswordRequirements } from '@/lib/supabase/password';

export default function PasswordRequirements({ password, email, fullName }) {
  const requirements = getPasswordRequirements(password, { email, fullName });
  const passed = requirements.filter((requirement) => requirement.valid).length;
  const isStrong = passed === requirements.length;
  const corePassed = requirements.slice(0, 5).filter((requirement) => requirement.valid).length;
  const strength = isStrong
    ? { label: 'Strong', color: 'bg-emerald-400' }
    : corePassed === 5 && passed >= 6
      ? { label: 'Good', color: 'bg-lime-400' }
      : corePassed >= 3 && passed >= 4
        ? { label: 'Fair', color: 'bg-amber-400' }
        : { label: 'Weak', color: 'bg-rose-500' };

  return (
    <div className="space-y-2 sm:col-span-2" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-white/70">Password strength</span>
        <span className={password ? 'font-semibold text-white/75' : 'text-white/45'}>
          {password ? strength.label : 'Not entered'}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={requirements.length}
        aria-valuenow={password ? passed : 0}
      >
        <div
          className={`h-full rounded-full transition-[width,background-color] ${password ? strength.color : 'bg-white/15'}`}
          style={{ width: `${password ? (passed / requirements.length) * 100 : 0}%` }}
        />
      </div>
      {!isStrong && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {requirements.map((requirement) => {
            const met = password && requirement.valid;
            const Icon = met ? CheckCircle2 : CircleX;
            return (
              <li
                key={requirement.id}
                className={`flex items-start gap-1.5 text-[11px] leading-4 ${
                  met ? 'text-emerald-300' : password ? 'text-rose-300' : 'text-white/45'
                }`}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{requirement.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
