import { createSignal, createEffect, onCleanup, JSX } from 'solid-js';

/**
 * Performance monitoring for progressive loading
 */
class ProgressiveLoadingMonitor {
  private loadTimes: Map<string, number> = new Map();
  private loadStartTimes: Map<string, number> = new Map();
  
  startLoad(id: string) {
    this.loadStartTimes.set(id, performance.now());
  }
  
  endLoad(id: string) {
    const startTime = this.loadStartTimes.get(id);
    if (startTime) {
      const loadTime = performance.now() - startTime;
      this.loadTimes.set(id, loadTime);
      console.log(`📊 Progressive load completed: ${id} in ${loadTime.toFixed(2)}ms`);
      this.loadStartTimes.delete(id);
    }
  }
  
  getStats() {
    const times = Array.from(this.loadTimes.values());
    return {
      totalLoads: times.length,
      averageTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      minTime: times.length > 0 ? Math.min(...times) : 0,
      maxTime: times.length > 0 ? Math.max(...times) : 0
    };
  }
}

const monitor = new ProgressiveLoadingMonitor();

/**
 * Progressive loading hook that triggers when element enters viewport
 */
export function createViewportLoader<T>(
  loadFn: () => Promise<T>,
  options: IntersectionObserverInit = { threshold: 0.1 },
  loadId?: string
) {
  const [data, setData] = createSignal<T | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);
  const [element, setElement] = createSignal<Element | null>(null);

  createEffect(() => {
    const el = element();
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !data() && !loading()) {
          setLoading(true);
          
          const id = loadId || `load-${Date.now()}`;
          monitor.startLoad(id);
          
          loadFn()
            .then((result) => {
              setData(() => result);
              monitor.endLoad(id);
            })
            .catch((err) => {
              setError(err);
              monitor.endLoad(id);
            })
            .finally(() => setLoading(false));
        }
      },
      options
    );

    observer.observe(el);

    onCleanup(() => {
      observer.disconnect();
    });
  });

  return {
    data,
    loading,
    error,
    setElement
  };
}

/**
 * Lightweight placeholder component
 */
export function ChartPlaceholder(props: { 
  title: string;
  height?: string;
  children?: JSX.Element;
}): JSX.Element {
  return (
    <div 
      class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
      style={{ height: props.height || '400px' }}
    >
      <div class="flex flex-col items-center justify-center h-full text-gray-500">
        <div class="animate-pulse mb-2">📊</div>
        <div class="text-sm font-medium">{props.title}</div>
        <div class="text-xs mt-1">Loading when visible...</div>
        {props.children}
      </div>
    </div>
  );
}

/**
 * Error boundary for chart loading
 */
export function ChartErrorBoundary(props: {
  error: Error;
  title: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div class="border-2 border-red-200 rounded-lg p-8 text-center bg-red-50">
      <div class="text-red-600 mb-2">⚠️</div>
      <div class="text-sm font-medium text-red-800">{props.title}</div>
      <div class="text-xs mt-1 text-red-600">{props.error.message}</div>
      {props.onRetry && (
        <button 
          onClick={props.onRetry}
          class="mt-3 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-800 rounded"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Export the performance monitor for global access
 */
export { monitor as progressiveLoadingMonitor };
