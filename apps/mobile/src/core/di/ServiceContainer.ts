/**
 * Мінімальний DI-контейнер (аналог builder.Services у MauiProgram.cs, лаб. 3).
 *
 * - Singleton — один екземпляр на весь застосунок (сервіси стану, БД, логер).
 * - Transient — новий екземпляр на кожен запит (ViewModel'і сторінок).
 */
type Factory<T> = (c: ServiceContainer) => T;

interface Registration<T> {
  lifetime: 'singleton' | 'transient';
  factory: Factory<T>;
  instance?: T;
}

/** Типізований ключ сервісу (аналог інтерфейсу IFooService як ключа реєстрації). */
export class ServiceKey<T> {
  /** Фантомне поле — лише для виведення типу T, у рантаймі не використовується. */
  readonly _type?: T;
  constructor(readonly name: string) {}
}

export class ServiceContainer {
  private readonly registrations = new Map<ServiceKey<unknown>, Registration<unknown>>();

  addSingleton<T>(key: ServiceKey<T>, factory: Factory<T>): this {
    this.registrations.set(key, { lifetime: 'singleton', factory });
    return this;
  }

  addTransient<T>(key: ServiceKey<T>, factory: Factory<T>): this {
    this.registrations.set(key, { lifetime: 'transient', factory });
    return this;
  }

  get<T>(key: ServiceKey<T>): T {
    const reg = this.registrations.get(key) as Registration<T> | undefined;
    if (!reg) throw new Error(`Service "${key.name}" is not registered`);
    if (reg.lifetime === 'transient') return reg.factory(this);
    if (reg.instance === undefined) reg.instance = reg.factory(this);
    return reg.instance;
  }
}
