---
title: "Композиция: как перестать плодить пропсы"
---

# Композиция: как перестать плодить пропсы

Есть один узнаваемый файл. Он называется `Modal.tsx`, или `Table.tsx`, или `Card.tsx`, ему полтора года, и у него семнадцать пропсов. `title`, `subtitle`, `showCloseButton`, `closeButtonLabel`, `showFooter`, `footerAlign`, `primaryActionText`, `primaryActionDisabled`, `onPrimaryAction`, `secondaryActionText`, `hideOverlay`, `size`, `variant`, `withScroll`, `headerIcon`, `renderCustomHeader`, `className`.

Половина из них используется в одном месте из десяти. Внутри компонента живёт лес из тернарных операторов. Каждая новая задача добавляет ещё один проп, потому что «ну это же одна строчка». И каждый раз становится чуть страшнее туда заходить.

Это статья про то, как из такого выбираться и, главное, как в такое не попадать. Разбираем композицию: почему передавать разметку выгоднее, чем передавать флаги, и где у этого приёма граница.

**Композиция** здесь означает простую вещь: вместо того чтобы описывать компоненту словами, что нарисовать, ты отдаёшь ему готовый кусок разметки. Компонент решает **куда** его поставить, вызывающий решает **что** это будет.

## Часть 1. Почему пропсы разрастаются

### Добавить проп кажется дешёвым

И в моменте это правда. Задача: в одном модальном окне нужна иконка в шапке. Что быстрее — переделать интерфейс компонента или добавить `headerIcon`? Конечно, второе: десять минут, ноль риска для остальных двадцати мест использования.

Долг накапливается не из-за одного пропа, а из-за того, что этот выбор делается каждый раз. Через год у компонента семнадцать входов, и их взаимодействие никто не держит в голове.

### Чем именно платим

**Комбинаторный взрыв.** Семнадцать пропсов, из которых десять булевых, — это тысяча вариантов поведения. Проверить их невозможно, значит часть комбинаций просто сломана, и никто не знает какие.

**Компонент знает про все случаи использования.** Он перестаёт быть кубиком и становится реестром: чтобы понять, что он умеет, надо прочитать его целиком. Изменение ради одного экрана рискует задеть остальные.

**Прокидывание насквозь.** Проп нужен не самому компоненту, а его внуку. Появляются `inputProps`, `contentProps`, `overlayProps` — сумки, которые компонент передаёт дальше, ничего про них не зная.

**Пропы не композируются.** Два соседних требования «показать иконку слева» и «показать бейдж справа» — это два независимых пропа, и вместе они дают третий случай, который надо предусмотреть отдельно.

### Признаки, что пора менять подход

- Больше трёх булевых пропсов, управляющих видимостью частей.
- Пропы, которые имеют смысл только вместе с другими (`showFooter` и `footerAlign`).
- Пропы вида `renderXxx` вперемешку с `xxxText`.
- Приходится добавлять проп, чтобы «спрятать то, что уже есть».

Последний признак самый показательный: если ты добавляешь `hideOverlay`, значит оверлей был зашит внутрь, хотя это решение вызывающего.

## Часть 2. `children` как слот

Самая простая форма композиции, и она же самая недоиспользуемая.

```jsx
// Было: содержимое описывается пропсами
function Card({ title, text, imageUrl, showBadge, badgeText, footerText }) {
  return (
    <div className="card">
      {imageUrl && <img src={imageUrl} alt="" />}
      <h3>{title}</h3>
      {showBadge && <span className="badge">{badgeText}</span>}
      <p>{text}</p>
      {footerText && <div className="card__footer">{footerText}</div>}
    </div>
  );
}

// Использование: а если в футере нужны две кнопки, а не текст?
<Card title="Заказ" text="Оплачен" showBadge badgeText="new" footerText="вчера" />
```

Вопрос «а если в футере нужны две кнопки» и есть момент, когда добавляется восемнадцатый проп. Вариант с передачей поддерева этот вопрос снимает целиком.

```jsx
// Стало: компонент отвечает за каркас, содержимое приходит снаружи
function Card({ children, footer }) {
  return (
    <div className="card">
      <div className="card__body">{children}</div>
      {footer && <div className="card__footer">{footer}</div>}
    </div>
  );
}

<Card footer={<><Button>Оплатить</Button><Button variant="ghost">Отмена</Button></>}>
  <h3>Заказ</h3>
  <Badge>new</Badge>
  <p>Оплачен</p>
</Card>
```

Пропов стало два вместо шести, а возможностей — бесконечно больше. `footer` — это тоже слот, просто именованный: `children` даёт один слот, пропсы-элементы дают сколько нужно.

Важная деталь: **элемент в пропсе — это не вызванный компонент.** Запись `footer={<Footer />}` создаёт объект-описание, а не рендерит его. Рендер произойдёт там, где `Card` подставит его в разметку. Это обычное значение, его можно передавать, сохранять в переменную и условно подменять.

### Почему поддерево лучше, чем флаг

Сравни два интерфейса:

```jsx
<Panel showHeader headerTitle="Отчёт" headerIcon={<ChartIcon />} />

<Panel header={<PanelHeader icon={<ChartIcon />}>Отчёт</PanelHeader>} />
```

Первый требует, чтобы `Panel` знала про заголовки, иконки и их взаимное расположение. Каждое новое требование к шапке — новый проп у `Panel`.

Второй — не требует ничего. `Panel` знает только, что у неё есть место наверху. Что там окажется, её не касается. Требования к шапке меняются в `PanelHeader` и вообще без участия `Panel`.

Это и есть **инверсия управления** (inversion of control): решение о содержимом принимает не компонент, а тот, кто его вызывает.

<figure class="diagram">
<svg viewBox="0 0 780 300" role="img" aria-label="Слева компонент с флагами внутри которого условная логика, справа компонент-каркас с слотами, содержимое которых задаёт вызывающий">
  <style>
    .cp-box { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); stroke-width: 1.5; }
    .cp-slot { fill: none; stroke: var(--vp-c-brand-1); stroke-width: 2; stroke-dasharray: 5 3; }
    .cp-t { fill: var(--vp-c-text-1); font: 700 13px/1 ui-sans-serif, system-ui, sans-serif; }
    .cp-s { fill: var(--vp-c-text-2); font: 400 11px/1 ui-sans-serif, system-ui, sans-serif; }
    .cp-m { fill: var(--vp-c-text-1); font: 600 11px/1 ui-monospace, SFMono-Regular, monospace; }
    .cp-a { stroke: var(--vp-c-text-3); stroke-width: 1.5; fill: none; }
  </style>
  <defs>
    <marker id="cp-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0 1 L7 4 L0 7" fill="none" stroke="var(--vp-c-text-3)" stroke-width="1.5"/>
    </marker>
  </defs>

  <text class="cp-t" x="14" y="20">Пропсы: решение внутри</text>

  <rect class="cp-box" x="14" y="34" width="150" height="88" rx="2"/>
  <text class="cp-s" x="26" y="54">вызывающий</text>
  <text class="cp-m" x="26" y="74">showHeader</text>
  <text class="cp-m" x="26" y="90">headerTitle</text>
  <text class="cp-m" x="26" y="106">headerIcon</text>

  <path class="cp-a" d="M168 78 H206" marker-end="url(#cp-head)"/>

  <rect class="cp-box" x="210" y="34" width="150" height="200" rx="2"/>
  <text class="cp-t" x="285" y="56" text-anchor="middle">Panel</text>
  <text class="cp-s" x="285" y="76" text-anchor="middle">знает про шапку,</text>
  <text class="cp-s" x="285" y="92" text-anchor="middle">иконку, заголовок</text>
  <rect class="cp-box" x="226" y="106" width="118" height="30" rx="2"/>
  <text class="cp-m" x="285" y="125" text-anchor="middle">if showHeader</text>
  <rect class="cp-box" x="226" y="142" width="118" height="30" rx="2"/>
  <text class="cp-m" x="285" y="161" text-anchor="middle">if headerIcon</text>
  <rect class="cp-box" x="226" y="178" width="118" height="30" rx="2"/>
  <text class="cp-m" x="285" y="197" text-anchor="middle">if ...</text>
  <text class="cp-s" x="285" y="226" text-anchor="middle">каждое требование сюда</text>

  <text class="cp-t" x="420" y="20">Композиция: решение снаружи</text>

  <rect class="cp-box" x="420" y="34" width="170" height="122" rx="2"/>
  <text class="cp-s" x="432" y="54">вызывающий</text>
  <rect class="cp-box" x="432" y="66" width="146" height="34" rx="2"/>
  <text class="cp-m" x="505" y="87" text-anchor="middle">PanelHeader</text>
  <rect class="cp-box" x="432" y="108" width="146" height="34" rx="2"/>
  <text class="cp-m" x="505" y="129" text-anchor="middle">любая разметка</text>

  <path class="cp-a" d="M594 96 H636" marker-end="url(#cp-head)"/>

  <rect class="cp-box" x="640" y="34" width="126" height="200" rx="2"/>
  <text class="cp-t" x="703" y="56" text-anchor="middle">Panel</text>
  <text class="cp-s" x="703" y="76" text-anchor="middle">знает только</text>
  <text class="cp-s" x="703" y="92" text-anchor="middle">про места</text>
  <rect class="cp-slot" x="654" y="106" width="98" height="44" rx="2"/>
  <text class="cp-m" x="703" y="133" text-anchor="middle">header</text>
  <rect class="cp-slot" x="654" y="158" width="98" height="60" rx="2"/>
  <text class="cp-m" x="703" y="193" text-anchor="middle">children</text>

  <text class="cp-s" x="420" y="266">Слева новое требование меняет Panel. Справа — не меняет:</text>
  <text class="cp-s" x="420" y="284">Panel не знает, что лежит в слотах, и ей это не нужно.</text>
</svg>
<figcaption>Флаги заставляют компонент знать про все случаи. Слоты оставляют ему только каркас.</figcaption>
</figure>

## Часть 3. Составные компоненты

Слоты хорошо работают, пока частей две-три. Когда частей больше и между ними есть общее состояние, приходят **составные компоненты** (compound components) — набор компонентов, которые по отдельности бессмысленны, а вместе образуют один виджет. Как `select` и `option` в HTML.

Возьмём вкладки.

```jsx
// Было: конфигурация массивом
function Tabs({ tabs, activeId, onChange, align, showIcons, renderTab }) {
  return (
    <div>
      <div className={`tabs tabs--${align}`}>
        {tabs.map((t) =>
          renderTab ? renderTab(t) : (
            <button
              key={t.id}
              className={t.id === activeId ? 'active' : ''}
              onClick={() => onChange(t.id)}
              disabled={t.disabled}
            >
              {showIcons && t.icon}
              {t.label}
              {t.badge != null && <span className="badge">{t.badge}</span>}
            </button>
          )
        )}
      </div>
      <div className="tabs__panel">
        {tabs.find((t) => t.id === activeId)?.content}
      </div>
    </div>
  );
}

<Tabs
  activeId={active}
  onChange={setActive}
  align="left"
  showIcons
  tabs={[
    { id: 'info', label: 'Инфо', icon: <InfoIcon />, content: <Info /> },
    { id: 'logs', label: 'Логи', badge: 12, content: <Logs /> },
  ]}
/>
```

Что здесь плохо: содержимое всех вкладок описывается в массиве, а значит создаётся всегда — даже для неактивных. Любое новое оформление вкладки — новый ключ объекта и новая ветка внутри. Разделитель между второй и третьей вкладкой вставить некуда. И `renderTab` уже появился как признание, что интерфейс не справляется.

```jsx
// Стало: части виджета — отдельные компоненты, связанные общим состоянием
const TabsContext = createContext(null);

function Tabs({ defaultValue, children }) {
  const [value, setValue] = useState(defaultValue);
  const ctx = useMemo(() => ({ value, setValue }), [value]);
  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>;
}

function useTabs(component) {
  const ctx = useContext(TabsContext);
  // понятная ошибка вместо «cannot read property of null» где-то ниже
  if (!ctx) throw new Error(`${component} должен быть внутри Tabs`);
  return ctx;
}

function TabList({ children }) {
  return <div className="tabs" role="tablist">{children}</div>;
}

function Tab({ value, children, disabled }) {
  const ctx = useTabs('Tab');
  const selected = ctx.value === value;
  return (
    <button
      role="tab"
      aria-selected={selected}
      disabled={disabled}
      className={selected ? 'active' : ''}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  );
}

function TabPanel({ value, children }) {
  const ctx = useTabs('TabPanel');
  if (ctx.value !== value) return null;      // неактивное не создаётся вовсе
  return <div role="tabpanel">{children}</div>;
}

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = TabPanel;
```

Использование:

```jsx
<Tabs defaultValue="info">
  <Tabs.List>
    <Tabs.Tab value="info"><InfoIcon /> Инфо</Tabs.Tab>
    <Tabs.Tab value="logs">Логи <Badge>12</Badge></Tabs.Tab>
    <span className="tabs__spacer" />
    <Tabs.Tab value="raw" disabled>Сырые данные</Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel value="info"><Info /></Tabs.Panel>
  <Tabs.Panel value="logs"><Logs /></Tabs.Panel>
</Tabs>
```

Что дал этот переход:

**Разметка стала видимой.** Раньше структура пряталась внутри `Tabs`, теперь она прямо перед глазами и её можно менять, не заходя в исходники виджета.

**Оформление кнопки — забота вызывающего.** Иконка, бейдж, разделитель — просто дети. Ни одного нового пропа у `Tabs`.

**Ленивость.** `TabPanel` возвращает `null`, если вкладка неактивна, — содержимое неактивных вкладок не создаётся и не монтируется.

**Состояние осталось внутри.** Вызывающий не обязан держать `activeId` у себя, но может: добавь необязательные `value` и `onChange` — и компонент станет управляемым, как это сделано в форменных полях.

<figure class="diagram">
<svg viewBox="0 0 760 260" role="img" aria-label="Составные компоненты: Tabs держит состояние в контексте, TabList и Tab и TabPanel читают его на любой глубине вложенности">
  <style>
    .cc-box { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-divider); stroke-width: 1.5; }
    .cc-hot { fill: var(--vp-c-bg-soft); stroke: var(--vp-c-brand-1); stroke-width: 2; }
    .cc-t { fill: var(--vp-c-text-1); font: 700 12px/1 ui-sans-serif, system-ui, sans-serif; }
    .cc-s { fill: var(--vp-c-text-2); font: 400 11px/1 ui-sans-serif, system-ui, sans-serif; }
    .cc-a { stroke: var(--vp-c-text-3); stroke-width: 1.5; fill: none; }
    .cc-d { stroke: var(--vp-c-brand-1); stroke-width: 1.5; fill: none; stroke-dasharray: 4 3; }
  </style>
  <defs>
    <marker id="cc-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0 1 L7 4 L0 7" fill="none" stroke="var(--vp-c-text-3)" stroke-width="1.5"/>
    </marker>
    <marker id="cc-dot" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0 1 L7 4 L0 7" fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.5"/>
    </marker>
  </defs>

  <rect class="cc-hot" x="14" y="14" width="200" height="62" rx="2"/>
  <text class="cc-t" x="114" y="38" text-anchor="middle">Tabs</text>
  <text class="cc-s" x="114" y="58" text-anchor="middle">хранит value, отдаёт в контекст</text>

  <path class="cc-a" d="M114 76 V100 H300 V124" marker-end="url(#cc-head)"/>
  <path class="cc-a" d="M114 76 V100 H560 V124" marker-end="url(#cc-head)"/>

  <rect class="cc-box" x="220" y="128" width="160" height="46" rx="2"/>
  <text class="cc-t" x="300" y="147" text-anchor="middle">Tabs.List</text>
  <text class="cc-s" x="300" y="164" text-anchor="middle">только обёртка</text>

  <path class="cc-a" d="M300 174 V194" marker-end="url(#cc-head)"/>
  <rect class="cc-box" x="196" y="198" width="100" height="42" rx="2"/>
  <text class="cc-t" x="246" y="223" text-anchor="middle">Tabs.Tab</text>
  <rect class="cc-box" x="308" y="198" width="100" height="42" rx="2"/>
  <text class="cc-t" x="358" y="223" text-anchor="middle">Tabs.Tab</text>
  <path class="cc-a" d="M300 174 V186 H358 V194" marker-end="url(#cc-head)"/>

  <rect class="cc-box" x="480" y="128" width="160" height="46" rx="2"/>
  <text class="cc-t" x="560" y="147" text-anchor="middle">Tabs.Panel</text>
  <text class="cc-s" x="560" y="164" text-anchor="middle">null, если не активна</text>

  <path class="cc-d" d="M214 44 H700 V210 H414" marker-end="url(#cc-dot)"/>
  <path class="cc-d" d="M700 120 H660" marker-end="url(#cc-dot)"/>
  <text class="cc-s" x="700" y="34" text-anchor="middle">контекст</text>
</svg>
<figcaption>Связь между частями идёт через контекст, а не через пропсы. Поэтому между Tabs.List и Tabs.Tab можно вставить что угодно — связь не порвётся.</figcaption>
</figure>

### Почему именно контекст, а не пропсы

Ключевое свойство: **связь не зависит от глубины вложенности**. Пользователь обернёт вкладку в `div` для стилей, в `Tooltip`, в свой компонент — всё продолжит работать, потому что `Tab` берёт состояние из контекста, а не от прямого родителя.

Именно это отличает нормальный составной компонент от следующего антипаттерна.

## Часть 4. Компонент, который знает слишком много о детях

Есть соблазн реализовать вкладки иначе: пробежаться по детям и подмешать им пропсы.

```jsx
// Было: клонируем детей и вставляем им пропсы
function Tabs({ children, value, onChange }) {
  return (
    <div>
      {React.Children.map(children, (child, index) =>
        React.cloneElement(child, {
          active: index === value,
          onSelect: () => onChange(index),
        })
      )}
    </div>
  );
}
```

Работает. Пока не сломается — а сломается быстро:

**Обёртка ломает всё.** Пользователь завернул вкладку в `div` для отступа — `cloneElement` подмешает пропсы `div`, и React ругнётся на неизвестные атрибуты, а вкладка перестанет получать `active`.

**Условия ломают индексы.** Запись вида «показать эту вкладку только админу» даёт в списке детей `false` или `null`. `React.Children.map` их пропускает при обходе, но нумерация оставшихся сдвигается — привязка к `index` едет.

**Фрагмент прячет детей.** Дети внутри `<>...</>` для `React.Children` — один ребёнок, а не три.

**Типизация разваливается.** С точки зрения TypeScript вызывающий не передавал `active`, значит в типе пропсов дочернего компонента он должен быть необязательным. Компилятор перестаёт помогать.

**Неявный контракт.** По коду использования невозможно понять, откуда у вкладки взялся `active`. Это магия, а магию отлаживают дольше.

```jsx
// Стало: явная связь через контекст и явный value
<Tabs.Tab value="logs">Логи</Tabs.Tab>
```

Ребёнок сам объявляет, кто он (`value="logs"`), и сам берёт нужное из контекста. Никакой зависимости от порядка, вложенности и формы дерева.

Правило: **не инспектируй детей.** `React.Children` уместен в редких случаях — например, вставить разделитель между элементами, — но никогда как способ передать данные вниз. Для данных есть контекст.

## Часть 5. Кастомный хук вместо обёртки

Отдельный вид разрастания — компонент-обёртка, существующий только ради логики.

```jsx
// Было: HOC ради одной подписки
function withWindowSize(Component) {
  return function Wrapped(props) {
    const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => {
      const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, []);
    return <Component {...props} windowSize={size} />;
  };
}

export default withWindowSize(withTheme(withRouter(Dashboard)));
```

**HOC** (higher-order component, компонент высшего порядка) — функция, которая берёт компонент и возвращает новый, обёрнутый. Проблемы видны в последней строке: непонятно, откуда приходит каждый проп, дерево компонентов забито обёртками, типы теряются на каждом слое, а имена пропсов от двух HOC могут столкнуться.

```jsx
// Стало: логика в хуке, обёрток нет
function useWindowSize() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

function Dashboard() {
  const { w } = useWindowSize();
  const theme = useTheme();
  // видно, откуда что взялось
}
```

Хук — способ переиспользовать **логику** без вмешательства в дерево. Обёртка нужна там, где переиспользуется **разметка**.

Держи это разделение в голове: если ты пишешь компонент, который ничего не рисует, а только вычисляет и передаёт вниз, — это хук, оформленный неправильно.

## Часть 6. Рендер-пропы: живы ли

**Рендер-проп** — приём, где компонент вместо разметки принимает функцию, которая эту разметку вернёт, и вызывает её со своими данными.

```jsx
// Компонент отвечает за логику, вызывающий — за вид
<MouseTracker render={({ x, y }) => <Cursor x={x} y={y} />} />

// Тот же приём, но функция передана через children
<MouseTracker>{({ x, y }) => <Cursor x={x} y={y} />}</MouseTracker>
```

Для чистой логики хуки победили: `const { x, y } = useMouse()` короче, не создаёт уровень вложенности и не порождает «лестницу» из вложенных рендер-пропов.

Но приём не умер. Он остаётся лучшим выбором там, где компонент **владеет чем-то, чего у вызывающего нет**, и должен отдать это в момент рендера конкретного элемента:

```jsx
// Виртуализированный список: только он знает, какие элементы видимы
// и какие им нужны координаты
<VirtualList items={rows} itemHeight={48}>
  {(row, style) => (
    <div style={style} key={row.id}>{row.title}</div>
  )}
</VirtualList>
```

Хуком это не выразить: хук не может подставить разметку в нужное место дерева со своим `style`. То же — у таблиц (`renderCell`), у drag-and-drop, у компонентов с измерением размеров контейнера. Про виртуализацию подробно — в статье [бесконечный список](./infinite-list-and-virtualization).

Практический ориентир: **логика без разметки — хук; разметка, зависящая от внутренних данных компонента, — рендер-проп или дети-функция.**

## Часть 7. Полиморфный компонент с пропом `as`

Кнопка, которая иногда должна быть ссылкой. Заголовок, у которого уровень зависит от контекста. Классическая история.

```jsx
// Было: булев проп плюс дублирование
function Button({ isLink, href, children, ...rest }) {
  if (isLink) return <a href={href} className="btn" {...rest}>{children}</a>;
  return <button className="btn" {...rest}>{children}</button>;
}
```

Проблемы: для третьего варианта (`Link` из роутера) нужен третий флаг; `href` бессмыслен, когда `isLink` не задан, но тип этого не запрещает; события у ссылки и кнопки разные, а тип пропсов один.

```jsx
// Стало: тег или компонент приходит снаружи
function Button({ as: Component = 'button', className, ...rest }) {
  return <Component className={cx('btn', className)} {...rest} />;
}

<Button>Обычная</Button>
<Button as="a" href="/orders">Ссылка</Button>
<Button as={Link} to="/orders">Ссылка роутера</Button>
```

Ключевая деталь: переменная должна начинаться с большой буквы. React считает элемент с маленькой буквы именем HTML-тега, а с большой — компонентом. Поэтому в деструктуризации пишут `as: Component`.

### Типизация

Хочется, чтобы TypeScript разрешал `href` только при `as="a"` и подсказывал события нужного элемента. Делается дженериком по типу элемента:

```ts
import type { ElementType, ComponentPropsWithoutRef } from 'react';

type ButtonProps<T extends ElementType> = {
  as?: T;
  variant?: 'primary' | 'ghost';
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'variant'>;

function Button<T extends ElementType = 'button'>({
  as,
  variant = 'primary',
  ...rest
}: ButtonProps<T>) {
  const Component = as ?? 'button';
  return <Component className={`btn btn--${variant}`} {...rest} />;
}
```

Разбор по частям: `T` — тип того, чем будет компонент. `ComponentPropsWithoutRef<T>` даёт все пропсы этого элемента, включая обработчики событий с правильными типами. `Omit` убирает пересечения с собственными пропсами, иначе `variant` конфликтует. Значение по умолчанию у `T` делает `as` необязательным.

Честное предупреждение: полностью корректная полиморфная типизация с пробросом `ref` — это заметный кусок сложного типового кода, который тяжело читать. Если полиморфных компонентов у тебя два, проще написать два компонента: `Button` и `ButtonLink`.

## Часть 8. Контейнер и представление: что осталось живого

Паттерн из эпохи классовых компонентов: «умный» контейнер получает данные и передаёт «глупому» представлению, которое только рисует. С приходом хуков делить компоненты **механически** перестало иметь смысл: хук и так отделяет логику, а лишний уровень только добавляет файлов.

Что осталось полезного:

**Компонент, который умеет только рисовать, легко тестировать и показывать в Storybook.** Дай ему данные пропсами — увидишь все состояния без моков сети.

**Граница «где происходит загрузка» полезна.** Хорошая практика — грузить данные на уровне маршрута или крупного блока, а вниз передавать готовое. Тогда понятно, где смотреть водопады запросов. Про них — в статье [работа с данными](./data-fetching-patterns).

Что умерло: обязательное деление каждого компонента надвое и папки `containers/` рядом с `components/`.

```jsx
// Разумная граница: страница знает про данные, карточка — нет
function OrderPage({ id }) {
  const { data, isPending } = useOrder(id);
  if (isPending) return <Skeleton />;
  return <OrderCard order={data} onPay={() => pay(id)} />;
}

// OrderCard чистая: одни пропсы на входе, разметка на выходе
```

## Часть 9. Побочный эффект композиции: меньше перерисовок

У передачи поддерева есть неожиданный бонус. Элемент, созданный в родителе и переданный вниз пропсом, **не пересоздаётся** при рендере того, кто его получает.

```jsx
// Было: тяжёлое поддерево внутри компонента с частым состоянием
function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={collapsed ? 'collapsed' : ''}>
      <button onClick={() => setCollapsed((v) => !v)}>Свернуть</button>
      <ExpensiveDashboard />     {/* перерисовывается на каждый клик */}
    </div>
  );
}
```

Каждое переключение перерисовывает `ExpensiveDashboard`, хотя от `collapsed` он не зависит. Обычная реакция — обернуть его в `memo`. Но есть решение без мемоизации:

```jsx
// Стало: состояние и тяжёлое поддерево живут на разных уровнях
function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={collapsed ? 'collapsed' : ''}>
      <button onClick={() => setCollapsed((v) => !v)}>Свернуть</button>
      {children}
    </div>
  );
}

function Page() {
  // элемент создан здесь, Page не перерисовывается при клике,
  // значит children остаётся тем же объектом
  return (
    <Layout>
      <ExpensiveDashboard />
    </Layout>
  );
}
```

Механика: React перерисовывает поддерево, когда элемент изменился. `children` пришёл сверху как готовый объект и при рендере `Layout` не создаётся заново — значит React сравнит его с предыдущим, увидит тот же самый элемент и пропустит обход этой ветки.

Приём стоит ноль строк накладных расходов и работает без `memo`, `useMemo` и списков зависимостей. Подробнее и с другими примерами — в статье [производительность интерфейса](./rendering-performance-patterns), а про то, как это соотносится с размещением состояния, — в статье [где должно жить состояние](./state-management-patterns).

## Когда не надо

Композиция — не бесплатная добродетель. Список случаев, где проп проще и правильнее.

**Когда вариантов ровно два и они фиксированы.** `size="s" | "m"` — это проп. Разворачивать его в слоты незачем: вызывающему не нужна свобода, ему нужен выбор из двух.

**Когда компонент должен выглядеть одинаково везде.** Дизайн-система на то и система: если `Alert` в каждом продукте свой, смысл теряется. Ограничение через пропсы — это фича, а не недостаток. Слоты дают свободу, а свобода — это расхождения.

**Когда составной компонент собирается из пяти частей ради одной кнопки.** Пять строк разметки на каждом использовании вместо одной — реальная цена. Составной компонент окупается на виджетах, которые действительно настраивают по-разному.

**Когда данные приходят массивом и рисуются единообразно.** Список из тысячи строк, все одинаковые, — конфигурация массивом уместнее, чем тысяча дочерних элементов. Меньше объектов, меньше работы для сверки дерева.

**Когда есть строгий контракт доступности.** Составной компонент легко собрать неправильно: `Tabs.Panel` без соответствующего `Tabs.Tab`, шапка модального окна без связи с `aria-labelledby`. Пропсы не дают ошибиться, потому что структуру собирает сам компонент. Если решаешь в пользу слотов — валидируй сборку хотя бы в режиме разработки.

**Когда переданный элемент нужно менять внутри.** Если тебе понадобилось клонировать слот и подмешивать ему пропсы, композиция выбрана не та: возвращайся к контексту или к явному компоненту-части.

Общее правило: **композиция стоит гибкости, пропсы стоят предсказуемости.** Виджет, который используют по-разному, — композиция. Элемент дизайн-системы, который обязан выглядеть одинаково, — пропсы.

## Что спросят на интервью

**Как бы вы отрефакторили компонент с семнадцатью пропсами?** Разделить пропсы на «данные», «оформление» и «структура». Структуру вынести в слоты (`children` и именованные пропсы-элементы), оформление свести к перечислимым вариантам, данные оставить. Флаги видимости — первые кандидаты на удаление.

**Что такое составные компоненты и как они связаны?** Набор компонентов одного виджета, общающихся через контекст. Контекст, а не пропсы, потому что связь не должна зависеть от глубины вложенности: между частями можно вставить любую обёртку.

**Чем плох `React.cloneElement` для передачи пропсов детям?** Ломается на обёртках, фрагментах и условном рендере, портит типизацию, создаёт неявный контракт. Замена — контекст плюс явный проп-идентификатор у ребёнка.

**Рендер-пропы устарели?** Для переиспользования логики — да, их заменили хуки. Остались там, где компонент владеет данными, нужными в момент рендера конкретного элемента: виртуализация, ячейки таблиц, измерение контейнера.

**Чем HOC хуже хука?** Лишний уровень в дереве, неявный источник пропсов, конфликты имён, потеря типов. Хук переиспользует логику без вмешательства в дерево. HOC остались уместны для сквозной обвязки вроде границ ошибок.

**Как типизировать проп `as`?** Дженерик по `ElementType`, пропсы элемента через `ComponentPropsWithoutRef<T>`, пересечения убираются `Omit`. Проброс `ref` заметно усложняет тип, и часто дешевле два отдельных компонента.

**Почему передавать поддерево лучше, чем булев флаг?** Флаг требует, чтобы компонент знал про содержимое, и каждое новое требование — новый проп. Слот не требует ничего: компонент знает только место.

**Когда композиция избыточна?** Фиксированный набор вариантов, требование единообразия, однотипные списки, строгая доступность. Свобода вызывающего — это не всегда благо.

## Коротко, для повторения

1. Семнадцать пропсов — симптом того, что компонент знает про все случаи использования. Лечится передачей разметки вместо флагов.
2. `children` и пропсы-элементы — слоты. Элемент в пропсе не отрендерен, это обычное значение.
3. Инверсия управления: не `showHeader`, а `header={...}`. Решение принимает вызывающий.
4. Составные компоненты связаны контекстом, поэтому переживают любую вложенность и обёртки.
5. `React.Children.map` плюс `cloneElement` — хрупко: ломается на обёртках, фрагментах и условиях.
6. Логика без разметки — кастомный хук. HOC оставляют лишний уровень и прячут источник пропсов.
7. Рендер-пропы живы там, где компонент отдаёт данные в момент рендера элемента: виртуализация, ячейки, измерения.
8. Полиморфный `as` избавляет от флагов вида `isLink`; переменная обязана быть с большой буквы.
9. Контейнер и представление как обязательное деление умерло, но граница «где грузятся данные» полезна.
10. Композиция стоит гибкости, пропсы стоят предсказуемости. Дизайн-системе часто нужнее второе.
