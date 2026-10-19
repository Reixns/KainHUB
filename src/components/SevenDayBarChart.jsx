import { formatPeso } from '@/components/UI';

/*
  One bar chart for the three "last 7 days" panels (admin dashboard, admin
  analytics, vendor analytics). They were three near-identical copies of the
  same markup, and all three shared the same mobile bug: seven `flex-1` columns
  each carry a peso label that cannot shrink below its own text width, so at
  375px the row needed more width than the card had and the right-hand days were
  clipped by `body { overflow-x: hidden }` instead of scrolling.

  The chart now lives in a horizontal scroll container with a minimum inner
  width, so on a phone the columns keep a readable size and the row scrolls,
  while on a wider card `flex-1` lets the columns share the full width.
*/
export default function SevenDayBarChart({
  days,
  valueKey = 'revenue',
  countKey = 'count',
  barClassName = 'bg-cat-blue-deep',
  heightClass = 'h-48',
  minBarHeight = 12,
  emptyBarHeight = 3,
  countSuffix = 'orders',
  formatValue = formatPeso,
  valueClassName = 'text-xs text-muted font-medium',
}) {
  const max = Math.max(1, ...days.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className={`flex ${heightClass} min-w-[26rem] items-end gap-2`}>
        {days.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className={valueClassName}>{formatValue(d[valueKey])}</div>
            <div
              className={`w-full ${barClassName} rounded-t-md`}
              style={{
                height: `${((Number(d[valueKey]) || 0) / max) * 100}%`,
                minHeight: d[valueKey] > 0 ? `${minBarHeight}px` : `${emptyBarHeight}px`,
              }}
            ></div>
            <div className="text-xs text-muted">{d.label}</div>
            <div className="text-xs font-medium text-body">
              {countSuffix ? `${d[countKey]} ${countSuffix}` : d[countKey]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
