/**
 * Простий логер у консоль (Metro / logcat / Xcode console).
 * Кожен сервіс отримує логер зі своєю категорією — аналог ILogger<T>.
 * (Повноцінне структуроване логування з файловим sink'ом — у лаб. 5.)
 */
export interface ILogger {
  debug(msg: string, props?: Record<string, unknown>): void;
  info(msg: string, props?: Record<string, unknown>): void;
  warn(msg: string, props?: Record<string, unknown>): void;
  error(error: unknown, msg: string, props?: Record<string, unknown>): void;
}

export class LoggerFactory {
  createLogger(category: string): ILogger {
    const line = (level: string, msg: string, props?: Record<string, unknown>) =>
      `${new Date().toISOString().slice(11, 23)} [${level}] ${category}: ${msg}${props ? ' ' + JSON.stringify(props) : ''}`;
    return {
      debug: (m, p) => __DEV__ && console.log(line('DBG', m, p)),
      info: (m, p) => console.log(line('INF', m, p)),
      warn: (m, p) => console.warn(line('WRN', m, p)),
      error: (e, m, p) => console.error(line('ERR', m, p), e),
    };
  }

  async flush(): Promise<void> {}
}
