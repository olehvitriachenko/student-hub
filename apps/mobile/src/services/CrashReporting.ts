import * as Sentry from '@sentry/react-native';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { LogLevel, formatEntry, type LogEntry, type LogSink } from '../core/logging/Logger';

/**
 * Автоматичний збір крашів та аналітика (лаб. 5) — Sentry
 * (App Center закрито у 2025 р., тому замість нього Sentry; Crashlytics теж підійде).
 *
 * Вмикається лише якщо задано EXPO_PUBLIC_SENTRY_DSN — без нього застосунок
 * працює як раніше, а звіти лише пишуться в локальний лог.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const crashReportingEnabled = !!DSN;

export function initCrashReporting(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    debug: false,
    environment: __DEV__ ? 'development' : 'production',
    // Приватність (контрольне питання 12): не відправляємо IP / cookies / тіла запитів.
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  });
}

/** Інформація про пристрій, що додається до ручного звіту про помилку. */
export function deviceInfo(): Record<string, string> {
  return {
    os: `${Platform.OS} ${Device.osVersion ?? Platform.Version}`,
    model: `${Device.manufacturer ?? ''} ${Device.modelName ?? 'unknown'}`.trim(),
    appVersion: `${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`,
    isDevice: String(Device.isDevice),
  };
}

/** Sink для логера: Warning+ → breadcrumbs, Error+ з винятком → окремий issue у Sentry. */
export class SentrySink implements LogSink {
  emit(e: LogEntry): void {
    if (!DSN) return;
    if (e.level >= LogLevel.Error && e.error) {
      const err = Object.assign(new Error(e.error.message), { name: e.error.name, stack: e.error.stack });
      Sentry.captureException(err, {
        level: e.level === LogLevel.Critical ? 'fatal' : 'error',
        tags: { category: e.ctx },
        extra: { message: e.msg, ...e.props },
      });
    } else if (e.level >= LogLevel.Information) {
      Sentry.addBreadcrumb({
        category: e.ctx,
        message: e.msg,
        level: e.level >= LogLevel.Warning ? 'warning' : 'info',
        data: e.props,
      });
    }
  }
}

/** Аналітика використання: події та екрани (аналог Analytics.TrackEvent). */
export class Analytics {
  constructor(private readonly onEvent: (name: string, props?: Record<string, string>) => void) {}

  trackEvent(name: string, props?: Record<string, string>): void {
    this.onEvent(name, props);
    if (DSN) Sentry.addBreadcrumb({ category: 'analytics', message: name, data: props });
  }

  trackScreen(route: string): void {
    this.trackEvent('ScreenView', { route });
  }
}

/** Ручний звіт "Повідомити про помилку": останні записи логу + інформація про пристрій. */
export async function sendUserReport(comment: string, recentLogs: LogEntry[]): Promise<string | null> {
  const info = deviceInfo();
  const logText = recentLogs.slice(0, 50).map(formatEntry).join('\n');
  if (!DSN) return null;
  const eventId = Sentry.captureMessage(`User report: ${comment || '(no comment)'}`, {
    level: 'info',
    tags: { kind: 'user-report' },
    extra: { device: info, recentLogs: logText },
  });
  return eventId;
}

/** Штучний краш для перевірки (лаб. 5, п. 5). */
export function nativeCrash(): void {
  if (DSN) Sentry.nativeCrash();
  else throw new Error('Sentry DSN не задано — нативний краш пропущено');
}
