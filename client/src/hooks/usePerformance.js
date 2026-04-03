import { useState, useEffect, useRef } from 'react';

export const usePerformanceMonitor = (label) => {
  const [metrics, setMetrics] = useState({
    loadTime: 0,
    renderTime: 0,
    isLoading: false
  });
  const startTimeRef = useRef();
  const renderStartRef = useRef();

  const startLoading = () => {
    startTimeRef.current = performance.now();
    renderStartRef.current = performance.now();
    setMetrics(prev => ({ ...prev, isLoading: true }));
  };

  const endLoading = (itemCount = 0) => {
    if (startTimeRef.current) {
      const loadTime = performance.now() - startTimeRef.current;
      const renderTime = performance.now() - renderStartRef.current;
      
      setMetrics({
        loadTime: Math.round(loadTime),
        renderTime: Math.round(renderTime),
        isLoading: false,
        itemCount
      });

      // Log performance metrics in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[${label}] Load Time: ${Math.round(loadTime)}ms, Render Time: ${Math.round(renderTime)}ms, Items: ${itemCount}`);
      }
    }
  };

  return { metrics, startLoading, endLoading };
};

export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const usePagination = (initialPage = 1, initialLimit = 20) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const pages = Math.ceil(total / limit);
  const hasMore = page < pages;
  const hasPrev = page > 1;

  const nextPage = () => setPage(prev => Math.min(prev + 1, pages));
  const prevPage = () => setPage(prev => Math.max(prev - 1, 1));
  const goToPage = (pageNum) => setPage(Math.max(1, Math.min(pageNum, pages)));
  const reset = () => setPage(1);

  return {
    page,
    limit,
    total,
    pages,
    hasMore,
    hasPrev,
    setPage,
    setLimit,
    setTotal,
    nextPage,
    prevPage,
    goToPage,
    reset
  };
};