import { useState } from 'react';
import { ChevronDown, Tag } from 'lucide-react';

const CUSTOM_CATEGORY_OPTION = '__enter_custom_category__';

export default function ProductCategoryField({ value, onChange, categories }) {
  const [customMode, setCustomMode] = useState(false);
  const categoryOptions = [...new Set([...categories, value].map((category) => category?.trim()).filter(Boolean))];
  const selection = customMode ? CUSTOM_CATEGORY_OPTION : value || '';

  const handleSelectionChange = (event) => {
    const nextValue = event.target.value;
    if (nextValue === CUSTOM_CATEGORY_OPTION) {
      onChange('');
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    onChange(nextValue);
  };

  const controlClass = 'w-full min-h-11 rounded-control border border-hairline-strong bg-white py-3 text-sm text-ink transition-colors duration-150 hover:border-hairline-hover focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-muted';

  return (
    <div className="w-full">
      <label htmlFor="product-category-select" className="mb-1.5 block text-sm font-medium text-body">
        Category
      </label>
      <div className="relative">
        <Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <select
          id="product-category-select"
          value={selection}
          onChange={handleSelectionChange}
          style={{ colorScheme: 'light' }}
          className={`${controlClass} appearance-none pl-11 pr-10`}
        >
          <option value="" disabled>Select a category</option>
          {categoryOptions.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
          <option value={CUSTOM_CATEGORY_OPTION}>Enter a new category...</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
      </div>
      {customMode && (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => setCustomMode(false)}
          autoComplete="off"
          aria-label="Enter product category"
          placeholder="Enter a category"
          className={`${controlClass} mt-2 px-3.5 placeholder:text-subtle`}
        />
      )}
      <p className="mt-1.5 text-xs text-muted">
        Choose a category already used on your menu or enter a new one.
      </p>
    </div>
  );
}
