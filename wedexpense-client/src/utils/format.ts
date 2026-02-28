export function formatINR(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN');
}

export function formatINRShort(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';
  if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr';
  if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
  if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
  return '₹' + num.toLocaleString('en-IN');
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateRange(startDate?: string, endDate?: string, fallback?: string): string {
  const start = startDate || fallback;
  if (!start) return '';
  const s = new Date(start);
  if (!endDate || endDate === start) {
    return s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const e = new Date(endDate);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${s.toLocaleDateString('en-IN', { month: 'short' })}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${e.getFullYear()}`;
}

export function budgetPercent(spent: string | number, budget: string | number): number {
  const s = typeof spent === 'string' ? parseFloat(spent) : spent;
  const b = typeof budget === 'string' ? parseFloat(budget) : budget;
  if (!b || isNaN(b) || b === 0) return 0;
  return Math.round((s / b) * 100);
}

export function budgetColor(percent: number): string {
  if (percent >= 90) return '#ef4444';
  if (percent >= 70) return '#f59e0b';
  return '#22c55e';
}
