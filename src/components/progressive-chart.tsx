import { JSX, Suspense, Show } from 'solid-js';
import { createViewportLoader, ChartPlaceholder, ChartErrorBoundary } from '../lib/progressive-loading';

interface ProgressiveChartProps<T> {
  title: string;
  height?: string;
  loadData: () => Promise<T>;
  children: (data: T) => JSX.Element;
  fallback?: JSX.Element;
}

/**
 * Progressive chart component that loads data when it enters the viewport
 */
export function ProgressiveChart<T>(props: ProgressiveChartProps<T>): JSX.Element {
  const { data, loading, error, setElement } = createViewportLoader(props.loadData);
  
  return (
    <div ref={setElement}>
      <Show
        when={!error()}
        fallback={
          <ChartErrorBoundary 
            error={error()!} 
            title={props.title}
            onRetry={() => window.location.reload()}
          />
        }
      >
        <Show
          when={data()}
          fallback={
            <Show
              when={loading()}
              fallback={<ChartPlaceholder title={props.title} height={props.height} />}
            >
              {props.fallback || <ChartPlaceholder title={props.title} height={props.height} />}
            </Show>
          }
        >
          <Suspense fallback={props.fallback || <ChartPlaceholder title={props.title} height={props.height} />}>
            {props.children(data()!)}
          </Suspense>
        </Show>
      </Show>
    </div>
  );
}

/**
 * Simple progressive wrapper without custom data loading
 * Just uses Suspense for code-splitting the chart component
 */
export function ProgressiveWrapper(props: {
  title: string;
  height?: string;
  children: JSX.Element;
  fallback?: JSX.Element;
}): JSX.Element {
  const { setElement } = createViewportLoader(
    () => Promise.resolve(true),
    { threshold: 0.1 }
  );
  
  return (
    <div ref={setElement}>
      <Suspense fallback={props.fallback || <ChartPlaceholder title={props.title} height={props.height} />}>
        {props.children}
      </Suspense>
    </div>
  );
}
