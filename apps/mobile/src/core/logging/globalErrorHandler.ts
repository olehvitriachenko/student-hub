import type { ILogger, LoggerFactory } from './Logger';

/**
 * Глобальна обробка необроблених винятків (лаб. 5).
 *
 *  - ErrorUtils.setGlobalHandler      ≈ AppDomain.CurrentDomain.UnhandledException
 *  - Hermes promise rejection tracker ≈ TaskScheduler.UnobservedTaskException
 *
 * Обидва обробники пишуть Critical/Error у лог, примусово скидають файловий буфер
 * і передають помилку попередньому обробнику (RN LogBox / Sentry), щоб не зламати їх.
 */
declare const ErrorUtils: {
  getGlobalHandler(): (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler(handler: (error: unknown, isFatal?: boolean) => void): void;
};

interface HermesInternalType {
  enablePromiseRejectionTracker?(options: {
    allRejections: boolean;
    onUnhandled: (id: number, error: unknown) => void;
    onHandled?: (id: number) => void;
  }): void;
}

export function installGlobalErrorHandlers(factory: LoggerFactory): void {
  const log: ILogger = factory.createLogger('GlobalErrorHandler');

  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    log.critical(error, isFatal ? 'Unhandled fatal JS exception' : 'Unhandled JS exception', { isFatal: !!isFatal });
    void factory.flush().finally(() => previous(error, isFatal));
  });

  const hermes = (globalThis as { HermesInternal?: HermesInternalType }).HermesInternal;
  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (id, error) => {
      log.error(error, 'Unhandled promise rejection', { rejectionId: id });
      void factory.flush();
    },
    onHandled: (id) => log.debug('Promise rejection handled later', { rejectionId: id }),
  });
}

/** Моделювання необробленого винятку у фоновій задачі (лаб. 5, п. 4). */
export function simulateUnhandledRejection(): void {
  setTimeout(() => {
    void Promise.reject(new Error('Simulated failure in background task'));
  }, 100);
}

export function simulateUnhandledException(): void {
  setTimeout(() => {
    throw new Error('Simulated unhandled exception in timer callback');
  }, 100);
}
