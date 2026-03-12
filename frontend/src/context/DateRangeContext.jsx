import { createContext, useContext, useState } from 'react';

const DateRangeContext = createContext();

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function DateRangeProvider({ children }) {
  const [range, setRange] = useState({
    from: formatDate(daysAgo(28)),
    to: formatDate(daysAgo(1)),
    preset: '28d',
  });

  const setPreset = (preset) => {
    const days = { '7d': 7, '28d': 28, '90d': 90, '365d': 365 }[preset] || 28;
    setRange({
      from: formatDate(daysAgo(days)),
      to: formatDate(daysAgo(1)),
      preset,
    });
  };

  const setCustomRange = (from, to) => {
    setRange({ from, to, preset: 'custom' });
  };

  return (
    <DateRangeContext.Provider value={{ ...range, setPreset, setCustomRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  return useContext(DateRangeContext);
}
