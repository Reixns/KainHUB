import { useState } from 'react';
import { ChevronDown, Tag } from 'lucide-react';

const CUSTOM_CATEGORY_OPTION = '__enter_custom_category__';

export default function FoodCategoryField({ value, onChange, error, className = '', theme = 'dark' }) {
  const [customMode, setCustomMode] = useState(false);
  const isDark = theme === 'dark';
  const inputId = 'vendor-food-category';
  const selectId = `${inputId}-select`;
  const selection = customMode ? CUSTOM_CATEGORY_OPTION : value || '';
  const controlClass = [
    'w-full rounded-control border text-sm transition-colors duration-150 focus:outline-none focus:ring-2',
    isDark
      ? 'min-h-11 bg-[#101014] py-2 text-white'
      : 'min-h-11 bg-white py-3 text-ink',
    error
      ? 'border-danger/60 focus:border-danger focus:ring-danger/20'
      : isDark
        ? 'border-white/15 hover:border-violet-300/50 focus:border-violet-400 focus:ring-violet-400/20'
        : 'border-hairline-strong hover:border-hairline-hover focus:border-brand focus:ring-brand-muted',
  ].join(' ');

  const handleSelectionChange = (event) => {
    const nextValue = event.target.value;
    if (nextValue === CUSTOM_CATEGORY_OPTION) {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    onChange(nextValue);
  };

  return (
    <div className={`w-full ${className}`}>
      <label
        htmlFor={selectId}
        className={`mb-1.5 block text-sm font-medium ${isDark ? 'text-white/72' : 'text-body'}`}
      >
        Food category
      </label>
      <div className="relative">
        <Tag
          className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
            isDark ? 'text-white/40' : 'text-subtle'
          }`}
          aria-hidden="true"
        />
        <select
          id={selectId}
          value={selection}
          onChange={handleSelectionChange}
          style={{ colorScheme: isDark ? 'dark' : 'light' }}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
          className={`${controlClass} appearance-none py-2 pl-11 pr-10 ${isDark ? 'register-input' : ''}`}
        >
          <option value="" disabled>Select a category</option>
          {value && <option value={value}>{value}</option>}
          <option value={CUSTOM_CATEGORY_OPTION}>Enter a new category...</option>
        </select>
        <ChevronDown
          className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
            isDark ? 'text-white/45' : 'text-subtle'
          }`}
          aria-hidden="true"
        />
      </div>
      {customMode && (
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setCustomMode(false)}
          autoComplete="off"
          aria-label="Enter food category"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
          required
          placeholder="Enter your category"
          className={`${controlClass} mt-2 px-3.5 placeholder:text-subtle ${isDark ? 'register-input' : ''}`}
        />
      )}
      {error
        ? <p id={`${inputId}-error`} className="mt-1.5 text-xs font-medium text-danger">{error}</p>
        : <p id={`${inputId}-hint`} className={`mt-1.5 text-xs ${isDark ? 'text-white/45' : 'text-muted'}`}>Choose a saved category or enter your own.</p>}
    </div>
  );
}
