const DECK_CSS = [
  { id: 'css1',
    q: 'Расскажите про блочную модель и box-sizing. Что именно меняет border-box?',
    a: `<p>Бокс состоит из content, padding, border и margin. При <code>content-box</code> (значение по умолчанию) свойство <code>width</code> задаёт ширину только контента, а padding и border прибавляются сверху. При <code>border-box</code> <code>width</code> включает padding и border — контент сжимается.</p>
    <ul><li>Margin не входит в бокс никогда: <code>border-box</code> его не учитывает, поэтому <code>width: 100%</code> плюс <code>margin</code> всё равно даст переполнение.</li>
    <li>Универсальный сброс делают через <code>*, *::before, *::after { box-sizing: border-box }</code>; более «библиотечно-дружелюбный» вариант — <code>html { box-sizing: border-box } * { box-sizing: inherit }</code>, он позволяет виджету переопределить модель для своего поддерева.</li>
    <li>Есть ещё <code>min-content</code>, <code>max-content</code>, <code>fit-content</code> — они считают размер от содержимого, а не от контейнера, и часто решают задачу лучше, чем проценты.</li>
    <li>Полезно помнить, что процентные <code>padding</code> и <code>margin</code> считаются от <strong>ширины</strong> контейнера, включая вертикальные, — на этом строится старый хак aspect-ratio.</li></ul>`,
    code: `html { box-sizing: border-box }
*, *::before, *::after { box-sizing: inherit }`,
    tip: 'Скажите про вертикальный padding в процентах от ширины — это выдаёт понимание, а не заученное правило.' },

  { id: 'css2',
    q: 'Что такое схлопывание margin и когда оно не происходит?',
    a: `<p>Вертикальные margin соседних или вложенных блоков в одном block formatting context объединяются в один, равный большему из них (для отрицательных берётся самое отрицательное, при смешении — сумма максимального положительного и минимального отрицательного). Горизонтальные margin не схлопываются никогда.</p>
    <p>Три случая схлопывания: соседние братья; родитель и первый/последний ребёнок; пустой блок сам с собой.</p>
    <p>Схлопывание <strong>не</strong> происходит:</p>
    <ul><li>внутри flex- и grid-контейнеров — там margin работают предсказуемо, и это главный практический ответ;</li>
    <li>если родитель создаёт новый BFC (<code>overflow</code> не <code>visible</code>, <code>display: flow-root</code>, float, absolute);</li>
    <li>если между блоками есть padding, border или встроенное содержимое;</li>
    <li>у абсолютно позиционированных и float-элементов.</li></ul>
    <p>Прагматичная стратегия — «margin только в одну сторону» (например, только <code>margin-block-end</code>) или отказ от margin в пользу <code>gap</code>.</p>`,
    code: `.parent { display: flow-root } /* отсечь схлопывание с ребёнком */
.stack > * + * { margin-block-start: 1rem } /* owl-селектор */`,
    tip: 'Ответ «в flex/grid схлопывания нет, поэтому современный layout эту проблему просто убрал» звучит зрело.' },

  { id: 'css3',
    q: 'Что такое block formatting context и зачем он нужен на практике?',
    a: `<p>BFC — это независимая область раскладки: внутри неё блоки выкладываются по своим правилам и не взаимодействуют с внешним потоком. Три классических эффекта.</p>
    <ul><li>BFC <strong>содержит float</strong>: контейнер обтекает и получает высоту от плавающих детей (замена clearfix).</li>
    <li>BFC <strong>блокирует схлопывание margin</strong> между родителем и детьми.</li>
    <li>Блок с BFC <strong>не заезжает под соседний float</strong> — на этом строится классический двухколоночный layout без ширины.</li></ul>
    <p>Создают BFC: <code>overflow</code> кроме <code>visible</code>, float, absolute/fixed, <code>display: inline-block | table-cell | flex | grid | flow-root</code>, <code>contain: layout</code>, мультиколонки. Правильный современный способ — <code>display: flow-root</code>: он даёт ровно BFC без побочных эффектов, тогда как <code>overflow: hidden</code> заодно обрезает тени, тултипы и sticky.</p>
    <p>Отдельно стоит упомянуть, что flex и grid создают свои <strong>formatting context</strong> (не BFC), где float внутри игнорируется.</p>`,
    code: `.clearfix { display: flow-root }`,
    tip: 'Назовите overflow: hidden как источник багов со sticky и тенями — это частая реальная проблема.' },

  { id: 'css4',
    q: 'Как считается специфичность и какие механизмы её обходят?',
    a: `<p>Специфичность — кортеж (inline, id, class/attr/pseudo-class, element/pseudo-element), сравниваемый лексикографически. Она не «сумма», а сравнение по разрядам: один id всегда сильнее любого количества классов. <code>!important</code> живёт вне кортежа, в отдельном origin.</p>
    <p>Порядок каскада целиком: origin и important (user agent, user, author, animations, затем important в обратном порядке, потом transitions) → <strong>cascade layers</strong> → специфичность → порядок в исходнике.</p>
    <ul><li><code>:is()</code> и <code>:not()</code> берут специфичность самого «тяжёлого» аргумента; <code>:where()</code> всегда даёт ноль — идеально для базовых стилей библиотеки.</li>
    <li>Повышают специфичность приёмом <code>.a.a</code> или <code>:is(.a):is(.a)</code> — честнее, чем id.</li>
    <li>Inline-стили побеждают всё, кроме <code>!important</code> в author-слое; поэтому анимации и утилиты-классы конфликтуют с ними.</li>
    <li>Специфичность вообще не применяется к inherited-значениям: наследование проигрывает любому прямому объявлению, даже <code>*</code>.</li></ul>`,
    code: `.btn:where(.theme-dark) { color: white } /* специфичность (0,1,0) */`,
    tip: 'Фраза «наследование всегда слабее прямого правила, даже универсального селектора» отвечает на классическую задачу с * { color }.' },

  { id: 'css5',
    q: 'Что такое каскадные слои @layer и как они меняют работу с чужими стилями?',
    a: `<p><code>@layer</code> вводит уровень каскада <strong>выше</strong> специфичности: правило из более позднего слоя побеждает правило из более раннего независимо от селекторов. Порядок слоёв задаётся первым упоминанием, поэтому его объявляют один раз в начале.</p>
    <ul><li>Стили <strong>вне слоёв</strong> сильнее любого слоя — это ключевое правило: незаслоённый код (например, легаси или инлайновые компоненты) всегда выигрывает.</li>
    <li>Для <code>!important</code> порядок слоёв <strong>инвертируется</strong>: important из самого раннего слоя побеждает important из позднего. Это сделано, чтобы reset-слой мог гарантировать что-то жёстко.</li>
    <li>Импорт чужой библиотеки в свой слой: <code>@import url(lib.css) layer(vendor)</code> — так вы гасите её специфичность целиком, не переписывая селекторы.</li>
    <li>Слои вложенные (<code>@layer components.button</code>) и анонимные (каждый <code>@layer {}</code> без имени — отдельный новый слой).</li></ul>`,
    code: `@layer reset, vendor, base, components, utilities;
@import url('normalize.css') layer(reset);
@layer utilities { .p-0 { padding: 0 } }`,
    tip: 'Инверсия порядка для !important — редко известный факт, который сразу выделяет ответ.' },

  { id: 'css6',
    q: 'Как работает наследование и чем отличаются inherit, initial, unset, revert и revert-layer?',
    a: `<p>Наследуются в основном типографические и «текстовые» свойства (<code>color</code>, <code>font-*</code>, <code>line-height</code>, <code>visibility</code>, <code>cursor</code>, <code>direction</code>); блочные (<code>display</code>, <code>margin</code>, <code>background</code>) — нет. Кастомные свойства наследуются всегда, если не объявлены через <code>@property</code> с <code>inherits: false</code>.</p>
    <ul><li><code>inherit</code> — взять вычисленное значение родителя, даже для ненаследуемого свойства.</li>
    <li><code>initial</code> — значение из спецификации, а не «как в браузере». Для <code>display</code> это <code>inline</code>, для <code>color</code> — чёрный; поэтому <code>all: initial</code> ломает вёрстку сильнее, чем ожидают.</li>
    <li><code>unset</code> — <code>inherit</code> для наследуемых, <code>initial</code> для остальных.</li>
    <li><code>revert</code> — откат к значению предыдущего origin, то есть к стилю браузера. Именно это обычно нужно при «верни как было».</li>
    <li><code>revert-layer</code> — откат к значению из предыдущего каскадного слоя; работает внутри <code>@layer</code>.</li></ul>
    <p><code>all: revert</code> — самый безопасный способ изолировать чужой виджет без Shadow DOM.</p>`,
    code: `.reset-widget { all: revert }
@layer theme { .btn { color: revert-layer } }`,
    tip: 'Разница initial и revert на примере display — короткая и убедительная иллюстрация.' },

  { id: 'css7',
    q: 'Как определяется containing block для absolute и fixed?',
    a: `<p>Для <code>position: absolute</code> containing block — padding-box ближайшего предка с <code>position</code> отличным от <code>static</code>. Для <code>fixed</code> — viewport. Но есть важные исключения, которые ломают ожидания.</p>
    <ul><li><code>transform</code>, <code>filter</code>, <code>backdrop-filter</code>, <code>perspective</code>, <code>will-change</code> на этих свойствах, <code>contain: paint | layout | strict</code> и <code>content-visibility</code> делают элемент containing block <strong>даже для fixed</strong>. Отсюда классический баг: модалка с <code>position: fixed</code> внутри анимируемого контейнера прилипает не к экрану.</li>
    <li>Для статических элементов containing block — content-box ближайшего блочного предка.</li>
    <li>Проценты в <code>width</code>/<code>height</code>/<code>padding</code> считаются от containing block, поэтому <code>height: 100%</code> требует определённой высоты у всей цепочки предков.</li>
    <li>Современная альтернатива для попапов — <code>position-area</code> и anchor positioning либо элемент в top layer (<code>dialog</code>, <code>popover</code>), где containing block вообще не мешает.</li></ul>`,
    code: `.animated { transform: translateZ(0) } /* сломает fixed внутри */`,
    tip: 'Кейс «fixed внутри transform» — один из самых частых реальных багов, называйте его сами.' },

  { id: 'css8',
    q: 'Что создаёт stacking context и почему z-index иногда не работает?',
    a: `<p>z-index сравнивается только <strong>внутри одного stacking context</strong>. Если предок создал контекст, ребёнок с <code>z-index: 9999</code> всё равно не поднимется выше соседа предка — это ответ на 90% вопросов про «не работает z-index».</p>
    <p>Контекст создают: корневой элемент; позиционированный элемент с <code>z-index</code> не <code>auto</code>; <code>opacity</code> меньше 1; <code>transform</code>, <code>filter</code>, <code>backdrop-filter</code>, <code>perspective</code>, <code>clip-path</code>, <code>mask</code>, <code>mix-blend-mode</code> кроме normal; <code>isolation: isolate</code>; <code>will-change</code> с любым из этих свойств; <code>contain: paint</code>; flex/grid-ребёнок с <code>z-index</code>; элемент в top layer.</p>
    <ul><li>Внутри контекста порядок покраски: фон контекста → отрицательный z-index → блочные в потоке → float → инлайновые → z-index 0/auto и позиционированные → положительный z-index.</li>
    <li><code>isolation: isolate</code> — способ намеренно запереть z-index компонента, чтобы его внутренние значения не конфликтовали с приложением.</li>
    <li>Настоящее решение для оверлеев — top layer: <code>dialog.showModal()</code> и Popover API рисуются поверх всего независимо от контекстов.</li></ul>`,
    code: `.card { isolation: isolate } /* локализовать z-index внутри компонента */`,
    tip: 'Предложите top layer как архитектурное решение вместо гонки z-index — это senior-уровень ответа.' },

  { id: 'css9',
    q: 'Как на самом деле работают flex-grow, flex-shrink и flex-basis?',
    a: `<p><code>flex-basis</code> — стартовый размер по главной оси до распределения; он <strong>перекрывает</strong> <code>width</code> (кроме <code>flex-basis: auto</code>, который берёт width/height, а при их отсутствии — размер контента).</p>
    <ul><li>Свободное место распределяется пропорционально <code>flex-grow</code>. Одинаковый grow не означает одинаковую ширину: базисы разные, поэтому итог тоже разный. Равные колонки — это <code>flex: 1 1 0</code> (нулевой basis), а не <code>flex: 1 1 auto</code>.</li>
    <li>Недостаток места распределяется пропорционально <code>flex-shrink</code>, <strong>взвешенному на базис</strong>: элемент с большим basis сжимается сильнее при равном shrink.</li>
    <li>Шорткаты: <code>flex: 1</code> = <code>1 1 0%</code>, <code>flex: auto</code> = <code>1 1 auto</code>, <code>flex: none</code> = <code>0 0 auto</code>, <code>flex: 0 1 auto</code> — значение по умолчанию.</li>
    <li>Сжатие ограничено <code>min-width</code>, которое у flex-элементов равно <code>auto</code>, то есть min-content — отдельная большая ловушка.</li></ul>`,
    code: `.equal > * { flex: 1 1 0 }   /* строго равные колонки */
.natural > * { flex: 1 1 auto } /* пропорционально контенту */`,
    tip: 'Разница flex: 1 и flex: auto на примере колонок с разным текстом — идеальная демонстрация понимания.' },

  { id: 'css10',
    q: 'Почему flex-элемент не сжимается и вылезает за контейнер?',
    a: `<p>Потому что у flex- и grid-элементов начальное значение <code>min-width</code> (по главной оси — <code>min-inline-size</code>) равно <code>auto</code>, что означает <strong>min-content</strong>: элемент не может стать уже своего самого широкого неразрывного содержимого — длинного слова, URL, таблицы, <code>pre</code> или картинки в натуральную величину.</p>
    <ul><li>Лечится <code>min-width: 0</code> (или <code>min-inline-size: 0</code>) на flex-элементе, а для колонок grid — <code>minmax(0, 1fr)</code> вместо <code>1fr</code>.</li>
    <li>Для текста дополнительно нужны <code>overflow-wrap: anywhere</code> или <code>text-overflow: ellipsis</code> вместе с <code>overflow: hidden</code>.</li>
    <li><code>overflow</code> отличный от <code>visible</code> тоже меняет автоматический минимум на ноль — поэтому «поставил overflow: hidden и всё починилось».</li>
    <li>Тот же механизм ломает вложенные скролл-контейнеры: скролл появляется у внешнего блока вместо внутреннего, пока не поставить <code>min-height: 0</code> по цепочке.</li></ul>`,
    code: `.flex-item { min-width: 0 }
.grid { grid-template-columns: minmax(0, 1fr) 240px }`,
    tip: 'Свяжите с вложенным скроллом: min-height: 0 по всей цепочке — очень практичный и узнаваемый кейс.' },

  { id: 'css11',
    q: 'Grid: как устроены named areas, fr и minmax? Когда grid лучше flex?',
    a: `<p><code>fr</code> — доля <strong>свободного</strong> места после вычитания фиксированных треков и gap. Важно: <code>1fr</code> эквивалентно <code>minmax(auto, 1fr)</code>, а <code>auto</code> в качестве минимума равен min-content, поэтому длинный контент «распирает» колонку. Для честно равных колонок пишут <code>minmax(0, 1fr)</code>.</p>
    <ul><li><code>grid-template-areas</code> даёт декларативную карту макета и заодно автоматически именованные линии (<code>header-start</code>/<code>header-end</code>); переносить блок между брейкпоинтами можно одной перерисовкой карты — но помните, что визуальный порядок разойдётся с DOM-порядком, а таб-навигация идёт по DOM.</li>
    <li><code>minmax(min, max)</code> — основной инструмент адаптивности без медиазапросов; <code>min-content</code>, <code>max-content</code>, <code>fit-content(300px)</code> как значения.</li>
    <li>Grid — двумерный: он выравнивает элементы по общим строкам и колонкам между собой. Flex — одномерный и распределяет по одной оси; выравнивание карточек в разных flex-контейнерах невозможно, в grid — естественно.</li>
    <li>Практический выбор: grid для страницы и для «карточек одинаковой высоты», flex для панелей инструментов, чипов и всего, что переносится по содержимому.</li></ul>`,
    code: `.layout {
  display: grid;
  grid-template-areas: 'head head' 'nav main' 'foot foot';
  grid-template-columns: 240px minmax(0, 1fr);
}`,
    tip: 'Предупреждение про расхождение визуального и DOM-порядка (и последствия для клавиатуры) — важный a11y-акцент.' },

  { id: 'css12',
    q: 'В чём разница между auto-fit и auto-fill в repeat()?',
    a: `<p>Оба вместе с <code>minmax</code> дают адаптивную сетку без медиазапросов. Разница проявляется, только когда элементов <strong>меньше</strong>, чем помещается треков.</p>
    <ul><li><code>auto-fill</code> создаёт максимум треков, помещающихся в контейнер, и оставляет пустые. Элементы сохраняют минимальную ширину, справа остаётся пустое место.</li>
    <li><code>auto-fit</code> создаёт те же треки, но затем <strong>схлопывает пустые до нуля</strong>, из-за чего <code>1fr</code> растягивает оставшиеся элементы на всю ширину.</li></ul>
    <p>То есть: одна карточка при <code>auto-fit</code> растянется на всю строку, при <code>auto-fill</code> — останется узкой. Выбор — продуктовый: для каталога обычно <code>auto-fill</code> (карточки не «раздуваются»), для баннеров и дашбордов — <code>auto-fit</code>.</p>
    <p>Ловушка: <code>minmax(250px, 1fr)</code> вызовет переполнение на экране уже 250px — надо <code>minmax(min(250px, 100%), 1fr)</code>.</p>`,
    code: `.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
}`,
    tip: 'Приём min(260px, 100%) против переполнения на узких экранах — то, о чём забывают почти все.' },

  { id: 'css13',
    q: 'Что такое subgrid и какую задачу он решает?',
    a: `<p><code>grid-template-columns: subgrid</code> заставляет вложенную сетку использовать <strong>треки родителя</strong>, а не создавать свои. Классическая задача — карточки, где заголовок, текст и футер должны быть выровнены по одной линии между <strong>разными</strong> карточками, хотя каждая карточка — самостоятельный DOM-узел.</p>
    <ul><li>До subgrid это решалось «плоской» сеткой без обёрток (что ломало семантику и рамки карточек) или display: contents (что ломало доступность и границы).</li>
    <li>Subgrid наследует размеры треков и gap родителя, но <code>gap</code> можно переопределить локально; именованные линии родителя тоже видны.</li>
    <li>Работает независимо по осям: можно <code>grid-template-rows: subgrid</code>, оставив колонки своими.</li>
    <li>Поддержка: во всех современных браузерах с конца 2023 (Chrome 117), поэтому в 2025 это уже рабочий инструмент; для старых — <code>@supports (grid-template-rows: subgrid)</code> с деградацией на фиксированные высоты.</li></ul>`,
    code: `.cards { display: grid; grid-template-rows: auto 1fr auto }
.card { display: grid; grid-row: span 3; grid-template-rows: subgrid }`,
    tip: 'Сравнение с display: contents и его проблемами с доступностью показывает, что вы знаете историю вопроса.' },

  { id: 'css14',
    q: 'Какие современные единицы вы используете: dvh/svh/lvh, ch, rem против em?',
    a: `<p><strong>Viewport-единицы.</strong> <code>vh</code> на мобильных равен <strong>большому</strong> вьюпорту (как при скрытой адресной строке), поэтому <code>100vh</code> вызывает обрезание контента. Новые единицы: <code>svh</code> — маленький вьюпорт (панели показаны), <code>lvh</code> — большой, <code>dvh</code> — динамический, меняется при скролле. <code>dvh</code> визуально корректен, но его изменение вызывает перерасчёт layout при каждом появлении/скрытии панели — для тяжёлых страниц это дёргание, поэтому часто берут <code>svh</code> для критичных блоков и <code>dvh</code> только для полноэкранных оверлеев.</p>
    <p><strong>rem против em.</strong> <code>rem</code> считается от корня и предсказуем — база для типографики и отступов. <code>em</code> считается от <code>font-size</code> текущего элемента и <strong>накапливается</strong> при вложенности, но именно поэтому идеален для внутренних отступов кнопки, которая должна масштабироваться вместе со своим шрифтом. Важный аргумент доступности: <code>rem</code> уважает пользовательский размер шрифта в браузере, а <code>px</code> — нет.</p>
    <ul><li><code>ch</code> — ширина символа «0» текущего шрифта; используется для <code>max-width: 65ch</code> — комфортной длины строки.</li>
    <li><code>lh</code> и <code>rlh</code> — высота строки как единица, удобна для вертикального ритма.</li>
    <li>Никогда не задавайте <code>html { font-size: 62.5% }</code> — это ломает пользовательские настройки; лучше <code>rem</code> от честных 16px.</li></ul>`,
    code: `.hero { min-height: 100svh }
.prose { max-width: 65ch }`,
    tip: 'Аргумент про пользовательский размер шрифта и rem — это одновременно ответ и про доступность.' },

  { id: 'css15',
    q: 'Что такое container queries и чем они лучше медиазапросов?',
    a: `<p>Медиазапрос знает только про вьюпорт, поэтому компонент нельзя переиспользовать в сайдбаре и в основной колонке — он не знает, сколько места ему реально досталось. Container queries переносят условие на <strong>размер контейнера</strong>.</p>
    <ul><li>Родитель объявляет <code>container-type: inline-size</code> (реже <code>size</code>), опционально <code>container-name</code>; потомки пишут <code>@container (min-width: 400px)</code>.</li>
    <li>Цена: <code>container-type</code> включает <strong>size containment</strong> по этой оси — контейнер перестаёт зависеть от размера содержимого по inline-оси. <code>container-type: size</code> требует явной высоты, иначе блок схлопнется. Это самая частая причина «всё поехало».</li>
    <li>Нельзя опросить сам контейнер (только потомков) — поэтому обычно нужна дополнительная обёртка.</li>
    <li>Container query units: <code>cqw</code>, <code>cqh</code>, <code>cqi</code>, <code>cqb</code>, <code>cqmin</code>, <code>cqmax</code> — позволяют делать fluid-типографику относительно компонента.</li>
    <li>Style queries (<code>@container style(--theme: dark)</code>) уже работают для кастомных свойств — это способ передавать варианты вниз без классов.</li></ul>`,
    code: `.card-wrap { container-type: inline-size; container-name: card }
@container card (min-width: 420px) {
  .card { grid-template-columns: 160px 1fr }
}`,
    tip: 'Обязательно упомяните containment и его побочку — это отличает того, кто внедрял CQ в проде.' },

  { id: 'css16',
    q: 'Что даёт селектор :has() и где он реально применяется?',
    a: `<p><code>:has()</code> — первый «родительский» селектор: он выбирает элемент, содержащий (или сопровождаемый) что-то, подходящее под аргумент. Специфичность берётся от самого тяжёлого аргумента, сам <code>:has()</code> веса не добавляет.</p>
    <p>Практические применения:</p>
    <ul><li>Стилизация формы по состоянию поля: <code>.field:has(input:invalid)</code>, <code>.field:has(:focus-visible)</code> — без JS и без классов-модификаторов.</li>
    <li>Реакция на наличие контента: <code>.card:has(img)</code>, <code>.layout:has(&gt; aside)</code> — макет подстраивается сам.</li>
    <li>Комбинация с соседними комбинаторами: <code>h2:has(+ p)</code>, «предыдущий элемент» через <code>li:has(+ li:hover)</code>.</li>
    <li>Замена части JS-логики: <code>body:has(dialog[open]) { overflow: hidden }</code> — блокировка скролла при открытой модалке.</li></ul>
    <p>Ограничения: нельзя вкладывать <code>:has()</code> в <code>:has()</code>, нельзя использовать псевдоэлементы внутри, и стоит помнить о стоимости — браузеры оптимизировали инвалидацию, но широкий <code>:has()</code> на body с частыми изменениями DOM реально вызывает лишние пересчёты стилей.</p>`,
    code: `.field:has(input:user-invalid) { border-color: red }
body:has(dialog[open]) { overflow: hidden }`,
    tip: 'Пример с блокировкой скролла при открытом dialog — эффектный и сразу показывает пользу.' },

  { id: 'css17',
    q: 'Зачем логические свойства и как правильно поддержать RTL?',
    a: `<p>Логические свойства описывают направления относительно <strong>потока письма</strong>, а не экрана: <code>inline</code> — ось строки, <code>block</code> — ось абзацев. <code>margin-inline-start</code> станет левым в LTR и правым в RTL автоматически.</p>
    <ul><li>Замены: <code>width/height</code> → <code>inline-size/block-size</code>; <code>text-align: left</code> → <code>start</code>; <code>left/right</code> → <code>inset-inline-start/end</code>; <code>border-radius</code> → <code>border-start-start-radius</code> и т. д.</li>
    <li>RTL включается атрибутом <code>dir="rtl"</code> на <code>html</code> (не через CSS <code>direction</code>) — потому что <code>dir</code> влияет ещё и на алгоритм двунаправленного текста, и на поведение форм и скролла.</li>
    <li>Что <strong>не</strong> зеркалится и требует ручной работы: иконки со смыслом направления (стрелки «назад», прогресс), логотипы, числа и код (остаются LTR), тени и градиенты, <code>transform: translateX</code>, значения <code>scrollLeft</code> в JS (в RTL они отрицательные/инвертированные).</li>
    <li>Логические свойства дают ещё и бесплатную поддержку вертикального письма (<code>writing-mode</code>) для японского/китайского.</li></ul>
    <p>Проверять RTL нужно на реальном контенте: длина строк в арабском и иврите отличается, и фиксированные ширины кнопок ломаются.</p>`,
    code: `.card { padding-inline: 16px; border-inline-start: 2px solid }
[dir='rtl'] .icon-back { transform: scaleX(-1) }`,
    tip: 'Упомяните расхождение scrollLeft в RTL между браузерами — редкая, но очень болезненная деталь.' },

  { id: 'css18',
    q: 'Как вы строите темизацию на CSS-переменных? Где их ограничения?',
    a: `<p>Кастомные свойства — это <strong>наследуемые</strong> значения, вычисляемые в рантайме, поэтому они работают с каскадом, доступны из JS (<code>getComputedStyle</code>, <code>style.setProperty</code>) и меняются без пересборки.</p>
    <p>Рабочая архитектура — два уровня: <strong>примитивные токены</strong> (<code>--color-blue-500</code>) и <strong>семантические</strong> (<code>--color-surface</code>, <code>--color-text-muted</code>). Тема переопределяет только семантические, компоненты используют только их.</p>
    <ul><li>Переменная берётся с места <strong>использования</strong>, а не объявления: <code>--x</code> внутри <code>:root</code>, применённая в компоненте, будет разрешена в контексте компонента. Это позволяет делать локальные переопределения одной строкой.</li>
    <li>Fallback: <code>var(--x, 8px)</code>; пустое значение считается валидным, а невалидное даёт <code>unset</code> (guaranteed-invalid), что часто выглядит как «переменная не работает».</li>
    <li><code>@property</code> даёт переменной тип, начальное значение и <code>inherits</code> — только так она становится <strong>анимируемой</strong> (иначе градиенты и углы не анимируются).</li>
    <li>Цена: значение вычисляется при каждом использовании, а изменение переменной на <code>:root</code> инвалидирует стили всего дерева — для анимаций на 60fps меняйте переменную на минимально возможном поддереве.</li></ul>`,
    code: `@property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false }
:root { --surface: #fff }
[data-theme='dark'] { --surface: #111 }`,
    tip: 'Двухуровневая система токенов и @property для анимаций — два признака зрелой дизайн-системы.' },

  { id: 'css19',
    q: 'Как работает clamp и как делать fluid typography без вреда для доступности?',
    a: `<p><code>clamp(min, preferred, max)</code> = <code>max(min, min(preferred, max))</code>. Для fluid-типографики preferred строится как линейная функция от вьюпорта: <code>clamp(1rem, 0.9rem + 0.6vw, 1.4rem)</code>.</p>
    <ul><li><strong>Критично для a11y</strong>: если preferred выражен только в <code>vw</code>, текст перестаёт реагировать на зум и на пользовательский размер шрифта — это нарушение WCAG 1.4.4 (Resize Text до 200%). Поэтому в формуле обязательно есть слагаемое в <code>rem</code>.</li>
    <li>min и max должны быть в <code>rem</code>, иначе при крупном системном шрифте текст упрётся в потолок в пикселях.</li>
    <li><code>clamp</code> применим не только к шрифтам: отступы, ширины колонок, радиусы. Для отступов удобнее <code>min()</code>/<code>max()</code>: <code>padding: min(5vw, 48px)</code>.</li>
    <li>Современная альтернатива — <code>interpolate-size</code> и <code>calc-size()</code> для анимации к <code>auto</code>, и container query units для fluid внутри компонента, а не вьюпорта.</li></ul>`,
    code: `h1 { font-size: clamp(1.75rem, 1.2rem + 2.5vw, 3rem) }
.section { padding-inline: min(6vw, 64px) }`,
    tip: 'Требование WCAG про 200% зума и чисто-vw шрифты — сильный аргумент, который редко звучит.' },

  { id: 'css20',
    q: 'Зачем нужны oklch и color-mix вместо hex и rgb?',
    a: `<p><code>oklch(L C H)</code> — перцептивно равномерное пространство: изменение L на равную величину даёт равное изменение <strong>воспринимаемой</strong> светлоты, чего нет ни в HSL, ни в hex. Практические следствия:</p>
    <ul><li>Палитра из 10 оттенков, построенная линейным изменением L, выглядит ровной; в HSL синий и жёлтый при одинаковой lightness воспринимаются совершенно по-разному.</li>
    <li>Проще держать контраст: L примерно коррелирует с яркостью, значит проверку WCAG можно прикинуть ещё на этапе выбора токенов.</li>
    <li>Доступен широкий гамут P3 — цвета ярче sRGB на современных экранах; браузер сам делает gamut mapping.</li></ul>
    <p><code>color-mix(in oklch, var(--brand) 80%, white)</code> генерирует оттенки прямо из токена, поэтому hover/disabled/тени не нужно хардкодить. Интерполяционное пространство важно: <code>in srgb</code> при смешении через белый даёт грязный результат, <code>in oklch</code> — чистый.</p>
    <p>Стоит помнить про <code>@supports (color: oklch(0 0 0))</code> для старых браузеров и про то, что <code>color-mix</code> не работает в контексте, где нужен статический цвет (например, в <code>meta theme-color</code>).</p>`,
    code: `:root { --brand: oklch(0.62 0.19 255) }
.btn:hover { background: color-mix(in oklch, var(--brand) 85%, black) }`,
    tip: 'Пример «палитра в HSL выглядит неровной, в OKLCH ровной» — самая наглядная мотивация перехода.' },

  { id: 'css21',
    q: 'Когда transition, а когда animation? Что важно знать про их поведение?',
    a: `<p><code>transition</code> — реакция на изменение значения: нужно, чтобы старое и новое значения были определены и анимируемы, срабатывает один раз, легко прерывается новым изменением (браузер плавно перенаправляет из текущей точки). <code>animation</code> — независимый от изменений сценарий с keyframes: повторы, задержки, несколько шагов, <code>animation-fill-mode</code>.</p>
    <ul><li>Transition не сработает при появлении элемента (<code>display: none</code> → <code>block</code>), потому что нет предыдущего вычисленного значения. Раньше это лечили <code>requestAnimationFrame</code>-двойным кадром, сейчас — <code>transition-behavior: allow-discrete</code>, <code>@starting-style</code> и анимируемым <code>display</code>.</li>
    <li>Анимируемы только свойства с определённым типом интерполяции; <code>height: auto</code> исторически не анимируется — решается <code>grid-template-rows: 0fr → 1fr</code> или новым <code>calc-size(auto)</code>.</li>
    <li>Web Animations API даёт то же самое из JS с возможностью управлять timeline и композитингом.</li>
    <li>Для интерактивных жестов лучше animation с приостановкой (<code>animation-play-state</code>) или WAAPI, чем цепочка transition.</li></ul>`,
    code: `.popover {
  transition: opacity .2s, display .2s allow-discrete;
  @starting-style { opacity: 0 }
}`,
    tip: 'Знание @starting-style и allow-discrete — свежая тема 2024–2025, она сразу показывает актуальность знаний.' },

  { id: 'css22',
    q: 'Какие свойства анимировать дёшево и что делает will-change?',
    a: `<p>Дёшево — <code>transform</code>, <code>opacity</code> и <code>filter</code>: они обрабатываются на этапе composite, то есть без layout и paint, и могут выполняться в отдельном потоке компоновщика, не блокируясь занятым main thread. Всё, что меняет геометрию (<code>width</code>, <code>top</code>, <code>margin</code>), вызывает reflow каждого кадра.</p>
    <ul><li><code>will-change: transform</code> заранее выносит элемент на собственный композитный слой. Это <strong>подсказка, а не команда</strong>, и её нельзя оставлять постоянно: каждый слой стоит видеопамяти, а на мобильных десятки слоёв ухудшают производительность сильнее, чем помогает оптимизация.</li>
    <li>Правильный паттерн — включать <code>will-change</code> перед анимацией (на hover родителя или из JS) и убирать после.</li>
    <li>Побочные эффекты: новый слой создаёт stacking context и containing block для fixed, может размывать текст из-за субпиксельного рендеринга, отключает субпиксельное сглаживание.</li>
    <li>Диагностика — Layers-панель и «Paint flashing»/«Layer borders» в Rendering DevTools; там же видно, какие анимации не попали на композитор («Non-composited animation» в трейсе).</li></ul>`,
    code: `.card { transition: transform .2s }
.list:hover .card { will-change: transform }`,
    tip: 'Формулировка «will-change — это обещание, а не оптимизация» плюс упоминание Layers-панели закрывают вопрос.' },

  { id: 'css23',
    q: 'Как учитывать prefers-reduced-motion и что именно отключать?',
    a: `<p><code>@media (prefers-reduced-motion: reduce)</code> отражает системную настройку пользователя. Мотивация — вестибулярные расстройства: параллакс, крупные перемещения, зум и вращение могут вызвать реальное головокружение и тошноту (WCAG 2.3.3 Animation from Interactions).</p>
    <ul><li><strong>Не нужно</strong> отключать всё подряд. Убирают крупные перемещения, параллакс, автоплей каруселей, эффекты масштабирования; оставляют мягкие изменения opacity и цвета — они дают обратную связь и не вредят.</li>
    <li>Глобальный «нокаут» через <code>* { animation: none !important }</code> опасен: он ломает компоненты, которые полагаются на событие <code>animationend</code> или <code>transitionend</code>. Безопаснее свести длительность к <code>0.01ms</code>, чтобы события всё же срабатывали.</li>
    <li>То же условие нужно проверять в JS для WAAPI и библиотек анимации: <code>matchMedia('(prefers-reduced-motion: reduce)')</code>.</li>
    <li>Родственные фичи: <code>prefers-reduced-transparency</code>, <code>prefers-contrast</code>, <code>forced-colors</code> (Windows High Contrast) — их тоже стоит уметь назвать.</li></ul>`,
    code: `@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}`,
    tip: 'Объяснение, почему 0.01ms лучше none (события всё ещё стреляют), — деталь уровня практика.' },

  { id: 'css24',
    q: 'Что такое scroll-driven animations и чем они лучше JS на скролле?',
    a: `<p>CSS позволяет привязать прогресс анимации не ко времени, а к прокрутке: <code>animation-timeline: scroll()</code> — прогресс скролл-контейнера, <code>view()</code> — видимость элемента во вьюпорте, с настройкой через <code>animation-range</code> (<code>entry</code>, <code>cover</code>, <code>exit</code>).</p>
    <ul><li>Главный выигрыш — анимация исполняется на <strong>компоновщике</strong>, вне main thread: не дёргается при тяжёлом JS и не порождает listener-ов на scroll (которые исторически были источником jank и проблем с passive-обработчиками).</li>
    <li>Заменяет 80% сценариев IntersectionObserver + классы: прогресс-бар чтения, появление карточек, параллакс, sticky-заголовки с изменением размера.</li>
    <li>Ограничение: анимировать нужно композитные свойства, иначе выигрыш теряется; и это <strong>анимация</strong>, а не логика — для загрузки данных при скролле по-прежнему нужен IntersectionObserver.</li>
    <li>Поддержка: Chromium с 115, Safari и Firefox подтянулись позже — обязательно оборачивать в <code>@supports (animation-timeline: scroll())</code> и обеспечивать статичный фолбэк.</li>
    <li>Не забыть про <code>prefers-reduced-motion</code>: параллакс — ровно тот случай, который отключают.</li></ul>`,
    code: `@supports (animation-timeline: view()) {
  .card { animation: fade linear both; animation-timeline: view();
          animation-range: entry 0% cover 30% }
}`,
    tip: 'Акцент «работает на компоновщике, поэтому не зависит от занятого main thread» — главный технический аргумент.' },

  { id: 'css25',
    q: 'Что такое View Transitions API и как его применять в SPA и MPA?',
    a: `<p>API делает снимок старого состояния DOM, даёт вам изменить DOM синхронно и затем анимирует переход между снимками. В SPA: <code>document.startViewTransition(() =&gt; updateDom())</code>. В MPA — чисто декларативно через <code>@view-transition { navigation: auto }</code> на обеих страницах одного origin.</p>
    <ul><li>Элементы, которым задан уникальный <code>view-transition-name</code>, анимируются самостоятельно (морфинг миниатюры в большое изображение); остальное — кросс-фейд корневых псевдоэлементов <code>::view-transition-old(root)</code> / <code>::view-transition-new(root)</code>.</li>
    <li>Имя должно быть <strong>уникальным на момент перехода</strong>; два элемента с одинаковым именем — переход просто не сработает. Для списков имена генерируют из id, а с 2025 есть <code>view-transition-name: auto</code> и <code>match-element</code>.</li>
    <li>Влияние на метрики: во время перехода DOM «заморожен», поэтому неаккуратно длинные переходы ухудшают INP и ощущаемую отзывчивость; держите 150–300 мс.</li>
    <li>Обязательно отключать при <code>prefers-reduced-motion</code> и обеспечивать работу без API — это прогрессивное улучшение, никакая логика на нём висеть не должна.</li>
    <li>В связке с Speculation Rules cross-document переходы дают ощущение SPA на обычном многостраничном сайте.</li></ul>`,
    code: `.thumb { view-transition-name: hero }
@view-transition { navigation: auto }`,
    tip: 'Связка «MPA + speculation rules + view transitions» — актуальный архитектурный аргумент против SPA по умолчанию.' },

  { id: 'css26',
    q: 'Почему не работает position: sticky? Перечислите причины.',
    a: `<p>Sticky — гибрид: элемент ведёт себя как <code>relative</code>, пока не достигнет порога, затем фиксируется относительно ближайшего <strong>скролл-контейнера</strong> (а не вьюпорта). Отсюда список причин.</p>
    <ul><li>Не задано ни одно из <code>top/right/bottom/left</code> (или логических <code>inset-*</code>) — порога нет, липнуть не к чему.</li>
    <li>У любого предка <code>overflow</code> отличен от <code>visible</code> (<code>hidden</code>, <code>auto</code>, <code>scroll</code>, <code>clip</code>) — этот предок становится скролл-контейнером, и элемент липнет внутри него, где скролла может не быть вовсе. Самая частая причина.</li>
    <li>Родитель не выше самого sticky-элемента: липнуть некуда, элемент «прокручивается» вместе с родителем.</li>
    <li>Sticky работает только в пределах своего <strong>родителя</strong>, а не всей страницы.</li>
    <li>В таблице sticky на <code>thead</code>/<code>tr</code> долго не поддерживался — нужно вешать на <code>th</code>/<code>td</code>.</li>
    <li>Flex/grid-контейнер с <code>align-items: stretch</code> (по умолчанию) растягивает элемент на всю высоту — липнуть снова некуда; помогает <code>align-self: start</code>.</li></ul>
    <p>Отладка: <code>:has()</code>-селектор или скрипт, поднимающийся по <code>offsetParent</code> и проверяющий <code>getComputedStyle(el).overflow</code>. Прилипание можно детектировать через IntersectionObserver с sentinel-элементом.</p>`,
    code: `.th { position: sticky; top: 0 }
.wrapper { overflow: visible } /* иначе sticky живёт внутри wrapper */`,
    tip: 'Пункт про align-items: stretch в flex — причина, которую почти никогда не называют, а встречается она часто.' },

  { id: 'css27',
    q: 'Как устроены скролл-контейнеры и какие свойства ими управляют?',
    a: `<p>Скролл-контейнер создаёт любой элемент с <code>overflow</code> отличным от <code>visible</code> (кроме <code>clip</code>, который обрезает без прокрутки). Ключевые нюансы:</p>
    <ul><li><code>overflow: hidden</code> — это прокручиваемый контейнер без интерфейса прокрутки: он всё ещё скроллится программно и при фокусе внутри, что вызывает «прыжки» на клавиатуре. Для настоящей обрезки без прокрутки — <code>overflow: clip</code> плюс <code>overflow-clip-margin</code>.</li>
    <li>Значение одной оси, отличное от <code>visible</code>, превращает <code>visible</code> на другой оси в <code>auto</code> — поэтому «поставил overflow-x: hidden, а появился вертикальный скролл».</li>
    <li><code>overscroll-behavior: contain</code> отключает scroll chaining (прокрутка страницы под открытым меню) и pull-to-refresh — обязательное свойство для модалок и дропдаунов.</li>
    <li><code>scroll-snap-type</code>/<code>scroll-snap-align</code> дают карусели без JS; <code>scroll-padding</code> и <code>scroll-margin</code> учитывают липкую шапку при переходе по якорю и при <code>scrollIntoView</code>.</li>
    <li><code>scrollbar-gutter: stable</code> резервирует место под скроллбар и убирает сдвиг макета при появлении контента — маленькое, но реальное улучшение CLS.</li>
    <li>Вложенные скроллы требуют <code>min-height: 0</code> по цепочке flex-родителей, иначе скролл всплывает наружу.</li></ul>`,
    code: `.modal { overscroll-behavior: contain }
html { scrollbar-gutter: stable; scroll-padding-top: 72px }`,
    tip: 'scrollbar-gutter: stable и scroll-padding-top под липкую шапку — мелочи, по которым видно опытного верстальщика.' },

  { id: 'css28',
    q: 'Как aspect-ratio и object-fit решают задачу медиа без сдвигов?',
    a: `<p><code>aspect-ratio</code> задаёт соотношение сторон, когда известен только один размер: браузер резервирует место до загрузки, и CLS не возникает. Он работает вместе с <code>width</code> (высота вычислится) и уступает явно заданной высоте.</p>
    <ul><li>Для картинок надёжнее всего указывать атрибуты <code>width</code> и <code>height</code> в HTML: браузер сам выводит из них <code>aspect-ratio</code> в UA-стилях, и это работает даже до применения CSS. В CSS тогда ставят <code>height: auto</code>, чтобы не сломать пропорцию.</li>
    <li><code>aspect-ratio</code> игнорируется, если контент распирает бокс — нужен <code>overflow: hidden</code> или <code>min-height: 0</code>.</li>
    <li><code>object-fit</code> определяет, как медиа заполняет свой бокс: <code>cover</code> (обрезать), <code>contain</code> (вписать с полями), <code>fill</code> (растянуть, исказив), <code>none</code>, <code>scale-down</code>. <code>object-position</code> задаёт точку кадрирования — для портретов обычно <code>50% 25%</code>, чтобы не срезать лицо.</li>
    <li>Для по-настоящему умного кадрирования на разных экранах нужен art direction через <code>&lt;picture&gt;</code> с разными файлами, а не только object-fit.</li></ul>`,
    code: `img { max-width: 100%; height: auto }
.thumb { aspect-ratio: 16 / 9; object-fit: cover; object-position: 50% 25% }`,
    tip: 'Скажите, что width/height в HTML нужны даже при CSS-размерах — именно они спасают CLS до загрузки стилей.' },

  { id: 'css29',
    q: 'Зачем нужен BEM в 2025 году и какие у него альтернативы?',
    a: `<p>BEM решает одну задачу: даёт <strong>плоскую</strong> специфичность и предсказуемые границы компонента при отсутствии реальной изоляции в CSS. Все селекторы — один класс, вложенности нет, конфликты имён исключены соглашением.</p>
    <ul><li>Плюсы: работает без сборщика, читается в DevTools, переживает любые фреймворки, отлично ложится на дизайн-систему с явными модификаторами.</li>
    <li>Минусы: многословность, ручная дисциплина, отсутствие удаления мёртвого CSS, сложность с состояниями от предка.</li>
    <li>Современные альтернативы: <strong>CSS Modules</strong> (изоляция на уровне сборки, никакого рантайма), <strong>Tailwind</strong> (утилиты, единый бюджет CSS), <strong>Shadow DOM</strong> (настоящая изоляция), <strong><code>@scope</code></strong> (изоляция средствами самого CSS, с донором и proximity-правилом).</li>
    <li>Прагматично: BEM-именование остаётся полезным <strong>внутри</strong> CSS Modules или Tailwind-компонентов как способ называть части, даже когда изоляцию обеспечивает инструмент.</li></ul>`,
    code: `@scope (.card) to (.card__nested) {
  :scope { padding: 16px }
  .title { font-weight: 600 }
}`,
    tip: 'Упоминание @scope как нативной замены части BEM показывает, что вы следите за платформой.' },

  { id: 'css30',
    q: 'CSS Modules против CSS-in-JS: в чём разница и какова цена рантайма?',
    a: `<p><strong>CSS Modules</strong> — компиляция: имена классов хешируются на этапе сборки, на выходе обычный статический CSS-файл. Ноль рантайма, отлично кешируется, извлекается в отдельный файл, работает с критическим CSS и с SSR без усилий. Минус — динамика только через CSS-переменные и классы-модификаторы.</p>
    <p><strong>CSS-in-JS с рантаймом</strong> (styled-components, emotion) даёт полноценную динамику от пропсов и колокацию стилей с компонентом. Цена:</p>
    <ul><li>Библиотека в бандле (десятки килобайт) плюс сериализация и вставка правил при каждом рендере — заметная нагрузка на main thread, что напрямую бьёт по INP и TBT на больших списках.</li>
    <li>SSR требует сбора стилей и вставки в HTML; при стриминге это отдельная сложность.</li>
    <li>Плохая совместимость с React Server Components: рантайм-библиотеки требуют клиентского контекста.</li></ul>
    <p>Компромисс 2025 года — <strong>zero-runtime CSS-in-JS</strong> (vanilla-extract, Linaria, Panda, StyleX): синтаксис и типобезопасность JS, а на выходе статический CSS. Практически это лучший вариант для дизайн-системы, если команда хочет типизацию токенов.</p>`,
    tip: 'Свяжите рантайм CSS-in-JS с конкретной метрикой (INP/TBT) — это переводит спор о вкусах в измеримую плоскость.' },

  { id: 'css31',
    q: 'Tailwind: какие у него реальные компромиссы?',
    a: `<p>Плюсы: единый ограниченный набор токенов вместо произвола, CSS почти не растёт при росте проекта (утилиты переиспользуются), нет проблемы именования и мёртвого CSS, стили не «утекают», отличный DX с автодополнением. В v4 движок на Rust и конфиг в CSS через <code>@theme</code>, что убрало JS-конфиг и ускорило сборку.</p>
    <p>Минусы, о которых честно стоит сказать:</p>
    <ul><li>Разметка шумная, диффы в код-ревью тяжело читать; частично лечится сортировкой классов (prettier-plugin) и вынесением повторов в компоненты, а не в <code>@apply</code> (который возвращает все проблемы обычного CSS).</li>
    <li>Стили нельзя переопределить снаружи — компонент-библиотека на Tailwind требует явного механизма (<code>cva</code>, <code>tailwind-merge</code>), иначе классы конфликтуют непредсказуемо (порядок в HTML не влияет, влияет порядок в сгенерированном CSS).</li>
    <li>Сложные состояния и анимации всё равно уезжают в обычный CSS.</li>
    <li>Привязка разметки к утилитам усложняет смену дизайн-системы и повторное использование HTML вне Tailwind.</li></ul>
    <p>Разумный выбор: Tailwind для продуктовых экранов, отдельный слой семантических компонентов на CSS Modules/vanilla-extract для дизайн-системы.</p>`,
    tip: 'Пункт про то, что порядок классов в атрибуте не решает конфликт, — практическая деталь, которую знают только те, кто внедрял.' },

  { id: 'css32',
    q: 'Что такое критический CSS и как его правильно доставлять?',
    a: `<p>CSS блокирует рендеринг: браузер не построит render tree, пока не загрузит все не отложенные стили. Критический CSS — минимальный набор правил для above-the-fold контента, встроенный в <code>&lt;style&gt;</code> в <code>&lt;head&gt;</code>, а остальной файл грузится асинхронно.</p>
    <ul><li>Асинхронная загрузка остального: <code>&lt;link rel="stylesheet" media="print" onload="this.media='all'"&gt;</code> или современнее — <code>rel="preload" as="style"</code> плюс переключение, с <code>&lt;noscript&gt;</code>-фолбэком.</li>
    <li>Извлечение автоматизируют (critters, beasties, critical) на этапе сборки или рендеринга, иначе критический CSS протухает при каждом изменении вёрстки.</li>
    <li>Издержки: инлайн не кешируется между страницами, дублируется в каждом HTML и раздувает документ, что ухудшает TTFB и стоимость трафика. При HTTP/2 и хорошем кеше выигрыш часто оказывается меньше, чем ожидают — обязательно измеряйте LCP до и после.</li>
    <li>Более дешёвые альтернативы: разбивать CSS по маршрутам, использовать <code>media</code>-атрибут для некритичных стилей (печать, широкие экраны), и <code>content-visibility: auto</code> для отложенного рендера нижних секций.</li></ul>`,
    code: `<link rel="stylesheet" href="/rest.css" media="print" onload="this.media='all'">`,
    tip: 'Честное «критический CSS не всегда окупается, надо мерить LCP» лучше, чем безусловное одобрение практики.' },

  { id: 'css33',
    q: 'Как вы организуете каскад в дизайн-системе на уровне архитектуры?',
    a: `<p>Ключевая идея — сделать выигрыш правил <strong>предсказуемым по слою</strong>, а не по хитрости селектора. Рабочая схема слоёв:</p>
    <ol><li><code>reset</code> — нормализация, включая импорт чужого reset через <code>layer()</code>.</li>
    <li><code>tokens</code> — примитивные и семантические переменные, темы.</li>
    <li><code>base</code> — типографика и элементы по тегам.</li>
    <li><code>components</code> — дизайн-система; сюда же импортируются сторонние UI-библиотеки, чтобы их специфичность перестала мешать.</li>
    <li><code>overrides</code>/<code>utilities</code> — прикладные исключения и утилиты, выигрывают всегда.</li></ol>
    <p>Дополняющие приёмы:</p>
    <ul><li>Внутри компонента — <code>:where()</code> для базовых стилей, чтобы потребитель мог переопределить одним классом без важности.</li>
    <li><code>@scope</code> или CSS Modules для локализации, <code>isolation: isolate</code> для z-index.</li>
    <li>Публичный контракт кастомизации — набор CSS-переменных компонента, а не «переопредели мой класс»: это единственный способ не сломать пользователей при рефакторинге разметки.</li>
    <li><code>!important</code> запрещён везде, кроме слоя утилит, и это правило проверяется линтером (stylelint).</li></ul>`,
    code: `@layer reset, tokens, base, components, overrides;
@layer components { :where(.btn) { padding: .5rem 1rem } }`,
    tip: 'Тезис «публичный API компонента — это переменные, а не классы» — самый ценный вывод из опыта дизайн-систем.' },

  { id: 'css34',
    q: 'Как правильно сделать тёмную тему?',
    a: `<p>Три уровня, и все три нужны.</p>
    <ul><li><strong>color-scheme</strong>: <code>:root { color-scheme: light dark }</code> сообщает браузеру о поддержке — он сам перекрасит скроллбары, поля форм, чекбоксы и дефолтный фон. Без этого тёмная тема выглядит «полусветлой» в системных контролах.</li>
    <li><strong>Три состояния, а не два</strong>: system (по умолчанию), light, dark. Системное определяется <code>prefers-color-scheme</code>, явный выбор — атрибутом на <code>html</code>. Значит токены надо задать в <code>:root</code>, переопределить в <code>@media (prefers-color-scheme: dark)</code> с защитой <code>:root:not([data-theme='light'])</code> и ещё раз в <code>:root[data-theme='dark']</code>.</li>
    <li><strong>Выбор применяется до первой отрисовки</strong> — синхронным инлайн-скриптом в <code>&lt;head&gt;</code>, иначе получите вспышку белого (FOUC), которая заодно портит впечатление и метрику.</li></ul>
    <p>Дизайнерские детали: тёмная тема — не инверсия. Чистый чёрный на OLED даёт ореолы и утомляет, берут #121212-подобные оттенки; насыщенность акцентов снижают, поскольку яркий цвет на тёмном «вибрирует»; тени не работают — глубину задают более светлой поверхностью. Контраст проверяют отдельно для обеих тем. Функция <code>light-dark()</code> позволяет задать пару значений в одном объявлении.</p>`,
    code: `:root { color-scheme: light dark; --bg: light-dark(#fff, #121212) }`,
    tip: 'Пункт про три состояния (system/light/dark) и инлайн-скрипт против FOUC — самая частая реальная ошибка.' },

  { id: 'css35',
    q: 'Что такое семантическая вёрстка и что она даёт кроме «правильности»?',
    a: `<p>Семантика — использование элементов по смыслу, а не по внешнему виду. Практические выгоды измеримы:</p>
    <ul><li><strong>Доступность</strong>: нативные элементы приносят роль, состояние, клавиатурное поведение и локализованные названия бесплатно. <code>&lt;button&gt;</code> реагирует на Enter/Space, участвует в форме, объявляется как кнопка; <code>&lt;div onclick&gt;</code> не делает ничего из этого без десятка строк кода.</li>
    <li><strong>Навигация screen reader</strong>: пользователи переходят по заголовкам и landmark-регионам (<code>header</code>, <code>nav</code>, <code>main</code>, <code>aside</code>, <code>footer</code>). Один <code>&lt;main&gt;</code> на страницу, заголовки без пропусков уровней.</li>
    <li><strong>SEO и парсеры</strong>: <code>article</code>, <code>time</code>, <code>nav</code>, микроразметка помогают выделять контент; режим чтения в браузерах опирается на семантику.</li>
    <li><strong>Устойчивость</strong>: нативное поведение переживает смену CSS-фреймворка и работает при отключённых стилях.</li></ul>
    <p>Полезные, но малоиспользуемые элементы: <code>&lt;dialog&gt;</code>, <code>&lt;details&gt;/&lt;summary&gt;</code>, <code>&lt;output&gt;</code>, <code>&lt;fieldset&gt;/&lt;legend&gt;</code>, <code>&lt;progress&gt;</code>, <code>&lt;figure&gt;/&lt;figcaption&gt;</code>, <code>&lt;address&gt;</code>. И наоборот — <code>&lt;section&gt;</code> без доступного имени бессмысленен: без <code>aria-labelledby</code> он не становится landmark-ом.</p>`,
    tip: 'Замечание про section без имени — деталь, которую редко знают, а она отличает карго-культ от понимания.' },

  { id: 'css36',
    q: 'Когда нужен ARIA, а когда он вредит? Сформулируйте правила.',
    a: `<p>Первое правило ARIA: <strong>не используйте ARIA</strong>, если задачу решает нативный элемент. Второе: не меняйте нативную семантику (<code>&lt;button role="heading"&gt;</code> — плохо). Третье: все интерактивные ARIA-контролы должны управляться с клавиатуры. Четвёртое: не вешайте <code>role="presentation"</code> или <code>aria-hidden</code> на фокусируемый элемент. Пятое: у всех интерактивных элементов должно быть доступное имя.</p>
    <p>Почему «No ARIA is better than bad ARIA»: неверный атрибут <strong>перекрывает</strong> реальность и вводит пользователя в заблуждение сильнее, чем его отсутствие. Данные WebAIM Million год за годом показывают, что страницы с большим количеством ARIA в среднем имеют <strong>больше</strong> обнаруженных ошибок доступности.</p>
    <ul><li>ARIA меняет только дерево доступности — она не добавляет поведение, фокусируемость и обработку клавиш.</li>
    <li>Частые ошибки: <code>aria-label</code> на неинтерактивном <code>div</code> (игнорируется), дублирование текста в <code>aria-label</code> (ломает распознавание голосом — WCAG 2.5.3 Label in Name), <code>role="button"</code> без <code>tabindex</code> и обработки Space/Enter, <code>aria-hidden="true"</code> на элементе с фокусируемым потомком (создаёт «призрачный» фокус).</li>
    <li>Ценные и оправданные применения: <code>aria-expanded</code>, <code>aria-controls</code>, <code>aria-current</code>, <code>aria-describedby</code> для подсказок и ошибок, <code>aria-live</code>, роли для составных виджетов (combobox, tabs, tree), которых нет в HTML.</li></ul>`,
    tip: 'Ссылка на WebAIM Million («страницы с ARIA имеют больше ошибок») — конкретный факт вместо общих слов.' },

  { id: 'css37',
    q: 'Как вы управляете фокусом в SPA и как делаете focus trap?',
    a: `<p><strong>Навигация в SPA.</strong> При смене маршрута фокус не перемещается сам, и пользователь screen reader остаётся «в старой странице». Решение: после рендера перевести фокус на заголовок нового экрана (<code>tabindex="-1"</code> плюс <code>focus()</code>) либо на контейнер <code>main</code>, и продублировать объявление через live region. Не забыть сбросить скролл и обновить <code>document.title</code>.</p>
    <p><strong>Focus trap</strong> нужен только в модальном контексте: пока диалог открыт, Tab не должен уводить на фон.</p>
    <ul><li>Правильный путь — <code>&lt;dialog&gt;</code> с <code>showModal()</code>: браузер сам делает trap, добавляет <code>::backdrop</code>, помещает элемент в top layer, помечает остальной контент inert и обрабатывает Esc.</li>
    <li>Ручная реализация: запомнить <code>document.activeElement</code>, поставить фокус на первый значимый элемент (не всегда первый фокусируемый — часто это заголовок или поле), перехватывать Tab/Shift+Tab на краях, скрывать фон атрибутом <code>inert</code> (он лучше <code>aria-hidden</code>, потому что заодно убирает кликабельность и фокус), а при закрытии <strong>вернуть фокус на триггер</strong>.</li>
    <li>Trap — барьер, если он неправильный: нет выхода по Esc, нет возврата фокуса, ловушка на немодальном элементе (дропдаун, тултип) — всё это делает страницу непроходимой.</li></ul>
    <p>И общее правило: никогда не убирайте <code>outline</code> без замены; используйте <code>:focus-visible</code>, чтобы кольцо появлялось при клавиатуре, но не при мыши.</p>`,
    code: `dialog::backdrop { background: rgb(0 0 0 / .5) }
:focus-visible { outline: 2px solid; outline-offset: 2px }`,
    tip: 'Атрибут inert как замена aria-hidden для фона модалки — современная и правильная деталь.' },

  { id: 'css38',
    q: 'Что такое skip links и как выстроить клавиатурную навигацию?',
    a: `<p>Skip link — первая ссылка в DOM, ведущая на <code>#main</code>: она позволяет пропустить повторяющуюся навигацию (WCAG 2.4.1 Bypass Blocks). Её прячут визуально, но <strong>не</strong> через <code>display: none</code> — иначе она недоступна и с клавиатуры; используют смещение или класс visually-hidden, а на <code>:focus</code> показывают.</p>
    <p>Клавиатурная навигация в целом:</p>
    <ul><li>Порядок таба идёт по DOM, а не по визуальному расположению — поэтому <code>order</code> во flex и перестановка areas в grid создают «прыгающий» фокус (WCAG 2.4.3 Focus Order).</li>
    <li><code>tabindex="0"</code> — включить в порядок; <code>tabindex="-1"</code> — фокусируемо только программно; положительные значения — антипаттерн, ломающий весь порядок на странице.</li>
    <li>Составные виджеты используют <strong>roving tabindex</strong> или <code>aria-activedescendant</code>: в табах, меню, тулбарах и гридах Tab входит и выходит из виджета, а стрелки перемещают внутри — так требует APG.</li>
    <li>Обязательные проверки: видимое кольцо фокуса везде (WCAG 2.4.7, а 2.4.11 в WCAG 2.2 добавляет требования к его непере­крытости липкими шапками), отсутствие клавиатурных ловушек, доступность всего, что доступно мышью.</li>
    <li>Быстрый ручной тест: пройти всю страницу Tab-ом, не касаясь мыши, и выполнить основной сценарий.</li></ul>`,
    code: `.skip { position: absolute; inset-block-start: -100% }
.skip:focus { inset-block-start: 0 }`,
    tip: 'Roving tabindex и требование WCAG 2.2 про не перекрытый липкой шапкой фокус — свежая и конкретная деталь.' },

  { id: 'css39',
    q: 'Как работают screen readers и как правильно использовать aria-live?',
    a: `<p>Screen reader читает не DOM, а <strong>дерево доступности</strong>, которое браузер строит из семантики, ARIA и вычисленного стиля (<code>display: none</code> и <code>visibility: hidden</code> убирают элемент из дерева). Пользователь перемещается по заголовкам, landmark-ам, ссылкам и формам, а не только табом.</p>
    <p><code>aria-live</code> объявляет динамические изменения, к которым фокус не переходит:</p>
    <ul><li><code>polite</code> — дождётся паузы; <code>assertive</code> — прервёт речь немедленно (только для критичного: потеря соединения, ошибка отправки). Роли <code>status</code> (= polite) и <code>alert</code> (= assertive) обычно предпочтительнее.</li>
    <li>Контейнер live region должен <strong>существовать в DOM заранее</strong> и быть пустым: если добавить элемент с <code>aria-live</code> и текстом одновременно, многие SR ничего не объявят.</li>
    <li><code>aria-atomic="true"</code> читает регион целиком, иначе — только изменённую часть. <code>aria-relevant</code> почти всегда оставляют по умолчанию.</li>
    <li>Частые ошибки: слишком частые обновления (например, live-таблица на каждый тик) — это заглушает пользователя; для таких случаев объявляют агрегированно и с задержкой («обновлено 12 строк»). И наоборот, для результатов поиска <code>role="status"</code> с текстом «найдено 42 результата» очень помогает.</li>
    <li>Тестировать нужно в реальных парах: NVDA+Firefox, JAWS+Chrome, VoiceOver+Safari — поведение заметно различается.</li></ul>`,
    code: `<div role="status" aria-live="polite" class="sr-only"></div>`,
    tip: 'Требование «регион должен существовать заранее» — причина №1, почему aria-live «не работает».' },

  { id: 'css40',
    q: 'Как считается контраст и какие уровни WCAG нужно знать?',
    a: `<p>Контраст в WCAG 2.x — отношение относительных яркостей, от 1:1 до 21:1. Пороги: <strong>AA</strong> — 4.5:1 для обычного текста, 3:1 для крупного (от 18pt или 14pt жирного) и для нетекстовых элементов (границы полей, иконки-контролы, состояние фокуса — критерий 1.4.11). <strong>AAA</strong> — 7:1 и 4.5:1 соответственно.</p>
    <ul><li>Уровни: A — минимум, AA — практический стандарт и требование большинства регуляторов (в ЕС — EN 301 549 и European Accessibility Act, действующий с июня 2025), AAA — не считается достижимым для всего сайта целиком.</li>
    <li>WCAG 2.1 добавил мобильные и когнитивные критерии, WCAG 2.2 (2023) — Focus Not Obscured, Target Size (минимум 24×24 CSS-пикселя), Dragging Movements, Consistent Help, Accessible Authentication.</li>
    <li>Формула WCAG 2.x известна своей неточностью для тёмных тем — она переоценивает контраст светлого текста на тёмном фоне. В WCAG 3 разрабатывается APCA, учитывающая полярность и толщину шрифта; на неё уже стоит смотреть при проектировании тёмной темы, но формальный аудит по-прежнему по 2.x.</li>
    <li>Исключения: логотипы и декоративный текст, а также отключённые контролы.</li>
    <li>Контраст — только часть: нельзя передавать смысл одним цветом (1.4.1), нужен ещё текст, иконка или паттерн.</li></ul>`,
    tip: 'Знание про APCA и про недооценку контраста в тёмной теме — очень свежий и предметный аргумент.' },

  { id: 'css41',
    q: 'Как сделать доступную форму и правильно показать ошибки валидации?',
    a: `<p>Основа — программная связь между полем и его подписью, подсказкой и ошибкой.</p>
    <ul><li><code>&lt;label for&gt;</code> или обёртка; <code>placeholder</code> <strong>не</strong> подпись — он исчезает при вводе, имеет низкий контраст и не читается частью SR.</li>
    <li>Подсказка и ошибка связываются через <code>aria-describedby</code> (можно перечислить несколько id). Само поле помечается <code>aria-invalid="true"</code>.</li>
    <li>Группы радио и чекбоксов оборачиваются в <code>&lt;fieldset&gt;</code> с <code>&lt;legend&gt;</code> — иначе SR не сообщит вопрос, к которому относятся варианты.</li>
    <li><code>autocomplete</code> с корректными токенами (<code>email</code>, <code>one-time-code</code>, <code>street-address</code>) — это WCAG 1.3.5 и одновременно заметный рост конверсии.</li></ul>
    <p><strong>Ошибки</strong>: показывать текстом рядом с полем (не только красной рамкой — 1.4.1), объяснять как исправить (3.3.3), а не «поле неверно». При отправке — сводка ошибок вверху формы с ссылками на поля, фокус переводится на неё; либо фокус на первое ошибочное поле. Валидировать на <code>blur</code>, а не на каждый символ (иначе SR тараторит), и использовать <code>:user-invalid</code> вместо <code>:invalid</code>, чтобы пустая нетронутая форма не была красной.</p>`,
    code: `<label for="mail">Email</label>
<input id="mail" type="email" autocomplete="email"
       aria-describedby="mail-err" aria-invalid="true">
<p id="mail-err">Введите адрес в формате name@site.ru</p>`,
    tip: 'Пара :user-invalid вместо :invalid и валидация на blur — практичные детали, которые сразу видно.' },

  { id: 'css42',
    q: 'Как сделать доступную модалку и доступную таблицу данных?',
    a: `<p><strong>Модалка.</strong> Берём <code>&lt;dialog&gt;</code> и <code>showModal()</code>: получаем top layer (никаких z-index-войн), <code>::backdrop</code>, inert для остального документа, focus trap, закрытие по Esc и корректную роль <code>dialog</code> с <code>aria-modal</code>. Остаётся: дать доступное имя (<code>aria-labelledby</code> на заголовок), поставить фокус осмысленно, вернуть его на триггер после закрытия, обработать клик по backdrop вручную (нативно его нет) и учесть, что <code>&lt;form method="dialog"&gt;</code> закрывает диалог с <code>returnValue</code>. Для немодальных всплывашек — Popover API с <code>popover</code> и <code>popovertarget</code>, у него light dismiss из коробки.</p>
    <p><strong>Таблица.</strong></p>
    <ul><li>Настоящий <code>&lt;table&gt;</code> с <code>&lt;caption&gt;</code>, <code>&lt;thead&gt;</code>, <code>&lt;th scope="col|row"&gt;</code>. Без scope SR не сможет озвучить, к какому столбцу относится ячейка.</li>
    <li>Сортировка: <code>&lt;th aria-sort="ascending|descending|none"&gt;</code> и кнопка внутри <code>th</code>, а не обработчик на <code>th</code>.</li>
    <li>Никогда не ломайте таблицу через <code>display: flex/grid/block</code> на адаптиве — это стирает семантику таблицы; используйте обёртку со скроллом (<code>overflow: auto</code>, <code>tabindex="0"</code> и доступное имя, чтобы область прокручивалась с клавиатуры) или карточную разметку с другой семантикой.</li>
    <li>Для виртуализированных гридов — роль <code>grid</code>, <code>aria-rowcount</code>/<code>aria-rowindex</code>, roving tabindex; иначе SR видит только отрендеренные строки.</li></ul>`,
    code: `<dialog id="d" aria-labelledby="t">
  <h2 id="t">Подтверждение</h2>
  <form method="dialog"><button value="ok">ОК</button></form>
</dialog>`,
    tip: 'Указание, что display на table стирает её семантику, — частая и дорогая ошибка адаптивных таблиц.' },

  { id: 'css43',
    q: 'Что фронтендер обязан знать про SEO?',
    a: `<p>Google рендерит JS, но во вторую волну и с задержкой; Yandex и социальные краулеры делают это хуже или не делают вовсе. Отсюда основное: критичный для индексации контент должен быть в HTML ответа — SSR, SSG или пререндер.</p>
    <ul><li><strong>Уникальные</strong> <code>&lt;title&gt;</code> и <code>meta description</code> на каждый маршрут, один <code>&lt;h1&gt;</code>, осмысленная иерархия заголовков.</li>
    <li><code>&lt;link rel="canonical"&gt;</code> против дублей от query-параметров, <code>hreflang</code> для локалей, <code>robots.txt</code> и <code>sitemap.xml</code>; <code>meta robots noindex</code> для служебных страниц.</li>
    <li>Ссылки — настоящими <code>&lt;a href&gt;</code>: <code>div</code> с <code>onClick</code> и <code>router.push</code> краулер не пройдёт. Пагинация и фасеты должны иметь реальные URL.</li>
    <li>Структурированные данные JSON-LD (Product, Article, BreadcrumbList, FAQ) — они дают расширенные сниппеты.</li>
    <li>Core Web Vitals — фактор ранжирования (page experience), причём измеряются полевые данные CrUX, а не Lighthouse.</li>
    <li>Изображения: <code>alt</code>, осмысленные имена файлов, <code>loading="lazy"</code> для нижних (но <strong>не</strong> для LCP-картинки).</li>
    <li>Мобильная версия — основа индексации (mobile-first indexing): контент, скрытый на мобильном, фактически не индексируется.</li></ul>`,
    tip: 'Разделение «Google рендерит JS во вторую волну, соцсети и часть краулеров — нет» точно объясняет, зачем SSR.' },

  { id: 'css44',
    q: 'Какие мета-теги и Open Graph нужны и как работает предпросмотр ссылок?',
    a: `<p>Обязательный минимум в <code>&lt;head&gt;</code>: <code>&lt;meta charset="utf-8"&gt;</code> (в первых 1024 байтах, иначе браузер перезапустит парсинг), <code>&lt;meta name="viewport" content="width=device-width, initial-scale=1"&gt;</code> — без него мобильные показывают десктопную ширину; при этом <strong>нельзя</strong> писать <code>maximum-scale=1</code> или <code>user-scalable=no</code>, это нарушает WCAG 1.4.4.</p>
    <ul><li><code>theme-color</code> (можно с <code>media</code> для светлой/тёмной), <code>color-scheme</code>.</li>
    <li><strong>Open Graph</strong>: <code>og:title</code>, <code>og:description</code>, <code>og:image</code> (абсолютный URL, 1200×630, до нескольких МБ), <code>og:url</code>, <code>og:type</code>, <code>og:locale</code>. Для X — <code>twitter:card="summary_large_image"</code>.</li>
    <li>Ключевой момент: краулеры соцсетей и мессенджеров <strong>не выполняют JavaScript</strong>. Теги, добавленные React Helmet на клиенте, в предпросмотре не появятся — нужен SSR или генерация на уровне edge/функции.</li>
    <li>Второй момент — <strong>агрессивное кеширование</strong> у Facebook, Telegram, VK: после изменения og-тегов превью не обновится, пока не сбросить кеш через отладчик платформы или не поменять URL.</li>
    <li>Динамические OG-картинки удобно генерировать на edge (Satori/@vercel/og) — это стандартная практика для блогов и товаров.</li></ul>`,
    code: `<meta property="og:image" content="https://site.ru/og/post-1.png">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#111">`,
    tip: 'Замечание про кеш превью в Telegram/Facebook — то, с чем сталкивался каждый, кто это делал в проде.' },

  { id: 'css45',
    q: 'Чем вёрстка писем отличается от вёрстки сайтов?',
    a: `<p>Почтовые клиенты — это десятки разных рендереров без единого стандарта. Outlook на Windows использует движок <strong>Word</strong>, Gmail вырезает <code>&lt;style&gt;</code> в части случаев и не поддерживает внешние ресурсы, мобильные клиенты масштабируют по-своему.</p>
    <ul><li>Раскладка — вложенные <code>&lt;table&gt;</code> с <code>role="presentation"</code> (иначе SR прочитает их как таблицы данных); flex и grid в Outlook не работают, поддержка неравномерна везде.</li>
    <li>Стили инлайнят в атрибут <code>style</code> автоматическим инлайнером; <code>&lt;style&gt;</code> в head оставляют как прогрессивное улучшение (медиазапросы, тёмная тема).</li>
    <li>Ширина 600–640px, картинки с абсолютными URL, обязательный <code>alt</code> (у многих изображения выключены по умолчанию), фоновые изображения в Outlook требуют VML.</li>
    <li>Обязательны текстовая версия письма, <code>lang</code>, осмысленный порядок чтения и preheader-текст.</li>
    <li>Тестирование только на реальных клиентах — Litmus/Email on Acid; локальный браузер ничего не доказывает. Практически всегда разумнее взять MJML или готовый фреймворк, чем писать таблицы руками.</li></ul>`,
    tip: 'Упоминание, что Outlook рендерит движком Word, — короткий факт, который объясняет всю специфику сразу.' }
];
