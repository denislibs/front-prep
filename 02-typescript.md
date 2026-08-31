# TypeScript: вопросы уровня сеньора

## Базовое, что должно отскакивать от зубов

**`interface` vs `type`**: почти взаимозаменяемы. interface — declaration merging (можно дополнять), только объектные формы, чуть лучше в ошибках/производительности компилятора. type — union, intersection, mapped/conditional types, примитивы, кортежи. Практика: interface для публичных API и объектов, type для всего остального. Главное — консистентность в команде.

**`unknown` vs `any`**: `any` отключает проверку типов (заражает всё вокруг), `unknown` — «тип неизвестен, сначала сузь» (безопасная альтернатива). Внешние данные (API, JSON.parse) типизировать как `unknown` + валидация (zod) или type guard.

**`never`** — тип «недостижимо»: функция, которая всегда throw; пустой union. Практика — exhaustive check в switch:
```ts
switch (shape.kind) {
  case 'circle': ...
  case 'square': ...
  default: const _exhaustive: never = shape; // ошибка компиляции, если добавили новый kind
}
```

## Сужение типов (narrowing)

- `typeof`, `instanceof`, `in`, проверка на литералы.
- **Discriminated union** — главный паттерн типобезопасного стейта:
```ts
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: User[] }
  | { status: 'error'; error: string };
// невозможно прочитать data, не проверив status === 'success'
```
- Пользовательский type guard: `function isUser(x: unknown): x is User { ... }`
- `satisfies` — проверить соответствие типу, не расширяя и не теряя вывод: `const config = {...} satisfies Config`.

## Дженерики

Уметь написать типизированную обёртку:
```ts
function groupBy<T, K extends PropertyKey>(items: T[], key: (item: T) => K): Record<K, T[]> { ... }
```
`extends` — ограничение; вывод типов из аргументов; дефолты `<T = string>`. Частый вопрос — типизировать функцию `pick`:
```ts
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> { ... }
```

## Utility types — знать и уметь написать руками

`Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`, `ReturnType`, `Parameters`, `Awaited`, `NonNullable`, `Exclude`, `Extract`.

Как они устроены (mapped + conditional):
```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyPick<T, K extends keyof T> = { [K2 in K]: T[K2] };
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```
`infer` — «вытащить» тип из позиции в conditional type. Conditional types дистрибутивны по union: `Exclude<'a'|'b', 'a'>` разбирается по элементам.

Template literal types: `` type Route = `/users/${string}` ``.

## Структурная типизация

TS сравнивает по форме, а не по имени (duck typing). Следствия: два одинаковых по форме типа совместимы; для номинальности используют branded types: `type UserId = string & { __brand: 'UserId' }`.

**Вариантность**: массивы и свойства — ковариантны (и это дыра: `Dog[]` присваивается `Animal[]`); параметры функций — контравариантны при `strictFunctionTypes`.

## Конфиг и строгость

`strict: true` обязателен (включает `strictNullChecks`, `noImplicitAny` и др.). Полезно: `noUncheckedIndexedAccess` (`arr[i]` → `T | undefined`), `exactOptionalPropertyTypes`. `enum` vs union литералов: сейчас чаще `as const` объект + union — без рантайм-кода, лучше tree-shaking:
```ts
const Status = { Active: 'active', Blocked: 'blocked' } as const;
type Status = typeof Status[keyof typeof Status];
```

## TS + React

- Типизация компонента: просто типизируй props, `React.FC` не обязателен (раньше навязывал children).
- `useState<User | null>(null)`; события: `React.ChangeEvent<HTMLInputElement>`.
- `useRef<HTMLDivElement>(null)` для DOM, `useRef<number | undefined>(undefined)` для мутабельного значения.
- Дженерик-компоненты (типизированный `<Select<T> items={...} />`).
- Пропсы-union для взаимоисключающих вариантов (кнопка-ссылка vs кнопка-действие) — тот же discriminated union.

## Чек-лист

- [ ] Написать `MyPick`/`MyPartial`/`MyReturnType` руками
- [ ] Объяснить discriminated union и exhaustive check
- [ ] `unknown` + zod для внешних данных
- [ ] `satisfies` — чем отличается от аннотации и `as`
- [ ] Почему `as` опасен (обходит проверку, но не приводит данные)
