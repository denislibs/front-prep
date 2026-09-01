const DECK_JS_EXTRA = [
  { id: 'jsx1',
    q: 'Опиши один полный «оборот» event loop в браузере: где именно в нём находится requestAnimationFrame относительно задач и микрозадач?',
    a: `<h4>Коротко</h4>
    <p>Оборот цикла — это одна макрозадача, затем полный дренаж очереди микрозадач, затем, если браузер решил рисовать кадр, шаг «update the rendering». <code>requestAnimationFrame</code> не задача и не микрозадача: это отдельная фаза внутри рендер-шага, прямо перед вычислением стилей и layout.</p>

    <h4>Как это работает</h4>
    <p>По спецификации HTML один оборот выглядит так. Браузер выбирает одну из task-очередей (таймеры, события ввода, сеть, парсер) и берёт из неё <strong>ровно одну</strong> задачу. Выполняет её до конца. Дальше — microtask checkpoint: очередь микрозадач опустошается целиком, включая микрозадачи, порождённые внутри других микрозадач.</p>
    <p>Затем браузер решает, нужен ли кадр. Обычно решение привязано к vsync дисплея — примерно раз в 16.7 мс на 60 Гц и раз в 8.3 мс на 120 Гц; если вкладка скрыта или ничего не изменилось, кадра не будет. Если кадр нужен, идёт «update the rendering»: сначала диспатчатся отложенные <code>resize</code> и <code>scroll</code>, пересчитываются media queries, затем вызываются <strong>все</strong> зарегистрированные rAF-колбэки, затем колбэки <code>ResizeObserver</code> и <code>IntersectionObserver</code>, и только потом style, layout, paint, composite. После каждого колбэка снова дренируются микрозадачи.</p>
    <p>Остаток кадра, если он есть, достаётся <code>requestIdleCallback</code> — то есть уже <strong>после</strong> paint.</p>

    <h4>Почему так</h4>
    <p>Отрисовка стоит дорого и привязана к физической частоте экрана, поэтому рисовать после каждой задачи бессмысленно — пользователь всё равно не увидит промежуточные кадры. Микрозадачи, наоборот, задуманы как «доделать начатую логическую операцию», поэтому их дренируют целиком: наблюдатель не должен увидеть половинчатое состояние. rAF выделен в отдельную фазу ровно затем, чтобы дать точку, где DOM уже можно менять, а layout ещё не считался — мутация тут не вызовет лишнего пересчёта.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>setTimeout(fn, 0)</code> может отработать несколько раз подряд без единой перерисовки — «анимация» на таймерах пропускает кадры и дёргается.</li>
      <li>На фоновой вкладке rAF замораживается полностью, а <code>setTimeout</code> троттлится до одного раза в секунду: счётчики и прогресс-бары на rAF «замирают» и потом прыгают.</li>
      <li>Чтение геометрии (<code>offsetHeight</code>, <code>getBoundingClientRect</code>) после записи в стиль внутри одного rAF даёт forced synchronous layout — лечится разделением на фазы read и write.</li>
      <li>Микрозадача, запланированная внутри rAF, выполнится до paint, поэтому тяжёлый <code>.then</code> в rAF затягивает кадр так же, как синхронный код.</li>
      <li>Все rAF-колбэки одного кадра получают <strong>одинаковый</strong> timestamp; использовать вместо него <code>performance.now()</code> — верный способ получить рассинхрон анимаций.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Где здесь requestIdleCallback?»</strong> — после paint, в остатке кадра, с объектом <code>deadline</code> и <code>timeRemaining()</code>; гарантий вызова нет, поэтому всегда задают <code>timeout</code>. <strong>«Сколько раз за кадр вызовется rAF?»</strong> — ровно один раз для каждого зарегистрированного колбэка; колбэк, зарегистрированный <strong>внутри</strong> rAF, попадёт уже в следующий кадр, и на этом строятся циклы анимации. <strong>«Почему анимацию не делают на setTimeout?»</strong> — таймер не синхронизирован с vsync, поэтому кадры то дублируются, то пропускаются, а на 120 Гц картинка дёргается заметнее всего.`,
    code: `// антипаттерн: чередование записи и чтения -> layout thrashing
requestAnimationFrame(() => {
  for (const el of items) {
    el.style.width = '100px';
    console.log(el.offsetHeight);   // форсирует layout на каждой итерации
  }
});

// правильно: сначала все чтения, потом все записи
requestAnimationFrame(() => {
  const heights = items.map(el => el.offsetHeight);  // read
  for (let i = 0; i < items.length; i++) {
    items[i].style.height = heights[i] * 2 + 'px';   // write
  }
});`,
    tip: 'Скажите вслух, что requestIdleCallback идёт после paint, а rAF — до, и что на фоновой вкладке rAF замораживается, а setTimeout только троттлится до 1 раза в секунду.' },

  { id: 'jsx2',
    q: 'Что такое microtask starvation и как безопасно разбивать длинную работу, не заморозив UI?',
    a: `<h4>Коротко</h4>
    <p>Очередь микрозадач дренируется до конца, а не по одной. Если микрозадача планирует новую микрозадачу, цикл никогда не дойдёт до рендера: вкладка живая, но не перерисовывается и не отвечает на ввод. Чтобы отдать управление браузеру, нужна <strong>макро</strong>задача, а не микрозадача.</p>

    <h4>Как это работает</h4>
    <p>Microtask checkpoint выполняется в цикле <code>while (queue.length)</code>. Рекурсивный <code>queueMicrotask</code> или бесконечная цепочка <code>.then</code> держат очередь непустой, поэтому шаг «update the rendering» не наступает никогда — это и есть starvation. Симптом характерный: CPU занят на 100%, но профайлер показывает не один long task, а сплошную полосу без кадров.</p>
    <p>Выход из блокировки даёт только возврат в event loop через новую задачу. Варианты по возрастанию качества: <code>setTimeout(fn, 0)</code> — работает везде, но после пятого вложенного вызова браузер зажимает задержку до 4 мс, то есть на разбиении в 1000 чанков вы теряете 4 секунды на пустом месте. <code>MessageChannel</code> — та же макрозадача без клампинга, классический трюк из React Scheduler. <code>scheduler.postTask(fn, { priority })</code> — три приоритета (<code>user-blocking</code>, <code>user-visible</code>, <code>background</code>) и отменяемость через <code>AbortSignal</code>. <code>await scheduler.yield()</code> — самый точный инструмент: отдаёт управление, но возвращает продолжение с <strong>повышенным</strong> приоритетом, поэтому вашу работу не оттеснят фоновые задачи.</p>
    <p>Разбивать нужно <strong>по времени, а не по количеству элементов</strong>: обрабатываем пачку, смотрим на <code>performance.now()</code>, и как только съели бюджет (обычно 5 мс), уступаем. Иначе на медленном устройстве «чанк по 100 элементов» превращается в тот же long task.</p>

    <h4>Почему так</h4>
    <p>Разделение на две очереди сделано намеренно: микрозадачи гарантируют, что состояние досчитается до того, как кто-то его увидит, — на этом держатся промисы и <code>MutationObserver</code>. Цена — отсутствие точки выхода. Макрозадача, наоборот, честно возвращает управление, но платит задержкой планирования и потерей «атомарности» — между чанками пользователь может успеть нажать кнопку и увидеть частично обработанные данные.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>await</code> внутри цикла НЕ отдаёт управление рендеру, если промис уже резолвлен: это по-прежнему микрозадача.</li>
      <li>Разбиение по счётчику (<code>if (i % 100 === 0)</code>) не переживает разницу устройств: тот же код на бюджетном Android даёт задачи по 300 мс.</li>
      <li>Слишком мелкие чанки тоже вредны — накладные расходы на планирование съедают выигрыш, а INP не улучшается.</li>
      <li><code>scheduler.yield</code> и <code>postTask</code> есть не везде, поэтому нужен фолбэк; проверять надо наличие метода, а не браузер.</li>
      <li>Если работа не трогает DOM, chunking на главном потоке — полумера: правильный ответ Worker.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Почему не setInterval?»</strong> — он не ждёт завершения предыдущего чанка и на медленном устройстве очередь колбэков растёт лавиной. <strong>«Как измерить, что стало лучше?»</strong> — <code>PerformanceObserver</code> на <code>longtask</code> и <code>long-animation-frame</code> плюс поле INP в CrUX; синтетический замер длительности функции ничего не говорит о том, успел ли кадр.</p>`,
    code: `async function processAll(items, work, signal) {
  const BUDGET = 5;
  let start = performance.now();
  for (let i = 0; i < items.length; i++) {
    signal && signal.throwIfAborted();
    work(items[i]);
    if (performance.now() - start > BUDGET) {
      await yieldToBrowser();
      start = performance.now();
    }
  }
}

function yieldToBrowser() {
  if (globalThis.scheduler && scheduler.yield) return scheduler.yield();
  return new Promise(resolve => {
    const ch = new MessageChannel();      // без 4ms clamping
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });
}`,
    tip: 'Отдельные очки: сказать, что await сам по себе НЕ отдаёт управление рендеру, если промис резолвится синхронно — это всё ещё микрозадача, и цикл с await остаётся long task.' },

  { id: 'jsx3',
    q: 'Что такое long task, как он связан с INP и где тут requestIdleCallback?',
    a: `<h4>Коротко</h4>
    <p>Long task — задача главного потока длиннее 50 мс. Пока она идёт, браузер не обрабатывает ввод и не рисует кадр, поэтому long tasks напрямую портят INP. <code>requestIdleCallback</code> — способ выполнить неприоритетную работу в остатке кадра, уже после paint, и без гарантий вызова.</p>

    <h4>Как это работает</h4>
    <p>INP (Interaction to Next Paint) измеряет самое медленное взаимодействие на странице и складывается из трёх частей: <strong>input delay</strong> — сколько ввод ждал, пока освободится поток; <strong>processing time</strong> — сколько работали обработчики; <strong>presentation delay</strong> — сколько заняли style, layout, paint до появления кадра. Порог «хорошо» — 200 мс на 75-м перцентиле, «плохо» — свыше 500 мс. Long task бьёт по первой и третьей части: даже идеально быстрый обработчик клика ничего не даст, если поток занят чужой задачей на 300 мс.</p>
    <p>Диагностика идёт через <code>PerformanceObserver</code>. Тип <code>longtask</code> даёт только длительность и очень общий <code>attribution</code>. Тип <code>long-animation-frame</code> (LoAF) намного полезнее: он описывает весь затянувшийся кадр — <code>renderStart</code>, <code>styleAndLayoutStart</code>, <code>blockingDuration</code> и массив <code>scripts</code> с <code>sourceURL</code>, <code>invoker</code> и <code>forcedStyleAndLayoutDuration</code>. То есть видно не «где-то было медленно», а какой именно обработчик и сколько времени потратил на форсированный layout.</p>
    <p><code>requestIdleCallback</code> получает <code>deadline</code> с <code>timeRemaining()</code> (максимум 50 мс) и флагом <code>didTimeout</code>. Он подходит для аналитики, префетча, прогрева кешей и отправки логов.</p>

    <h4>Почему так</h4>
    <p>50 мс выбраны не случайно: при бюджете отклика в 100 мс (порог «мгновенности» по RAIL) половина отдаётся на то, чтобы поток вообще освободился. Idle-колбэки существуют, потому что «сделать потом» безопаснее, чем «сделать сейчас и подвесить кадр», но платой становится непредсказуемость: при загруженном потоке idle-колбэк может не вызваться минутами, поэтому <code>timeout</code> обязателен.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Мемоизация редко чинит INP: чаще виновата не React-перерисовка, а сторонний скрипт, синхронный <code>localStorage</code> или парсинг большого JSON в обработчике.</li>
      <li><code>requestIdleCallback</code> не поддержан в Safari до недавнего времени и его часто полифиллят через <code>setTimeout</code>, что убивает всю семантику — «idle» превращается в «сразу».</li>
      <li>Работа в idle-колбэке тоже может стать long task: <code>timeRemaining()</code> надо проверять внутри цикла, а не один раз на входе.</li>
      <li>Обновление DOM внутри idle-колбэка вызовет layout уже вне кадра и часто выглядит как мигание.</li>
      <li>Долгий обработчик <code>pointerdown</code> портит INP того взаимодействия, которое пользователь ещё даже не завершил.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как быстро починить INP на конкретной кнопке?»</strong> — правило «сначала покажи, потом досчитывай»: синхронно отрисовать оптимистичный результат, дождаться paint через <code>rAF</code> + <code>setTimeout</code>, и только затем делать тяжёлую работу. <strong>«Чем LoAF лучше longtask?»</strong> — он привязан к кадру, а не к задаче, и показывает виновный скрипт с URL, поэтому по нему можно завести тикет, а не «оптимизировать вообще». <strong>«INP заменил FID — что изменилось?»</strong> — FID мерил только задержку до начала обработки, поэтому «быстрый» обработчик с медленным рендером выглядел хорошо; INP мерит весь путь до кадра.`,
    code: `new PerformanceObserver(list => {
  for (const e of list.getEntries()) {
    if (e.blockingDuration < 50) continue;
    report('loaf', {
      duration: e.duration,
      blocking: e.blockingDuration,
      layout: e.styleAndLayoutStart - e.renderStart,
      scripts: e.scripts.map(s => s.sourceURL + ':' + s.duration)
    });
  }
}).observe({ type: 'long-animation-frame', buffered: true });

// покажи результат до того, как считать
button.onclick = () => {
  setPending(true);                                   // мгновенный отклик
  requestAnimationFrame(() => setTimeout(heavyWork)); // после paint
};`,
    tip: 'Назовите числа: INP «хорошо» до 200 мс на p75, long task — от 50 мс. Кандидат, который говорит про метрики без порогов, звучит так, будто читал заголовки статей.' },

  { id: 'jsx4',
    q: 'Чем отличаются queueMicrotask, Promise.resolve().then, process.nextTick и MutationObserver как способы отложить код?',
    a: `<h4>Коротко</h4>
    <p>Все четыре планируют работу на микрозадачу, но у них разная цена, разная обработка ошибок и — в Node — разный приоритет. Для «просто отложить на тик» правильный выбор <code>queueMicrotask</code>; <code>process.nextTick</code> живёт в отдельной очереди с более высоким приоритетом, а <code>MutationObserver</code> сегодня остался только как API наблюдения за DOM.</p>

    <h4>Как это работает</h4>
    <p><code>queueMicrotask(fn)</code> кладёт колбэк прямо в очередь микрозадач, без создания промиса и без аллокации цепочки. Исключение из него всплывает как обычная необработанная ошибка — в браузере это <code>window.onerror</code> и <code>error</code>-событие, в Node это <code>uncaughtException</code>.</p>
    <p><code>Promise.resolve().then(fn)</code> делает то же самое, но создаёт как минимум один промис и одну реакцию, а исключение превращает в <strong>отклонение</strong> результирующего промиса. Если этот промис никто не держит, ошибка станет unhandled rejection и легко потеряется в логах. Дополнительный нюанс: если резолвить промис <strong>другим</strong> промисом или thenable, раскрутка стоит лишних тиков — отсюда неожиданный порядок логов в задачах на event loop.</p>
    <p>В Node <code>process.nextTick</code> — <strong>отдельная</strong> очередь, которая дренируется полностью <strong>перед</strong> очередью промисов, и делает это после каждой фазы event loop, а не только между макрозадачами. Изначально она была нужна, чтобы дать пользователю навесить обработчики до того, как объект начнёт эмитить события.</p>
    <p><code>MutationObserver</code> доставляет записи как микрозадачу и батчит их: несколько мутаций подряд дадут один вызов со списком записей. До появления <code>queueMicrotask</code> его использовали как кроссбраузерный полифилл микрозадачи — сегодня это только исторический факт.</p>

    <h4>Почему так</h4>
    <p>Разные очереди — это разные контракты. Промисы обязаны быть безопасными: ошибка не должна ронять процесс, поэтому она заворачивается в rejection. <code>queueMicrotask</code>, наоборот, задуман как «низкоуровневый примитив без семантики значения», поэтому не глотает ошибки. <code>nextTick</code> с более высоким приоритетом даёт Node возможность гарантированно вклиниться перед пользовательскими промисами — но той же ценой он способен заморить их голодом.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Рекурсивный <code>process.nextTick</code> не даёт event loop выйти в фазу I/O — сервер перестаёт принимать соединения при 0% простоя.</li>
      <li>Ошибка внутри <code>.then</code>-микрозадачи может тихо исчезнуть, если результат цепочки нигде не обрабатывается.</li>
      <li>Использовать <code>Promise.resolve().then</code> ради отложенности в горячем коде дороже, чем <code>queueMicrotask</code>: лишние аллокации и давление на GC.</li>
      <li>Микрозадача не даёт браузеру перерисоваться, поэтому «отложу через <code>Promise.resolve()</code>, чтобы UI успел обновиться» не работает.</li>
      <li>В Node у <code>queueMicrotask</code> и промисов одна очередь, а у <code>setImmediate</code> — своя фаза check, которая идёт после I/O; путать их — классика.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Что выведет nextTick вперемешку с промисами?»</strong> — все <code>nextTick</code> в порядке постановки, затем все микрозадачи промисов. <strong>«Чем setImmediate отличается от setTimeout(0) в Node?»</strong> — <code>setImmediate</code> выполняется в фазе check текущего оборота, <code>setTimeout(0)</code> — в фазе timers следующего; из основного модуля их порядок недетерминирован, а внутри I/O-колбэка <code>setImmediate</code> всегда первый.</p>`,
    code: `// Node
process.nextTick(() => console.log('nextTick 1'));
Promise.resolve().then(() => console.log('promise'));
queueMicrotask(() => console.log('qmt'));
process.nextTick(() => console.log('nextTick 2'));
// nextTick 1, nextTick 2, promise, qmt

// ошибка не теряется
queueMicrotask(() => { throw new Error('viden'); });   // uncaughtException

// ошибка превращается в unhandled rejection
Promise.resolve().then(() => { throw new Error('tiho'); });`,
    tip: 'Скажите, что для «просто отложить на микрозадачу» правильный выбор — queueMicrotask, потому что он не превращает баг в unhandled rejection и не аллоцирует промис.' },

  { id: 'jsx5',
    q: 'Зачем нужны Symbol, если есть строковые ключи? И чем Symbol() отличается от Symbol.for()?',
    a: `<h4>Коротко</h4>
    <p>Symbol — примитив, гарантированно уникальный: два <code>Symbol('id')</code> никогда не равны. Он даёт ключ, который не столкнётся с чужим и не попадёт в перечисление и сериализацию. <code>Symbol()</code> создаёт новый символ каждый раз, <code>Symbol.for()</code> берёт его из глобального реестра по строке.</p>

    <h4>Как это работает</h4>
    <p>Символьное свойство — полноценное свойство объекта, но оно невидимо для «строковых» операций: <code>for...in</code>, <code>Object.keys</code>, <code>Object.values</code>, <code>JSON.stringify</code> и spread его не увидят. Достать его можно только через <code>Object.getOwnPropertySymbols</code> или <code>Reflect.ownKeys</code>. Поэтому символ — это «полускрытый», а не приватный ключ.</p>
    <p><code>Symbol.for('app.meta')</code> обращается к <strong>глобальному реестру символов</strong>, общему для всех realm одного агента — включая iframes с тем же процессом и, что важнее, разные копии одной библиотеки в бандле. Один и тот же строковый ключ всегда даёт один и тот же символ, а <code>Symbol.keyFor(sym)</code> возвращает строку обратно (для символов не из реестра — <code>undefined</code>). Именно так React помечает элементы: <code>Symbol.for('react.element')</code> переживает дублирование пакета в node_modules, тогда как обычный <code>Symbol()</code> из двух копий модуля дал бы два разных значения.</p>
    <p>Описание символа доступно через <code>sym.description</code> (ES2019) и участвует только в отладке — на равенство оно не влияет.</p>

    <h4>Почему так</h4>
    <p>Задача, которую решает Symbol, — <strong>расширение чужих объектов без конфликтов</strong>. Библиотека хочет положить служебные данные в объект пользователя и быть уверенной, что не перетрёт поле <code>_meta</code>, что оно не улетит в JSON на сервер и не сломает цикл по ключам. Строковый ключ такой гарантии не даёт никогда, каким бы длинным он ни был. Цена — символы нельзя сериализовать: они не переживают <code>JSON.stringify</code>, <code>structuredClone</code> и <code>postMessage</code>.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Symbol — не приватность. <code>Reflect.ownKeys</code> и любой отладчик покажут ключ; для настоящей приватности нужны <code>#</code>-поля.</li>
      <li>Неявное приведение к строке бросает <code>TypeError</code>: <code>sym + ''</code> падает, работает только явный <code>String(sym)</code> и шаблонный литерал тоже падает.</li>
      <li>Символьные ключи теряются при клонировании: <code>structuredClone</code> их выбрасывает молча, что превращается в «данные исчезли при передаче в воркер».</li>
      <li>Реестр <code>Symbol.for</code> глобален и никогда не очищается — по сути утечка, поэтому туда кладут константы протоколов, а не пользовательские ключи.</li>
      <li>Symbol нельзя использовать как ключ в <code>WeakMap</code> до недавнего времени (symbols-as-weakmap-keys) — старые движки бросят <code>TypeError</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сериализовать объект с символьными ключами?»</strong> — только вручную: перечислить через <code>getOwnPropertySymbols</code> и отобразить на строки; автоматики нет и не будет. <strong>«Зачем React использует Symbol.for, а не Symbol?»</strong> — чтобы проверка <code>element.$$typeof</code> работала между разными копиями React и заодно защищала от XSS: JSON не может содержать символ, поэтому подставленный из сети «элемент» не пройдёт проверку. <strong>«Можно ли использовать Symbol как ключ enum?»</strong> — да, и это защищает от случайного сравнения со строкой, но такой enum не сериализуется и не переживает передачу между воркерами.`,
    code: `const meta = Symbol('meta');
const user = { name: 'Ann', [meta]: { dirty: true } };

JSON.stringify(user);                // '{"name":"Ann"}'
Object.keys(user);                   // ['name']
Object.getOwnPropertySymbols(user);  // [Symbol(meta)]
structuredClone(user)[meta];         // undefined — символ потерян

Symbol('a') === Symbol('a');          // false
Symbol.for('a') === Symbol.for('a');  // true — глобальный реестр
Symbol.keyFor(Symbol.for('a'));       // 'a'
Symbol.keyFor(Symbol('a'));           // undefined`,
    tip: 'Упомяните, что Symbol нельзя неявно привести к строке: String(sym) работает, а sym + \'\' бросает TypeError — это спасает от случайной конкатенации, но ломает наивное логирование.' },

  { id: 'jsx6',
    q: 'Какие well-known symbols ты реально применял и что они меняют в поведении объекта?',
    a: `<h4>Коротко</h4>
    <p>Well-known symbols — это точки расширения встроенных протоколов языка. Реально в продуктовом коде живут три: <code>Symbol.iterator</code>, <code>Symbol.asyncIterator</code> и <code>Symbol.toStringTag</code>. Остальные — инструмент авторов библиотек, и злоупотребление ими меняет базовые операции языка «на расстоянии».</p>

    <h4>Как это работает</h4>
    <p><code>Symbol.iterator</code> делает объект итерируемым: его начинают понимать <code>for...of</code>, spread, деструктуризация массива, <code>Array.from</code>, <code>Promise.all</code>, конструкторы <code>Set</code> и <code>Map</code>. Метод должен вернуть объект с <code>next()</code>, возвращающим <code>{ value, done }</code>; проще всего реализовать его генератором.</p>
    <p><code>Symbol.asyncIterator</code> — то же для <code>for await...of</code>. На нём построены Node-стримы, <code>ReadableStream</code> в браузере и удобная пагинация API: каждый <code>next()</code> может сходить за следующей страницей.</p>
    <p><code>Symbol.toStringTag</code> меняет результат <code>Object.prototype.toString.call(x)</code> и попутно улучшает вывод <code>console.log</code> и <code>util.inspect</code>. <code>Symbol.toPrimitive</code> перехватывает приведение к примитиву и получает <code>hint</code>. <code>Symbol.hasInstance</code> переопределяет <code>instanceof</code>. <code>Symbol.species</code> задаёт, какой конструктор использует <code>map</code>/<code>filter</code>/<code>slice</code> у подклассов встроенных типов. Группа <code>Symbol.match</code>, <code>Symbol.replace</code>, <code>Symbol.split</code>, <code>Symbol.search</code> позволяет подсунуть свой объект туда, где ждут RegExp — так, например, <code>String.prototype.split</code> можно научить работать с парсером. <code>Symbol.unscopables</code> — историческая заплатка, чтобы новые методы массива не ломали старый код с <code>with</code>.</p>

    <h4>Почему так</h4>
    <p>До ES6 расширять поведение языка можно было только патчингом прототипов, и любые два патча конфликтовали. Символы дали неконфликтующие «слоты протокола»: движок ищет свойство по уникальному ключу, а не по строке. Цена — неявность. Читатель кода видит <code>for...of</code>, а выполняется ваш метод; видит <code>instanceof</code>, а выполняется произвольная функция. Поэтому переопределять базовые операции стоит только там, где объект действительно моделирует встроенный тип.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Итератор, объявленный как <strong>поле-стрелка</strong>, а не метод, попадает на инстанс и не наследуется подклассами.</li>
      <li>Итератор, который возвращает <code>this</code> вместо нового состояния, нельзя пройти дважды — второй <code>for...of</code> даст пустоту.</li>
      <li><code>Symbol.toStringTag</code> не влияет ни на <code>typeof</code>, ни на <code>instanceof</code> — это только ярлык для диагностики, и он тривиально подделывается.</li>
      <li>Переопределение <code>Symbol.species</code> ломает ожидание «map вернул такой же тип»; TC39 постепенно вычищает species из спецификации как источник сложности.</li>
      <li>Прерванный <code>for...of</code> (<code>break</code>, <code>throw</code>) вызывает у итератора метод <code>return()</code> — если вы его не реализовали, ресурс не освободится.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сделать объект итерируемым и переиспользуемым?»</strong> — метод <code>[Symbol.iterator]</code> должен создавать <strong>новый</strong> итератор при каждом вызове; генератор делает это автоматически. <strong>«Чем итератор отличается от итерируемого?»</strong> — итерируемое имеет <code>[Symbol.iterator]</code>, итератор имеет <code>next()</code>; генератор является и тем и другим, поэтому его так удобно возвращать. <strong>«Зачем asyncIterator, если есть массив промисов?»</strong> — массив требует знать все элементы заранее и держать их в памяти; async-итератор отдаёт по одному и позволяет остановиться на середине, не запрашивая остаток.</p>`,
    code: `class Range {
  constructor(from, to) { this.from = from; this.to = to; }
  *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; }
  get [Symbol.toStringTag]() { return 'Range'; }
}
[...new Range(1, 4)];                             // [1,2,3,4]
Object.prototype.toString.call(new Range(1, 2));  // '[object Range]'

// асинхронная пагинация через Symbol.asyncIterator
const pages = {
  async *[Symbol.asyncIterator]() {
    let url = '/api/items';
    while (url) {
      const page = await fetch(url).then(r => r.json());
      yield* page.items;
      url = page.next;
    }
  }
};
for await (const item of pages) render(item);`,
    tip: 'Хороший ответ заканчивается предостережением: переопределять Symbol.hasInstance или Symbol.species в продуктовом коде почти всегда плохая идея — это ломает ожидания читателя без предупреждения.' },

  { id: 'jsx7',
    q: 'Как объект приводится к примитиву? Расскажи про Symbol.toPrimitive, valueOf и toString и про hint.',
    a: `<h4>Коротко</h4>
    <p>Приведение идёт через абстрактную операцию ToPrimitive, которая получает <strong>hint</strong>: <code>'string'</code>, <code>'number'</code> или <code>'default'</code>. Сначала ищется <code>Symbol.toPrimitive</code>; если его нет, для hint <code>string</code> порядок <code>toString</code> → <code>valueOf</code>, иначе <code>valueOf</code> → <code>toString</code>. Берётся первый результат-примитив.</p>

    <h4>Как это работает</h4>
    <p>Hint <code>'string'</code> ставится там, где ожидается строка: <code>String(obj)</code>, шаблонный литерал, использование объекта как ключа обычного объекта, конкатенация внутри <code>+=</code> строки. Hint <code>'number'</code> — унарный плюс, все арифметические операторы кроме бинарного <code>+</code>, реляционные сравнения <code>&lt;</code> и <code>&gt;</code>, <code>Math.*</code>. Hint <code>'default'</code> — бинарный <code>+</code> и <code>==</code> с примитивом; для всех встроенных типов, кроме <code>Date</code>, <code>default</code> ведёт себя как <code>number</code>.</p>
    <p><code>Symbol.toPrimitive</code>, если он есть, вызывается один раз с hint-строкой и <strong>обязан</strong> вернуть примитив, иначе <code>TypeError</code> — фолбэка на <code>valueOf</code> не будет. Без него движок пробует два метода по очереди и пропускает тот, что вернул объект. Если оба вернули объект — <code>TypeError: Cannot convert object to primitive value</code>.</p>
    <p>Отсюда знаменитые выражения. <code>[] + []</code> даёт пустую строку, потому что <code>[].valueOf()</code> возвращает сам массив, а <code>[].toString()</code> — <code>''</code>. <code>[] + {}</code> даёт <code>'[object Object]'</code>. А <code>{} + []</code> в консоли даёт <code>0</code>, потому что фигурные скобки в позиции инструкции парсятся как <strong>блок</strong>, и остаётся унарный плюс от массива.</p>

    <h4>Почему так</h4>
    <p>Два метода вместо одного — наследие ES1, где <code>valueOf</code> отвечал за «числовое значение обёрток», а <code>toString</code> за отображение. <code>Symbol.toPrimitive</code> добавили в ES6, чтобы дать один явный хук вместо угадывания порядка. Плата за гибкость — приведение вызывает <strong>пользовательский код</strong> в самых неожиданных местах, включая <code>==</code>, поэтому оператор нестрогого равенства с объектами принципиально непредсказуем.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>Date</code> — единственный встроенный тип, где <code>default</code> ведёт себя как <code>string</code>: <code>d1 + d2</code> склеивает строки, а <code>d1 - d2</code> даёт миллисекунды.</li>
      <li><code>Object.create(null)</code> не имеет ни <code>toString</code>, ни <code>valueOf</code>, поэтому любое приведение такого объекта к строке падает — включая случайный <code>console.log</code> в шаблоне.</li>
      <li>Приведение может иметь побочные эффекты и вызываться несколько раз: логирование или счётчик внутри <code>valueOf</code> — источник трудноуловимых багов.</li>
      <li>Ключ объекта всегда приводится к строке (кроме символов), поэтому <code>obj[{a:1}]</code> и <code>obj[{b:2}]</code> — один и тот же ключ <code>'[object Object]'</code>.</li>
      <li>Возврат объекта из <code>Symbol.toPrimitive</code> — сразу <code>TypeError</code>, без попытки <code>valueOf</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как задать поведение для value-объекта?»</strong> — реализовать <code>Symbol.toPrimitive</code> явно и обработать все три hint: это документирует намерение и убирает неоднозначность. <strong>«Почему <code>{} + []</code> и <code>([]) + {}</code> дают разное?»</strong> — из-за парсинга: в первом случае фигурные скобки это блок, а не литерал объекта; в REPL и в позиции выражения результат отличается. <strong>«Как отладить неожиданное приведение?»</strong> — временно положить <code>Symbol.toPrimitive</code> с <code>console.trace(hint)</code>: сразу видно и место вызова, и какой hint запросил движок.`,
    code: `const money = {
  amount: 100, currency: 'USD',
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.amount;
    return this.amount + ' ' + this.currency;   // string и default
  }
};
+money;         // 100
String(money);  // '100 USD'
money + '';     // '100 USD'  (hint default)
money > 50;     // true (hint number)

const bare = Object.create(null);
// String(bare);  // TypeError: Cannot convert object to primitive value

const d1 = new Date(), d2 = new Date(0);
typeof (d1 + d2);   // 'string' — у Date default ведёт себя как string
typeof (d1 - d2);   // 'number'`,
    tip: 'Назовите отдельно, что у Date hint default ведёт себя как string — поэтому date1 + date2 склеивает строки, а date1 - date2 даёт миллисекунды. Это самый частый практический след ToPrimitive.' },

  { id: 'jsx8',
    q: 'Разбери нетривиальные случаи приведения типов: почему NaN появляется там, где не ждали, и как ведут себя сравнения.',
    a: `<h4>Коротко</h4>
    <p>Почти все операторы приводят операнды к числу, и только бинарный <code>+</code> может уйти в конкатенацию. <code>NaN</code> появляется там, где <code>ToNumber</code> получает строку, которую не может разобрать целиком, или где в арифметику попал <code>undefined</code>. Лечение одно: явные <code>Number()</code>, <code>String()</code>, <code>Boolean()</code> и <code>===</code>.</p>

    <h4>Как это работает</h4>
    <p>Бинарный <code>+</code> сначала прогоняет оба операнда через <code>ToPrimitive</code> с hint <code>default</code>. Если после этого хоть один — строка, идёт конкатенация; иначе оба идут в <code>ToNumber</code>. Остальные арифметические операторы (<code>-</code>, <code>*</code>, <code>/</code>, <code>%</code>, <code>**</code>) всегда числовые. Отсюда <code>'5' * '2'</code> это <code>10</code>, а <code>'5' + 2</code> это <code>'52'</code>.</p>
    <p><code>ToNumber</code> от строки требует, чтобы <strong>вся</strong> строка была корректным числовым литералом после обрезки пробелов; пустая строка и строка из пробелов дают <code>0</code>, всё остальное — <code>NaN</code>. <code>ToNumber(undefined)</code> это <code>NaN</code>, <code>ToNumber(null)</code> это <code>0</code>, <code>ToNumber([])</code> это <code>0</code> (потому что <code>[].toString()</code> — пустая строка), <code>ToNumber([2])</code> это <code>2</code>, <code>ToNumber([1,2])</code> это <code>NaN</code>.</p>
    <p>Реляционные операторы <code>&lt;</code> и <code>&gt;</code> сравнивают лексикографически по UTF-16 code unit, только если <strong>оба</strong> операнда после ToPrimitive оказались строками; иначе оба идут в число. Поэтому <code>'10' &lt; '9'</code> это <code>true</code>, а <code>'10' &lt; 9</code> это <code>false</code>. Если хоть одна сторона стала <code>NaN</code>, все четыре сравнения возвращают <code>false</code> — включая взаимоисключающие.</p>
    <p><code>==</code> живёт по своему алгоритму Abstract Equality: <code>null == undefined</code> это <code>true</code>, и оба не равны больше ничему, включая <code>0</code> и <code>''</code>. Объект сравнивается с примитивом через ToPrimitive, булев операнд <strong>сначала</strong> превращается в число.</p>

    <h4>Почему так</h4>
    <p>Приведения появились в 1995 году ради «дружелюбности» языка в формах: строка из <code>input</code> должна была вести себя как число. Совместимость закрепила поведение навсегда. Практическая цена — целый класс ошибок, где строка из API или из <code>localStorage</code> проходит через половину приложения и превращается в <code>NaN</code> только в отчёте.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>null &gt;= 0</code> это <code>true</code>, а <code>null &gt; 0</code> и <code>null == 0</code> — оба <code>false</code>: <code>&gt;=</code> идёт через число, а <code>==</code> имеет спецправило для <code>null</code>.</li>
      <li><code>NaN !== NaN</code>, поэтому <code>indexOf(NaN)</code> всегда <code>-1</code>, а сортировка с <code>NaN</code> в данных даёт непредсказуемый порядок.</li>
      <li><code>Number('')</code> это <code>0</code>, а <code>parseInt('')</code> это <code>NaN</code> — валидация «пустое поле» на них ведёт себя по-разному.</li>
      <li><code>[] == false</code> это <code>true</code>: <code>[]</code> → <code>''</code> → <code>0</code>, <code>false</code> → <code>0</code>. При этом <code>if ([])</code> истинно, потому что <code>ToBoolean</code> не вызывает ToPrimitive.</li>
      <li><code>typeof NaN</code> это <code>'number'</code>, поэтому проверка типа не спасает; нужен <code>Number.isNaN</code> (глобальный <code>isNaN</code> сначала приводит и потому врёт: <code>isNaN('abc')</code> это <code>true</code>).</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Объясни <code>[] == false</code> по шагам»</strong> — важен алгоритм, а не заученный результат: булев операнд к числу, объект через ToPrimitive к строке, строка к числу, <code>0 == 0</code>. <strong>«Когда <code>==</code> допустим?»</strong> — единственный оправданный случай <code>x == null</code> как краткая проверка на <code>null</code> или <code>undefined</code>; во всех остальных местах он экономит символ и стоит багов.</p>`,
    code: `[] + [];        // ''
[] + {};        // '[object Object]'
[1,2] + [3];    // '1,23'
null >= 0;      // true
null > 0;       // false
null == 0;      // false
'10' < '9';     // true
'10' < 9;       // false
[] == false;    // true   ([] -> '' -> 0, false -> 0)
Boolean([]);    // true   — ToBoolean не вызывает ToPrimitive

isNaN('abc');        // true  — сначала приводит
Number.isNaN('abc'); // false — честная проверка

const qty = Number(input.value);
if (!Number.isFinite(qty)) throw new Error('not a number');`,
    tip: 'Не пересказывайте таблицу приведений: разложите один пример по шагам ToPrimitive/ToNumber и скажите, что в проде вы это отсекаете явным Number() на границе с внешними данными.' },

  { id: 'jsx9',
    q: 'Что такое Proxy, какие ловушки бывают и в каких реальных задачах ты его применял?',
    a: `<h4>Коротко</h4>
    <p>Proxy оборачивает целевой объект и перехватывает базовые операции над ним через ловушки-traps. Их 13: <code>get</code>, <code>set</code>, <code>has</code>, <code>deleteProperty</code>, <code>ownKeys</code>, <code>getOwnPropertyDescriptor</code>, <code>defineProperty</code>, <code>apply</code>, <code>construct</code>, <code>getPrototypeOf</code>, <code>setPrototypeOf</code>, <code>isExtensible</code>, <code>preventExtensions</code>.</p>

    <h4>Как это работает</h4>
    <p>Любая операция над прокси идёт во внутренний метод объекта — <code>[[Get]]</code>, <code>[[Set]]</code>, <code>[[HasProperty]]</code> и так далее. Прокси подменяет эти внутренние методы вызовом соответствующей ловушки; если ловушка не задана, операция уходит в target напрямую. Внутри ловушки правильно делегировать через <code>Reflect</code> с тем же набором аргументов — это сохраняет receiver и не ломает геттеры на прототипе.</p>
    <p>Реальные применения: <strong>реактивность</strong> — Vue 3 отслеживает чтения в <code>get</code> и инвалидирует в <code>set</code>, и именно переход с <code>defineProperty</code> на Proxy позволил ему видеть новые ключи и <code>delete</code>. <strong>Строгий конфиг</strong> — падать на опечатке в имени ключа вместо тихого <code>undefined</code>. <strong>Ленивые API-клиенты</strong>, где <code>api.users.byId(3).get()</code> собирает URL из цепочки обращений. <strong>Негативные индексы</strong> и умные коллекции. <strong>Трассировка и моки</strong> в тестах. <strong><code>Proxy.revocable</code></strong> — отзыв доступа при выгрузке плагина: после <code>revoke()</code> любая операция бросает <code>TypeError</code>, и ссылка перестаёт удерживать объект.</p>
    <p>Прокси обязан соблюдать <strong>инварианты</strong> объектной модели. Например, для non-configurable non-writable свойства target ловушка <code>get</code> обязана вернуть то же значение; <code>ownKeys</code> обязана перечислить все non-configurable ключи; <code>deleteProperty</code> не может «удалить» non-configurable свойство. Нарушение — <code>TypeError</code> в момент операции.</p>

    <h4>Почему так</h4>
    <p>Задача Proxy — дать метапрограммирование, не ломая инварианты движка и безопасность. До него единственным способом был <code>Object.defineProperty</code> по каждому известному ключу: он не видит новых свойств, не перехватывает <code>delete</code> и <code>in</code>, требует обхода всего дерева заранее и не работает с Map/Set. Цена Proxy — производительность: каждая операция превращается в вызов функции, инлайн-кеши становятся мегаморфными, а объект не может быть оптимизирован в JIT.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>В горячем цикле разница с прямым доступом достигает порядка; прокси ставят на границу подсистемы, а не вокруг данных, читаемых миллион раз.</li>
      <li><code>proxy !== target</code>: WeakMap-кеши, <code>Set</code> и мемоизация по ссылке начинают видеть два разных объекта.</li>
      <li>Методы, читающие приватные <code>#</code>-поля или внутренние слоты (Map, Set, Date), падают при вызове через прокси.</li>
      <li>Ловушка <code>get</code>, которая возвращает новую функцию на каждое обращение, ломает <code>removeEventListener</code> и React-мемоизацию.</li>
      <li>Забытый <code>receiver</code> в <code>Reflect.get</code> ломает геттеры на прототипе — они получат target вместо прокси.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем Proxy лучше defineProperty в реактивности?»</strong> — видит добавление и удаление ключей, работает с массивами и коллекциями без патчинга методов, не требует обхода дерева при инициализации. <strong>«Как отследить чтение вложенного объекта?»</strong> — возвращать из <code>get</code> прокси на вложенное значение лениво и кешировать его в <code>WeakMap</code>, иначе идентичность будет ломаться на каждом обращении.</p>`,
    code: `function safeConfig(target) {
  return new Proxy(target, {
    get(t, key, receiver) {
      if (typeof key === 'string' && !(key in t)) {
        throw new Error('Unknown config key: ' + key);
      }
      return Reflect.get(t, key, receiver);
    }
  });
}
const cfg = safeConfig({ apiUrl: '/api' });
cfg.apiUrl;  // '/api'
cfg.apiURL;  // Error: Unknown config key: apiURL

// отзыв доступа при выгрузке плагина
const { proxy, revoke } = Proxy.revocable(hostApi, {});
plugin.init(proxy);
onUnload(() => revoke());   // дальше любая операция -> TypeError`,
    tip: 'Сильный сигнал — назвать конкретную цену: Proxy не «медленный в теории», а делает доступ мегаморфным и мешает инлайн-кешам, поэтому его вешают на границы, а не на горячие данные.' },

  { id: 'jsx10',
    q: 'Зачем нужен Reflect, если есть Object.* и обычные операторы?',
    a: `<h4>Коротко</h4>
    <p>Reflect — функциональная форма внутренних методов объекта, один в один соответствующая ловушкам Proxy. Он существует, чтобы прокси мог делегировать в дефолтное поведение, не потеряв <code>receiver</code>, и чтобы у неудачных операций был результат-<code>boolean</code>, а не исключение.</p>

    <h4>Как это работает</h4>
    <p>У <code>Reflect</code> тринадцать статических методов, ровно по числу traps: <code>get</code>, <code>set</code>, <code>has</code>, <code>deleteProperty</code>, <code>ownKeys</code>, <code>getOwnPropertyDescriptor</code>, <code>defineProperty</code>, <code>apply</code>, <code>construct</code>, <code>getPrototypeOf</code>, <code>setPrototypeOf</code>, <code>isExtensible</code>, <code>preventExtensions</code>. Сигнатуры совпадают с сигнатурами ловушек, поэтому «прозрачный» прокси пишется как <code>Reflect[trap](...args)</code>.</p>
    <p>Три практических отличия от <code>Object.*</code> и операторов. Первое — <strong>receiver</strong>. <code>Reflect.get(target, key, receiver)</code> позволяет указать, какой <code>this</code> получит геттер, объявленный на прототипе. Без него прокси над объектом с accessor-ами на прототипе тихо ломает наследование: геттер увидит target и не заметит перехвата. Второе — <strong>возврат boolean</strong>: <code>Reflect.set</code>, <code>Reflect.defineProperty</code>, <code>Reflect.deleteProperty</code> возвращают <code>false</code> при неудаче, тогда как <code>Object.defineProperty</code> бросает; в ловушке это ровно то, что нужно вернуть. Третье — <strong><code>Reflect.ownKeys</code></strong>: единственный метод, который отдаёт и строковые, и символьные ключи, включая неперечисляемые; <code>Object.keys</code>, <code>getOwnPropertyNames</code> и <code>getOwnPropertySymbols</code> по отдельности этого не дают.</p>
    <p>Плюс <code>Reflect.apply(fn, thisArg, argsArray)</code> надёжнее <code>fn.apply</code>, если <code>apply</code> у функции переопределён, а <code>Reflect.construct(Target, args, newTarget)</code> позволяет подменить <code>new.target</code> — единственный корректный способ наследоваться от встроенных типов в транспилированном коде.</p>

    <h4>Почему так</h4>
    <p>Раньше метаоперации были размазаны: часть в <code>Object</code>, часть в операторах (<code>in</code>, <code>delete</code>), часть недоступна вовсе. Proxy потребовал полного и единообразного набора — иначе ловушку невозможно реализовать «как по умолчанию». Reflect и есть этот набор. Обратная сторона: он выглядит избыточным вне прокси, и код на <code>Reflect.get(o, k)</code> вместо <code>o[k]</code> без нужды читается хуже.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>Reflect.set</code> возвращает <code>false</code> вместо исключения — молчаливая неудача, если результат не проверять.</li>
      <li><code>Reflect.get(t, k)</code> без третьего аргумента использует target как receiver, и геттер на прототипе вернёт «не то» состояние.</li>
      <li><code>Reflect.ownKeys</code> даёт порядок из спецификации: сначала целочисленные ключи по возрастанию, затем строковые в порядке вставки, затем символы.</li>
      <li><code>Reflect.deleteProperty</code> на non-configurable свойстве вернёт <code>false</code>, а <code>delete</code> в strict mode бросит — разное поведение легко перепутать при рефакторинге.</li>
      <li>У <code>Reflect</code> нет <code>Reflect.keys</code> и <code>Reflect.assign</code>; попытка «переписать всё на Reflect» упирается в это.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Что сломается без receiver?»</strong> — геттер на прототипе получит target, поэтому реактивность не запишет зависимость, а вычисляемое свойство вернёт значение «мимо прокси». <strong>«Чем Reflect.ownKeys отличается от Object.keys?»</strong> — Object.keys даёт только собственные перечисляемые строковые ключи; Reflect.ownKeys даёт все собственные, включая символы и неперечисляемые. <strong>«Почему Reflect не заменил Object?»</strong> — у них разные задачи: <code>Object.*</code> — прикладной API с приведением аргументов и исключениями, <code>Reflect.*</code> — точное отражение внутренних методов без сахара, и смешивать их стили в одном коде не стоит.</p>`,
    code: `const handler = {
  get(target, key, receiver) {
    track(target, key);
    return Reflect.get(target, key, receiver);   // receiver обязателен
  },
  set(target, key, value, receiver) {
    if (typeof value !== 'number') return false; // -> TypeError в strict mode
    const ok = Reflect.set(target, key, value, receiver);
    if (ok) trigger(target, key);
    return ok;
  }
};

const base = { _v: 1, get v() { return this._v; } };
const obj = Object.create(base);
Reflect.get(base, 'v', obj);   // геттер получит obj как this`,
    tip: 'Ключевая фраза для интервьюера: «Reflect существует, чтобы прокси могли делегировать в дефолт, не потеряв receiver» — это отличает того, кто читал спеку, от того, кто читал туториал.' },

  { id: 'jsx11',
    q: 'Какие подводные камни у Proxy? Что он ломает?',
    a: `<h4>Коротко</h4>
    <p>Proxy — это <strong>другой объект</strong>, а не тот же самый с перехватом. Отсюда четыре класса проблем: приватные поля и внутренние слоты, идентичность, инварианты и производительность. Всё это проявляется далеко от места создания прокси, поэтому отлаживается тяжело.</p>

    <h4>Как это работает</h4>
    <p><strong>Приватные поля.</strong> Доступ к <code>#field</code> — это brand check по внутреннему списку полей самого объекта. У прокси такого списка нет, поэтому вызов метода через прокси даёт <code>TypeError: Cannot read private member</code>: внутри метода <code>this</code> — прокси. Лечится привязкой методов к target в ловушке <code>get</code>, но тогда мутации через <code>this</code> пойдут мимо перехвата.</p>
    <p><strong>Внутренние слоты.</strong> <code>Map</code>, <code>Set</code>, <code>Date</code>, <code>Promise</code>, <code>TypedArray</code> хранят состояние в слотах, недоступных через <code>[[Get]]</code>. <code>new Proxy(new Map(), {}).get(k)</code> падает по той же причине. Тот же фикс через <code>bind(target)</code>.</p>
    <p><strong>Идентичность.</strong> <code>proxy !== target</code>, и это ломает всё, что сравнивает по ссылке: ключи в <code>WeakMap</code> и <code>Set</code>, <code>Object.is</code> в React, дедупликацию, проверку «этот ли объект я уже видел». Если в системе гуляют обе ссылки, поведение становится зависимым от того, какая из них попала в конкретное место.</p>
    <p><strong>Инварианты.</strong> На non-configurable свойствах прокси обязан отдавать реальные значения target, а <code>ownKeys</code> обязан включать все non-configurable ключи и не может выдумывать ключи у non-extensible объекта. Нарушение — <code>TypeError</code>, часто в чужом коде: например, при <code>Object.keys</code> внутри библиотеки.</p>

    <h4>Почему так</h4>
    <p>Спецификация сознательно ставит целостность объектной модели выше удобства: если бы прокси мог врать про non-configurable свойства, замороженный объект перестал бы быть гарантией, и на этом посыпалась бы вся защита от подмены в браузерных API. То же с приватными полями — их смысл именно в том, что доступ невозможно перехватить, иначе <code>#</code> не давал бы никакой приватности.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Оборачивание уже проксированного объекта даёт вложенные прокси и удваивает стоимость каждой операции.</li>
      <li>Ловушка <code>get</code>, возвращающая новую обёртку на каждое обращение, делает <code>proxy.fn !== proxy.fn</code> — ломается снятие слушателей и <code>useCallback</code>.</li>
      <li><code>JSON.stringify</code> вызывает <code>ownKeys</code> и <code>get</code> — «умный» прокси может выдать в сериализацию то, чего не ожидали.</li>
      <li>Ловушка <code>has</code> не срабатывает на чтении по ключу, а <code>get</code> — на <code>in</code>: две разные операции, и реализовать надо обе.</li>
      <li>Отладчик в DevTools сам обращается к свойствам, поэтому ловушка с побочными эффектами «срабатывает сама собой» при раскрытии объекта в консоли.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как проксировать класс с приватными полями?»</strong> — привязывать методы к target в <code>get</code> и мириться с тем, что внутренние обращения не перехватываются; либо проектировать API так, чтобы состояние жило в обычных свойствах. <strong>«Зачем Proxy.revocable?»</strong> — гарантированно оборвать доступ к объекту (плагины, sandbox, выгрузка модуля): после <code>revoke()</code> любая операция бросает <code>TypeError</code>, и прокси перестаёт удерживать target от сборки.</p>`,
    code: `class Counter {
  #n = 0;
  inc() { return ++this.#n; }
}
const p = new Proxy(new Counter(), {});
// p.inc(); // TypeError: Cannot read private member #n

const fixed = new Proxy(new Counter(), {
  get(t, k, r) {
    const v = Reflect.get(t, k, r);
    return typeof v === 'function' ? v.bind(t) : v;  // теряем перехват this
  }
});
fixed.inc(); // 1

const m = new Proxy(new Map(), {});
// m.get('a');  // TypeError: incompatible receiver

const cache = new WeakMap();
cache.set(target, 1);
cache.has(proxy);   // false — другая ссылка`,
    tip: 'Упомяните, что bind(target) в ловушке get чинит приватные поля и внутренние слоты, но одновременно выключает перехват внутренних обращений — это честный компромисс, а не полное решение.' },

  { id: 'jsx12',
    q: 'Что такое дескрипторы свойств? Разбери writable, enumerable, configurable и что происходит при их сочетаниях.',
    a: `<h4>Коротко</h4>
    <p>Каждое свойство описывается дескриптором: либо data-дескриптор (<code>value</code> + <code>writable</code>), либо accessor-дескриптор (<code>get</code> + <code>set</code>). Общие для обоих — <code>enumerable</code> и <code>configurable</code>. Свойства из литерала и присваивания получают все флаги <code>true</code>, из <code>defineProperty</code> — все <code>false</code>.</p>

    <h4>Как это работает</h4>
    <p><code>writable: false</code> запрещает запись через <code>[[Set]]</code>: в sloppy mode это тихий no-op, в strict — <code>TypeError</code>. <code>enumerable: false</code> убирает свойство из <code>for...in</code>, <code>Object.keys</code>, <code>Object.entries</code>, spread и <code>JSON.stringify</code>, но оставляет его доступным по имени и видимым в <code>Object.getOwnPropertyNames</code>. <code>configurable: false</code> запрещает <code>delete</code> и повторное <code>defineProperty</code> — и это <strong>необратимо</strong>: обратно в <code>true</code> флаг не переводится.</p>
    <p>Из non-configurable состояния разрешён ровно один переход: <code>writable</code> можно поменять с <code>true</code> на <code>false</code>. Всё остальное — смена типа дескриптора, возврат writable, изменение <code>enumerable</code>, замена геттера — <code>TypeError</code>.</p>
    <p>Практические следствия. Методы класса, геттеры класса и <code>Symbol.toStringTag</code> объявляются <strong>не enumerable</strong>, поэтому не копируются spread-ом и не видны в <code>Object.keys(instance)</code>. Поля класса, наоборот, enumerable. <code>length</code> и <code>name</code> у функции — non-writable, но configurable, поэтому их можно переопределить только через <code>defineProperty</code>. Свойство <code>length</code> массива — writable, non-configurable, и запись в него усекает массив.</p>
    <p>Скопировать объект <strong>вместе с геттерами</strong> можно только через дескрипторы: <code>Object.create(Object.getPrototypeOf(src), Object.getOwnPropertyDescriptors(src))</code>. Обычный spread геттер <strong>вычислит</strong> и превратит в застывшее значение.</p>

    <h4>Почему так</h4>
    <p>Дескрипторы появились в ES5, чтобы описать поведение встроенных объектов на языке самой спецификации и дать библиотекам ту же выразительность. Неперечисляемость методов на прототипе — прямое следствие: иначе <code>for...in</code> по любому объекту вываливал бы весь API, и код 90-х перестал бы работать. Цена — неочевидность: два внешне одинаковых объекта могут вести себя по-разному при копировании и сериализации.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>Object.defineProperty(o, 'x', { value: 1 })</code> создаёт read-only, неперечисляемое свойство — почти никогда не то, что имели в виду.</li>
      <li>Spread и <code>Object.assign</code> вызывают геттеры источника: побочные эффекты и потеря ленивости при «простом копировании».</li>
      <li><code>Object.assign</code> использует <code>[[Set]]</code>, поэтому падает на read-only свойстве цели и вызывает её сеттеры; spread использует <code>[[DefineOwnProperty]]</code> и не падает.</li>
      <li>Сделать свойство non-configurable нельзя откатить — «залочили» объект в дев-режиме и получили несовместимость в проде.</li>
      <li><code>JSON.stringify</code> игнорирует неперечисляемые свойства, поэтому геттеры класса не попадают в сериализацию, если нет <code>toJSON</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Почему метод класса не попал в spread?»</strong> — он на прототипе и non-enumerable; spread берёт только собственные перечисляемые. <strong>«Как скопировать объект с геттерами?»</strong> — через <code>getOwnPropertyDescriptors</code> + <code>Object.create</code>; ни spread, ни <code>structuredClone</code>, ни JSON этого не умеют. <strong>«Зачем вообще неперечисляемые свойства?»</strong> — чтобы служебные поля не попадали в <code>for...in</code>, сериализацию и логи: так устроены все методы на прототипах встроенных типов, иначе любой цикл по объекту вываливал бы весь API.</p>`,
    code: `const o = {};
Object.defineProperty(o, 'id', { value: 1 });
Object.getOwnPropertyDescriptor(o, 'id');
// { value: 1, writable: false, enumerable: false, configurable: false }

const src = { get now() { return Date.now(); } };
const bad = { ...src };            // now — застывшее число
const good = Object.create(
  Object.getPrototypeOf(src),
  Object.getOwnPropertyDescriptors(src)   // геттер сохранён
);

class A { m() {} get g() { return 1; } f = 1; }
Object.keys(new A());                     // ['f'] — только поле
Object.getOwnPropertyNames(A.prototype);  // ['constructor','m','g']`,
    tip: 'Фраза «spread копирует значения, а не дескрипторы» — короткий и очень убедительный ответ на вопрос про копирование объектов с геттерами и про пропавшие методы класса.' },

  { id: 'jsx13',
    q: 'Когда использовать геттеры и сеттеры, а когда обычные методы? Чем accessor в классе отличается от defineProperty?',
    a: `<h4>Коротко</h4>
    <p>Геттер уместен, когда значение производное, дешёвое и без побочных эффектов: <code>fullName</code>, <code>isEmpty</code>, <code>size</code>. Если вычисление дорогое или что-то меняет — нужен метод, чтобы вызывающий видел скобки и понимал, что платит цену. Accessor в классе живёт на прототипе и не перечисляем, <code>defineProperty</code> обычно создаёт собственное свойство инстанса.</p>

    <h4>Как это работает</h4>
    <p>Синтаксис <code>get x() {}</code> в теле класса создаёт accessor-свойство на <code>Class.prototype</code> с <code>enumerable: false</code>, <code>configurable: true</code>. В литерале объекта — на самом объекте, но уже с <code>enumerable: true</code>. <code>Object.defineProperty(obj, 'x', { get })</code> кладёт свойство туда, куда вы указали, с флагами по умолчанию <code>false</code>.</p>
    <p>Разница видима сразу: прототипный геттер не попадёт в <code>Object.keys(instance)</code>, в spread и в <code>JSON.stringify</code>; собственный accessor с <code>enumerable: true</code> — попадёт, и <code>JSON.stringify</code> его вычислит.</p>
    <p>Полезный приём — <strong>ленивая инициализация с самозаменой</strong>: геттер при первом обращении вычисляет значение и через <code>defineProperty</code> подменяет сам себя обычным data-свойством. Дальше доступ идёт без вызова функции и без проверки кеша. Важно указать <code>configurable: true</code>, иначе повторное определение бросит <code>TypeError</code>.</p>
    <p>Отдельно стоит помнить: если геттер объявлен только на прототипе, присваивание <code>obj.x = 1</code> не создаст поле, а провалится — <code>[[Set]]</code> находит accessor вверх по цепочке и ищет у него сеттер.</p>

    <h4>Почему так</h4>
    <p>Accessor-ы существуют, чтобы менять реализацию, не меняя контракт: поле <code>user.age</code> можно превратить в вычисление из <code>birthDate</code>, не переписывая вызывающий код. Это же их опасность — синтаксис не отличает чтение поля от вызова кода, поэтому геттер, делающий сетевой запрос или мутацию, превращает безобидную строчку в источник багов. Отсюда правило: <strong>геттер обещает дешевизну и отсутствие сюрпризов</strong>; нарушили обещание — делайте метод.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Геттер без сеттера: присваивание тихо игнорируется в sloppy mode и бросает <code>TypeError</code> в strict — то есть всегда в классах и модулях.</li>
      <li><code>get x() { return this.x; }</code> — бесконечная рекурсия и переполнение стека; нужен отдельный внутренний ключ или <code>#</code>-поле.</li>
      <li>Геттер, возвращающий новый объект или массив на каждое обращение, ломает мемоизацию и <code>===</code> в React-зависимостях.</li>
      <li>Геттеры вычисляются при spread, <code>Object.assign</code> и <code>console.log</code> — тяжёлое вычисление незаметно выполняется при логировании.</li>
      <li>Поле класса с тем же именем, что accessor базового класса, <strong>перетирает</strong> его на инстансе: поле создаётся через <code>[[DefineOwnProperty]]</code>, а не через сеттер.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сделать вычисляемое свойство, которое считается один раз?»</strong> — геттер с самозаменой через <code>defineProperty</code> или приватное поле-кеш; в классах — <code>#cache</code> и проверка на <code>undefined</code>. <strong>«Влияют ли геттеры на производительность?»</strong> — сами по себе они инлайнятся хорошо, но полиморфный геттер (разные формы объектов в одном месте вызова) уводит инлайн-кеш в мегаморфизм; это надо измерять, а не бояться.</p>`,
    code: `const config = {
  raw: '{"a":1}',
  get parsed() {
    const value = JSON.parse(this.raw);
    Object.defineProperty(this, 'parsed', { value, configurable: true });
    return value;                 // дальше — обычное свойство
  }
};
config.parsed;   // считается один раз

class Temp {
  #c = 0;
  get f() { return this.#c * 9 / 5 + 32; }   // дёшево — геттер
  set f(v) { this.#c = (v - 32) * 5 / 9; }
  async fetchHistory() { /* дорого — метод */ }
}
Object.keys(new Temp());   // [] — accessor на прототипе не перечисляем`,
    tip: 'Правило, которое хорошо звучит вслух: «геттер обещает дешевизну и отсутствие сюрпризов; если обещание нарушается — делайте метод». Дальше сразу добавьте пример с самозаменяющимся геттером.' },

  { id: 'jsx14',
    q: 'Что произойдёт, если геттер объявлен на прототипе, а мы присваиваем свойство инстансу?',
    a: `<h4>Коротко</h4>
    <p>Присваивание идёт по алгоритму <code>[[Set]]</code>, который ищет свойство <strong>вверх по цепочке прототипов</strong>. Если найден accessor — вызывается его сеттер с <code>this</code> равным инстансу. Если сеттера нет, присваивание проваливается: тихо в sloppy mode, с <code>TypeError</code> в strict — то есть всегда в классах и модулях.</p>

    <h4>Как это работает</h4>
    <p><code>[[Set]](key, value, receiver)</code> сначала выполняет <code>[[GetOwnProperty]]</code> на самом объекте. Если своего свойства нет, вызов делегируется прототипу с тем же <code>receiver</code>. Возможны три исхода. Нашли accessor — вызываем его <code>set</code> с <code>this = receiver</code>; если <code>set</code> отсутствует, возвращаем <code>false</code>. Нашли data-свойство с <code>writable: false</code> — возвращаем <code>false</code>, shadowing не происходит. Нашли writable data-свойство или не нашли ничего — создаём <strong>собственное</strong> свойство на receiver, которое затеняет прототипное.</p>
    <p><code>false</code> из <code>[[Set]]</code> в strict mode превращается в <code>TypeError</code>, в sloppy — молча игнорируется. Именно поэтому баг «поле не сохраняется» в старом коде живёт годами: класс объявил только <code>get value()</code>, а другой модуль пишет <code>obj.value = 5</code>.</p>
    <p>Обойти это можно через <code>Object.defineProperty(obj, 'value', { value: 5, writable: true, ... })</code>: <code>[[DefineOwnProperty]]</code> <strong>не смотрит на прототип</strong> и создаёт собственное свойство напрямую. По той же причине <strong>поля класса</strong> перетирают одноимённые accessor-ы базового класса — они определяются, а не присваиваются.</p>

    <h4>Почему так</h4>
    <p>Делегирование <code>[[Set]]</code> вверх нужно, чтобы сеттер на прототипе вообще имел смысл: иначе <code>obj.x = 1</code> всегда создавал бы поле и перекрывал логику класса. Плата — асимметрия между присваиванием и определением свойства, из-за которой <code>Object.assign</code> и spread ведут себя по-разному на одних и тех же данных: <code>assign</code> идёт через <code>[[Set]]</code> (триггерит сеттеры цели, падает на read-only и на замороженном объекте), а spread — через <code>[[DefineOwnProperty]]</code> в новый литерал, поэтому не падает никогда.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Класс всегда strict, поэтому «тихая» неудача превращается в исключение — но только в рантайме и часто в проде.</li>
      <li>Read-only data-свойство на прототипе тоже блокирует shadowing; частый случай — <code>Object.freeze(Base.prototype)</code>.</li>
      <li>Сеттер на прототипе, который пишет в <code>this[key]</code> с тем же именем, даёт бесконечную рекурсию.</li>
      <li><code>Object.assign(frozen, patch)</code> бросает <code>TypeError</code>, тогда как <code>{ ...frozen, ...patch }</code> работает — рефакторинг «оптимизирую в assign» ломает код.</li>
      <li>Поле класса, совпадающее по имени с методом или accessor базового класса, молча его отключает для этого инстанса.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем defineProperty отличается от присваивания?»</strong> — <code>defineProperty</code> использует <code>[[DefineOwnProperty]]</code>, игнорирует прототип и сеттеры и позволяет задать флаги; присваивание использует <code>[[Set]]</code> и уважает цепочку. <strong>«Почему Object.assign падает, а spread нет?»</strong> — ровно поэтому: разные внутренние методы, разные точки отказа. <strong>«Как всё-таки записать значение поверх геттера?»</strong> — только <code>Object.defineProperty</code> на самом объекте: он создаёт собственное data-свойство и не смотрит на цепочку прототипов, поэтому геттер оказывается затенён.</p>`,
    code: `class A { get value() { return 1; } }
const a = new A();
// a.value = 5;   // TypeError: Cannot set property value (класс = strict)

Object.defineProperty(a, 'value', { value: 5, writable: true, configurable: true });
a.value;          // 5 — собственное свойство затенило геттер

class Base { get kind() { return 'base'; } }
class Child extends Base { kind = 'child'; }   // поле перетирает геттер
new Child().kind;                              // 'child'

const target = Object.freeze({ x: 1 });
// Object.assign(target, { x: 2 });  // TypeError — [[Set]]
({ ...target, x: 2 });               // ok — [[DefineOwnProperty]] в новый объект`,
    tip: 'Разница assign vs spread через [[Set]] против [[DefineOwnProperty]] — один из лучших способов показать, что вы читаете спеку, а не только MDN; заодно она объясняет, почему поля класса перетирают геттеры базового.' },

  { id: 'jsx15',
    q: 'Object.freeze, Object.seal, Object.preventExtensions — в чём разница и что freeze НЕ делает?',
    a: `<h4>Коротко</h4>
    <p>Три уровня «запечатывания». <code>preventExtensions</code> запрещает добавлять новые свойства. <code>seal</code> = preventExtensions + <code>configurable: false</code> на всех свойствах, то есть нельзя удалять и переопределять, но менять значения можно. <code>freeze</code> = seal + <code>writable: false</code>. Всё это работает <strong>только на первом уровне</strong>.</p>

    <h4>Как это работает</h4>
    <p><code>preventExtensions</code> сбрасывает внутренний флаг <code>[[Extensible]]</code>. Это также запрещает менять прототип через <code>Object.setPrototypeOf</code>. Проверки — <code>Object.isExtensible</code>, <code>Object.isSealed</code>, <code>Object.isFrozen</code>; причём пустой non-extensible объект считается и sealed, и frozen, потому что нарушать нечего.</p>
    <p><code>freeze</code> проходит по всем собственным ключам (включая символьные) и ставит <code>writable: false, configurable: false</code> для data-свойств. Accessor-свойства он тоже делает non-configurable, но <code>writable</code> к ним не применяется — <strong>сеттеры продолжают работать</strong>, и через них замороженный объект спокойно меняет своё состояние.</p>
    <p>Чего freeze не делает: не трогает вложенные объекты (поверхностность), не замораживает прототип, не мешает внутренним слотам. <code>Object.freeze(new Map())</code> не мешает <code>map.set()</code>, а <code>Object.freeze(arr)</code> запрещает изменение элементов, но <code>arr.push</code> упадёт с <code>TypeError</code> только потому, что не может записать <code>length</code>.</p>
    <p>Неудачная запись тиха в sloppy mode и бросает <code>TypeError</code> в strict — то есть в модулях и классах замороженный объект «громкий», а в старом скрипте баг просто исчезает без следа.</p>

    <h4>Почему так</h4>
    <p>Заморозка задумана как инструмент защиты объектной модели (например, чтобы библиотека не могла подменить чужой API), а не как система иммутабельности данных. Глубокая заморозка потребовала бы обхода произвольного графа с циклами и стоила бы линейно от размера — спецификация такого не делает намеренно. Отсюда практическое следствие: <code>freeze</code> хорош как <strong>ассерт в dev-режиме</strong>, но плох как основа иммутабельности в проде.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Поверхностность: <code>Object.freeze(state)</code> не мешает <code>state.user.name = 'x'</code>, и команда живёт с ложным чувством безопасности.</li>
      <li>В sloppy mode мутация замороженного объекта проходит молча — тесты «на мутацию» ничего не ловят, если файл не модуль.</li>
      <li><code>Object.freeze</code> не блокирует сеттеры и не блокирует изменение внутренних слотов у Map, Set, Date, TypedArray.</li>
      <li>Перф: V8 переводит замороженные объекты в отдельную форму, и попытка записи идёт по медленному пути; массовая заморозка данных в горячем коде заметно дороже, чем кажется.</li>
      <li><code>freeze</code> необратим — «разморозить» объект нельзя, только сделать копию, что ломает ссылочное равенство.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сделать deep freeze?»</strong> — рекурсия по <code>Reflect.ownKeys</code> с защитой от циклов через <code>WeakSet</code>; и сразу оговорка, что в проде это включают только под флагом <code>NODE_ENV !== 'production'</code>. <strong>«Чем заменить freeze для иммутабельного стора?»</strong> — <code>readonly</code> в TypeScript плюс копирующие методы (<code>toSorted</code>, <code>with</code>) или Immer со structural sharing: проверка на этапе компиляции стоит ноль в рантайме. <strong>«Что вернёт <code>Object.isFrozen({})</code> после <code>preventExtensions</code>?»</strong> — <code>true</code>: у пустого необрасширяемого объекта нечего нарушать, поэтому он формально считается и sealed, и frozen.`,
    code: `function deepFreeze(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object' || seen.has(obj)) return obj;
  seen.add(obj);
  for (const key of Reflect.ownKeys(obj)) deepFreeze(obj[key], seen);
  return Object.freeze(obj);
}

const m = Object.freeze(new Map());
m.set('a', 1);        // работает! данные во внутреннем слоте
m.size;               // 1

const o = Object.freeze({ _v: 1, set v(x) { this._v = x; } });
// сеттер вызовется, но запись в _v упадёт: TypeError в strict

const arr = Object.freeze([1, 2]);
// arr.push(3);       // TypeError: Cannot add property 2`,
    tip: 'Замечание про производительность отличает практика: замороженные объекты в V8 получают отдельную форму, и запись в них идёт по медленному пути — массово фризить данные в горячем коде не стоит.' },

  { id: 'jsx16',
    q: 'Как ты обеспечиваешь иммутабельность данных на практике в большом приложении?',
    a: `<h4>Коротко</h4>
    <p>Иммутабельность нужна не сама по себе, а ради дешёвого сравнения по ссылке: на нём стоит мемоизация, <code>React.memo</code>, селекторы и вычисление diff. Поэтому стратегия строится снизу вверх: типы на компиляции, копирующие операции в коде, structural sharing в сторе. <code>Object.freeze</code> — только дев-ассерт.</p>

    <h4>Как это работает</h4>
    <p><strong>Уровень типов.</strong> <code>readonly</code>, <code>Readonly&lt;T&gt;</code>, <code>ReadonlyArray&lt;T&gt;</code> и <code>as const</code> ловят мутацию на этапе компиляции и стоят ноль в рантайме. Это основной инструмент; всё остальное — страховка. Минус — тип не защищает от мутации через <code>any</code> и от чужого кода.</p>
    <p><strong>Уровень операций.</strong> ES2023 дал копирующие версии мутирующих методов: <code>toSorted</code>, <code>toReversed</code>, <code>toSpliced</code>, <code>with(i, v)</code>. Они заменяют ритуал <code>[...arr].sort()</code> и убирают самый частый источник багов в редьюсерах — <code>sort</code> и <code>reverse</code>, молча мутирующие пропсы.</p>
    <p><strong>Уровень структуры.</strong> Наивное глубокое копирование на каждое обновление даёт O(размер стора) на каждое действие и давит на GC. Structural sharing переиспользует неизменённые ветки: копируется только путь от корня до изменённого узла. Immer делает это через Proxy-драфт — вы пишете мутирующий код, а получаете новый объект с переиспользованными ветками; цена — прокси-обёртки и штраф на очень частых мелких обновлениях. Immutable.js даёт настоящие persistent-структуры (HAMT), но требует чужого API и конвертации на границах.</p>

    <h4>Почему так</h4>
    <p>React и селекторы сравнивают зависимости через <code>Object.is</code>. Если мутировать объект на месте, ссылка не меняется, и компонент не перерисуется — баг «данные обновились, а UI нет». Если, наоборот, копировать всё глубоко, ссылки меняются везде, и перерисовывается всё — баг «тормозит без причины». Structural sharing — единственный способ получить и корректность, и точечные обновления.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>Object.freeze</code> всего стора: медленно, поверхностно и даёт ложную уверенность.</li>
      <li><code>structuredClone</code> на каждое обновление копирует всё дерево и теряет прототипы, функции и символы.</li>
      <li>Spread копирует один уровень: <code>{ ...state, items: state.items }</code> оставляет ту же ссылку на массив, и мутация внутри пройдёт незамеченной.</li>
      <li>Immer не помогает, если вернуть из рецепта <strong>и</strong> изменить draft — это ошибка рантайма; и он не работает с классами без <code>immerable</code>.</li>
      <li><code>Record &amp; Tuple</code>, обещавший глубоко иммутабельные примитивы, снят с рассмотрения TC39 — на него закладываться нельзя.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Иммутабельность же расходует память?»</strong> — да, старые версии живут до сборки, но structural sharing делает расход пропорциональным глубине пути, а не размеру данных; выигрыш на сравнении обычно перекрывает это. <strong>«Как поймать мутацию в проде?»</strong> — deep freeze под dev-флагом плюс правило линтера на мутирующие методы; в проде — ничего, там платить за это нельзя. <strong>«Иммутабельность и производительность рендера — как связаны?»</strong> — новая ссылка означает «данные изменились», поэтому <code>React.memo</code> и селекторы могут отсечь поддерево одним сравнением вместо глубокого обхода.</p>`,
    code: `// было: две мутации подряд, ссылка не меняется
state.items.sort((a, b) => a.n - b.n);
state.items[0].done = true;

// стало: копирующие методы, новая ссылка только там, где надо
const next = {
  ...state,
  items: state.items
    .toSorted((a, b) => a.n - b.n)
    .with(0, { ...state.items[0], done: true })
};
next.items === state.items;   // false
next.other === state.other;   // true — ветка переиспользована

if (process.env.NODE_ENV !== 'production') deepFreeze(next);`,
    tip: 'Отметьте, что дешёвое сравнение по ссылке — главная практическая выгода иммутабельности, а не «чистота»: на нём стоит вся мемоизация в React и в селекторах.' },

  { id: 'jsx17',
    q: 'В каком порядке инициализируются поля и выполняется конструктор при наследовании классов? Где здесь ловушка с super?',
    a: `<h4>Коротко</h4>
    <p>В производном классе <code>this</code> не существует до <code>super()</code> — обращение раньше даёт <code>ReferenceError</code>. <code>super()</code> выполняет конструктор базового класса <strong>целиком</strong>, включая инициализацию его полей. Поля производного класса создаются только <strong>после</strong> возврата из <code>super()</code>, и лишь затем идёт остальной код конструктора.</p>

    <h4>Как это работает</h4>
    <p>Полный порядок при <code>new Child()</code>: 1) вычисляются аргументы; 2) начинает выполняться конструктор <code>Child</code> с непроинициализированным <code>this</code> (TDZ для <code>this</code>); 3) <code>super()</code> создаёт объект с прототипом <code>new.target.prototype</code>, выполняет инициализаторы полей <code>Base</code> и тело конструктора <code>Base</code>; 4) управление возвращается в <code>Child</code>, и <strong>сразу</strong> выполняются инициализаторы полей <code>Child</code> сверху вниз; 5) выполняется оставшееся тело конструктора <code>Child</code>.</p>
    <p>Если конструктор в производном классе не написан, подставляется неявный <code>constructor(...args) { super(...args); }</code>. Если базовый конструктор возвращает объект, именно он становится <code>this</code> — редкий, но реальный способ подменить инстанс.</p>
    <p>Методы, в отличие от полей, живут на прототипе и существуют с момента вычисления класса. Поэтому вызов <code>this.method()</code> из конструктора базового класса уже <strong>попадает в переопределённый</strong> метод производного — но тот увидит свои поля как <code>undefined</code>.</p>
    <p><code>super.method()</code> резолвится не через <code>this</code>, а через <code>[[HomeObject]]</code> метода — скрытую ссылку на объект, в котором метод объявлен. Поэтому «вытащенный» метод (<code>const m = obj.method</code>) сохраняет доступ к super, а метод, скопированный через <code>Object.assign</code>, — теряет.</p>

    <h4>Почему так</h4>
    <p>Порядок «сначала база, потом производный» — единственный корректный: производный класс может опираться на состояние базового, обратное неверно. Плата за это — невозможность безопасно вызывать перегружаемые методы из конструктора, ровно как в C++ и Java, но без предупреждений компилятора.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Шаблонный метод в конструкторе базового класса видит поля наследника как <code>undefined</code> — классический баг «конфиг не применился».</li>
      <li>Поле производного класса с именем accessor-а базового <strong>перетирает</strong> его на инстансе: поле создаётся через <code>[[DefineOwnProperty]]</code>, а не через сеттер.</li>
      <li>Метод-стрелка (<code>m = () =&gt; {}</code>) живёт на инстансе, поэтому не виден через <code>super.m()</code>, не переопределяется подклассом привычным образом и аллоцируется на каждый объект.</li>
      <li>Обращение к <code>this</code> в аргументах <code>super(...)</code> — <code>ReferenceError</code>, а не <code>undefined</code>.</li>
      <li>Забытый <code>super()</code> в конструкторе производного класса даёт <code>ReferenceError</code> при возврате, а не при объявлении.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как правильно сделать инициализацию с хуками?»</strong> — вынести её из конструктора в явный <code>init()</code>, вызываемый статической фабрикой после создания объекта; в React-классах эту роль играл <code>componentDidMount</code>. <strong>«Когда выполняются статические поля?»</strong> — при вычислении класса, сверху вниз, статика базового класса раньше статики производного. <strong>«Что вернёт конструктор, если в нём написать <code>return</code>?»</strong> — возврат объекта подменяет <code>this</code> и становится результатом <code>new</code>, возврат примитива игнорируется; в производном классе это ещё и способ обойти проверку на вызов <code>super()</code>.</p>`,
    code: `class Base {
  constructor() { this.init(); }
  init() { console.log('base init'); }
}
class Child extends Base {
  name = 'child';
  init() { console.log('child init, name =', this.name); }
}
new Child();
// 'child init, name = undefined' — поле ещё не создано

// правильно: явная фаза инициализации
class Widget {
  static create(opts) { const w = new Widget(opts); w.init(); return w; }
  constructor(opts) { this.opts = opts; }
  init() { /* здесь все поля уже на месте */ }
}`,
    tip: 'Скажите, что именно поэтому в конструкторе нельзя вызывать перегружаемые методы, и что поля наследника перетирают одноимённые геттеры базового класса — это два следствия одного правила.' },

  { id: 'jsx18',
    q: 'Чем приватные поля (#) отличаются от соглашения с подчёркиванием, Symbol и WeakMap? Как проверить наличие приватного поля?',
    a: `<h4>Коротко</h4>
    <p><code>#field</code> — единственная настоящая приватность в языке. Это не свойство: имя не строка и не символ, поле не видно ни в <code>Object.keys</code>, ни в <code>getOwnPropertySymbols</code>, ни в <code>Reflect.ownKeys</code>, ни в <code>JSON.stringify</code>. Доступ вне лексического тела класса — <strong>синтаксическая</strong> ошибка. Проверить наличие безопасно позволяет <code>#field in obj</code>.</p>

    <h4>Как это работает</h4>
    <p>Приватные имена живут в лексической области видимости тела класса, как переменные. Движок хранит их в отдельном внутреннем списке объекта — «бренде», который выдаётся объекту в момент выполнения инициализаторов полей. Обращение к <code>#field</code> у объекта без бренда бросает <code>TypeError</code>, и это фактически проверка «этот объект действительно создан этим классом».</p>
    <p>Отсюда идиома <code>static isMine(x) { return #field in x; }</code> — эргономичный brand check (ES2022), который не бросает исключений. Он надёжнее <code>instanceof</code>: переживает границы realm (iframe, worker, <code>vm</code>), не ломается подменой <code>Symbol.hasInstance</code> и не обманывается объектом с подделанным прототипом.</p>
    <p>Приватные поля <strong>не наследуются</strong>: подкласс не видит <code>#field</code> родителя, у него могут быть свои поля с тем же именем — это разные имена. Динамический доступ невозможен принципиально: <code>this['#x']</code> обращается к обычному строковому свойству. Бывают также приватные методы, приватные accessor-ы и статические приватные поля.</p>
    <p>Сравнение альтернатив: подчёркивание — только соглашение, ничего не мешает записи; <code>Symbol</code> скрывает от перечисления, но достижим через <code>getOwnPropertySymbols</code>; <code>WeakMap</code> даёт настоящую приватность и был исторической заменой <code>#</code>, но громоздок и требует ручной привязки к <code>this</code>.</p>

    <h4>Почему так</h4>
    <p>Комитет намеренно сделал приватность <strong>жёсткой</strong>, а не «по соглашению»: иначе фреймворки, сериализаторы и DevTools продолжили бы натыкаться на внутренности классов, и любая внутренняя деталь становилась бы публичным API. Цена — несовместимость с Proxy, невозможность отладочного доступа и синтаксис, который многим не нравится.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Вызов метода с <code>#</code>-полем через Proxy бросает <code>TypeError</code>: у прокси нет бренда.</li>
      <li><code>structuredClone</code> и любые копирования теряют приватные поля — клон становится «сломанным» объектом того же класса.</li>
      <li><code>JSON.stringify</code> не видит <code>#</code>-полей: если состояние живёт в них, нужен явный <code>toJSON</code>.</li>
      <li>Доступ к <code>#x</code> у чужого объекта в <code>catch</code>-обёртке — <code>TypeError</code>, а не <code>undefined</code>; проверять надо через <code>#x in obj</code>.</li>
      <li>Транспиляция <code>#</code> в WeakMap меняет производительность и делает поля видимыми в дампе памяти — «приватность» пропадает после сборки под старые таргеты.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Почему <code>#x in obj</code> лучше <code>instanceof</code>?»</strong> — <code>instanceof</code> проверяет прототип, который можно подменить и который различается между realm; бренд подделать нельзя. <strong>«Как тестировать приватное состояние?»</strong> — никак напрямую: проверять через публичное поведение; если очень нужно, выносить логику в отдельный модуль и тестировать его. <strong>«Наследуются ли приватные методы?»</strong> — нет: приватные имена принадлежат телу конкретного класса, и одноимённое <code>#x</code> в подклассе — это другое имя, а не переопределение.`,
    code: `class Money {
  #amount;
  constructor(a) { this.#amount = a; }
  static isMoney(x) { return #amount in x; }   // brand check без исключений
  add(other) {
    if (!Money.isMoney(other)) throw new TypeError('not Money');
    return new Money(this.#amount + other.#amount);
  }
  toJSON() { return { amount: this.#amount }; } // иначе поле не сериализуется
}
Money.isMoney(new Money(1));   // true
Money.isMoney({});             // false
JSON.stringify(new Money(5));  // '{"amount":5}'

const p = new Proxy(new Money(1), {});
// p.add(new Money(2));        // TypeError: нет бренда`,
    tip: 'Упомяните, что #x in obj надёжнее instanceof при работе с несколькими realm (iframe, worker, vm) и при подмене Symbol.hasInstance — это аргумент уровня спецификации, а не стиля.' },

  { id: 'jsx19',
    q: 'Зачем нужны статические блоки инициализации в классах и как они соотносятся со статическими приватными полями?',
    a: `<h4>Коротко</h4>
    <p><code>static { ... }</code> — код, выполняющийся один раз при вычислении класса, в лексической области его тела. Он решает две задачи: сложная инициализация статики, которую нельзя выразить одним выражением, и контролируемая выдача доступа к приватным полям наружу.</p>

    <h4>Как это работает</h4>
    <p>Статические блоки и статические поля выполняются <strong>сверху вниз в порядке объявления</strong>, в момент вычисления класса — то есть при загрузке модуля, а не при первом <code>new</code>. Статика базового класса выполняется раньше статики производного. Внутри блока <code>this</code> — это сам конструктор класса, поэтому <code>this.#privateStatic = ...</code> работает, а <code>super.prop</code> ведёт к статике родителя. <code>super()</code>, <code>await</code>, <code>return</code> и <code>arguments</code> внутри блока запрещены.</p>
    <p>Первая задача — <strong>инициализация с логикой</strong>. Инициализатор статического поля это одно выражение; блок даёт полноценный код: <code>try/catch</code> для опциональной зависимости, цикл для построения таблицы, условная ветка по окружению, взаимозависимые поля.</p>
    <p>Вторая задача — <strong>доступ к приватным полям снаружи</strong>. Внутри статического блока приватные имена класса в области видимости, поэтому там можно записать в модульную переменную функцию-«ключик», которую получит только доверенный код того же модуля. Это официальный паттерн из proposal: он даёт «friend»-доступ, не открывая поля миру.</p>

    <h4>Почему так</h4>
    <p>До статических блоков всё это писали как <code>Class.field = ...</code> сразу после объявления класса. Это работало, но выносило инициализацию за пределы класса и, главное, создавало <strong>side effect на верхнем уровне модуля</strong> — бандлеры переставали считать модуль чистым и не могли его вытрясти при tree-shaking. Блок возвращает инициализацию внутрь конструкции класса, где она видна и где ей доступны приватные имена.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Блок выполняется при загрузке модуля: тяжёлая работа в нём удлиняет старт приложения и не поддаётся ленивой загрузке.</li>
      <li>Порядок важен: обращение к статическому полю, объявленному ниже блока, даст <code>undefined</code> или TDZ-ошибку.</li>
      <li>Исключение из статического блока делает класс невычисляемым — модуль падает целиком при импорте, и стек указывает на строку <code>import</code>.</li>
      <li><code>await</code> внутри запрещён, поэтому асинхронную инициализацию всё равно приходится выносить в отдельный экспорт.</li>
      <li>Паттерн «ключик наружу» легко превращается в чёрный ход: если функция утечёт из модуля, приватность потеряна.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Когда именно выполняется статический блок?»</strong> — при вычислении определения класса, то есть один раз на модуль, до первого <code>new</code>. <strong>«Как сделать асинхронную инициализацию класса?»</strong> — экспортировать <code>static async init()</code> и звать её из entry-point или использовать top-level await в модуле, а не пытаться сделать это в блоке. <strong>«Чем статический блок отличается от IIFE рядом с классом?»</strong> — он выполняется внутри лексической области класса, поэтому видит приватные имена и <code>this</code> как конструктор, и не создаёт side effect на верхнем уровне модуля.</p>`,
    code: `let readSecret;

class Vault {
  #secret;
  static #createdAt;
  static registry = new Map();

  constructor(s) { this.#secret = s; }

  static {
    readSecret = (v) => v.#secret;      // доверенный доступ наружу
    this.#createdAt = Date.now();
    try {
      this.registry.set('default', new Vault(process.env.SECRET ?? ''));
    } catch {
      this.registry.set('default', new Vault(''));
    }
  }
}
readSecret(new Vault('x'));   // 'x'`,
    tip: 'Хорошая ремарка: до статических блоков всё это писали как Class.field = ... сразу после класса, что создавало side effect на верхнем уровне модуля и ломало tree-shaking.' },

  { id: 'jsx20',
    q: 'Что нужно знать при наследовании от встроенных типов — Array, Error, Map? Причём тут Symbol.species?',
    a: `<h4>Коротко</h4>
    <p>Нативно наследование работает: <code>super()</code> создаёт объект с правильными внутренними слотами и прототипом <code>new.target.prototype</code>. Проблемы начинаются в трёх местах: методы Array возвращают ваш подкласс (управляется <code>Symbol.species</code>), Error теряет прототип при транспиляции в ES5, а Map и Set требуют внутренний слот, которого нет у прокси и у <code>Object.create</code>.</p>

    <h4>Как это работает</h4>
    <p><strong>Array.</strong> Подкласс получает экзотическое поведение <code>length</code> и индексов, потому что объект создаётся конструктором <code>Array</code>. Методы <code>map</code>, <code>filter</code>, <code>slice</code>, <code>concat</code>, <code>splice</code> используют <code>ArraySpeciesCreate</code>: они смотрят на <code>constructor[Symbol.species]</code> и создают результат этого типа. Значит, <code>collection.map(x =&gt; x)</code> вернёт <code>Collection</code>, а не обычный массив — и если ваш конструктор требует аргументов, это упадёт. Переопределение <code>static get [Symbol.species]() { return Array; }</code> возвращает обычные массивы.</p>
    <p><strong>Error.</strong> В нативных классах всё в порядке. При таргете ES5 <code>class MyError extends Error</code> транспилируется в вызов <code>Error.call(this)</code>, который <strong>возвращает новый объект</strong> и игнорирует <code>this</code>; прототип теряется, и <code>instanceof MyError</code> даёт <code>false</code>. Лечение — <code>Object.setPrototypeOf(this, new.target.prototype)</code> в конструкторе. Дополнительно стоит ставить <code>this.name</code> (иначе в stack будет <code>Error</code>) и в V8 звать <code>Error.captureStackTrace(this, new.target)</code>, чтобы убрать конструктор из трейса.</p>
    <p><strong>Map, Set, Promise, TypedArray.</strong> Их методы читают внутренний слот, который выдаётся только конструктором. Подкласс работает, а <code>Object.create(Map.prototype)</code> и <code>new Proxy(new Map(), {})</code> — нет: <code>TypeError: incompatible receiver</code>.</p>

    <h4>Почему так</h4>
    <p><code>Symbol.species</code> задумывался как способ дать подклассам контроль над типом результата. На практике он оказался источником сложности и уязвимостей (произвольный конструктор вызывается из встроенного метода), поэтому TC39 постепенно вычищает species из спецификации: новые методы вроде <code>toSorted</code> и <code>with</code> его уже <strong>не используют</strong> и всегда возвращают обычный <code>Array</code>.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Конструктор подкласса Array с обязательным аргументом ломает <code>map</code> и <code>filter</code> — species вызовет его с числом-длиной.</li>
      <li><code>class X extends Array</code> и <code>new X(5)</code> создаёт массив длины 5, а не с одним элементом — унаследованная неоднозначность конструктора Array.</li>
      <li>Забытый <code>this.name</code> в наследнике Error делает логи неотличимыми, а <code>err.constructor.name</code> ломается при минификации.</li>
      <li><code>cause</code> нужно пробрасывать вручную: <code>super(message, options)</code>, иначе цепочка причин теряется.</li>
      <li>Наследование от <code>Promise</code> заставляет <code>then</code> создавать ваш подкласс — легко получить бесконечную рекурсию в конструкторе.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Почему instanceof не работает у моей ошибки?»</strong> — почти всегда таргет ES5 в tsconfig или Babel без <code>@babel/plugin-transform-classes</code> в loose-режиме; проверяется одной строкой <code>Object.getPrototypeOf(err)</code>. <strong>«Стоит ли наследоваться от Array?»</strong> — обычно нет: композиция с внутренним массивом предсказуемее и не тянет species. <strong>«Как проверить, что ошибка ваша?»</strong> — не <code>instanceof</code>, а поле-дискриминант <code>code</code> или brand check через <code>#</code>-поле: это переживает и транспиляцию, и границы realm.</p>`,
    code: `class Collection extends Array {
  static get [Symbol.species]() { return Array; }  // map вернёт обычный Array
}
const c = new Collection(1, 2, 3);
c.map(x => x) instanceof Collection;   // false

class HttpError extends Error {
  constructor(status, options) {
    super('HTTP ' + status, options);            // пробрасываем cause
    this.name = 'HttpError';
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);   // страховка для ES5
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }
}
new HttpError(404) instanceof HttpError;   // true`,
    tip: 'Скажите, что species в новых методах (toSorted, with, toSpliced) уже не используется и TC39 вычищает его из спеки — знать надо, применять почти никогда не стоит.' },

  { id: 'jsx21',
    q: 'Как теряется this в классах и какой способ его сохранить лучше: bind в конструкторе, поле-стрелка или что-то ещё?',
    a: `<h4>Коротко</h4>
    <p>Методы живут на прототипе, и <code>this</code> у них определяется <strong>способом вызова</strong>, а не местом объявления. Как только метод передаётся как значение — в <code>addEventListener</code>, <code>setTimeout</code>, <code>map</code>, — связь теряется, и поскольку класс всегда strict, <code>this</code> становится <code>undefined</code> с падением, а не тихо берёт <code>window</code>.</p>

    <h4>Как это работает</h4>
    <p><code>obj.method()</code> — это <code>[[Call]]</code> с receiver <code>obj</code>. <code>const m = obj.method; m()</code> — вызов без receiver, и в strict mode <code>this</code> равен <code>undefined</code>. Именно это и происходит при передаче метода колбэком.</p>
    <p>Варианты решения. <strong><code>this.m = this.m.bind(this)</code> в конструкторе</strong>: метод остаётся на прототипе (наследуется, доступен через <code>super.m()</code>, тестируется в изоляции), а на инстансе появляется связанная копия. Работает всегда, стоит одну функцию на метод на инстанс. <strong>Поле-стрелка <code>m = () =&gt; {}</code></strong>: короче, но метод переезжает на инстанс — его нельзя вызвать через <code>super.m()</code>, нельзя привычно переопределить в подклассе (поле подкласса просто перетрёт поле базового), он не виден в <code>Class.prototype</code>, и он аллоцируется на каждый объект.</p>
    <p><strong>Стрелка на месте вызова</strong> — <code>el.onclick = () =&gt; this.m()</code>: ничего не связывает заранее, читается явно, но создаёт новую функцию, которую надо где-то сохранить, если её потом снимать.</p>
    <p><strong>Интерфейс <code>handleEvent</code></strong> — в <code>addEventListener</code> передаётся сам объект, а не функция. Тогда <code>this</code> внутри правильный по определению, и снять слушатель можно тем же объектом, без хранения bound-ссылки. Это самый недооценённый вариант в DOM-коде.</p>

    <h4>Почему так</h4>
    <p>Динамический <code>this</code> — фундаментальное решение языка: он позволяет одному методу работать с разными объектами и делает возможным заимствование методов (<code>Array.prototype.slice.call</code>). Классы это поведение не меняли, они только добавили strict mode, из-за которого потеря контекста стала громкой ошибкой вместо тихой порчи глобального объекта.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>removeEventListener(this.m.bind(this))</code> ничего не снимает: <code>bind</code> создаёт новую функцию каждый раз — реальный и частый источник утечек.</li>
      <li>Поле-стрелка нельзя вызвать через <code>super</code> и нельзя замокать через прототип в тестах.</li>
      <li>Порядок в конструкторе: <code>bind</code> надо делать после <code>super()</code>, иначе <code>ReferenceError</code>.</li>
      <li><code>bind</code> внутри JSX-пропса (<code>onClick={this.m.bind(this)}</code>) создаёт новую функцию на каждый рендер и ломает <code>React.memo</code> у дочернего компонента.</li>
      <li>Декораторы вроде <code>@bound</code> и <code>autobind</code> решают это, но требуют транспиляции и путают отладку.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Что выбрать по умолчанию?»</strong> — <code>handleEvent</code> для DOM, стрелка на месте вызова для разовых колбэков, <code>bind</code> в конструкторе для методов, передаваемых многократно; поле-стрелка — когда важна краткость и не нужны наследование и мокинг. <strong>«Почему стрелка не теряет this?»</strong> — у неё нет собственного <code>this</code>: имя резолвится лексически, как обычная переменная замыкания, и <code>bind</code>/<code>call</code> на неё не действуют. <strong>«Сколько стоит поле-стрелка?»</strong> — одна функция на каждый инстанс: на тысяче объектов это тысяча замыканий вместо одного метода на прототипе, что заметно в списках и в играх.`,
    code: `class Widget {
  constructor(el) {
    this.el = el;
    this.count = 0;
    el.addEventListener('click', this);   // объект как listener
  }
  handleEvent(e) { if (e.type === 'click') this.onClick(e); }
  onClick() { this.count++; }
  destroy() { this.el.removeEventListener('click', this); }  // без bound-ref
}

// антипаттерн: слушатель не снимется никогда
el.addEventListener('click', this.onClick.bind(this));
el.removeEventListener('click', this.onClick.bind(this));  // другая функция`,
    tip: 'Аргумент про removeEventListener — самый практичный: bind создаёт новую функцию каждый раз, поэтому removeEventListener(this.m.bind(this)) не снимает слушатель, и это реальный источник утечек.' },

  { id: 'jsx22',
    q: 'Что такое new.target и где он реально нужен?',
    a: `<h4>Коротко</h4>
    <p><code>new.target</code> — мета-свойство, доступное внутри функции и конструктора. При вызове через <code>new</code> оно равно вызванному конструктору, при обычном вызове — <code>undefined</code>. При наследовании в базовом конструкторе оно указывает на <strong>самый производный</strong> класс, а не на базовый.</p>

    <h4>Как это работает</h4>
    <p>Значение <code>new.target</code> передаётся во внутренний метод <code>[[Construct]]</code> и прокидывается по цепочке <code>super()</code> без изменений. Именно оно определяет, какой прототип получит создаваемый объект: <code>OrdinaryCreateFromConstructor</code> берёт <code>new.target.prototype</code>. Поэтому <code>new Circle()</code> создаёт объект с <code>Circle.prototype</code>, хотя объект физически создаётся в конструкторе <code>Shape</code>.</p>
    <p>Практические применения. <strong>Абстрактный класс</strong>: <code>if (new.target === Shape) throw new TypeError('Shape is abstract')</code> — работает и запрещает прямое инстанцирование, но разрешает наследников. <strong>Устойчивость к забытому new</strong>: <code>if (!new.target) return new Fn(...arguments)</code> — так писали до классов, и так до сих пор устроены многие библиотеки. <strong>Обратный запрет</strong>: фабрика, которая падает, если её позвали через <code>new</code>. <strong>Имя конкретного класса</strong>: <code>this.name = new.target.name</code> в базовом классе ошибок — каждый наследник автоматически получает правильный <code>name</code> без ручного дублирования. <strong>Восстановление прототипа</strong> в транспилированных наследниках Error: <code>Object.setPrototypeOf(this, new.target.prototype)</code>.</p>
    <p><code>Reflect.construct(Target, args, newTarget)</code> позволяет задать <code>new.target</code> явно — так делают фабрики, создающие объект с прототипом одного класса через конструктор другого, и так Babel эмулирует наследование от встроенных типов.</p>

    <h4>Почему так</h4>
    <p>До ES6 отличить <code>Fn()</code> от <code>new Fn()</code> можно было только эвристикой <code>this instanceof Fn</code>, которая врёт при <code>call</code> с подходящим объектом. Мета-свойство даёт честный ответ от движка. Цена — ещё одна неявная сущность в конструкторе, о которой легко забыть при рефакторинге в фабричную функцию.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Стрелочные функции не имеют собственного <code>new.target</code> — берут из внешней области, как и <code>this</code>; внутри стрелки в методе он будет <code>undefined</code>.</li>
      <li><code>new.target.name</code> ломается при минификации: имена классов терминируются, и в проде вместо <code>NotFoundError</code> получается <code>n</code>.</li>
      <li>Проверка <code>new.target === Shape</code> ломается при копировании класса или при двух копиях модуля — надёжнее сравнивать не по ссылке, а через <code>new.target.prototype</code> и брендинг.</li>
      <li>В обычной функции вне конструктора <code>new.target</code> это <code>undefined</code>, а на верхнем уровне модуля — синтаксическая ошибка.</li>
      <li>Стрелка, объявленная как поле класса, вычисляется во время конструирования, но <code>new.target</code> там уже <code>undefined</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сделать абстрактный метод?»</strong> — базовый метод бросает <code>new Error('not implemented')</code>; проверить наличие переопределения можно в конструкторе через <code>new.target.prototype.method === Base.prototype.method</code>. <strong>«Зачем Reflect.construct с третьим аргументом?»</strong> — чтобы создать объект встроенного типа, но с прототипом вашего класса; это единственный корректный способ наследовать Array и Error в транспилированном коде. <strong>«Можно ли запретить наследование?»</strong> — проверить <code>new.target !== MyClass</code> и бросить, либо пометить конструктор как final по соглашению; языковой поддержки <code>final</code> в JS нет.</p>`,
    code: `class Shape {
  constructor() {
    if (new.target === Shape) throw new TypeError('Shape is abstract');
    this.kind = new.target.name;
  }
}
class Circle extends Shape {}
new Circle().kind;   // 'Circle'
// new Shape();      // TypeError

// устойчивость к забытому new (стиль библиотек)
function Money(amount) {
  if (!new.target) return new Money(amount);
  this.amount = amount;
}
Money(5) instanceof Money;   // true

// подмена new.target
const arr = Reflect.construct(Array, [1, 2, 3], MyArray);
Object.getPrototypeOf(arr) === MyArray.prototype;   // true`,
    tip: 'Уточните, что стрелочные функции не имеют своего new.target — как и this, они берут его из внешней области; и что new.target.name небезопасен после минификации.' },

  { id: 'jsx23',
    q: 'Расскажи про тонкости typeof: какие результаты он даёт и какие из них — исторические баги?',
    a: `<h4>Коротко</h4>
    <p><code>typeof</code> возвращает одну из восьми строк: <code>'undefined'</code>, <code>'boolean'</code>, <code>'number'</code>, <code>'string'</code>, <code>'bigint'</code>, <code>'symbol'</code>, <code>'function'</code>, <code>'object'</code>. Он единственный оператор, который не бросает <code>ReferenceError</code> на необъявленной переменной — но TDZ он не обходит.</p>

    <h4>Как это работает</h4>
    <p>Оператор получает <strong>Reference</strong>, а не значение, и если ссылка неразрешима, сразу возвращает <code>'undefined'</code> вместо разыменования. Именно это делает <code>typeof someGlobal !== 'undefined'</code> классической проверкой наличия глобала. Но переменные <code>let</code>, <code>const</code> и <code>class</code> в temporal dead zone — это <strong>разрешимая</strong> ссылка на неинициализированный биндинг, поэтому <code>typeof</code> для них бросает <code>ReferenceError</code>. Формулировка «typeof безопасен для undeclared, но не для TDZ» точно передаёт разницу: TDZ означает «переменная есть, но ещё не инициализирована», а не «переменной нет».</p>
    <p><code>typeof null === 'object'</code> — баг первой реализации: значения хранились как тег типа плюс данные, тег <code>000</code> означал объект, а <code>null</code> был нулевым указателем и попадал под тот же тег. Предложение вернуть <code>'null'</code> отклонили из-за обратной совместимости.</p>
    <p><code>typeof function</code> даёт <code>'function'</code>, хотя функция — объект: спецификация выделяет отдельную ветку для всего, что имеет внутренний метод <code>[[Call]]</code>. Поэтому классы тоже дают <code>'function'</code>, а <code>class</code> без <code>new</code> бросает <code>TypeError</code>.</p>
    <p><code>typeof document.all</code> даёт <code>'undefined'</code> — легально прописанное в HTML-спецификации исключение ради старых сайтов; это же единственный falsy объект в языке.</p>

    <h4>Почему так</h4>
    <p><code>typeof</code> создавался как «безопасный» оператор для скриптов, работающих в неизвестном окружении: проверить наличие API до его использования. Из-за этого он не различает объекты между собой — все структуры, массивы, даты и <code>null</code> для него одинаковы, и для реальной проверки типа нужны <code>Array.isArray</code>, <code>Object.prototype.toString</code> или brand check.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>typeof NaN === 'number'</code> — тип не помогает, нужен <code>Number.isNaN</code>.</li>
      <li><code>typeof []</code> и <code>typeof null</code> оба дают <code>'object'</code>: проверка <code>typeof x === 'object'</code> без <code>x !== null</code> — вечный источник <code>Cannot read property of null</code>.</li>
      <li>В TypeScript <code>typeof</code> — ещё и оператор уровня типов; путаница между ними частая на собеседовании.</li>
      <li>Проверка <code>typeof window !== 'undefined'</code> для SSR работает, а <code>window !== undefined</code> — нет: второе бросает <code>ReferenceError</code> в Node.</li>
      <li>Обёртки: <code>typeof new Number(1)</code> это <code>'object'</code>, а не <code>'number'</code> — редко, но встречается после <code>JSON</code>-реviver-ов и старых библиотек.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как отличить массив от объекта?»</strong> — <code>Array.isArray</code>, потому что он работает кросс-realm, в отличие от <code>instanceof Array</code>. <strong>«Как проверить, что значение — plain object?»</strong> — <code>Object.prototype.toString.call(x) === '[object Object]'</code> плюс проверка прототипа на <code>Object.prototype</code> или <code>null</code>; универсального одного оператора нет. <strong>«Почему typeof не бросает на undeclared?»</strong> — он работает с Reference, а не со значением, и для неразрешимой ссылки сразу возвращает строку; это единственный оператор с таким поведением, и на нём держатся все проверки наличия глобалов.</p>`,
    code: `typeof undefined;        // 'undefined'
typeof null;             // 'object'   — исторический баг
typeof NaN;              // 'number'
typeof class {};         // 'function'
typeof Symbol();         // 'symbol'
typeof 10n;              // 'bigint'
typeof document.all;     // 'undefined' — легальное исключение в HTML-спеке
typeof notDeclared;      // 'undefined' — не бросает

// typeof letBeforeInit; // ReferenceError — TDZ сильнее typeof
let letBeforeInit = 1;

// безопасная проверка объекта
const isObject = x => x !== null && typeof x === 'object';`,
    tip: 'Фраза «typeof безопасен для undeclared, но не для TDZ» показывает, что вы понимаете: TDZ — это не «переменной нет», а «переменная есть, но неинициализирована».' },

  { id: 'jsx24',
    q: 'Как работает instanceof на самом деле и в каких случаях он врёт? Что делает Symbol.hasInstance?',
    a: `<h4>Коротко</h4>
    <p><code>obj instanceof C</code> сначала ищет у <code>C</code> метод <code>Symbol.hasInstance</code> и вызывает его, если он есть. Иначе берётся <code>C.prototype</code> и проверяется, встречается ли он в цепочке прототипов <code>obj</code>. То есть оператор проверяет <strong>прототип</strong>, а не «происхождение от конструктора».</p>

    <h4>Как это работает</h4>
    <p>Алгоритм <code>InstanceofOperator</code>: если правый операнд не объект — <code>TypeError</code>; если у него есть <code>Symbol.hasInstance</code> — вызвать и привести результат к boolean; иначе, если он не callable — <code>TypeError</code>; иначе выполнить <code>OrdinaryHasInstance</code>: взять <code>C.prototype</code> и идти вверх по <code>[[GetPrototypeOf]]</code> от объекта, сравнивая по ссылке.</p>
    <p>Отсюда три случая, где он врёт. Первый — <strong>разные realm</strong>: массив из iframe, из <code>vm</code> в Node или из воркера имеет <strong>другой</strong> <code>Array.prototype</code>, поэтому <code>instanceof Array</code> даёт <code>false</code> при абсолютно правильном массиве. Ровно поэтому в языке существует <code>Array.isArray</code> — он проверяет внутренний слот, а не прототип. Тот же эффект дают <code>Error</code>, <code>Date</code> и промисы из другой копии библиотеки в <code>node_modules</code>.</p>
    <p>Второй — <strong>подмена прототипа</strong>: <code>Object.setPrototypeOf(obj, X.prototype)</code> или переприсваивание <code>C.prototype</code> меняет результат задним числом для уже созданных объектов. Третий — <strong>транспиляция</strong>: наследники Error и Array при таргете ES5 теряют прототип.</p>
    <p><code>Symbol.hasInstance</code> позволяет заменить проверку на любую логику — например, структурную («утиную») типизацию. Он всегда объявляется как <code>static</code> и получает проверяемое значение.</p>

    <h4>Почему так</h4>
    <p><code>instanceof</code> проверяет прототип, потому что в JS нет номинальных типов: «класс» — это функция плюс объект-прототип, и единственный объективный признак родства — цепочка. Хук <code>Symbol.hasInstance</code> добавили ради обёрток и полифиллов, но он же делает оператор ненадёжным: читатель ожидает проверку прототипа, а получает произвольный код.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Две копии одной библиотеки в бандле — и <code>err instanceof AppError</code> внезапно <code>false</code> в проде и <code>true</code> локально.</li>
      <li><code>instanceof</code> с примитивом всегда <code>false</code>: <code>'a' instanceof String</code> это <code>false</code>, потому что примитив не имеет собственной цепочки.</li>
      <li>Правый операнд-стрелка бросает <code>TypeError</code>: у стрелок нет <code>prototype</code>.</li>
      <li><code>Symbol.hasInstance</code> можно подменить и на встроенных классах — то есть <code>instanceof</code> в принципе не является проверкой безопасности.</li>
      <li>Проверка <code>x instanceof Object</code> даёт <code>false</code> для <code>Object.create(null)</code>, хотя это объект.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем заменить instanceof?»</strong> — для встроенных типов специализированные предикаты (<code>Array.isArray</code>, <code>Number.isInteger</code>, <code>Error.isError</code> из ES2025); для своих классов brand check через <code>#field in obj</code> или дискриминант <code>err.code</code>. <strong>«Почему Array.isArray вообще существует?»</strong> — именно из-за realm: это лучший короткий пример проблемы, и его стоит назвать первым. <strong>«Что произойдёт при <code>Object.setPrototypeOf</code> после создания объекта?»</strong> — результат <code>instanceof</code> изменится задним числом, а объект вдобавок потеряет оптимизации V8: смена прототипа переводит его в медленное представление.</p>`,
    code: `class Iterable {
  static [Symbol.hasInstance](x) {
    return x != null && typeof x[Symbol.iterator] === 'function';
  }
}
[] instanceof Iterable;      // true
'abc' instanceof Iterable;   // true
({}) instanceof Iterable;    // false

// realm: массив из iframe
const iframe = document.createElement('iframe');
document.body.append(iframe);
const foreign = new iframe.contentWindow.Array(1, 2);
foreign instanceof Array;    // false
Array.isArray(foreign);      // true

'a' instanceof String;       // false — примитив`,
    tip: 'Назовите конкретный кейс: Array.isArray существует именно потому, что instanceof Array ломается через iframe. Второй по силе пример — две копии пакета в node_modules.' },

  { id: 'jsx25',
    q: 'Зачем нужен Object.prototype.toString.call(x) и как на него влияет Symbol.toStringTag?',
    a: `<h4>Коротко</h4>
    <p>Он возвращает <code>'[object Type]'</code> и исторически был единственным способом отличить массив от объекта, дату от объекта и <code>null</code> от <code>undefined</code>. Работает кросс-realm, потому что смотрит на внутренние слоты и на <code>Symbol.toStringTag</code>, а не на цепочку прототипов.</p>

    <h4>Как это работает</h4>
    <p>Алгоритм такой: если аргумент <code>undefined</code> — вернуть <code>'[object Undefined]'</code>, если <code>null</code> — <code>'[object Null]'</code>. Иначе привести к объекту и определить builtinTag по внутренним слотам: <code>Array</code> (есть <code>[[ArrayLength]]</code>), <code>Function</code> (есть <code>[[Call]]</code>), <code>Error</code>, <code>Boolean</code>, <code>Number</code>, <code>String</code>, <code>Date</code>, <code>RegExp</code>, <code>Arguments</code>; для всего остального — <code>Object</code>. Затем прочитать свойство <code>Symbol.toStringTag</code>: если это строка, использовать её вместо builtinTag.</p>
    <p>У <code>Map</code>, <code>Set</code>, <code>WeakMap</code>, <code>Promise</code>, <code>Symbol</code>, генераторов, <code>ArrayBuffer</code>, типизированных массивов и модульных namespace-объектов <code>Symbol.toStringTag</code> определён на прототипе как non-writable, configurable accessor — поэтому они и различаются.</p>
    <p>Свои классы могут задать тег геттером или полем. Это влияет ровно на два места: результат этого метода и отладочный вывод — <code>console.log</code> и <code>util.inspect</code> в Node печатают тег в заголовке объекта. На <code>typeof</code> и <code>instanceof</code> тег не влияет никак.</p>
    <p>Типовая обёртка — <code>const type = x =&gt; Object.prototype.toString.call(x).slice(8, -1)</code>, дающая <code>'Null'</code>, <code>'Array'</code>, <code>'Map'</code>, <code>'Promise'</code>.</p>

    <h4>Почему так</h4>
    <p>Метод остался от ES3, где он был единственным окном во внутреннее устройство значения, и его пришлось сохранить ради совместимости. <code>Symbol.toStringTag</code> добавили в ES6, чтобы новые встроенные типы различались тем же механизмом, а пользовательские классы могли к нему подключиться. Цена — тег подделывается одной строчкой, поэтому это <strong>эвристика для диагностики, а не проверка безопасности</strong>.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Подкласс Array даёт <code>'[object Array]'</code> — метод не отличает наследника от базового типа.</li>
      <li>Любой объект может объявить <code>[Symbol.toStringTag] = 'Array'</code> и притвориться массивом; для валидации входных данных это непригодно.</li>
      <li>Обёртки примитивов дают <code>'[object Number]'</code> вместо <code>'[object Object]'</code>, поэтому «плоские» проверки типа иногда ошибаются на legacy-данных.</li>
      <li>Прямой вызов <code>x.toString()</code> вместо <code>call</code> сработает по-другому: у массивов и дат он переопределён.</li>
      <li>Тег не наследуется автоматически: подкласс Map тег унаследует, а ваш класс без явного геттера даст <code>'[object Object]'</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем это лучше typeof?»</strong> — различает объекты между собой и правильно обрабатывает <code>null</code>; но медленнее и не является гарантией. <strong>«Что использовать для настоящей проверки?»</strong> — специализированные предикаты (<code>Array.isArray</code>, <code>Number.isInteger</code>) и brand check через приватное поле; <code>toStringTag</code> оставить для логов. <strong>«Почему <code>[object Null]</code>, а не ошибка?»</strong> — спецификация обрабатывает <code>null</code> и <code>undefined</code> явными ветками до приведения к объекту, поэтому этот метод — единственный встроенный способ отличить их одной операцией.</p>`,
    code: `const type = x => Object.prototype.toString.call(x).slice(8, -1);
type(null);               // 'Null'
type(undefined);          // 'Undefined'
type([]);                 // 'Array'
type(new Map());          // 'Map'
type(Promise.resolve());  // 'Promise'
type(function* () {});    // 'GeneratorFunction'

class Temperature {
  get [Symbol.toStringTag]() { return 'Temperature'; }
}
type(new Temperature());  // 'Temperature'
console.log(new Temperature());   // Temperature {} — читаемый лог

// подделка: тег ничего не гарантирует
type({ [Symbol.toStringTag]: 'Array' });   // 'Array'`,
    tip: 'Стоит добавить, что console.log и util.inspect в Node тоже используют toStringTag — это дешёвый способ улучшить читаемость логов своих классов, и одновременно причина не доверять тегу как проверке.' },

  { id: 'jsx26',
    q: 'Почему 0.1 + 0.2 !== 0.3 и как правильно сравнивать и хранить дробные числа?',
    a: `<h4>Коротко</h4>
    <p>Все числа в JS — IEEE 754 double: 1 бит знака, 11 бит экспоненты, 52 бита мантиссы. 0.1 и 0.2 в двоичной системе — бесконечные периодические дроби, они округляются при хранении, и сумма округлений даёт 0.30000000000000004. Это свойство binary floating point, а не баг JS: то же самое в C, Java и Python.</p>

    <h4>Как это работает</h4>
    <p>Каждое число хранится как <code>знак × мантисса × 2^экспонента</code>. Точно представимы только дроби со знаменателем — степенью двойки: 0.5, 0.25, 0.125. 0.1 требует бесконечного двоичного разложения, поэтому в памяти лежит ближайшее представимое значение, чуть большее 0.1. При сложении накопленные ошибки выходят за пределы точности результата и становятся видны при печати.</p>
    <p>Печать тоже неочевидна: <code>toString</code> выводит <strong>кратчайшую строку, которая при обратном чтении даёт то же число</strong>. Поэтому 0.1 печатается как <code>0.1</code>, хотя хранится не ровно 0.1, а сумма печатается со всеми знаками — кратчайшего представления у неё нет.</p>
    <p>Сравнивать нужно с допуском, причём <strong>относительным</strong>. <code>Number.EPSILON</code> — это 2⁻⁵², минимальная различимая разница около единицы; для чисел порядка миллиона он бессмысленно мал, для чисел порядка 10⁻¹⁰ — бессмысленно велик. Корректная проверка масштабирует эпсилон по величине операндов.</p>
    <p>Для денег правило жёсткое: <strong>не хранить в float</strong>. Хранить целые в минимальных единицах (копейки, центы) или в <code>BigInt</code>, считать в целых, а форматировать через <code>Intl.NumberFormat</code>. Библиотеки decimal.js и dinero.js делают ровно это.</p>

    <h4>Почему так</h4>
    <p>Один числовой тип на всё был решением ради простоты языка в 1995 году, и double выбран как компромисс между диапазоном и точностью, поддержанный аппаратно. Плата — невозможность точно представить десятичные дроби, из-за чего финансовые расчёты в JS требуют дисциплины, а не встроенной поддержки. Предложение <code>Decimal</code> обсуждается в TC39, но до Stage 3 не дошло.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>(1.005).toFixed(2)</code> даёт <code>'1.00'</code>: хранимое значение чуть меньше 1.005, и округление формально корректно.</li>
      <li>Накопление в цикле: сложение 0.1 сто раз даёт 9.99999999999998 — суммировать надо целые, а делить один раз в конце.</li>
      <li><code>Math.abs(a - b) &lt; Number.EPSILON</code> без масштабирования ложно-отрицательно для больших чисел и ложно-положительно для очень маленьких.</li>
      <li>Проценты и НДС: <code>price * 0.2</code> в float даёт копеечные расхождения, которые бухгалтерия находит на отчёте за квартал.</li>
      <li><code>JSON</code> не различает <code>1</code> и <code>1.0</code>, поэтому округление «туда-обратно» через API теряет намерение.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как хранить деньги?»</strong> — целое количество минимальных единиц плюс код валюты; никаких <code>float</code> ни в БД, ни в JSON. <strong>«А если валюта с тремя знаками?»</strong> — множитель зависит от валюты (JOD, KWD — 1000), поэтому в модели денег хранят и exponent, а форматируют через <code>Intl.NumberFormat</code> с <code>currency</code>, который знает правильное число знаков. <strong>«Почему нельзя просто округлять после каждой операции?»</strong> — ошибки округления накапливаются в свою сторону, и итог расходится с суммой строк; правильный порядок — считать в целых и округлять один раз при выводе.`,
    code: `0.1 + 0.2;               // 0.30000000000000004
0.1 + 0.2 === 0.3;       // false

const nearlyEqual = (a, b, eps = Number.EPSILON) =>
  Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
nearlyEqual(0.1 + 0.2, 0.3);   // true

(1.005).toFixed(2);      // '1.00' — представление, а не баг округления

// деньги: целые минимальные единицы
const cents = 1999;
new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })
  .format(cents / 100);          // деление один раз, только для вывода`,
    tip: 'Не останавливайтесь на «это IEEE 754» — сразу переходите к деньгам в целых центах и к тому, что множитель зависит от валюты: это показывает продуктовый опыт, а не теорию.' },

  { id: 'jsx27',
    q: 'Когда нужен BigInt, какие у него ограничения и как его сериализовать?',
    a: `<h4>Коротко</h4>
    <p>BigInt нужен, когда целое выходит за <code>Number.MAX_SAFE_INTEGER</code> (2⁵³−1): snowflake-id из Twitter и Discord, суммы в минимальных единицах у криптовалют, хеши, счётчики из 64-битных полей БД. Литерал — суффикс <code>n</code> или <code>BigInt(x)</code>. Точность произвольная, ограничена только памятью.</p>

    <h4>Как это работает</h4>
    <p>BigInt — отдельный примитивный тип (<code>typeof</code> даёт <code>'bigint'</code>) с собственной арифметикой произвольной точности. Смешивать его с <code>Number</code> в арифметике <strong>запрещено</strong> — <code>TypeError</code>. Это сделано намеренно: неявное приведение либо потеряло бы точность BigInt, либо превратило бы всё в медленную большую арифметику. Унарный <code>+</code> тоже запрещён (он зарезервирован под asm.js), а <code>Math.*</code> с BigInt не работает.</p>
    <p>Деление целочисленное с усечением к нулю: <code>7n / 2n</code> это <code>3n</code>. Сравнения между типами <strong>разрешены</strong>: <code>1n == 1</code> это <code>true</code>, <code>1n &lt; 2</code> это <code>true</code>, а <code>1n === 1</code> — <code>false</code>, потому что типы разные. Это единственное место, где <code>==</code> реально полезен.</p>
    <p><code>JSON.stringify</code> на BigInt бросает <code>TypeError: Do not know how to serialize a BigInt</code>. Решения: replacer, превращающий BigInt в строку, и reviver на приёме; либо <code>BigInt.prototype.toJSON</code> — но патчить прототип встроенного типа глобально опасно. Именно поэтому крупные API отдают id строками, а не числами: <code>Number</code> потерял бы точность молча, а строка проходит через JSON без изменений.</p>
    <p>Для бинарных протоколов и WASM есть <code>BigInt64Array</code> и <code>BigUint64Array</code> — единственный способ работать с 64-битными целыми в типизированных массивах.</p>

    <h4>Почему так</h4>
    <p>Добавить точность в существующий <code>Number</code> было невозможно без слома всего кода, поэтому сделали отдельный тип с явной границей. Строгий запрет на смешивание — это выбор «громкая ошибка вместо тихой потери точности». Цена — BigInt заметно медленнее: он не помещается в smi-представление, аллоцируется в куче и не оптимизируется JIT так же, как числа.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>Number(bigInt)</code> молча теряет точность выше 2⁵³ — самый частый способ «случайно» испортить id.</li>
      <li><code>JSON.parse</code> уже потерял точность к моменту, когда вы решите конвертировать: число разобрано в double до вашего reviver-а (в ES2025 это решает <code>context.source</code>).</li>
      <li>Смешанная арифметика падает даже в безобидных местах: <code>bigInt + 1</code>, <code>arr.length + bigInt</code>, <code>bigInt * 0.5</code>.</li>
      <li><code>BigInt</code> нельзя использовать в <code>Math.max</code>, в <code>Date</code>, в побитовых операциях вместе с числами.</li>
      <li>В горячих циклах BigInt может быть в разы медленнее — если значения помещаются в safe integer, он не нужен.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как принять большой id с бэкенда без потерь?»</strong> — просить строку и делать <code>BigInt(str)</code>; либо парсить JSON с <code>reviver</code> и <code>context.source</code> в ES2025. <strong>«BigInt или строка для id в модели?»</strong> — строка, если над id нет арифметики: она проще, сериализуется и не тянет запрет на смешивание. <strong>«Как сравнить BigInt и Number корректно?»</strong> — реляционные операторы и <code>==</code> между ними работают штатно и без потери точности, а <code>===</code> всегда даёт <code>false</code>: типы разные.`,
    code: `const big = 9007199254740993n;
Number(big);      // 9007199254740992 — молча потеряли единицу
// big + 1;       // TypeError: Cannot mix BigInt and other types
big + 1n;         // 9007199254740994n
7n / 2n;          // 3n — усечение
1n == 1;          // true
1n === 1;         // false

JSON.stringify({ id: big }, (k, v) =>
  typeof v === 'bigint' ? v.toString() : v);   // '{"id":"9007199254740993"}'

JSON.parse('{"id":"9007199254740993"}', (k, v) =>
  k === 'id' ? BigInt(v) : v);`,
    tip: 'Упомяните, что BigInt64Array и BigUint64Array — единственный способ работать с 64-битными целыми в бинарных протоколах и WASM; это выводит ответ за пределы «числа бывают большие».' },

  { id: 'jsx28',
    q: 'Чем отличаются ===, Object.is и SameValueZero? Где это проявляется на практике?',
    a: `<h4>Коротко</h4>
    <p>Три алгоритма различаются ровно в двух точках — <code>NaN</code> и <code>-0</code>. <code>===</code> (Strict Equality): <code>NaN !== NaN</code>, <code>+0 === -0</code>. <code>Object.is</code> (SameValue): <code>NaN</code> равен <code>NaN</code>, <code>+0</code> и <code>-0</code> различны. <code>SameValueZero</code> — гибрид: <code>NaN</code> равен <code>NaN</code>, <code>+0</code> и <code>-0</code> равны.</p>

    <h4>Как это работает</h4>
    <p>SameValueZero — это то, что использует <code>Array.prototype.includes</code>, а также ключи <code>Map</code> и <code>Set</code>. Отсюда самый показательный контраст: <code>[NaN].includes(NaN)</code> это <code>true</code>, а <code>[NaN].indexOf(NaN)</code> это <code>-1</code>, потому что <code>indexOf</code> использует <code>===</code>. <code>new Set([NaN, NaN]).size</code> равен 1, и <code>new Set([0, -0]).size</code> тоже 1.</p>
    <p><code>Object.is</code> нужен ровно тогда, когда важен знак нуля или требуется «математическое» равенство <code>NaN</code>. Именно его использует React для сравнения state и массивов зависимостей — поэтому <code>setState(NaN)</code> при текущем значении <code>NaN</code> не вызовет ререндер, что иногда удивляет.</p>
    <p><code>-0</code> появляется чаще, чем кажется: <code>Math.round(-0.4)</code>, <code>-1 * 0</code>, <code>Math.min(0, -0)</code>, парсинг строки <code>'-0'</code>, <code>0 / -Infinity</code>. Он ломает две вещи. Деление: <code>1 / -0</code> это <code>-Infinity</code>, поэтому знак нуля утекает в результат. Сериализация: <code>JSON.stringify(-0)</code> даёт <code>'0'</code>, и после round-trip знак теряется — то есть <code>-0</code> не переживает передачу по сети.</p>

    <h4>Почему так</h4>
    <p><code>NaN !== NaN</code> прописано в IEEE 754: «не число» не равно ничему, включая себя, потому что два разных невычислимых результата не обязаны совпадать. <code>+0 === -0</code> тоже из IEEE — они математически равны, различается только бит знака. <code>Object.is</code> добавили в ES6 как «истинное тождество значений» для метапрограммирования и для дифференцирующих алгоритмов, а SameValueZero — как «то же самое, но нулю прощаем знак», потому что для поиска в коллекции знак нуля не должен иметь значения.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>indexOf</code> и <code>lastIndexOf</code> никогда не найдут <code>NaN</code> — типичный баг фильтрации «есть ли такое значение».</li>
      <li><code>Object.is(a, b)</code> — <strong>не</strong> глубокое сравнение: для объектов это всё та же проверка по ссылке.</li>
      <li><code>Object.is(0, -0) === false</code> ломает наивную мемоизацию, если в данных появляется <code>-0</code> из умножения.</li>
      <li><code>Map</code> с ключом <code>NaN</code> работает корректно, а объект с таким ключом превращает его в строку <code>'NaN'</code>.</li>
      <li>Сравнение через <code>===</code> в тестах на <code>NaN</code> даёт вечно проваливающийся ассерт; нужны <code>toBeNaN</code> или <code>Object.is</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как проверить NaN?»</strong> — <code>Number.isNaN(x)</code> или <code>Object.is(x, NaN)</code>; глобальный <code>isNaN</code> сначала приводит тип и потому врёт на строках. <strong>«Зачем вообще различать <code>-0</code>?»</strong> — в геометрии и физике знак нуля кодирует направление подхода к пределу, и его потеря даёт скачок направления; в прикладном коде это чаще источник багов, чем польза. <strong>«Какой алгоритм использует <code>Array.prototype.sort</code> для равенства?»</strong> — никакого: он опирается только на компаратор, поэтому <code>NaN</code> в данных даёт непредсказуемый порядок и его надо отфильтровать до сортировки.</p>`,
    code: `NaN === NaN;              // false
Object.is(NaN, NaN);      // true
Object.is(+0, -0);        // false
+0 === -0;                // true

[NaN].indexOf(NaN);       // -1   (===)
[NaN].includes(NaN);      // true (SameValueZero)
new Set([NaN, NaN]).size; // 1
new Set([0, -0]).size;    // 1
new Map([[NaN, 'a']]).get(NaN);   // 'a'

1 / Math.round(-0.4);     // -Infinity — знак нуля утёк
JSON.parse(JSON.stringify(-0));   // 0 — знак потерян`,
    tip: 'Пара indexOf/includes с NaN — идеальный короткий ответ: он одновременно показывает знание трёх алгоритмов и практическое следствие, а упоминание Object.is в React добавляет прикладной контекст.' },

  { id: 'jsx29',
    q: 'Что такое Number.MAX_SAFE_INTEGER и какие ещё ловушки есть при работе с числами и округлением?',
    a: `<h4>Коротко</h4>
    <p><code>Number.MAX_SAFE_INTEGER</code> = 2⁵³−1 = 9007199254740991. До него каждое целое представимо точно и каждое целое имеет единственное представление; дальше значения начинают «выпадать»: <code>2**53 === 2**53 + 1</code> это <code>true</code>. Проверка — <code>Number.isSafeInteger</code>.</p>

    <h4>Как это работает</h4>
    <p>У double 52 бита мантиссы плюс неявная единица, то есть 53 значащих бита. Пока целое помещается в 53 бита, шаг между соседними представимыми числами равен 1. Выше — шаг становится 2, потом 4, и так далее. Поэтому id из БД, превышающий 2⁵³, нельзя передавать числом в JSON: он молча округлится ещё на этапе <code>JSON.parse</code>.</p>
    <p><strong><code>parseInt</code> против <code>Number</code>.</strong> <code>parseInt</code> читает числовой префикс и молча игнорирует хвост: <code>parseInt('12px')</code> это 12, <code>parseInt('1e3')</code> это 1 (экспоненту он не понимает), <code>parseInt('0.00000005')</code> это 5, потому что строка сначала печатается как <code>'5e-8'</code>. <code>Number</code> требует, чтобы вся строка была числом, зато <code>Number('')</code> это 0. Классическая ловушка — <code>['1','2','3'].map(parseInt)</code> даёт <code>[1, NaN, NaN]</code>: второй аргумент <code>map</code> — индекс, который попадает в параметр <code>radix</code>.</p>
    <p><strong>Округление.</strong> <code>Math.round</code> округляет половину вверх (к плюс бесконечности), поэтому <code>Math.round(-0.5)</code> это <code>-0</code>, а не <code>-1</code>. <code>Math.trunc</code>, <code>Math.floor</code>, <code>Math.ceil</code> различаются на отрицательных числах. <code>toFixed</code> возвращает <strong>строку</strong> и округляет по фактическому двоичному значению, а не «как в школе». Для вывода правильный инструмент — <code>Intl.NumberFormat</code>, у которого с ES2023 есть <code>roundingMode</code> (<code>halfExpand</code>, <code>halfEven</code>, <code>trunc</code>, <code>ceil</code>) и <code>roundingIncrement</code>.</p>
    <p><strong>Побитовые операторы</strong> приводят операнд к <strong>32-битному</strong> знаковому int через ToInt32, поэтому <code>~~x</code> и <code>x | 0</code> ломаются выше 2³¹−1 и на дробях с большим модулем. Как «быстрый <code>Math.trunc</code>» их использовать нельзя. Исключение — <code>&gt;&gt;&gt;</code>, дающий unsigned 32-битный результат.</p>

    <h4>Почему так</h4>
    <p>Один тип <code>Number</code> на все числа упрощает язык, но переносит ответственность на разработчика: границы безопасности не проверяются автоматически, а переполнение не бросает исключение — оно просто тихо меняет результат. Побитовые операторы унаследовали 32-битную семантику из Java-подобного синтаксиса 1995 года и уже не могут её поменять.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Проверка <code>id &gt; Number.MAX_SAFE_INTEGER</code> бесполезна после <code>JSON.parse</code> — точность потеряна раньше.</li>
      <li><code>parseFloat('1.2.3')</code> это 1.2, а <code>Number('1.2.3')</code> это <code>NaN</code>: две разные политики «мягкости».</li>
      <li><code>toFixed</code> даёт строку, и <code>'0.30' + 1</code> внезапно становится <code>'0.301'</code>.</li>
      <li><code>Math.max()</code> без аргументов возвращает <code>-Infinity</code>, а <code>Math.max(...hugeArray)</code> переполняет стек на сотнях тысяч элементов.</li>
      <li><code>+'0x10'</code> это 16, а <code>parseInt('0x10')</code> тоже 16, но <code>parseInt('0x10', 10)</code> это 0 — явный radix меняет смысл.</li>
      <li><code>Number.EPSILON</code> — это не «минимальное число», а шаг около единицы; минимальное положительное — <code>Number.MIN_VALUE</code> ≈ 5e-324.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Почему <code>map(parseInt)</code> ломается?»</strong> — из-за арности: <code>parseInt</code> принимает два аргумента, а <code>map</code> передаёт три; лечится <code>map(Number)</code> или <code>map(s =&gt; parseInt(s, 10))</code>. <strong>«Как безопасно округлить до копеек?»</strong> — считать в целых минимальных единицах, а для вывода использовать <code>Intl.NumberFormat</code>; <code>toFixed</code> оставить для логов. <strong>«Чем isSafeInteger отличается от isInteger?»</strong> — <code>isInteger</code> проверяет только целостность, поэтому <code>2**53</code> его проходит, а <code>isSafeInteger</code> — нет.</p>`,
    code: `Number.MAX_SAFE_INTEGER;      // 9007199254740991
2 ** 53 === 2 ** 53 + 1;      // true
Number.isInteger(2 ** 53);    // true
Number.isSafeInteger(2 ** 53);// false

['1','2','3'].map(parseInt);  // [1, NaN, NaN] — индекс попал в radix
['1','2','3'].map(Number);    // [1, 2, 3]

Math.round(-0.5);             // -0
(2 ** 31) | 0;                // -2147483648 — переполнение int32

new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', roundingMode: 'halfEven'
}).format(1234.5);            // '1 234,50 ₽'`,
    tip: 'map(parseInt) — вопрос-детектор внимательности; всегда добавляйте, что корень проблемы в арности колбэка, а не в самом parseInt, и что лечится это через map(Number).' },

  { id: 'jsx30',
    q: 'Почему у строки с эмодзи length больше, чем видимых символов? Как правильно считать и резать строки?',
    a: `<h4>Коротко</h4>
    <p>Строки в JS — последовательности <strong>UTF-16 code units</strong>, и <code>length</code> считает именно их. Символы вне BMP кодируются суррогатной парой из двух code unit, поэтому <code>'😀'.length</code> это 2. Есть три уровня счёта — code unit, code point и графемный кластер, — и почти всегда пользователю нужен третий.</p>

    <h4>Как это работает</h4>
    <p><strong>Code unit</strong> — 16 бит. По ним работают <code>length</code>, индексация <code>s[i]</code>, <code>charAt</code>, <code>slice</code>, <code>substring</code>, <code>split('')</code> и регулярки без флага <code>u</code>. Разрез посередине суррогатной пары даёт «половину символа» — невалидную строку, которая рендерится как <code>?</code> или ромбик и ломает JSON в некоторых бэкендах.</p>
    <p><strong>Code point</strong> — полный символ Unicode, от одного до двух code unit. По ним идёт итератор строки: <code>for...of</code>, spread, <code>Array.from</code>, <code>codePointAt</code>, <code>String.fromCodePoint</code>, а также регулярки с флагом <code>u</code> или <code>v</code>. Суррогатные пары они не рвут.</p>
    <p><strong>Графемный кластер</strong> — то, что пользователь считает одним символом. Флаг страны — два code point (regional indicators), эмодзи семьи — до семи с ZWJ-склейками, эмодзи с модификатором тона кожи — два, «й» может быть буквой плюс комбинирующим знаком. Единственный стандартный способ получить графемы — <code>Intl.Segmenter</code> с <code>granularity: 'grapheme'</code>; он же умеет <code>'word'</code> и <code>'sentence'</code> с учётом локали.</p>
    <p>Отсюда практика: для лимита символов в UI (счётчик «осталось 20») считать графемами; для обрезки превью резать по графемам; для лимита в БД считать <strong>байты UTF-8</strong>, потому что ограничение обычно там; а <code>length</code> использовать только как грубую оценку.</p>

    <h4>Почему так</h4>
    <p>JS зафиксировал UTF-16 в 1995 году, когда Unicode обещал уместиться в 16 бит. Когда стандарт вырос до 21 бита, менять представление строк было уже нельзя — весь существующий код индексировал по code unit. Суррогатные пары стали компромиссом, а ES6 добавил слой code point поверх, не ломая старый. Цена — три несовпадающих способа посчитать «длину» и вечная путаница.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>slice</code> и <code>substring</code> режут по code unit и создают невалидные суррогаты; проверить строку можно через <code>String.prototype.isWellFormed</code> (ES2024), починить — <code>toWellFormed</code>.</li>
      <li><code>split('')</code> ломает эмодзи; <code>[...s]</code> ломает только графемы, но не суррогаты.</li>
      <li><code>s.toUpperCase().length</code> может отличаться от <code>s.length</code>: немецкая ß превращается в SS.</li>
      <li>Регулярка <code>/./</code> без флага <code>u</code> матчит половину суррогатной пары; <code>/./u</code> — целый code point, но всё ещё не графему.</li>
      <li>Счётчик «осталось символов» по <code>length</code> вычитает 2 за один эмодзи и 7 за семью — пользователи это замечают и пишут в поддержку.</li>
      <li><code>Intl.Segmenter</code> заметно дороже <code>length</code>: на каждом нажатии клавиши в длинном тексте его вызывать не стоит, нужно дебаунсить.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как обрезать строку до N символов безопасно?»</strong> — сегментировать графемами, взять первые N сегментов и склеить; ни <code>slice</code>, ни <code>[...s].slice</code> полностью не подходят. <strong>«Сколько байт занимает эмодзи?»</strong> — в UTF-8 обычно 4 байта на code point, то есть флаг страны это 8 байт, а семья — до 25; считать надо <code>new TextEncoder().encode(s).length</code>.</p>`,
    code: `const s = '👨‍👩‍👧';
s.length;                    // 8 — code units
[...s].length;               // 5 — code points (с ZWJ)
const seg = new Intl.Segmenter('ru', { granularity: 'grapheme' });
[...seg.segment(s)].length;  // 1 — то, что видит пользователь

s.slice(0, 1).isWellFormed();          // false — сломанный суррогат
new TextEncoder().encode(s).length;    // 18 байт в UTF-8

function truncate(str, max) {
  const parts = [...seg.segment(str)];
  return parts.length <= max
    ? str
    : parts.slice(0, max).map(p => p.segment).join('') + '…';
}`,
    tip: 'Назовите три уровня — code unit, code point, графемный кластер — и скажите, какой из них нужен для какой задачи: UI считает графемы, БД считает байты UTF-8, а length не значит почти ничего.' },

  { id: 'jsx31',
    q: 'Что такое нормализация Unicode и почему две одинаковые на вид строки могут быть не равны?',
    a: `<h4>Коротко</h4>
    <p>Один и тот же символ часто имеет несколько представлений: «й» — это либо один code point U+0439, либо композиция «и» U+0438 плюс комбинирующая краткая U+0306. Визуально идентичны, но <code>===</code> даёт <code>false</code> и <code>length</code> разный. <code>String.prototype.normalize</code> приводит обе формы к общему виду.</p>

    <h4>Как это работает</h4>
    <p>Есть четыре формы. <strong>NFC</strong> — каноническая композиция: максимально «склеенное» представление, рекомендованная форма для веба и для хранения. <strong>NFD</strong> — каноническая декомпозиция: базовый символ плюс комбинирующие знаки; удобна, чтобы снять диакритику регуляркой по <code>\\p{M}</code>. <strong>NFKC</strong> и <strong>NFKD</strong> добавляют совместимостные замены: лигатура ﬁ становится fi, ① становится 1, полноширинные латинские буквы становятся обычными, ² становится 2.</p>
    <p>NFKC агрессивен и <strong>теряет информацию</strong>: обратного преобразования нет. Поэтому он годится для нормализации поискового запроса, для сравнения имён пользователей и для защиты от омоглифов, но не для хранения оригинального текста.</p>
    <p>Практика: нормализовать пользовательский ввод в NFC на границе (форма, API), сравнивать нормализованные строки, а для поиска без учёта диакритики использовать NFD плюс удаление комбинирующих знаков.</p>
    <p>Для сравнения по правилам языка одного <code>normalize</code> мало — нужен <code>Intl.Collator</code>. Порядок и «равенство» символов зависят от локали: в шведском ä идёт после z, в немецком — рядом с a; в словацком «ch» это одна буква. <code>sensitivity: 'base'</code> игнорирует регистр и акценты, <code>'accent'</code> — только регистр, <code>'variant'</code> различает всё.</p>

    <h4>Почему так</h4>
    <p>Unicode обязан быть совместим со старыми кодировками, где были и готовые «й», и отдельные комбинирующие знаки. Отменить дубли задним числом невозможно, поэтому стандарт вместо этого определил канонические эквивалентности и алгоритмы нормализации. Плата — любая система, сравнивающая строки, обязана явно решить, в какой форме она их хранит.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>macOS хранит имена файлов в NFD, Linux и Windows — обычно в NFC; сравнение путей без <code>normalize</code> регулярно ломает сборки и git-статусы.</li>
      <li>Строка после нормализации может стать длиннее или короче — ограничение по длине надо применять <strong>после</strong>.</li>
      <li><code>normalize</code> не приводит регистр: для case-insensitive сравнения нужен <code>toLowerCase</code> или <code>Intl.Collator</code>, и <code>toLowerCase</code> зависит от локали (турецкая точка над i).</li>
      <li>NFKC уравнивает визуально разные вещи: «𝟏» и «1» станут одним, что для пароля или кода купона может быть нежелательно.</li>
      <li>Индексы в БД строятся по хранимой форме: если приложение нормализует, а миграция нет, поиск перестаёт находить старые записи.</li>
      <li>Регулярка <code>/й/</code> не найдёт декомпозированный вариант — регулярные выражения работают по code point, а не по каноническим классам.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Где нормализовать — на клиенте или на сервере?»</strong> — на обоих концах на границе ввода, но авторитетной считать серверную: клиент можно обойти. <strong>«Как искать без учёта регистра и акцентов?»</strong> — <code>Intl.Collator(locale, { sensitivity: 'base' })</code> для сравнения или нормализованный ключ поиска (NFD плюс удаление <code>\\p{M}</code> плюс lowercase), сохранённый отдельным полем.</p>`,
    code: `const a = 'й';                      // U+0439
const b = 'и\\u0306';                // и + комбинирующая краткая
a === b;                            // false
a.length === b.length;              // false (1 и 2)
a.normalize('NFC') === b.normalize('NFC');   // true

const deburr = s => s.normalize('NFD').replace(/\\p{M}/gu, '');
deburr('Ёжик');                     // 'Ежик'

'ﬁle'.normalize('NFKC');            // 'file' — лигатура развёрнута

new Intl.Collator('ru', { sensitivity: 'base' }).compare('Ёж', 'еж');  // 0`,
    tip: 'Приведите живой кейс: имена файлов в macOS хранятся в NFD, а в Linux и Windows — в NFC, поэтому сравнение путей без normalize регулярно ломает сборки в CI.' },

  { id: 'jsx32',
    q: 'Что умеет Intl помимо форматирования чисел, и какие задачи он снимает?',
    a: `<h4>Коротко</h4>
    <p>Intl — стандартный доступ к данным CLDR прямо в рантайме, без единого килобайта бандла. Он закрывает числа, даты, относительное время, множественные числа, списки, сортировку, сегментацию текста и названия языков и валют — то есть почти всё, ради чего раньше тянули moment, numeral и самописные хелперы.</p>

    <h4>Как это работает</h4>
    <p><code>Intl.NumberFormat</code> — числа, валюты, проценты, единицы измерения (<code>style: 'unit', unit: 'kilometer-per-hour'</code>), компактная запись (<code>notation: 'compact'</code> даёт «1,2 млн»), <code>signDisplay</code>, <code>roundingMode</code> и <code>roundingIncrement</code> из ES2023, а также <code>formatRange</code> для диапазонов.</p>
    <p><code>Intl.DateTimeFormat</code> — даты с учётом таймзоны (<code>timeZone: 'Europe/Moscow'</code>) и календаря, готовые пресеты <code>dateStyle</code> и <code>timeStyle</code>, <code>formatToParts</code> для сборки собственной вёрстки и <code>formatRange</code> для интервалов («12–15 мая»).</p>
    <p><code>Intl.RelativeTimeFormat</code> убирает самописные «3 дня назад» вместе со склонениями. <code>Intl.PluralRules</code> даёт правильную форму множественного числа: в русском три категории (<code>one</code>, <code>few</code>, <code>many</code>) плюс <code>other</code> для дробей, в арабском — шесть. <code>Intl.ListFormat</code> собирает «A, B и C» по правилам языка, с типами <code>conjunction</code> и <code>disjunction</code>.</p>
    <p><code>Intl.Collator</code> — сортировка и сравнение по локали, с <code>numeric: true</code> для естественного порядка. <code>Intl.Segmenter</code> — разбиение на графемы, слова и предложения. <code>Intl.DisplayNames</code> — названия языков, стран, валют и письменностей на нужном языке. <code>Intl.Locale</code> — разбор и канонизация тегов языка.</p>

    <h4>Почему так</h4>
    <p>Локализационные данные огромны и постоянно меняются; держать их в бандле — сотни килобайт на язык, которые устаревают. Браузер и Node уже содержат ICU, поэтому логично дать к нему API. Обратная сторона: вывод <strong>не гарантирован побитово</strong> — он зависит от версии ICU в конкретном движке. Отсюда правило: не ассертить точные строки в снапшот-тестах, а проверять через <code>formatToParts</code> или фиксировать локаль и версию Node в CI.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Создание форматтера дорого: в цикле его надо создавать один раз и переиспользовать, иначе на тысяче строк таблицы это заметно.</li>
      <li>Неразрывные пробелы: <code>Intl.NumberFormat('ru').format(1000)</code> вставляет U+00A0, и наивное сравнение с <code>'1 000'</code> в тесте падает.</li>
      <li><code>new Date('2026-08-31')</code> — UTC-полночь, поэтому в отрицательных смещениях <code>DateTimeFormat</code> покажет предыдущий день; таймзону надо задавать явно.</li>
      <li>Node без full-icu (старые сборки и некоторые Docker-образы) поддерживает только английский — локализация тихо деградирует.</li>
      <li><code>PluralRules</code> для дробей даёт <code>other</code>, о чём забывают: «1,5 товара» ломает наивную таблицу форм.</li>
      <li><code>Intl</code> не умеет парсить — обратного преобразования из локализованной строки в число нет, это надо писать руками.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как склонять слова после числа?»</strong> — <code>Intl.PluralRules('ru').select(n)</code> и таблица из трёх-четырёх форм; никаких <code>n % 10</code>-эвристик. <strong>«Чем заменить moment.js?»</strong> — <code>Intl.DateTimeFormat</code> для вывода плюс небольшая библиотека или Temporal-полифилл для арифметики; сам moment в режиме поддержки с 2020 года. <strong>«Как тестировать Intl-вывод?»</strong> — сравнивать не строку целиком, а результат <code>formatToParts</code> или зафиксировать локаль и версию Node в CI: неразрывные пробелы и порядок частей меняются между версиями ICU.`,
    code: `const pr = new Intl.PluralRules('ru');
const forms = { one: 'товар', few: 'товара', many: 'товаров', other: 'товара' };
const label = n => n + ' ' + forms[pr.select(n)];
label(1);    // '1 товар'
label(3);    // '3 товара'
label(11);   // '11 товаров'
label(1.5);  // '1.5 товара' — категория other

new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(-1, 'day'); // 'вчера'
new Intl.ListFormat('ru', { type: 'conjunction' }).format(['A','B','C']); // 'A, B и C'

const c = new Intl.Collator(undefined, { numeric: true });
['file10', 'file2'].sort(c.compare);   // ['file2', 'file10']`,
    tip: 'Пример с PluralRules для русского — самый убедительный: три категории вместо двух сразу показывают, почему самописные хелперы всегда ломаются на 11 и на 111.' },

  { id: 'jsx33',
    q: 'Что делает structuredClone и чем он отличается от JSON round-trip и от ручного глубокого копирования?',
    a: `<h4>Коротко</h4>
    <p><code>structuredClone</code> — рантайм-доступ к алгоритму structured clone, тому же, что используется в <code>postMessage</code>, IndexedDB и History API. Он копирует Date, RegExp, Map, Set, ArrayBuffer, TypedArray, Blob, File, Error и корректно обрабатывает <strong>циклические ссылки</strong>, сохраняя разделяемые ссылки внутри графа.</p>

    <h4>Как это работает</h4>
    <p>Алгоритм обходит граф, ведя таблицу уже увиденных объектов. Поэтому цикл <code>src.self = src</code> даёт клон, где <code>clone.self === clone</code>, а два поля, указывающие на один объект, в клоне тоже указывают на один объект. Это принципиальное отличие от наивной рекурсии, которая либо зациклится, либо продублирует общий узел.</p>
    <p>Чего он <strong>не</strong> умеет. Функции, классы и символы — <code>DataCloneError</code>. DOM-узлы, кроме явно поддерживаемых типов, — тоже. Геттеры и сеттеры не переносятся: копируется <strong>вычисленное значение</strong>. Дескрипторы (<code>writable</code>, <code>enumerable</code>) сбрасываются в дефолтные. И главное — <strong>прототип теряется</strong>: клон экземпляра класса становится plain object, приватные поля исчезают, методы недоступны.</p>
    <p>Второй аргумент <code>{ transfer: [buf] }</code> позволяет перенести владение буферами вместо копирования — тот же механизм, что у <code>postMessage</code>.</p>
    <p>JSON round-trip хуже по всем пунктам: теряет <code>undefined</code>, функции и символы, Date превращает в строку, Map и Set — в <code>{}</code>, падает на циклах и на BigInt, а <code>-0</code> становится <code>0</code>. Его единственное преимущество — работает везде и на маленьких plain-объектах быстрее.</p>

    <h4>Почему так</h4>
    <p>Алгоритм проектировался для передачи данных <strong>между агентами</strong> — воркерами, вкладками, процессами. Там нельзя передать функцию (у неё есть замыкание, привязанное к чужой куче) и нельзя передать прототип (класса на той стороне может не быть). Поэтому ограничения не «недоделка», а следствие модели: <strong>structuredClone копирует данные, а не поведение</strong>.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Клон экземпляра класса не проходит <code>instanceof</code> и теряет <code>#</code>-поля — «объект приехал из IndexedDB и сломался».</li>
      <li>Символьные ключи выбрасываются молча, без ошибки: данные исчезают при передаче в воркер.</li>
      <li>Он синхронный и блокирует поток: на графе в сотни тысяч узлов это полноценный long task.</li>
      <li>На простых plain-объектах он <strong>медленнее</strong> JSON round-trip — универсальность стоит проверок типов на каждом узле.</li>
      <li>Ошибка <code>DataCloneError</code> называет тип, но не путь к проблемному полю — искать функцию в большом объекте приходится вручную.</li>
      <li>В Node доступен с версии 17; в старых средах нужен полифилл, который обычно не поддерживает половину типов.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как клонировать объект с классами?»</strong> — сериализовать в plain-структуру своим <code>toJSON</code>/<code>fromJSON</code> либо реализовать <code>static from(data)</code>; автоматического способа нет. <strong>«Что быстрее для plain-объекта?»</strong> — обычно явное копирование известной формы, затем JSON, затем structuredClone; но выбирать надо по требованиям к типам, а не по бенчмарку. <strong>«Как найти, что именно не клонируется?»</strong> — обойти граф своим рекурсивным обходом и попытаться клонировать по узлам: <code>DataCloneError</code> называет тип, но не путь, и на большом объекте это единственный практичный способ.`,
    code: `const src = { d: new Date(), m: new Map([['a', 1]]), n: undefined };
src.self = src;
const c = structuredClone(src);
c.self === c;         // true — цикл сохранён
c.m instanceof Map;   // true
c.n;                  // undefined — ключ сохранён, в отличие от JSON

// JSON.parse(JSON.stringify(src));   // TypeError: circular structure

class P { #x = 1; constructor(n) { this.n = n; } }
structuredClone(new P(1)) instanceof P;   // false — прототип потерян

const buf = new ArrayBuffer(1024);
structuredClone({ buf }, { transfer: [buf] });
buf.byteLength;       // 0 — буфер передан, а не скопирован`,
    tip: 'Ключевая формулировка: structuredClone копирует данные, а не поведение — прототипы, методы, геттеры и приватные поля не переживают клонирование, потому что алгоритм рассчитан на передачу между агентами.' },

  { id: 'jsx34',
    q: 'Как передавать данные между главным потоком и Web Worker? Что такое transferable objects?',
    a: `<h4>Коротко</h4>
    <p>Есть три режима. <strong>Копирование</strong> — <code>postMessage(data)</code> прогоняет данные через structured clone. <strong>Передача владения</strong> — <code>postMessage(data, [buf])</code> переносит буфер за O(1), оставляя исходный detached. <strong>Общая память</strong> — <code>SharedArrayBuffer</code>, где копий нет вовсе, но нужны Atomics и cross-origin isolation.</p>

    <h4>Как это работает</h4>
    <p>По умолчанию <code>postMessage</code> сериализует граф на стороне отправителя и десериализует на стороне получателя. Для больших массивов это дорого дважды: по времени (обход графа блокирует поток) и по памяти (на пике существуют обе копии). Для объекта в 50 МБ это заметная пауза и риск OOM на мобильных.</p>
    <p><strong>Transferable objects</strong> — <code>ArrayBuffer</code>, <code>MessagePort</code>, <code>ImageBitmap</code>, <code>OffscreenCanvas</code>, <code>ReadableStream</code>, <code>WritableStream</code>, <code>TransformStream</code>, <code>RTCDataChannel</code>. Они передаются вторым аргументом: происходит перенос владения без копирования, исходный объект становится <strong>detached</strong> (<code>byteLength === 0</code>) и любое обращение к нему падает. Это правильный способ гонять пиксели, аудио-семплы и бинарные протоколы. Типизированный массив сам по себе не transferable — передавать надо его <code>.buffer</code>.</p>
    <p>Дополнительно: <code>OffscreenCanvas</code> позволяет отдать воркеру канвас и рисовать полностью вне главного потока; <code>MessagePort</code> позволяет построить прямой канал между двумя воркерами, минуя главный.</p>
    <p>Практически поверх этого удобно класть <strong>Comlink</strong>: он прячет message-протокол за прокси, и вызов метода воркера выглядит как <code>await api.process(data)</code>. Цена — прокси и невозможность передать функции без явного <code>Comlink.proxy</code>.</p>

    <h4>Почему так</h4>
    <p>У воркера отдельная куча и отдельный event loop — это и даёт параллелизм. Разделять произвольные объекты между кучами нельзя без блокировок и без риска гонок, поэтому по умолчанию всё копируется. Transfer — компромисс: память физически одна, но владелец ровно один, что снимает гонки без синхронизации.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>После transfer исходный буфер detached: попытка прочитать его даёт <code>TypeError</code>, и это часто вылезает в retry-логике.</li>
      <li>Забыть вернуть буфер обратно — и второй проход по данным уже нечем делать; при пинг-понге буфер передают в обе стороны.</li>
      <li>Воркер не имеет доступа к DOM, <code>window</code>, <code>localStorage</code> — половина кода туда просто не переезжает.</li>
      <li>Забытый <code>worker.terminate()</code> и неснятые <code>onmessage</code> — это утечка потока, а не только памяти; на SPA с навигацией воркеры копятся.</li>
      <li>Старт воркера стоит десятки миллисекунд плюс загрузка скрипта: для мелких задач накладные расходы больше выигрыша.</li>
      <li>Ошибка внутри воркера не всплывает в главный поток сама — нужен обработчик <code>onerror</code> и <code>messageerror</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как выбрать режим?»</strong> — маленькое копируй, большое с передачей владения — transfer, нужен одновременный доступ нескольким потокам — <code>SharedArrayBuffer</code>. <strong>«Что переносить в воркер в реальном приложении?»</strong> — парсинг больших JSON и CSV, сжатие и шифрование, обработку изображений, диффы и поиск по индексу; всё, что не трогает DOM и занимает больше 50 мс. <strong>«Сколько воркеров создавать?»</strong> — ориентир <code>navigator.hardwareConcurrency</code> минус один, чтобы оставить главному потоку ядро; больше потоков не ускоряет, а добавляет переключений контекста.`,
    code: `const buf = new ArrayBuffer(64 * 1024 * 1024);
worker.postMessage({ buf }, [buf]);   // transfer, не копия
buf.byteLength;                       // 0 — detached

// в воркере
self.onmessage = (e) => {
  const view = new Uint8Array(e.data.buf);
  process(view);
  self.postMessage({ buf: view.buffer }, [view.buffer]);  // отдали обратно
};

// отрисовка вне главного потока
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ canvas: offscreen }, [offscreen]);

worker.onerror = e => report(e.message);   // иначе ошибка потеряется`,
    tip: 'Правило выбора одной фразой: маленькое — копируй, большое с передачей владения — transfer, нужен одновременный доступ нескольким потокам — SharedArrayBuffer. И сразу добавьте, что TypedArray не transferable, передавать надо .buffer.' },

  { id: 'jsx35',
    q: 'Что такое SharedArrayBuffer и Atomics, и почему их так сложно включить в браузере?',
    a: `<h4>Коротко</h4>
    <p><code>SharedArrayBuffer</code> — буфер, видимый нескольким агентам одновременно без копирования: обе стороны получают ссылки на один блок памяти. Из этого немедленно следуют гонки, поэтому нужен <code>Atomics</code>. Доступен только в cross-origin isolated контексте — это последствие Spectre.</p>

    <h4>Как это работает</h4>
    <p>SAB «передаётся» через <code>postMessage</code>, но, в отличие от <code>ArrayBuffer</code>, не становится detached — он именно разделяется. Поверх него создают типизированные представления (<code>Int32Array</code>, <code>BigInt64Array</code>), и обе стороны пишут в одну память.</p>
    <p><code>Atomics</code> даёт атомарные операции и барьеры памяти: <code>load</code>, <code>store</code>, <code>add</code>, <code>sub</code>, <code>and</code>, <code>or</code>, <code>xor</code>, <code>exchange</code>, <code>compareExchange</code>. Без них даже простой <code>counter[0]++</code> — это три операции (чтение, инкремент, запись), которые могут перемежаться, и результат теряется; кроме того, компилятор вправе переупорядочить или закешировать обычное чтение в регистре, и поток вообще не увидит чужую запись.</p>
    <p><code>Atomics.wait(arr, index, expected, timeout)</code> блокирует поток, пока по индексу лежит ожидаемое значение — это настоящая блокировка, поэтому на главном потоке она <strong>запрещена</strong> и доступна только в воркерах. <code>Atomics.notify(arr, index, count)</code> будит ожидающих. <code>Atomics.waitAsync</code> (ES2024) даёт неблокирующий вариант, возвращающий промис, — его уже можно использовать на главном потоке.</p>
    <p>Включение требует <strong>cross-origin isolation</strong>: заголовки <code>Cross-Origin-Opener-Policy: same-origin</code> и <code>Cross-Origin-Embedder-Policy: require-corp</code> (или <code>credentialless</code>), причём все сторонние ресурсы обязаны отдавать <code>Cross-Origin-Resource-Policy</code> или корректный CORS. Проверка — <code>self.crossOriginIsolated</code>.</p>

    <h4>Почему так</h4>
    <p>Spectre позволяет читать чужую память через спекулятивное выполнение, но атака требует таймера высокого разрешения. <code>performance.now()</code> в ответ на это загрубили, однако из SharedArrayBuffer можно собрать сколь угодно точный таймер: воркер в цикле инкрементирует счётчик в общей памяти. Поэтому SAB отключили везде, а вернули только в изолированном контексте, где в процессе нет чужих данных. Цена — заголовки ломают сторонние виджеты: реклама, аналитика, встроенные видео и карты перестают загружаться, если не отдают CORP.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>COEP ломает сторонние встраивания; переход на <code>credentialless</code> помогает частично, но не для всего.</li>
      <li><code>Atomics.wait</code> на главном потоке — <code>TypeError</code>, а не просто предупреждение.</li>
      <li>Без атомиков код «работает» на разработческой машине и падает под нагрузкой: гонки воспроизводятся редко.</li>
      <li>SAB не сериализуется в IndexedDB и не переживает перезагрузку — это только межпоточная память.</li>
      <li>Deadlock реален: два воркера, ждущие друг друга через <code>Atomics.wait</code>, зависают навсегда без сообщений об ошибке.</li>
      <li>Проверять надо <code>self.crossOriginIsolated</code>, а не наличие <code>SharedArrayBuffer</code>: конструктор может существовать, а конструирование — падать.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Где это реально нужно?»</strong> — WASM с потоками: ffmpeg.wasm, SQLite WASM, Photoshop Web, эмуляторы, аудиообработка, симуляции. Для обычной фоновой работы хватает обычных воркеров с transfer. <strong>«Как включить изоляцию поэтапно?»</strong> — сначала <code>Cross-Origin-Opener-Policy</code> в report-only, посмотреть отчёты, перевести сторонние ресурсы на CORP, и только потом включать COEP.</p>`,
    code: `if (self.crossOriginIsolated) {
  const sab = new SharedArrayBuffer(8);
  const counter = new Int32Array(sab);

  Atomics.add(counter, 0, 1);      // атомарный инкремент
  Atomics.notify(counter, 0);      // разбудить ждущих

  worker.postMessage({ sab });     // не detached — разделяется
}

// в воркере: блокирующее ожидание, пока значение равно 0
// Atomics.wait(counter, 0, 0);

// на главном потоке — только асинхронный вариант
const { async: isAsync, value } = Atomics.waitAsync(counter, 0, 0);
if (isAsync) await value;`,
    tip: 'Обязательно свяжите ограничение со Spectre и назовите оба заголовка COOP/COEP плюс требование CORP к сторонним ресурсам — спрашивают именно это, а не API атомиков.' },

  { id: 'jsx36',
    q: 'Как ES-модули обрабатывают циклические зависимости и что такое live bindings?',
    a: `<h4>Коротко</h4>
    <p>Импорт в ESM — не копия значения, а <strong>живая привязка</strong> к ячейке в модуле-экспортёре: переприсвоил экспортёр — импортёр сразу видит новое значение. Циклы при этом не падают на этапе связывания, потому что все привязки создаются до выполнения любого кода; но значение в цикле может оказаться ещё не инициализированным.</p>

    <h4>Как это работает</h4>
    <p>Загрузка идёт в три фазы, и это точная терминология из спецификации. <strong>Construction</strong>: скачать и разобрать все модули, построить граф, зарезолвить все спецификаторы импортов. <strong>Instantiation (Link)</strong>: создать Module Environment Record для каждого модуля и связать каждое импортируемое имя с ячейкой в экспортёре — по ссылке, а не по значению. На этом этапе код ещё не выполнялся ни в одном модуле. <strong>Evaluation</strong>: выполнить тела модулей в порядке обхода графа в глубину, каждый ровно один раз.</p>
    <p>Именно фаза instantiation делает циклы работоспособными: к моменту выполнения все имена уже связаны, поэтому «модуль ещё не загружен» не бывает. Что бывает — <strong>значение ещё не присвоено</strong>. Если A на верхнем уровне читает <code>let</code> или <code>const</code> из B, а B ещё не выполнялся, это <code>ReferenceError</code> по TDZ. Функции же поднимаются и инициализируются на этапе instantiation, поэтому вызов функции из цикла работает.</p>
    <p>Привязки read-only <strong>на стороне импортёра</strong>: <code>count = 5</code> после <code>import { count }</code> — это <code>TypeError</code>, как присваивание в <code>const</code>. Менять значение может только экспортёр.</p>
    <p>В CommonJS всё иначе: <code>require</code> возвращает снимок <code>module.exports</code> на момент вызова. В цикле вы получаете <strong>частично заполненный</strong> объект, где нужного поля просто нет, — и вместо громкого TDZ-исключения приходит тихий <code>undefined</code>, который сломается позже и в другом месте. Поэтому цикл в ESM отлаживается легче, чем в CJS.</p>

    <h4>Почему так</h4>
    <p>Live bindings нужны, чтобы статический анализ был возможен: бандлер знает все импорты до выполнения, поэтому умеет tree-shaking, hoisting модулей и определение циклов. Разделение на фазы решает проблему курицы и яйца в циклах, не требуя ленивых прокси. Плата — необходимость понимать TDZ и невозможность «переприсвоить импорт» в тестах без специальных инструментов вроде <code>vi.mock</code>.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Мокинг ESM-импорта присваиванием не работает: привязка read-only, нужен loader-хук или мок на уровне модуля.</li>
      <li>Цикл с чтением значения на верхнем уровне падает <code>ReferenceError</code> — и стек указывает на импортёра, а не на настоящую причину.</li>
      <li>Порядок выполнения в графе зависит от порядка импортов в файле: перестановка двух <code>import</code> может изменить порядок side effects.</li>
      <li>Смешение CJS и ESM через интероп даёт третий набор правил: <code>default</code>-импорт CJS-модуля отдаёт весь <code>module.exports</code>.</li>
      <li>Реэкспорт (<code>export * from</code>) удлиняет граф и умеет создавать неожиданные циклы через barrel-файлы <code>index.ts</code>.</li>
      <li>Barrel-файлы вдобавок ломают tree-shaking в некоторых сборках и заметно замедляют dev-сервер.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как чинить цикл?»</strong> — извлечь общую часть в третий модуль, перейти на отложенное использование (функция вместо значения) или на динамический <code>import()</code>; циклы почти всегда сигнал того, что границы модулей проведены неверно. <strong>«Как импорт ведёт себя при HMR?»</strong> — бандлер подменяет модуль и переустанавливает привязки, поэтому live bindings и делают горячую замену возможной. <strong>«Что такое TDZ здесь?»</strong> — то же, что и внутри функции: биндинг существует, но не инициализирован, и чтение бросает исключение.</p>`,
    code: `// counter.js
export let count = 0;
export const inc = () => { count++; };

// main.js
import { count, inc } from './counter.js';
console.log(count);   // 0
inc();
console.log(count);   // 1 — live binding, не копия
// count = 5;         // TypeError: Assignment to constant variable

// цикл: a.js
import { bValue } from './b.js';
export const aValue = 'a';
console.log(bValue);        // ReferenceError, если b ещё не выполнялся

// цикл через функцию — работает
import { getB } from './b.js';
export const aLazy = () => getB() + 'a';`,
    tip: 'Три фазы — construction, instantiation, evaluation — это точная формулировка из спеки; сказать их вслух заметно сильнее, чем «модули хойстятся». Добавьте, что в CJS цикл даёт тихий undefined, а в ESM — громкий ReferenceError.' },

  { id: 'jsx37',
    q: 'Что даёт top-level await и какие у него риски?',
    a: `<h4>Коротко</h4>
    <p>TLA разрешает <code>await</code> на верхнем уровне ES-модуля. Модуль с TLA становится <strong>асинхронным</strong>: его выполнение приостанавливается, и все модули, которые его импортируют, ждут завершения. Ожидание корректно распространяется вверх по графу — без асинхронных IIFE и без экспорта промиса.</p>

    <h4>Как это работает</h4>
    <p>На фазе evaluation асинхронный модуль возвращает промис вместо синхронного завершения. Его зависимые модули не выполняются, пока он не завершится; при этом <strong>независимые ветки графа выполняются параллельно</strong> — TLA не сериализует весь граф, а только цепочку зависимостей. Ошибка в асинхронном модуле отклоняет его промис, и все зависимые падают с той же причиной.</p>
    <p>Реальные кейсы: динамический выбор реализации (<code>const db = await import(driver)</code>), инициализация WASM-модуля перед экспортом функций, чтение конфига или feature-флагов до первого рендера, подключение к брокеру или БД, ленивая загрузка полифилла только там, где он нужен.</p>
    <p>Раньше это писали через экспорт промиса — <code>export const ready = init()</code> — и каждый потребитель обязан был помнить про <code>await ready</code>. TLA переносит это обязательство в рантайм модульной системы: забыть невозможно.</p>
    <p>Требования среды: только ESM (в CommonJS его нет в принципе), в браузере — <code>&lt;script type="module"&gt;</code>, в Node — <code>.mjs</code> или <code>"type": "module"</code>, в бандлерах — соответствующий формат вывода; сборка в IIFE или UMD с TLA не совместима.</p>

    <h4>Почему так</h4>
    <p>До TLA единственным способом асинхронной инициализации была асинхронная IIFE, из которой невозможно корректно экспортировать результат, — потребители получали <code>undefined</code> в гонке. Комитет сознательно сделал ожидание «заразительным»: если модуль не готов, никто из зависимых не должен считать его готовым. Цена — задержка старта и новый класс дедлоков.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><strong>TLA заразителен</strong>: в общей библиотеке он блокирует всех потребителей, и цепочки ожиданий складываются.</li>
      <li><strong>Дедлок в циклах</strong>: если A ждёт B, а B ждёт A, граф не выполнится никогда — это не ошибка, а тихое зависание без стека.</li>
      <li>CommonJS не может синхронно <code>require</code> модуль с TLA — интероп ломается на границе.</li>
      <li>Ошибка при инициализации падает в момент импорта: стек указывает на <code>import</code>, а не на реальную строку, и отладка усложняется.</li>
      <li>Часть бандлеров требует явной настройки (<code>topLevelAwait</code> в webpack, поддержка target в esbuild) и молча выдаёт сломанный бандл при неверном формате.</li>
      <li>TLA в модуле, который загружается на критическом пути, задерживает first paint так же надёжно, как синхронный скрипт.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Где TLA уместен?»</strong> — в entry-point и в редких инициализаторах приложения; в переиспользуемой библиотеке лучше экспортировать явную <code>async function init()</code>, чтобы решение об ожидании принимал потребитель. <strong>«Как обнаружить дедлок?»</strong> — по симптому «модуль не выполнился и ошибок нет»: проверять граф импортов и искать цикл, содержащий асинхронный модуль. <strong>«Влияет ли TLA на tree-shaking?»</strong> — модуль с TLA имеет side effect по определению, поэтому вытрясти его нельзя.</p>`,
    code: `// db.js — асинхронный модуль
const driver = process.env.DB === 'pg' ? './pg.js' : './sqlite.js';
export const db = await (await import(driver)).connect();

// любой импортёр ждёт готовности автоматически
import { db } from './db.js';
db.query('select 1');       // db гарантированно готов

// антипаттерн в библиотеке: заразительное ожидание
// export const client = await createClient();

// правильно для библиотеки: решение за потребителем
let client;
export async function init(opts) { client = await createClient(opts); }
export function get() {
  if (!client) throw new Error('call init() first');
  return client;
}`,
    tip: 'Фраза «TLA заразителен: он делает асинхронными всех ваших потребителей» — точный аргумент против его использования в библиотеках. Дедлок в цикле стоит назвать отдельно: он не бросает ошибку, а просто зависает.' },

  { id: 'jsx38',
    q: 'Что такое import.meta и чем динамический import() отличается от статического?',
    a: `<h4>Коротко</h4>
    <p><code>import.meta</code> — объект с метаданными текущего модуля, наполняемый хостом. Динамический <code>import()</code> — не оператор импорта, а синтаксическая форма, возвращающая промис с namespace-объектом: он работает в рантайме, принимает вычисляемую строку и доступен внутри функций, условий и даже в обычных скриптах.</p>

    <h4>Как это работает</h4>
    <p>В <code>import.meta</code> в браузере и Node всегда есть <code>url</code> — абсолютный URL модуля. В Node к нему добавлены <code>dirname</code>, <code>filename</code> и <code>resolve()</code> — замена <code>__dirname</code> и <code>require.resolve</code> в ESM. Бандлеры дописывают своё: <code>import.meta.env</code> у Vite, <code>import.meta.hot</code> для HMR, <code>import.meta.glob</code> для массового импорта по маске, <code>import.meta.webpackContext</code> у webpack.</p>
    <p>Каноническое применение — <strong>адресация ассетов рядом с модулем</strong>: <code>new URL('./worker.js', import.meta.url)</code>. Этот приём понимают все современные бандлеры (они переписывают путь на хешированное имя в сборке), и он же работает вообще без сборки.</p>
    <p>Динамический импорт возвращает промис, который резолвится namespace-объектом со всеми экспортами; <code>default</code> лежит в поле <code>default</code>. Модуль загружается и выполняется <strong>один раз</strong> — повторный <code>import()</code> того же спецификатора отдаёт тот же namespace из кеша модулей, поэтому его можно звать в обработчике без опасений. Ошибка загрузки (сеть, 404, синтаксис) превращается в отклонение промиса, которое можно поймать <code>catch</code>-ем и показать пользователю.</p>
    <p>ES2025 добавил <strong>import attributes</strong>: <code>import data from './x.json' with { type: 'json' }</code>. Указание типа обязательно для не-JS модулей и сделано из соображений безопасности: без него сервер, отдавший JSON вместо JS, мог бы подменить содержимое модуля.</p>

    <h4>Почему так</h4>
    <p>Статический импорт намеренно ограничен: только литеральный спецификатор и только верхний уровень — иначе граф модулей нельзя построить до выполнения, и всё дерево оптимизаций (tree-shaking, предзагрузка, hoisting) разваливается. Динамический импорт — сознательный выход из этого контракта в обмен на код-сплиттинг.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Полностью вычисляемый путь (<code>import(userInput)</code>) убивает статический анализ: бандлер либо соберёт огромный чанк из всей папки, либо не соберёт ничего.</li>
      <li>Отклонение <code>import()</code> при неудачной сети — реальный сценарий после деплоя, когда старый чанк уже удалён; нужен retry и предложение перезагрузить страницу.</li>
      <li>Динамический импорт внутри цикла отрисовки добавляет сетевую задержку в интеракцию — лучше префетчить на <code>mouseenter</code> или через <code>&lt;link rel="modulepreload"&gt;</code>.</li>
      <li><code>import.meta.url</code> в бандле после сборки может указывать не туда, если конфигурация меняет <code>base</code>.</li>
      <li>В CommonJS <code>import()</code> работает, но возвращает промис, поэтому «просто заменить require» не получится.</li>
      <li>Без import attributes JSON-импорт не поддерживается частью рантаймов, а с ними — падает на старых сборщиках.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сделать путь частично статическим?»</strong> — использовать шаблон с литеральным префиксом и расширением (<code>'./locales/' + lang + '.js'</code>), тогда бандлер соберёт ограниченный набор чанков. <strong>«Как предзагрузить чанк заранее?»</strong> — <code>&lt;link rel="modulepreload"&gt;</code> или вызвать <code>import()</code> в idle-колбэке и проигнорировать результат. <strong>«Чем namespace отличается от объекта?»</strong> — он запечатан, его свойства read-only и у него есть <code>Symbol.toStringTag === 'Module'</code>.</p>`,
    code: `const workerUrl = new URL('./worker.js', import.meta.url);
new Worker(workerUrl, { type: 'module' });

// ленивая загрузка с обработкой ошибки сети
button.onclick = async () => {
  try {
    const { renderChart } = await import('./chart.js');
    renderChart(data);
  } catch (e) {
    showToast('Не удалось загрузить модуль, обновите страницу');
    throw e;
  }
};

// префетч на наведение
button.onmouseenter = () => { import('./chart.js'); };

import config from './config.json' with { type: 'json' };`,
    tip: 'Приём с new URL(\'./file\', import.meta.url) — правильный способ адресовать ассеты: его понимают все бандлеры и он работает без них. Второй сильный пункт — retry при отклонении import() после деплоя.' },

  { id: 'jsx39',
    q: 'Что на самом деле происходит на каждом await? Сколько микрозадач стоит await и почему это иногда важно?',
    a: `<h4>Коротко</h4>
    <p><code>await</code> приостанавливает async-функцию и планирует её продолжение как микрозадачу, привязанную к резолву ожидаемого значения. Функция синхронно выполняется до <strong>первого</strong> await и возвращает промис; всё после — асинхронно, даже если ждали не промис.</p>

    <h4>Как это работает</h4>
    <p><code>await v</code> раскрывается примерно в <code>PromiseResolve(v).then(continuation)</code>. Если <code>v</code> — уже нативный промис, <code>PromiseResolve</code> возвращает его как есть, и продолжение стоит <strong>один тик</strong> микрозадач. Это результат оптимизации спецификации 2018 года («await takes 1 tick»); до неё было три.</p>
    <p>Если <code>v</code> — не промис (число, строка, объект), он оборачивается, и продолжение всё равно планируется на следующий тик: <code>await 1</code> не бесплатен. Если <code>v</code> — <strong>thenable</strong> (объект с методом <code>then</code>), раскрутка идёт через дополнительные микрозадачи, потому что <code>then</code> вызывается асинхронно и его результат снова резолвится. Отсюда неожиданный порядок логов при смешивании нативных промисов и thenable-ов.</p>
    <p>Аналогично <code>return promise</code> из async-функции стоит <strong>два дополнительных тика</strong> по сравнению с <code>return await promise</code>: резолв промиса промисом требует раскрутки. Раньше это делало <code>no-return-await</code> популярным правилом линтера; сегодня оно устарело, потому что внутри <code>try</code> <code>return await</code> <strong>обязателен</strong> — без него отклонение произойдёт после выхода из блока и <code>catch</code> его не увидит.</p>
    <p>Главное практическое следствие не в тиках, а в топологии: последовательные <code>await</code> — это последовательные сетевые задержки. Если запросы независимы, их надо <strong>стартовать раньше</strong>, а ждать позже — либо через сохранение промисов, либо через <code>Promise.all</code>.</p>

    <h4>Почему так</h4>
    <p>Async/await — синтаксис поверх генераторов и промисов, а не отдельный механизм. Каждая точка возобновления обязана быть микрозадачей, иначе нарушится гарантия промисов «колбэк никогда не вызывается синхронно» — она нужна, чтобы порядок выполнения не зависел от того, был ли промис уже резолвлен. Цена — фиксированные накладные расходы на каждый await и неинтуитивный порядок при смешивании механизмов.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>await</code> в цикле по массиву запросов превращает параллельную работу в последовательную — самая частая перф-ошибка в async-коде.</li>
      <li><code>Promise.all</code> падает на первой ошибке и <strong>не отменяет</strong> остальные запросы: они продолжают выполняться и могут дать unhandled rejection.</li>
      <li><code>forEach</code> с async-колбэком не ждёт ничего: <code>forEach</code> игнорирует возвращаемые промисы.</li>
      <li><code>await</code> не отдаёт управление рендеру: цикл с уже резолвленными промисами остаётся long task.</li>
      <li>Старт промиса раньше ожидания означает, что ошибка может произойти до <code>await</code> — нужен либо немедленный <code>catch</code>, либо <code>allSettled</code>.</li>
      <li>Ограничение параллелизма приходится делать вручную: <code>Promise.all</code> на 5000 запросов положит и клиента, и сервер.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем <code>return promise</code> отличается от <code>return await promise</code>?»</strong> — двумя тиками и, что важнее, поведением в <code>try</code>: без <code>await</code> ошибка пролетает мимо <code>catch</code>. <strong>«Как ограничить параллелизм?»</strong> — пул воркеров на промисах или библиотека вроде p-limit; наивный <code>Promise.all</code> по всему списку — типичная причина 429 от API.</p>`,
    code: `// плохо: два последовательных RTT
const user = await fetchUser();
const posts = await fetchPosts();

// хорошо: старт одновременно, ожидание после
const userP = fetchUser();
const postsP = fetchPosts();
const [user2, posts2] = await Promise.all([userP, postsP]);

async function a() { return Promise.resolve(1); }        // резолвится позже
async function b() { return await Promise.resolve(1); }  // на 2 тика раньше

// ограничение параллелизма без библиотеки
async function pool(items, limit, fn) {
  const running = new Set();
  const out = [];
  for (const item of items) {
    const p = fn(item).finally(() => running.delete(p));
    running.add(p); out.push(p);
    if (running.size >= limit) await Promise.race(running);
  }
  return Promise.all(out);
}`,
    tip: 'Разница между return promise и return await promise в try/catch — короткий вопрос с высоким сигналом: без await ошибка пролетает мимо catch, поэтому старое правило no-return-await сегодня считается вредным.' },

  { id: 'jsx40',
    q: 'Как ведут себя try/catch/finally в async-функциях? Что делает return или throw внутри finally?',
    a: `<h4>Коротко</h4>
    <p><code>try/catch</code> в async-функции ловит и синхронные исключения, и отклонения промисов — но только тех, которые реально <code>await</code>-ятся <strong>внутри</strong> блока. <code>return</code> внутри <code>finally</code> перезаписывает и возвращаемое значение, и выброшенное исключение; это почти всегда баг.</p>

    <h4>Как это работает</h4>
    <p>Async-функция превращается в конечный автомат: каждый <code>await</code> — точка приостановки, и отклонение промиса возобновляет функцию через <code>throw</code> в этой точке. Поэтому <code>catch</code> ловит его только если точка приостановки лексически внутри <code>try</code>. Промис, созданный в <code>try</code> и не ожидаемый там, отклонится <strong>после</strong> выхода из блока — это прямой путь к unhandled rejection.</p>
    <p><code>finally</code> выполняется всегда: при нормальном завершении, при <code>return</code>, при <code>throw</code> и при <code>break</code>/<code>continue</code> из цикла. Механика такая: блок <code>try</code> формирует «completion record» (normal, return, throw), затем выполняется <code>finally</code>, и если <strong>он сам</strong> порождает completion (через <code>return</code>, <code>throw</code>, <code>break</code>), эта запись <strong>вытесняет</strong> предыдущую. Отсюда и проглатывание исключений.</p>
    <p><code>await</code> внутри <code>finally</code> легален и задерживает завершение функции — это правильный способ дождаться корректной очистки, но он же незаметно удлиняет критический путь и может «съесть» ошибку, если сам упадёт.</p>
    <p>Отдельно про <code>promise.finally(fn)</code>: он <strong>пробрасывает</strong> исходное значение или ошибку и игнорирует возвращаемое значение <code>fn</code> — но если <code>fn</code> бросит или вернёт отклонённый промис, результат станет отклонением с новой причиной. Типовое применение — снятие лоадера и освобождение ресурса в одном месте вместо дублирования в обеих ветках.</p>

    <h4>Почему так</h4>
    <p>Правило «finally вытесняет completion» унаследовано от синхронного <code>try/finally</code> и логично: <code>finally</code> — последнее слово блока. Но в сочетании с <code>return</code> оно даёт бесшумную потерю ошибок, поэтому эргономика проиграла: линтеры (<code>no-unsafe-finally</code>) запрещают то, что спецификация разрешает.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>return</code> в <code>finally</code> проглатывает исключение целиком — ни стек, ни причина никуда не попадут.</li>
      <li>Промис, созданный в <code>try</code> без <code>await</code>, уходит мимо <code>catch</code>; TypeScript этого не ловит без <code>no-floating-promises</code>.</li>
      <li><code>catch</code> без параметра (<code>catch {}</code>) удобен, но легко превращается в глушитель ошибок при копипасте.</li>
      <li>Ошибка в <code>finally</code> перекрывает исходную: диагностика показывает проблему очистки, а не причину падения.</li>
      <li><code>try/finally</code> вокруг долгого <code>await</code> без <code>AbortSignal</code> не отменяет работу — ресурс освобождается, но запрос продолжает выполняться.</li>
      <li>В генераторах и async-генераторах <code>finally</code> выполняется при <code>return()</code> итератора — на этом строится корректное освобождение ресурсов при <code>break</code>.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как гарантированно освободить ресурс?»</strong> — <code>finally</code> без <code>return</code>, а в новых средах — <code>using</code> и <code>Symbol.dispose</code> из Explicit Resource Management. <strong>«Почему <code>return await</code> внутри try обязателен?»</strong> — иначе точка приостановки оказывается вне блока, и отклонение не попадёт в <code>catch</code>. <strong>«Чем <code>.finally()</code> отличается от <code>.then(f, f)</code>?»</strong> — первый пробрасывает исходный результат, второй его подменяет. <strong>«Что будет, если <code>await</code> в <code>finally</code> отклонится?»</strong> — функция отклонится этой причиной, а исходная ошибка пропадёт; поэтому очистку оборачивают в собственный <code>try/catch</code> и логируют отдельно.`,
    code: `async function bad() {
  try { return 'try'; }
  finally { return 'finally'; }   // вернёт 'finally', проглотит и исключение
}

async function alsoBad() {
  try {
    const p = fetch('/x');        // не await — rejection уйдёт мимо catch
    return 'ok';
  } catch { return 'caught'; }
}

async function good(signal) {
  const release = await lock.acquire();
  try {
    return await work(signal);    // await обязателен внутри try
  } finally {
    release();                    // никакого return здесь
  }
}`,
    tip: 'Скажите, что return в finally — это правило линтера no-unsafe-finally: показывает, что вы знаете не только язык, но и как команда защищается от этого класса ошибок на уровне процесса.' },

  { id: 'jsx41',
    q: 'Что такое unhandled rejection, когда он возникает и как это ловить в проде?',
    a: `<h4>Коротко</h4>
    <p>Unhandled rejection — отклонённый промис, у которого к моменту опустошения очереди микрозадач нет обработчика. Проверка отложенная: если обработчик навесить в той же микрозадачной сессии, предупреждения не будет; если позже — сработает событие <code>unhandledrejection</code>, а затем может прийти <code>rejectionhandled</code>.</p>

    <h4>Как это работает</h4>
    <p>У каждого промиса есть флаг «обработан». Когда промис отклоняется без обработчиков, движок ставит его в список «потенциально необработанных» и проверяет этот список после дренажа микрозадач. Отсюда асимметрия: <code>const p = Promise.reject(); p.catch(noop)</code> в той же синхронной последовательности — молча; тот же <code>catch</code> через <code>setTimeout</code> — сначала предупреждение, потом <code>rejectionhandled</code>.</p>
    <p>Типичные причины. <strong>Floating promise</strong> — вызвали async-функцию без <code>await</code> и без <code>catch</code>. <strong>Промис в try без await</strong> — отклоняется вне блока. <strong><code>forEach</code> с async-колбэком</strong> — <code>forEach</code> игнорирует возвращаемые промисы, поэтому каждый упавший вызов повисает. <strong>Забытый <code>return</code></strong> в цепочке <code>.then</code> — внутренний промис отвязывается от внешнего. <strong><code>Promise.all</code></strong>, где одна ветка падает раньше, чем к остальным привязали обработчики.</p>
    <p>Ловля в браузере: <code>window.addEventListener('unhandledrejection', e =&gt; ...)</code> с <code>e.preventDefault()</code>, чтобы не шуметь в консоли, и отправкой <code>e.reason</code> в Sentry. В Node с версии 15 дефолт — <strong>падение процесса</strong> (<code>--unhandled-rejections=throw</code>), поэтому <code>process.on('unhandledRejection')</code> нужен для логирования и корректного завершения, а не для того, чтобы «проглотить и жить дальше».</p>
    <p>Профилактика: правило <code>@typescript-eslint/no-floating-promises</code>, явный <code>void</code> там, где игнорирование намеренно, и обязательный <code>.catch(reportError)</code> на fire-and-forget вызовах.</p>

    <h4>Почему так</h4>
    <p>Отложенная проверка нужна, потому что привязка обработчика асинхронна по определению: промис часто создаётся раньше, чем на него подписываются. Движок не может знать заранее, появится ли <code>catch</code>. Плата — предупреждение приходит с задержкой и иногда ложно, а <code>reason</code> в нём может не иметь стека, если бросали не Error.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Глобальный обработчик с <code>preventDefault</code> без отправки в мониторинг — это способ ослепнуть: ошибки исчезают отовсюду.</li>
      <li>В Node проглатывание unhandled rejection оставляет процесс в неконсистентном состоянии; корректно — залогировать и завершиться.</li>
      <li><code>reason</code> может быть не Error (например, строка или объект ответа) — в логах не будет стека.</li>
      <li>Отмена через <code>AbortController</code> даёт <code>AbortError</code>, который в мониторинге выглядит как поток ложных ошибок; его надо фильтровать.</li>
      <li>Обработчик <code>unhandledrejection</code> сам может бросить — тогда теряется и он, и исходная ошибка.</li>
      <li>В воркерах нужен свой обработчик: события главного потока их не покрывают.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как правильно делать fire-and-forget?»</strong> — <code>void doThing().catch(reportError)</code>: намерение видно в коде и ошибка не теряется. <strong>«Что не так с forEach и async?»</strong> — он не ждёт; нужен <code>for...of</code> с <code>await</code> для последовательности или <code>Promise.all(map)</code> для параллели. <strong>«Почему rejectionhandled?»</strong> — чтобы снять ранее показанное предупреждение, если обработчик всё-таки появился. <strong>«Почему промис, созданный заранее, опасен?»</strong> — он может отклониться до того, как к нему привяжут <code>catch</code>: между созданием и подпиской проходит дренаж микрозадач.`,
    code: `// floating promise — упадёт в unhandledrejection
saveAnalytics();

// намеренное игнорирование, но осознанное
void saveAnalytics().catch(reportError);

// forEach не ждёт ничего
items.forEach(async (i) => { await save(i); });   // все ошибки повиснут
for (const i of items) await save(i);             // последовательно
await Promise.all(items.map(save));               // параллельно

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.name === 'AbortError') { e.preventDefault(); return; }
  reportError(e.reason);
  e.preventDefault();
});`,
    tip: 'Отметьте, что forEach с async-колбэком — самый частый источник floating promises, и что в Node с 15-й версии unhandled rejection по умолчанию роняет процесс: это меняет цену ошибки.' },

  { id: 'jsx42',
    q: 'Как ты проектируешь ошибки в приложении? Расскажи про кастомные классы ошибок и Error cause.',
    a: `<h4>Коротко</h4>
    <p>Основа — иерархия своих классов, наследующих <code>Error</code>, с полями для обработки: <code>code</code>, <code>status</code>, <code>retriable</code>. Контекст добавляется через <code>cause</code> (ES2022), не теряя корневой причины. Проверять тип надёжнее по дискриминанту <code>err.code</code>, чем по <code>instanceof</code>.</p>

    <h4>Как это работает</h4>
    <p>Базовый класс ставит <code>this.name = new.target.name</code> — иначе в стеке будет <code>Error</code>, и в логах ошибки неразличимы. В V8 вызывается <code>Error.captureStackTrace(this, new.target)</code>, чтобы убрать кадр конструктора из трейса и сделать первую строку стека полезной.</p>
    <p><code>cause</code> решает главную проблему перехвата. Раньше <code>throw new AppError('failed')</code> в <code>catch</code>-блоке терял исходную ошибку вместе со стеком, и в мониторинг попадала бесполезная обёртка. Теперь <code>new Error('msg', { cause: err })</code> сохраняет цепочку: Node печатает её в консоли, Sentry показывает как связанные события, а <code>util.inspect</code> разворачивает целиком. Это позволяет добавлять контекст на каждом слое, не теряя корня.</p>
    <p>Дискриминант вместо <code>instanceof</code> нужен по двум причинам: <code>instanceof</code> ломается кросс-realm (worker, iframe, <code>vm</code>) и при дублировании пакета в <code>node_modules</code>, где существуют два разных класса с одним именем. Проверка <code>err.code === 'NOT_FOUND'</code> переживает и то и другое; brand check через <code>#</code>-поле — тоже. В ES2025 появился <code>Error.isError()</code> — надёжная кросс-realm проверка «это вообще Error».</p>
    <p>Дисциплина: <strong>никогда не бросать не-Error</strong>. <code>throw 'oops'</code> лишает стека, а <code>catch (e)</code> получает строку; в TypeScript тип <code>catch</code>-переменной — <code>unknown</code>, и её всё равно придётся сужать.</p>
    <p>Полезное разделение: <strong>операционные</strong> ошибки (сеть, валидация, 404 — ожидаемы, обрабатываются) и <strong>программные</strong> (баг, нарушенный инвариант — логируются и роняют операцию). Флаг <code>isOperational</code> на базовом классе позволяет обработчику верхнего уровня решать, показывать ли пользователю сообщение или общий экран ошибки.</p>

    <h4>Почему так</h4>
    <p>Ошибка — часть API функции, а не «исключительная ситуация». Если у неё нет машиночитаемого признака, вызывающему остаётся парсить <code>message</code> — и любая правка текста ломает обработку. Цена явной иерархии — код и дисциплина: каждый слой обязан решить, оборачивать ошибку или пробрасывать.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>err.constructor.name</code> ломается при минификации — <code>name</code> надо задавать строкой или через <code>new.target.name</code> с сохранением имён в сборке.</li>
      <li>Оборачивание без <code>cause</code> уничтожает стек: в Sentry прилетает «Failed to load user» без строки, где реально упало.</li>
      <li><code>JSON.stringify(err)</code> даёт <code>{}</code>: <code>message</code> и <code>stack</code> не перечисляемы — нужен явный сериализатор.</li>
      <li>Логирование ошибки на каждом слое даёт дубли в мониторинге; логировать надо один раз, на границе.</li>
      <li>Слишком глубокая иерархия классов (десяток наследников) обычно бесполезна: чаще нужен один класс с полем <code>code</code>.</li>
      <li>Наследники Error при таргете ES5 теряют прототип, и <code>instanceof</code> перестаёт работать в проде, но работает локально.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сериализовать ошибку в лог?»</strong> — явный маппер: <code>name</code>, <code>message</code>, <code>stack</code>, <code>code</code> и рекурсивно <code>cause</code>; в Node есть <code>util.inspect</code> с <code>depth</code>. <strong>«Где обрабатывать?»</strong> — как можно ближе к тому месту, где известно, что делать; всё остальное — обогатить контекстом и пробросить.</p>`,
    code: `class AppError extends Error {
  isOperational = true;
  constructor(message, options) {
    super(message, options);            // пробрасываем cause
    this.name = new.target.name;
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }
}
class NotFound extends AppError { code = 'NOT_FOUND'; status = 404; }

try {
  await db.get(id);
} catch (e) {
  throw new NotFound('User ' + id + ' not found', { cause: e });
}

// сериализация для лога
const serialize = (e) => e && ({
  name: e.name, message: e.message, code: e.code,
  stack: e.stack, cause: serialize(e.cause)
});`,
    tip: 'Проверка по err.code вместо instanceof — сильный аргумент: она переживает дубли пакета в node_modules и границы realm, где instanceof молча ломается. Второй сильный пункт — разделение операционных и программных ошибок.' },

  { id: 'jsx43',
    q: 'Что такое AggregateError и где он используется?',
    a: `<h4>Коротко</h4>
    <p><code>AggregateError</code> оборачивает <strong>несколько</strong> ошибок в одну: у него есть свойство <code>errors</code> с массивом причин. В стандарт он попал вместе с <code>Promise.any</code>, который отклоняется именно им, когда упали все входные промисы.</p>

    <h4>Как это работает</h4>
    <p>Конструктор принимает итерируемое ошибок, необязательное сообщение и, с ES2022, объект с <code>cause</code>: <code>new AggregateError(errors, message, { cause })</code>. Он наследует <code>Error</code>, поэтому у него есть <code>name</code>, <code>message</code> и <code>stack</code>; <code>errors</code> — обычное собственное свойство (не перечисляемое), доступное как массив.</p>
    <p><code>Promise.any</code> резолвится первым успешным промисом, а отклоняется <code>AggregateError</code>-ом только если <strong>все</strong> упали. Это ровно противоположно <code>Promise.all</code>, который падает на первой ошибке и молча теряет остальные.</p>
    <p>За пределами <code>Promise.any</code> он полезен везде, где операция состоит из независимых частей и «первая ошибка» — неполная картина. Валидация формы: пользователю нужны все нарушенные правила, а не первое. Пакетная обработка: важно, какие именно элементы упали и почему. Параллельная очистка ресурсов в <code>finally</code>: нельзя терять ошибки закрытия соединений. Загрузка нескольких зеркал: если все недоступны, нужен список причин, а не одна.</p>
    <p>Хороший рабочий паттерн — собрать <code>Promise.allSettled</code>, вытащить все <code>rejected</code>, и если их больше нуля, бросить <code>AggregateError</code> с осмысленным сообщением и счётчиком. Это заметно информативнее, чем <code>Promise.all</code>.</p>

    <h4>Почему так</h4>
    <p>Модель исключений в языке одноканальная: <code>throw</code> передаёт ровно одно значение. Для параллельных операций это структурно неверно — упасть могут несколько веток одновременно, и выбирать «главную» произвольно. <code>AggregateError</code> легализует множественность, оставаясь обычным Error, чтобы работать со всей существующей инфраструктурой <code>catch</code> и логирования. Цена — стандартный вывод не разворачивает вложенные ошибки, и без явной обработки диагностика теряется.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Сообщение по умолчанию у <code>Promise.any</code> — «All promises were rejected»: в Sentry без разворачивания <code>errors</code> это бесполезная строка.</li>
      <li><code>errors</code> не перечисляемо, поэтому <code>JSON.stringify</code> и наивные логгеры его не покажут.</li>
      <li>Стек указывает на место создания агрегата, а не на места исходных ошибок — их стеки надо логировать отдельно.</li>
      <li><code>Promise.any</code> на пустом массиве сразу отклоняется <code>AggregateError</code> с пустым <code>errors</code> — легко забыть про этот кейс.</li>
      <li>Оборачивание одной ошибки в агрегат ради единообразия усложняет обработку на стороне вызывающего: тип теряет конкретику.</li>
      <li><code>instanceof AggregateError</code> ломается кросс-realm так же, как и для обычных ошибок.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем allSettled лучше all?»</strong> — он не бросает и возвращает статус каждой ветки, поэтому можно решить, что делать с частичным успехом; <code>all</code> отдаёт только первую ошибку. <strong>«Отменяет ли <code>Promise.all</code> остальные запросы при падении?»</strong> — нет, они продолжают выполняться; для отмены нужен общий <code>AbortController</code>. <strong>«Как это выглядит в мониторинге?»</strong> — логгер должен рекурсивно разворачивать и <code>errors</code>, и <code>cause</code>, иначе видна только обёртка. <strong>«Чем <code>cause</code> отличается от <code>errors</code>?»</strong> — <code>cause</code> это одна причина по вертикали (слой за слоем), а <code>errors</code> — множество причин по горизонтали (параллельные ветки); в сложных случаях используют оба сразу.</p>`,
    code: `const results = await Promise.allSettled(tasks.map(run));
const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);
if (failed.length) {
  throw new AggregateError(
    failed,
    failed.length + ' of ' + tasks.length + ' tasks failed'
  );
}

try {
  await Promise.any([fetchMirrorA(), fetchMirrorB()]);
} catch (e) {
  if (e instanceof AggregateError) {
    for (const inner of e.errors) reportError(inner);   // иначе потеряем
  }
}`,
    tip: 'Скажите, что Promise.all теряет все ошибки кроме первой, и что связка allSettled + AggregateError — стандартный способ не терять диагностику в батчах; добавьте, что errors не перечисляемо и логгер должен разворачивать его явно.' },

  { id: 'jsx44',
    q: 'Что такое скрытые классы и инлайн-кеши в V8, и как это влияет на то, как ты пишешь код?',
    a: `<h4>Коротко</h4>
    <p>V8 присваивает каждому объекту <strong>shape</strong> (hidden class) — описание набора и порядка свойств. Объекты с одинаковыми полями в одинаковом порядке разделяют shape, и доступ к свойству превращается в чтение по фиксированному смещению вместо хеш-лукапа. В месте доступа стоит инлайн-кеш, который может быть мономорфным, полиморфным или мегаморфным.</p>

    <h4>Как это работает</h4>
    <p>Shape меняется при добавлении свойства: движок переходит по «дереву переходов» от одной формы к другой. Поэтому <code>{ x: 1, y: 2 }</code> и <code>{ y: 2, x: 1 }</code> — разные hidden class, хотя поля те же. Удаление через <code>delete</code> может перевести объект в <strong>dictionary mode</strong>, где свойства хранятся хеш-таблицей и быстрый путь теряется.</p>
    <p>Инлайн-кеш в конкретной строке кода запоминает, какие shape он уже видел. Один shape — <strong>мономорфный</strong> кеш, самый быстрый путь, доступ инлайнится в машинный код. До четырёх — <strong>полиморфный</strong>, проверка по списку. Больше — <strong>мегаморфный</strong>, и V8 уходит в общий медленный путь через глобальный кеш.</p>
    <p>То же для элементов массива: V8 различает <code>PACKED_SMI_ELEMENTS</code>, <code>PACKED_DOUBLE_ELEMENTS</code>, <code>PACKED_ELEMENTS</code> и их «дырявые» варианты <code>HOLEY_*</code>. Переходы идут только в сторону обобщения и <strong>необратимы</strong>: один <code>undefined</code>, положенный в массив чисел, навсегда переводит его в более медленное представление.</p>
    <p>Практические выводы <strong>без мифологии</strong>: инициализируйте все поля в конструкторе в одном порядке; не добавляйте свойства «по ходу» и не используйте <code>delete</code> — присваивайте <code>null</code>; не держите словарь с произвольными ключами в объекте — для этого есть <code>Map</code>; не смешивайте типы в массиве и не делайте его разреженным. Это обычная гигиена кода, а не микрооптимизации.</p>

    <h4>Почему так</h4>
    <p>JS динамически типизирован, но реальные программы почти всегда мономорфны: в конкретной точке кода объекты обычно одной формы. Hidden classes — способ извлечь из динамического языка статическую информацию и получить производительность, близкую к типизированным языкам. Цена — оптимизация хрупкая: одно нарушение регулярности в горячей точке обрушивает её, и происходит это невидимо.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Страшилки «try/catch не оптимизируется» и «delete всегда убивает перф» относятся к Crankshaft и неверны для TurboFan; повторять их — минус на собеседовании.</li>
      <li>Объект-конфиг, собираемый условными присваиваниями, даёт десятки shape в одной точке — мегаморфизм там, где ожидали быстрый путь.</li>
      <li>Опциональные поля лучше инициализировать <code>null</code> или <code>undefined</code> в конструкторе, чем добавлять позже.</li>
      <li><code>arr[1000] = 1</code> на коротком массиве превращает его в dictionary elements — доступ становится в разы медленнее.</li>
      <li>Деоптимизация возможна и после успешной оптимизации: изменившийся тип аргумента выбрасывает функцию обратно в интерпретатор.</li>
      <li>Микробенчмарк без прогрева измеряет интерпретатор, а не оптимизированный код, — типичная ошибка «замерил и поверил».</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как это измерить?»</strong> — профилировщик в DevTools, <code>--trace-deopt</code> и <code>--trace-ic</code> в d8, а для гипотез — Deoptigate; без замера любые утверждения о перфе бессмысленны. <strong>«Значит, надо писать классы вместо литералов?»</strong> — классы дают стабильную форму бесплатно, но литерал с фиксированным набором полей ничем не хуже; важен порядок и постоянство, а не синтаксис. <strong>«Когда всё это вообще важно?»</strong> — в горячих циклах на десятках тысяч объектов; в обработчике клика это шум.</p>`,
    code: `// разные shapes из-за порядка полей
const a = { x: 1, y: 2 };
const b = { y: 2, x: 1 };     // другой hidden class

// стабильная форма: все поля сразу, в одном порядке
class Point {
  constructor(x, y) { this.x = x; this.y = y; this.label = null; }
}

// антипаттерн: объект как словарь
const byId = {};
byId[userInput] = value;      // мегаморфизм + риск __proto__
const byIdMap = new Map();    // правильный инструмент

const nums = [1, 2, 3];       // PACKED_SMI_ELEMENTS
nums.push(undefined);         // -> HOLEY_ELEMENTS, назад дороги нет`,
    tip: 'Обязательно добавьте «но всё это измеряется профилировщиком» — интервьюеры настороженно относятся к кандидатам, которые уверенно повторяют перф-мифы вроде «try/catch не оптимизируется».' },

  { id: 'jsx45',
    q: 'Расскажи про группы в регулярных выражениях: захватывающие, именованные, незахватывающие, lookahead и lookbehind.',
    a: `<h4>Коротко</h4>
    <p><code>(...)</code> — захватывающая группа, попадает в результат и нумеруется слева направо по открывающей скобке. <code>(?:...)</code> — незахватывающая, только для группировки. <code>(?&lt;name&gt;...)</code> — именованная, доступна в <code>match.groups.name</code> и в замене как <code>$&lt;name&gt;</code>. Lookaround — утверждения нулевой ширины.</p>

    <h4>Как это работает</h4>
    <p>Захват стоит денег: движок обязан запоминать позиции начала и конца каждой группы и откатывать их при бэктрекинге. Если группа нужна только для квантификатора или альтернативы, <code>(?:...)</code> дешевле и не засоряет результат. Именованные группы решают главную проблему нумерации — при вставке новой скобки в середину паттерна все последующие номера сдвигаются, и код молча начинает читать не то.</p>
    <p><strong>Lookahead</strong>: <code>(?=...)</code> позитивный, <code>(?!...)</code> негативный. <strong>Lookbehind</strong>: <code>(?&lt;=...)</code> и <code>(?&lt;!...)</code>; в JS они, в отличие от большинства языков, <strong>переменной длины</strong> и матчатся справа налево. Все четыре не потребляют символы: они проверяют контекст и возвращают позицию на место. Это позволяет писать «найди X, за которым идёт Y, но верни только X» и строить проверки паролей из нескольких независимых условий.</p>
    <p>Для разбора текста удобен <code>matchAll</code>: он возвращает итератор всех совпадений с группами, тогда как <code>match</code> с флагом <code>g</code> отдаёт только массив строк и <strong>теряет группы</strong>. Флаг <code>d</code> (ES2022) добавляет <code>indices</code> — точные позиции каждой группы, включая именованные; это то, что нужно для подсветки синтаксиса и для указания места ошибки в редакторе.</p>
    <p>Обратные ссылки: <code>\\1</code> по номеру и <code>\\k&lt;name&gt;</code> по имени. С ES2025 разрешены <strong>дублирующиеся имена</strong> групп в разных альтернативах — раньше это была синтаксическая ошибка, и приходилось выдумывать <code>y1</code>, <code>y2</code>.</p>

    <h4>Почему так</h4>
    <p>Группы и lookaround — компромисс между выразительностью и предсказуемостью. Захват даёт данные, но замедляет; lookaround даёт контекст без потребления, но усложняет бэктрекинг. Именованные группы и <code>indices</code> добавили поздно именно потому, что регулярки в JS долго считались «одноразовым» инструментом, а не частью парсеров.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>match</code> с флагом <code>g</code> теряет группы; нужен <code>matchAll</code> или <code>exec</code> в цикле.</li>
      <li>Группа внутри необязательного квантификатора даёт <code>undefined</code>, а не пустую строку: <code>match.groups.x</code> надо проверять.</li>
      <li>Lookbehind не поддерживается в старых Safari — для широкой совместимости приходится переписывать через захват и <code>slice</code>.</li>
      <li>Вложенные квантификаторы вокруг групп — прямой путь к катастрофическому бэктрекингу.</li>
      <li><code>$&lt;name&gt;</code> в строке замены работает только если в паттерне есть такая именованная группа, иначе подставится буквально.</li>
      <li>Регулярками нельзя разбирать HTML и вложенные структуры — если паттерн перестал помещаться в голову, нужен парсер.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем matchAll лучше цикла с exec?»</strong> — не мутирует <code>lastIndex</code> исходной регулярки (работает с клоном), возвращает итератор и не даёт зациклиться на пустом совпадении. <strong>«Зачем флаг d?»</strong> — точные координаты групп для подсветки и для сообщений об ошибках с позицией. <strong>«Когда отказаться от регулярки?»</strong> — при вложенности, при необходимости состояний и при длине паттерна больше строки: дальше дешевле написать посимвольный разбор.</p>`,
    code: `const re = /(?<y>\\d{4})-(?<m>\\d{2})-(?<d>\\d{2})/du;
const m = '2026-08-31'.match(re);
m.groups.y;              // '2026'
m.indices.groups.y;      // [0, 4]

'2026-08-31'.replace(re, '$<d>.$<m>.$<y>');    // '31.08.2026'

// только число, но лишь если после него RUB (lookahead)
'100 RUB 200 USD'.match(/\\d+(?= RUB)/g);       // ['100']

// цена без валюты перед ней (lookbehind переменной длины)
'итого: $42'.match(/(?<=\\$)\\d+/)[0];           // '42'

for (const hit of '2026-08-31 2027-01-01'.matchAll(re)) {
  console.log(hit.groups.y);                   // 2026, 2027
}`,
    tip: 'Именованные группы плюс флаг d — свежий и практичный набор; упоминание matchAll вместо exec-цикла тоже читается как современный стиль и снимает целый класс багов с lastIndex.' },

  { id: 'jsx46',
    q: 'Какие флаги есть у RegExp и в чём ловушка с lastIndex?',
    a: `<h4>Коротко</h4>
    <p>Флаги: <code>g</code>, <code>i</code>, <code>m</code>, <code>s</code>, <code>u</code>, <code>v</code>, <code>y</code>, <code>d</code>. Главная ловушка — у регулярки с <code>g</code> или <code>y</code> есть <strong>изменяемое состояние</strong> <code>lastIndex</code>, которое двигают <code>test</code> и <code>exec</code>. Вынесенная в константу глобальная регулярка начинает «работать через раз».</p>

    <h4>Как это работает</h4>
    <p><code>g</code> — глобальный поиск. <code>i</code> — регистронезависимость (в unicode-режиме через case folding, поэтому <code>/ß/iu</code> не равно <code>SS</code>). <code>m</code> — многострочный: <code>^</code> и <code>$</code> начинают матчить границы строк, а не всей строки. <code>s</code> (dotAll) — точка начинает матчить перевод строки. <code>u</code> — unicode-режим: корректные суррогатные пары, свойства <code>\\p{...}</code>, строгая обработка escape-последовательностей. <code>v</code> (ES2024) — расширенный unicode-набор с операциями над множествами (<code>[\\p{L}--\\p{ASCII}]</code>) и строковыми свойствами. <code>y</code> (sticky) — совпадение обязано начинаться ровно с <code>lastIndex</code>. <code>d</code> — <code>indices</code> в результате.</p>
    <p>Механика <code>lastIndex</code>: при <code>g</code> или <code>y</code> метод <code>exec</code>/<code>test</code> начинает поиск с текущего <code>lastIndex</code> и после успеха выставляет его на позицию за концом совпадения; после неудачи — <strong>сбрасывает в 0</strong>. Отсюда чередование <code>true</code>/<code>false</code> при проверке разных строк одной и той же константной регуляркой: первая строка совпала и сдвинула индекс, вторая начала поиск с середины и не совпала, индекс сбросился, третья снова совпала.</p>
    <p>Три способа лечения. Не ставить <code>g</code> там, где нужен только факт совпадения, — это правильный фикс. Сбрасывать <code>re.lastIndex = 0</code> перед каждым вызовом. Использовать методы, не мутирующие состояние: <code>String.prototype.match</code> и <code>matchAll</code> (последняя требует <code>g</code>, но работает с внутренним клоном регулярки).</p>
    <p>Флаг <code>y</code>, наоборот, полезен именно из-за <code>lastIndex</code>: на нём строят токенайзеры, последовательно продвигаясь по строке и гарантируя, что лексема начинается ровно там, где закончилась предыдущая, без перескоков.</p>

    <h4>Почему так</h4>
    <p><code>lastIndex</code> появился в ES3 как способ итерировать по совпадениям без итераторов — их тогда не было. Состояние на объекте было единственным механизмом. Сегодня для этого есть <code>matchAll</code>, но убрать <code>lastIndex</code> нельзя из-за совместимости, и он остаётся миной для тех, кто выносит регулярки в константы, следуя обычному совету «не создавать объект в цикле».</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Экспорт глобальной регулярки из общего модуля — баг, который не ловится юнит-тестом на одной строке.</li>
      <li><code>re.test(s)</code> в <code>filter</code> по массиву даёт «через одну» и выглядит как ошибка данных.</li>
      <li><code>String.replace</code> без <code>g</code> заменяет только первое вхождение; <code>replaceAll</code> без <code>g</code> у регулярки бросает <code>TypeError</code>.</li>
      <li>Пустое совпадение в <code>exec</code>-цикле не двигает <code>lastIndex</code> — бесконечный цикл, если не инкрементировать вручную.</li>
      <li><code>u</code> и <code>v</code> взаимоисключающие; <code>v</code> строже к escape-последовательностям, и старые паттерны под ним падают.</li>
      <li>Литерал регулярки в теле функции пересоздаётся при каждом вызове — движки это кешируют, но не всегда; в горячем коде это заметно.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как безопасно переиспользовать регулярку?»</strong> — без <code>g</code> для <code>test</code>, с <code>g</code> только внутри <code>matchAll</code>, либо явный сброс <code>lastIndex</code>. <strong>«Зачем sticky?»</strong> — для лексеров: он гарантирует отсутствие пропусков между токенами. <strong>«Что даёт RegExp.escape?»</strong> — ES2025 наконец добавил экранирование пользовательского ввода перед вставкой в паттерн; до него все писали свой <code>replace</code> по классу спецсимволов.</p>`,
    code: `const re = /\\d+/g;
re.test('a1');   // true,  lastIndex = 2
re.test('a1');   // false! поиск начался с позиции 2
re.lastIndex;    // 0 — сбросился после неудачи

// безопасно: без g для проверки факта
const hasDigit = s => /\\d+/.test(s);

// безопасно: matchAll работает с клоном
[...'a1 b22'.matchAll(/\\d+/g)].map(m => m[0]);   // ['1','22']

// sticky для токенайзера
const token = /\\s*(\\w+)/y;
token.lastIndex = 0;
token.exec('let x');   // ['let', 'let'], lastIndex = 3`,
    tip: 'Баг «регулярка с /g в константе даёт true через раз» — реальная прод-история; рассказать её конкретно ценнее, чем перечислить все флаги. Добавьте, что юнит-тест на одной строке её не ловит.' },

  { id: 'jsx47',
    q: 'Что такое катастрофический бэктрекинг и ReDoS? Как обнаружить и починить уязвимую регулярку?',
    a: `<h4>Коротко</h4>
    <p>Движок регулярок в JS основан на бэктрекинге. Если в паттерне есть вложенные квантификаторы или пересекающиеся альтернативы, число способов разбить вход растёт экспоненциально, и на несовпадающей строке движок перебирает их все. Строка в 40 символов может занять поток на минуты — это ReDoS.</p>

    <h4>Как это работает</h4>
    <p>Признак уязвимости — квантификатор внутри квантификатора, где внутренняя часть может совпасть <strong>несколькими способами</strong>, плюс возможность несовпадения в конце. Классические формы: <code>(a+)+$</code>, <code>(a|a)*$</code>, <code>(a|ab)*$</code>, <code>(\\s*,)*</code>, <code>(\\w+\\s?)*$</code>. Для строки <code>'aaaa...aX'</code> движок обязан перепробовать все разбиения последовательности <code>a</code> на группы, а их 2ⁿ.</p>
    <p>Последствия зависят от среды. В браузере это зависание вкладки: главный поток занят, кадры не рисуются, кнопка «стоп» не работает. В Node — <strong>DoS всего сервера</strong>: event loop однопоточный, и один зловредный запрос кладёт обработку всех остальных. Реальные инциденты: падение Cloudflare в июле 2019 из-за одной регулярки в WAF и получасовой простой Stack Exchange в 2016 из-за паттерна для обрезки пробелов.</p>
    <p>Поиск: статические анализаторы (<code>eslint-plugin-regexp</code>, <code>safe-regex</code>, CodeQL), фаззинг с длинными строками, и главное — ревью любых регулярок, работающих с пользовательским вводом.</p>
    <p>Починка. Убрать вложенность и сделать альтернативы взаимоисключающими: <code>(a+)+</code> → <code>a+</code>, <code>(\\w+\\s?)*</code> → <code>[\\w\\s]*</code>. Ограничить квантификатор диапазоном: <code>a{1,20}</code>. Эмулировать атомарную группу через lookahead с обратной ссылкой: <code>(?=(a+))\\1</code> — совпадение фиксируется и не откатывается. Заменить регулярку на <code>split</code>, <code>indexOf</code> или посимвольный разбор. И дешёвая универсальная защита — <strong>ограничить длину входа</strong> до применения паттерна.</p>

    <h4>Почему так</h4>
    <p>Бэктрекинг выбран ради выразительности: обратные ссылки и lookaround невозможны в конечных автоматах, а именно они делают регулярки в JS такими удобными. Языки с RE2-подобным движком (Go, Rust) гарантируют линейное время, но отказываются от этих возможностей. JS выбрал мощность и переложил риск на разработчика.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Уязвимая регулярка ведёт себя нормально на совпадающих строках — проблема проявляется только на «почти совпадающих», которых нет в тестах.</li>
      <li>Валидация email самописной регуляркой — классический источник ReDoS; лучше простая проверка на <code>@</code> и подтверждение письмом.</li>
      <li>Регулярка, пришедшая из конфига или от пользователя, — прямая дыра; такие входы надо запрещать или гонять в отдельном процессе с таймаутом.</li>
      <li>Таймаут внутри того же потока невозможен: регулярка не прерывается, поэтому нужен воркер или дочерний процесс.</li>
      <li>Ограничение длины помогает, но экспонента растёт быстро: даже 100 символов при 2ⁿ — это уже вечность.</li>
      <li>Библиотеки-зависимости тоже содержат регулярки: инциденты с <code>ms</code>, <code>moment</code> и <code>marked</code> были именно такими.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как проверить конкретный паттерн?»</strong> — прогнать <code>safe-regex</code> или recheck и замерить время на строке вида <code>'a'.repeat(40) + 'X'</code>. <strong>«Что делать, если регулярка нужна и она сложная?»</strong> — вынести в воркер с таймаутом или переписать разбор вручную. <strong>«Помогает ли <code>RegExp.escape</code>?»</strong> — от инъекции паттерна да, от ReDoS в вашем собственном паттерне нет.</p>`,
    code: `// уязвимо: экспоненциальный бэктрекинг
// /^(a+)+$/.test('a'.repeat(40) + 'X');    // виснет надолго

// безопасно: нет вложенного квантификатора
/^a+$/.test('a'.repeat(40) + 'X');          // мгновенно false

// атомарная группа через lookahead + обратная ссылка
const atomic = /^(?=(a+))\\1$/;

// дешёвая защита на входе
function validate(input) {
  if (input.length > 256) throw new Error('too long');
  return SAFE_RE.test(input);
}

// разбор без регулярки часто проще и всегда линеен
const parts = line.split(',').map(s => s.trim());`,
    tip: 'Назовите конкретный инцидент — Cloudflare, июль 2019 — и правило «ограничь длину входа»: это ответ уровня человека, который правил такое в проде, а не читал про NFA.' },

  { id: 'jsx48',
    q: 'Стабильна ли сортировка в JavaScript? Какие подводные камни у Array.prototype.sort?',
    a: `<h4>Коротко</h4>
    <p>С ES2019 <code>sort</code> и <code>toSorted</code> обязаны быть <strong>стабильными</strong>: элементы с равным ключом сохраняют относительный порядок. До этого V8 использовал нестабильный QuickSort для массивов длиннее 10 элементов, и результат отличался между браузерами. Сейчас V8 использует TimSort.</p>

    <h4>Как это работает</h4>
    <p>Стабильность даёт возможность сортировать многоуровнево последовательными проходами: сначала по имени, потом по группе — и внутри группы имена останутся упорядоченными. Это же свойство нужно для таблиц с несколькими кликами по заголовкам.</p>
    <p><strong>Сортировка по умолчанию идёт по строкам.</strong> Без компаратора элементы приводятся к строке и сравниваются по UTF-16 code unit, поэтому <code>[10, 9, 1].sort()</code> даёт <code>[1, 10, 9]</code>. Компаратор нужен всегда.</p>
    <p><strong><code>sort</code> мутирует</strong> исходный массив и возвращает ссылку на него же. В React это приводит к «магическому» изменению пропсов и к отсутствию ререндера, потому что ссылка не поменялась. Лечится <code>toSorted</code> (ES2023) или <code>[...arr].sort()</code>.</p>
    <p><strong>Компаратор обязан быть консистентным</strong>: возвращать число, быть антисимметричным (если <code>cmp(a,b) &lt; 0</code>, то <code>cmp(b,a) &gt; 0</code>) и транзитивным. <code>(a, b) =&gt; a.name &gt; b.name</code> возвращает boolean, который приводится к 0 и 1 — «меньше» не выражается вовсе, и порядок получается произвольным. Компаратор со случайным значением (<code>sort(() =&gt; Math.random() - 0.5)</code>) не перемешивает, а даёт заметно смещённое распределение: правильный способ — Fisher-Yates.</p>
    <p><code>undefined</code> всегда уезжают в конец и <strong>не передаются</strong> в компаратор, а дырки разреженного массива идут ещё дальше — за <code>undefined</code>.</p>

    <h4>Почему так</h4>
    <p>Строковое сравнение по умолчанию — наследие ES1, где массивы часто содержали строки, а числовой компаратор считался частным случаем. Требование стабильности добавили только в ES2019, когда стало ясно, что все движки де-факто её обеспечивают на практических размерах и что различия ломают приложения. Цена стабильного TimSort — дополнительная память O(n) в худшем случае, что для JS сочли приемлемым.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>arr.sort()</code> без компаратора на числах — самая частая ошибка в коде, и она не падает, а тихо даёт неверный порядок.</li>
      <li>Компаратор с <code>a.value - b.value</code> на строках даёт <code>NaN</code>, и порядок становится непредсказуемым.</li>
      <li>Мутация <code>props.items.sort()</code> меняет данные родителя и не вызывает ререндер — двойной баг.</li>
      <li>Дорогой ключ, вычисляемый внутри компаратора, считается O(n log n) раз: нужен предварительный decorate-sort-undecorate.</li>
      <li><code>localeCompare</code> прямо в компараторе на больших массивах на порядок медленнее, чем <code>Intl.Collator</code>, созданный один раз.</li>
      <li>Сортировка объектов по полю, которого нет у части элементов, даёт <code>undefined</code> в арифметике и <code>NaN</code> — компаратор ломается молча.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как правильно перемешать массив?»</strong> — Fisher-Yates за O(n): идти с конца и менять текущий элемент со случайным из уже пройденных. <strong>«Как сортировать по нескольким полям?»</strong> — цепочка через <code>||</code> в одном компараторе или последовательные стабильные проходы от менее значимого ключа к более значимому. <strong>«Что стабильность даёт на практике?»</strong> — воспроизводимость: одинаковый ввод всегда даёт одинаковый вывод, что важно для снапшот-тестов и для diff-ов.</p>`,
    code: `[10, 9, 1].sort();                  // [1, 10, 9] — строковое сравнение
[10, 9, 1].sort((a, b) => a - b);   // [1, 9, 10]

// многоуровневая сортировка без мутации
const collator = new Intl.Collator('ru');
const sorted = items.toSorted((a, b) =>
  a.group - b.group || collator.compare(a.name, b.name));

// перемешивание: не sort, а Fisher-Yates
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}`,
    tip: 'Упомяните, что sort(() => Math.random() - 0.5) — не перемешивание, а источник смещения; замена на Fisher-Yates часто становится отдельным маленьким вопросом, и ответ на него стоит держать наготове.' },

  { id: 'jsx49',
    q: 'Как правильно сортировать строки? Чем localeCompare отличается от простого сравнения и когда нужен Intl.Collator?',
    a: `<h4>Коротко</h4>
    <p>Оператор <code>&lt;</code> и <code>sort()</code> по умолчанию сравнивают строки по <strong>UTF-16 code unit</strong> — это «программистский» порядок, где все заглавные раньше строчных. <code>localeCompare</code> и <code>Intl.Collator</code> используют правила локали. Для сортировки массива нужен именно <code>Collator</code>, а не <code>localeCompare</code> в компараторе.</p>

    <h4>Как это работает</h4>
    <p>Code-unit-порядок даёт <code>'Z' &lt; 'a'</code>, потому что заглавная Z это U+005A, а строчная a — U+0061. Кириллическая «ё» (U+0451) оказывается после всей строчной кириллицы, хотя носитель ждёт её между «е» и «ж». Символы вне BMP сортируются по суррогатам, а не по code point, поэтому редкие иероглифы и эмодзи идут «не туда».</p>
    <p>Collation по правилам локали — многоуровневое сравнение. Первый уровень — базовые буквы, второй — диакритика, третий — регистр, четвёртый — прочие различия. Опции: <code>sensitivity</code> (<code>'base'</code> игнорирует регистр и акценты, <code>'accent'</code> — только регистр, <code>'case'</code> — только акценты, <code>'variant'</code> различает всё), <code>numeric: true</code> для естественной сортировки, <code>caseFirst</code> (<code>'upper'</code>/<code>'lower'</code>), <code>ignorePunctuation</code>.</p>
    <p><strong>Почему Collator, а не localeCompare.</strong> <code>localeCompare</code> при каждом вызове формально создаёт внутренний объект коллятора со всеми опциями; движки это кешируют, но не всегда полно, и на массиве в десятки тысяч строк разница достигает порядка. <code>new Intl.Collator(...)</code> создаётся один раз, а его метод <code>compare</code> уже привязан и передаётся в <code>sort</code> напрямую.</p>
    <p><code>numeric: true</code> решает частую задачу «файл2 перед файл10» без разбора чисел вручную; работает и для смешанных строк вроде версий и артикулов.</p>

    <h4>Почему так</h4>
    <p>Порядок букв — свойство языка, а не Unicode: в шведском ä идёт после z, в немецком телефонном порядке — рядом с a, в словацком «ch» это отдельная буква между h и i. Универсального порядка не существует, поэтому спецификация делегирует его данным CLDR. Плата — результат зависит от версии ICU в движке и потому не гарантирован побитово между окружениями.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Ассерт точного порядка экзотических строк в тестах ломается при обновлении Node — сравнивать надо по инвариантам, а не по литералу.</li>
      <li>Клиентская и серверная сортировка могут разойтись: пагинация с сортировкой на бэкенде и досортировкой на фронте даёт дубли и пропуски.</li>
      <li><code>sensitivity: 'base'</code> уравнивает «е» и «ё», что для поиска хорошо, а для уникальности имён — нет.</li>
      <li>Node без full-icu поддерживает только английскую коллацию; в Docker-образе это легко пропустить.</li>
      <li><code>numeric: true</code> сравнивает числовые последовательности любой длины, поэтому <code>'v1.10'</code> и <code>'v1.9'</code> упорядочатся правильно, но семантику semver он всё равно не знает.</li>
      <li>Сортировка с <code>Collator</code> дороже, чем по code unit; на очень больших списках имеет смысл сортировать по предвычисленному ключу.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как получить одинаковый порядок на клиенте и сервере?»</strong> — сортировать на одной стороне, а другой отдавать готовый порядок; либо сортировать по нормализованному ключу, вычисленному одним и тем же алгоритмом. <strong>«Как сделать поиск без учёта регистра и ё/е?»</strong> — <code>Collator</code> с <code>sensitivity: 'base'</code> для сравнения или отдельное нормализованное поле в индексе.</p>`,
    code: `['я', 'Ёж', 'ель', 'Абв'].sort();
// ['Абв','Ёж','ель','я'] — заглавные первыми, ё не на месте

const c = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
['файл10', 'файл2', 'Файл1'].sort(c.compare);
// ['Файл1','файл2','файл10']

// плохо на больших массивах: коллятор пересоздаётся логарифмически часто
rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

// хорошо: один коллятор на всю сортировку
const cmp = new Intl.Collator('ru').compare;
rows.sort((a, b) => cmp(a.name, b.name));`,
    tip: 'Аргумент про производительность — создать Collator один раз вместо localeCompare в компараторе — практичная деталь, которую называют немногие; добавьте, что вывод зависит от версии ICU и его нельзя ассертить в снапшотах.' },

  { id: 'jsx50',
    q: 'Что такое разреженные массивы и как разные методы обходятся с дырками?',
    a: `<h4>Коротко</h4>
    <p>Разреженный массив — массив, у которого есть индексы без собственного свойства: <code>[1, , 3]</code>, <code>new Array(3)</code>, <code>arr[100] = 1</code>, <code>delete arr[0]</code>. Дырка — это <strong>не</strong> <code>undefined</code>: <code>0 in [,]</code> даёт <code>false</code>, а <code>0 in [undefined]</code> — <code>true</code>.</p>

    <h4>Как это работает</h4>
    <p>Методы делятся на три группы. <strong>Пропускают дырки</strong> (колбэк не вызывается): <code>forEach</code>, <code>map</code>, <code>filter</code>, <code>some</code>, <code>every</code>, <code>reduce</code>, <code>reduceRight</code>, <code>find</code> частично, <code>indexOf</code>, <code>lastIndexOf</code>. Причём <code>map</code> дырки <strong>сохраняет</strong> в результате — это самая неинтуитивная часть: колбэк не вызвался, но позиция осталась пустой.</p>
    <p><strong>Считают дырки за <code>undefined</code></strong>: <code>join</code> (даёт пустую строку), <code>sort</code> (отправляет в самый конец, за <code>undefined</code>), <code>fill</code>, <code>copyWithin</code>, <code>keys</code>, <code>entries</code>, <code>Array.from</code>, spread, <code>for...of</code> — потому что итератор массива честно читает <code>arr[i]</code> по каждому индексу от 0 до <code>length</code>.</p>
    <p><strong>Не знают про дырки вовсе</strong> — новые методы ES2022–ES2023: <code>at</code>, <code>includes</code>, <code>findLast</code>, <code>findLastIndex</code>, <code>toSorted</code>, <code>toReversed</code>, <code>toSpliced</code>, <code>with</code>, <code>flat</code>. Они читают <code>undefined</code> и возвращают плотный массив. Комитет сознательно решил не тащить дырки в новый API.</p>
    <p>Отсюда классика: <code>new Array(3).map((_, i) =&gt; i)</code> даёт <code>[ , , ]</code>, а <code>Array.from({ length: 3 }, (_, i) =&gt; i)</code> — <code>[0,1,2]</code>. И контраст <code>[1,,3].indexOf(undefined)</code> это <code>-1</code>, а <code>includes(undefined)</code> — <code>true</code>.</p>
    <p>Плюс производительность: V8 держит плотные массивы в <code>PACKED_*</code> представлении с быстрым доступом по смещению, а любая дырка переводит его в <code>HOLEY_*</code>, где каждое чтение требует проверки на дырку и, возможно, похода по прототипу. Сильно разреженный массив уходит в dictionary elements — хеш-таблицу, где доступ в разы медленнее. Переход необратим.</p>

    <h4>Почему так</h4>
    <p>Массив в JS — это объект с целочисленными ключами и особым <code>length</code>, поэтому «отсутствующий индекс» физически возможен, в отличие от массивов в C. Старые методы из ES5 пропускают дырки, потому что тогда это считалось «правильной» семантикой разреженных данных. Новые методы этот принцип отбросили, и в языке теперь сосуществуют две модели — это цена совместимости.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>new Array(n)</code> для инициализации — почти всегда ошибка; нужен <code>Array.from({length: n}, fn)</code> или <code>new Array(n).fill(0)</code>.</li>
      <li><code>delete arr[i]</code> не сдвигает элементы и оставляет дырку; правильно — <code>splice</code> или фильтрация.</li>
      <li><code>arr.length = 10</code> на массиве из трёх элементов создаёт семь дырок.</li>
      <li>Присваивание по далёкому индексу (<code>arr[10000] = 1</code>) переводит массив в dictionary mode целиком.</li>
      <li>В DevTools дырки печатаются как <code>&lt;1 empty item&gt;</code>, а <code>undefined</code> — как <code>undefined</code>; это единственный простой способ их различить визуально.</li>
      <li><code>JSON.stringify([1,,3])</code> даёт <code>'[1,null,3]'</code> — дырки становятся <code>null</code> и после round-trip превращаются в настоящие значения.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как проверить, что массив плотный?»</strong> — <code>arr.every((_, i) =&gt; i in arr)</code>, потому что <code>every</code> пропускает дырки и потому вернёт <code>true</code> ошибочно; надёжнее <code>Object.keys(arr).length === arr.length</code>. <strong>«Почему <code>[...Array(3)]</code> работает, а <code>Array(3).map</code> нет?»</strong> — spread идёт через итератор, который читает каждый индекс и даёт <code>undefined</code>; <code>map</code> проверяет наличие собственного свойства. <strong>«Стоит ли бояться дырок?»</strong> — их просто не надо создавать: это дешевле, чем помнить таблицу поведения методов.</p>`,
    code: `const sparse = [1, , 3];
sparse.length;            // 3
1 in sparse;              // false — дырка, не undefined
sparse.map(x => x * 2);   // [2, <1 empty item>, 6] — дырка сохранена
sparse.join('-');         // '1--3'
[...sparse];              // [1, undefined, 3]
sparse.indexOf(undefined);   // -1
sparse.includes(undefined);  // true
JSON.stringify(sparse);      // '[1,null,3]'

new Array(3).map((_, i) => i);            // [ , , ] — колбэк не вызван
new Array(3).fill(0).map((_, i) => i);    // [0,1,2]
Array.from({ length: 3 }, (_, i) => i);   // [0,1,2]`,
    tip: 'Пара примеров new Array(3).map против Array.from({length:3}) — самая узнаваемая иллюстрация дырок; добавьте, что переход массива в HOLEY-представление в V8 необратим.' },

  { id: 'jsx51',
    q: 'Расскажи про at(), toSorted, toSpliced, toReversed и with. Зачем их добавили?',
    a: `<h4>Коротко</h4>
    <p><code>at()</code> (ES2022) даёт доступ по индексу с поддержкой отрицательных значений. ES2023 добавил <strong>копирующие версии</strong> мутирующих методов: <code>toSorted</code>, <code>toReversed</code>, <code>toSpliced</code> и <code>with(index, value)</code>. Они возвращают новый массив, не трогая исходный, и закрывают самую частую причину багов в React и Redux.</p>

    <h4>Как это работает</h4>
    <p><code>arr.at(-1)</code> заменяет <code>arr[arr.length - 1]</code>. Есть у <code>Array</code>, <code>String</code> и <code>TypedArray</code>. Важно: это <strong>не</strong> отрицательная индексация — <code>arr[-1]</code> по-прежнему обычное строковое свойство объекта и остаётся <code>undefined</code>.</p>
    <p>Копирующие методы всегда возвращают <strong>обычный <code>Array</code></strong>: <code>Symbol.species</code> к ним не применяется, поэтому подкласс получит базовый массив. Дырок они не знают — читают их как <code>undefined</code> и отдают плотный результат. Работают с любым array-like через <code>call</code>, потому что читают только <code>length</code> и индексы. У <code>TypedArray</code> есть <code>toSorted</code>, <code>toReversed</code> и <code>with</code>, но нет <code>toSpliced</code>: длина типизированного массива фиксирована.</p>
    <p><code>toSpliced(start, deleteCount, ...items)</code> — копирующий аналог <code>splice</code>, но возвращает <strong>новый массив целиком</strong>, а не удалённые элементы, как <code>splice</code>. Это несовпадение сигнатур регулярно сбивает при рефакторинге.</p>
    <p>Из того же релиза <code>findLast</code> и <code>findLastIndex</code> убирают уродливый паттерн <code>[...arr].reverse().find(...)</code>, который делал лишнюю копию и терял индекс.</p>
    <p>Стоимость: каждый вызов создаёт копию, поэтому цепочка <code>toSorted().toReversed().with(...)</code> — это три массива. В горячем коде это заметно; там либо один проход, либо мутация локальной копии.</p>

    <h4>Почему так</h4>
    <p>Мутирующие методы <code>sort</code>, <code>reverse</code>, <code>splice</code> проектировались в 1995 году, когда иммутабельность не была практикой. С приходом React ритуал <code>[...arr].sort()</code> стал обязательным в каждом редьюсере, и его регулярно забывали — получался баг «состояние изменилось, а компонент не перерисовался» или, наоборот, «пропсы родителя внезапно поменялись». Копирующие методы делают правильный путь короче неправильного.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>at()</code> не заменяет проверку границ: <code>arr.at(-10)</code> на коротком массиве это <code>undefined</code>, а не ошибка.</li>
      <li><code>toSpliced</code> возвращает новый массив, а <code>splice</code> — удалённые элементы: механическая замена имени ломает логику.</li>
      <li>Копирующие методы всегда возвращают базовый <code>Array</code> — подклассы теряют тип без предупреждения.</li>
      <li>Каждый вызов — новая копия и новая ссылка: цепочка из трёх методов создаёт три массива и три раза инвалидирует мемоизацию.</li>
      <li>В Node 18 и старых Safari части этих методов нет — при поддержке старых сред нужен полифилл или core-js.</li>
      <li><code>with</code> на индексе вне диапазона бросает <code>RangeError</code>, в отличие от обычного присваивания.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем это лучше spread + sort?»</strong> — короче, читается как выражение и не создаёт промежуточный массив дважды при цепочке из одной операции; семантика та же. <strong>«Что делать с большими массивами?»</strong> — копирующие методы линейны по памяти; на десятках тысяч элементов лучше мутировать локальную копию один раз или использовать structural sharing. <strong>«Почему они не уважают species?»</strong> — TC39 сознательно отказался от него в новых методах как от источника сложности и уязвимостей.</p>`,
    code: `const arr = [3, 1, 2];
arr.at(-1);                 // 2
arr.toSorted((a, b) => a - b);  // [1,2,3], arr не изменён
arr.with(0, 99);            // [99,1,2]
arr.toSpliced(1, 1);        // [3,2] — новый массив, не удалённые элементы
arr.findLast(x => x < 3);   // 2
arr;                        // [3,1,2] — исходник цел

// раньше в редьюсере приходилось так
// return { ...state, items: [...state.items].sort(cmp) };
// теперь
return { ...state, items: state.items.toSorted(cmp) };

class Col extends Array {}
new Col(1, 2).toReversed() instanceof Col;   // false — всегда Array`,
    tip: 'Свяжите это с иммутабельностью в стейт-менеджерах: «toSorted появился ровно потому, что [...arr].sort() был обязательным ритуалом в каждом редьюсере». И отметьте несовпадение сигнатур splice и toSpliced.' },

  { id: 'jsx52',
    q: 'Что такое Object.groupBy и Map.groupBy? Чем они отличаются и в чём подвох?',
    a: `<h4>Коротко</h4>
    <p>ES2024 добавил два статических метода группировки. <code>Object.groupBy(items, fn)</code> возвращает объект, где ключи — строковый результат колбэка. <code>Map.groupBy(items, fn)</code> возвращает <code>Map</code> и потому допускает <strong>любые ключи</strong>: объекты, числа, символы, без приведения к строке.</p>

    <h4>Как это работает</h4>
    <p>Колбэк получает <code>(element, index)</code> — никакого аккумулятора, это чистая группировка без reduce-акробатики. Оба метода работают с любым <strong>итерируемым</strong>, а не только с массивом: <code>Set</code>, <code>Map.entries()</code>, генератор, <code>NodeList</code>.</p>
    <p>Ключевая деталь <code>Object.groupBy</code>: результат создаётся с прототипом <code>null</code>. Это защита от prototype pollution — данные с полем <code>'__proto__'</code> не сломают объект и не подменят прототип. Обратная сторона: у результата <strong>нет</strong> <code>hasOwnProperty</code>, <code>toString</code> и остальных методов <code>Object.prototype</code>, а <code>console.log</code> покажет <code>[Object: null prototype]</code>. Проверять наличие ключа надо через <code>Object.hasOwn</code> или оператор <code>in</code>.</p>
    <p>Ключи <code>Object.groupBy</code> всегда приводятся к строке (или остаются символом), поэтому группировка по числу даст ключи <code>'1'</code>, <code>'2'</code>, а группировка по объекту схлопнет всё в <code>'[object Object]'</code>. <code>Map.groupBy</code> использует SameValueZero и сохраняет и тип, и порядок вставки групп.</p>
    <p>Когда что: <code>Map.groupBy</code> — если ключ не строка, если важен порядок появления групп или если групп очень много (Map лучше держит динамические ключи). <code>Object.groupBy</code> — если результат сразу идёт в JSON, в шаблон или в пропсы компонента.</p>

    <h4>Почему так</h4>
    <p>Группировка — одна из самых частых операций, и её десять лет писали через <code>reduce</code> с ручным созданием массива для нового ключа. Это шумно и легко ошибиться (забыть инициализацию, использовать <code>||</code> вместо <code>??</code>). Прототип <code>null</code> выбран потому, что ключи приходят <strong>из данных</strong>, а не из кода: без этой защиты одна строка <code>__proto__</code> в пользовательском вводе давала бы полноценную уязвимость.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>У результата нет методов <code>Object.prototype</code>: <code>result.hasOwnProperty(k)</code> бросает <code>TypeError</code>.</li>
      <li>Библиотеки, ожидающие обычный объект (некоторые сериализаторы, старые шаблонизаторы), могут споткнуться о прототип <code>null</code>.</li>
      <li>Порядок ключей в объекте — целочисленные первыми по возрастанию, затем строковые в порядке вставки; группировка по числам «перемешает» группы.</li>
      <li>Колбэк, возвращающий <code>undefined</code>, создаёт группу с ключом <code>'undefined'</code>, а не отбрасывает элемент.</li>
      <li><code>Map.groupBy</code> с объектными ключами удерживает их от сборки мусора, пока жива Map.</li>
      <li>Поддержка появилась только в 2024: Node 21+ и свежие браузеры, в старых нужен полифилл.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем это лучше reduce?»</strong> — читаемость и отсутствие класса ошибок с инициализацией группы; производительность сопоставима. <strong>«Что такое prototype pollution?»</strong> — запись в <code>__proto__</code> при слиянии недоверенных данных меняет <code>Object.prototype</code> для всего приложения; прототип <code>null</code> и <code>Object.create(null)</code> — стандартная защита. <strong>«Как сгруппировать по нескольким полям?»</strong> — составной строковый ключ для <code>Object.groupBy</code> или кортеж-объект и <code>Map.groupBy</code> с предвычисленной канонической ссылкой. <strong>«Порядок групп гарантирован?»</strong> — в <code>Map.groupBy</code> да, это порядок первого появления; в <code>Object.groupBy</code> целочисленные ключи всегда всплывают вперёд и по возрастанию.`,
    code: `const users = [
  { name: 'Ann', dept: 'eng' },
  { name: 'Bob', dept: 'ops' },
  { name: 'Cid', dept: 'eng' }
];

const byDept = Object.groupBy(users, u => u.dept);
// { eng: [Ann, Cid], ops: [Bob] } с прототипом null
Object.getPrototypeOf(byDept);        // null
// byDept.hasOwnProperty('eng');      // TypeError
Object.hasOwn(byDept, 'eng');         // true

const byTeam = Map.groupBy(users, u => teams.get(u.dept));  // ключ — объект

// раньше это писали так
users.reduce((acc, u) => ((acc[u.dept] ??= []).push(u), acc), {});`,
    tip: 'Прототип null — деталь, которую почти никто не называет; она объясняет и защиту от prototype pollution, и почему у результата нет привычных методов Object.' },

  { id: 'jsx53',
    q: 'Какие возможности ES2023-ES2025 ты считаешь реально полезными и уже используешь?',
    a: `<h4>Коротко</h4>
    <p>Из свежего в ежедневной работе живут четыре группы: копирующие методы массивов, <code>Promise.withResolvers</code>, iterator helpers и методы <code>Set</code>. Всё остальное — точечные инструменты, которые вспоминаешь по случаю.</p>

    <h4>Как это работает</h4>
    <p><strong>ES2022</strong>, которое ещё считают новым: <code>Object.hasOwn</code> (замена <code>Object.prototype.hasOwnProperty.call</code>), <code>at()</code>, <code>Error.cause</code>, <code>#</code>-поля, статические блоки, <code>#x in obj</code>, top-level await, флаг <code>d</code> в регулярках.</p>
    <p><strong>ES2023</strong>: копирующие методы массивов (<code>toSorted</code>, <code>toSpliced</code>, <code>toReversed</code>, <code>with</code>), <code>findLast</code> и <code>findLastIndex</code>, hashbang-грамматика для CLI-скриптов, символы как ключи <code>WeakMap</code>.</p>
    <p><strong>ES2024</strong>: <code>Object.groupBy</code> и <code>Map.groupBy</code>; <code>Promise.withResolvers</code> — resolve и reject наружу без конструктора-обёртки, идеально для deferred и адаптации событийных API; <code>Array.fromAsync</code> — собрать async-итерируемое в массив; <code>ArrayBuffer.prototype.transfer</code> и <code>resize</code>; флаг <code>v</code> в регулярках; <code>String.isWellFormed</code> и <code>toWellFormed</code> для строк со сломанными суррогатами; <code>Atomics.waitAsync</code>.</p>
    <p><strong>ES2025</strong>: <strong>iterator helpers</strong> — <code>map</code>, <code>filter</code>, <code>take</code>, <code>drop</code>, <code>flatMap</code>, <code>reduce</code>, <code>toArray</code>, <code>some</code>, <code>every</code>, <code>find</code> прямо на итераторах, то есть ленивые цепочки без промежуточных массивов. <strong>Методы Set</strong>: <code>union</code>, <code>intersection</code>, <code>difference</code>, <code>symmetricDifference</code>, <code>isSubsetOf</code>, <code>isSupersetOf</code>, <code>isDisjointFrom</code>. Плюс <code>Promise.try</code>, <code>RegExp.escape</code>, import attributes, <code>Float16Array</code>, дублирующиеся именованные группы в регулярках, <code>Error.isError</code>.</p>
    <p><strong>Из ближайшего будущего</strong>: Temporal (даты), Explicit Resource Management (<code>using</code> и <code>Symbol.dispose</code>), Signals, Decorators.</p>

    <h4>Почему так</h4>
    <p>Общая линия последних релизов — забрать в стандарт то, что все писали руками: группировку, deferred, ленивые цепочки, операции над множествами, экранирование регулярок. Это уменьшает бандл и убирает целые классы самописных багов. Цена — фрагментация поддержки: половина этого требует свежих браузеров и Node 22+, поэтому решение «использовать или полифиллить» принимается по матрице поддержки продукта.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Iterator helpers работают на <strong>итераторах</strong>, а не на массивах: нужен <code>arr.values()</code>, иначе метода просто нет.</li>
      <li>Методы <code>Set</code> принимают любой set-like с <code>size</code>, <code>has</code> и <code>keys</code>, но не обычный массив — <code>TypeError</code>.</li>
      <li><code>Promise.withResolvers</code> легко превращается в антипаттерн: если промис можно построить конструктором, лучше конструктор.</li>
      <li><code>Array.fromAsync</code> ждёт весь поток целиком — на бесконечном источнике это зависание.</li>
      <li>core-js полифиллит многое, но iterator helpers добавляют методы на прототипы итераторов, что заметно раздувает бандл.</li>
      <li>Ссылаться на Stage 3 как на «уже есть» рискованно: Record &amp; Tuple дошёл до обсуждения и был снят.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Зачем iterator helpers, если есть методы массива?»</strong> — они ленивые: <code>take(3)</code> остановит генератор после третьего подходящего элемента и не создаст ни одного промежуточного массива. <strong>«Что вы ждёте больше всего?»</strong> — Temporal, потому что он закрывает целый класс багов с таймзонами, и <code>using</code>, потому что он даёт детерминированное освобождение ресурсов. <strong>«Как решать, брать ли новинку в прод?»</strong> — по матрице поддержки продукта и стоимости полифилла: <code>Object.hasOwn</code> стоит копейки, а iterator helpers через core-js заметно раздувают бандл.`,
    code: `const { promise, resolve, reject } = Promise.withResolvers();
socket.onmessage = e => resolve(e.data);
socket.onerror = reject;
const first = await promise;

// iterator helpers: ленивая цепочка, без промежуточных массивов
const top3 = data.values()
  .filter(x => x.active)
  .map(x => x.id)
  .take(3)
  .toArray();

new Set([1,2,3]).intersection(new Set([2,3,4]));   // Set {2,3}
new Set([1,2]).isSubsetOf(new Set([1,2,3]));       // true

new RegExp(RegExp.escape(userInput));              // безопасная вставка
Error.isError(err);                                // кросс-realm проверка`,
    tip: 'Iterator helpers стоит подать через выгоду: они не создают промежуточные массивы, поэтому take(3) по бесконечному генератору останавливает его сразу — с методами массива это невозможно в принципе.' },

  { id: 'jsx54',
    q: 'Какие тонкости у JSON.stringify и JSON.parse? Что теряется при сериализации?',
    a: `<h4>Коротко</h4>
    <p><code>stringify</code> молча выбрасывает <code>undefined</code>, функции и символы в объектах, а в массивах заменяет их на <code>null</code>. <code>NaN</code> и <code>Infinity</code> становятся <code>null</code>. <code>Date</code> превращается в ISO-строку, <code>Map</code>, <code>Set</code>, <code>RegExp</code> — в <code>{}</code>. <code>BigInt</code> и циклическая ссылка бросают <code>TypeError</code>.</p>

    <h4>Как это работает</h4>
    <p>Порядок обработки значения такой: если у объекта есть метод <code>toJSON</code>, вызывается он и дальше сериализуется его результат; затем применяется <code>replacer</code>; затем значение приводится по типу. Именно из-за <code>toJSON</code> у <code>Date</code> получается ISO-строка — и именно поэтому <code>parse</code> не возвращает <code>Date</code> обратно: обратного преобразования в стандарте нет.</p>
    <p><strong>Точки расширения.</strong> <code>toJSON</code> на классе полностью определяет представление — удобно для value-объектов и для скрытия секретов. <code>replacer</code> — либо функция <code>(key, value)</code>, вызываемая для каждой пары сверху вниз, либо массив-белый список ключей. Третий аргумент — отступ. У <code>parse</code> есть <code>reviver</code>, вызываемый снизу вверх; в ES2025 у него появился четвёртый параметр <code>context</code> с полем <code>source</code> — исходным текстом числа, что наконец позволяет разобрать большое целое в <code>BigInt</code> без потери точности.</p>
    <p><strong>Безопасность.</strong> <code>JSON.parse</code> сам по себе безопасен и не выполняет код, в отличие от <code>eval</code>. Но ключ <code>__proto__</code> из недоверенного JSON при последующем глубоком слиянии в объект даёт <strong>prototype pollution</strong>: атакующий подменяет свойство на <code>Object.prototype</code> и влияет на всё приложение. Защита — <code>Object.create(null)</code> для аккумулятора, отбрасывание опасных ключей в <code>reviver</code> и схема-валидация (zod, ajv).</p>
    <p><strong>Порядок ключей.</strong> Это порядок вставки, кроме целочисленных ключей, которые всегда идут первыми и по возрастанию. Поэтому JSON нельзя использовать как канонический ключ кеша или как основу для подписи без явной сортировки ключей.</p>

    <h4>Почему так</h4>
    <p>JSON проектировался как подмножество литерала JS с минимальным набором типов ради переносимости между языками. Всё, чего нет в этом наборе, приходится кодировать соглашением — и стандарт сознательно не навязывает конкретное, чтобы не конфликтовать с существующими форматами. Цена — каждый проект изобретает свой способ передать дату, Map и большое число.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li><code>JSON.stringify(err)</code> даёт <code>{}</code>: <code>message</code> и <code>stack</code> не перечисляемы.</li>
      <li>Разница между объектом и массивом: <code>undefined</code> в объекте исчезает, в массиве становится <code>null</code> и меняет длину смысла.</li>
      <li><code>JSON.parse</code> уже потерял точность больших чисел до вызова <code>reviver</code> — спасает только <code>context.source</code> или парсинг строкой.</li>
      <li>Глубокая рекурсия даёт <code>RangeError: Maximum call stack size exceeded</code> на сильно вложенных структурах.</li>
      <li><code>stringify</code> на большом объекте — синхронный long task; для мегабайтных данных нужен стриминговый сериализатор или воркер.</li>
      <li><code>-0</code> сериализуется как <code>0</code>, а <code>'\\u2028'</code> и <code>'\\u2029'</code> в строках раньше ломали вставку JSON в <code>&lt;script&gt;</code> (исправлено в ES2019 well-formed stringify).</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как передать Date и Map?»</strong> — договорным форматом: ISO-строка плюс <code>reviver</code>, или обёртка <code>{ $type: 'Map', value: [...] }</code>; альтернативно <code>structuredClone</code>, если данные не покидают браузер. <strong>«Как сделать стабильный ключ кеша?»</strong> — рекурсивно отсортировать ключи и только потом сериализовать; наивный <code>JSON.stringify(params)</code> даёт разные строки для одинаковых данных.</p>`,
    code: `JSON.stringify({ a: undefined, b: () => {}, c: NaN });  // '{"c":null}'
JSON.stringify([undefined, () => {}]);                  // '[null,null]'
JSON.stringify({ m: new Map([['a',1]]) });              // '{"m":{}}'

class Token { constructor(v) { this.v = v; } toJSON() { return '[redacted]'; } }
JSON.stringify({ t: new Token('secret') });             // '{"t":"[redacted]"}'

JSON.stringify({ b: 1, a: 2, 2: 'x', 1: 'y' });
// '{"1":"y","2":"x","b":1,"a":2}' — целые ключи первыми

// защита от prototype pollution
JSON.parse(raw, function (k, v) {
  if (k === '__proto__' || k === 'constructor') return undefined;
  return v;
});`,
    tip: 'Про целочисленные ключи, которые всегда сортируются вперёд, знают немногие — а это ломает наивные ключи кеша, построенные через JSON.stringify. Второй сильный пункт — __proto__ и prototype pollution.' },

  { id: 'jsx55',
    q: 'Какие проблемы у встроенного Date и что меняет Temporal?',
    a: `<h4>Коротко</h4>
    <p><code>Date</code> мутабельный, месяцы нумерует с нуля, парсит строки частично зависимо от реализации и внутри хранит одно число миллисекунд без информации о зоне. Из-за последнего «календарная дата» и «момент времени» неразличимы — отсюда весь класс багов с таймзонами. Temporal вводит отдельные типы для каждого смысла.</p>

    <h4>Как это работает</h4>
    <p>Внутри <code>Date</code> — epoch milliseconds в UTC. Все геттеры (<code>getDate</code>, <code>getHours</code>) отдают значения в <strong>локальной</strong> зоне рантайма, а конструктор интерпретирует аргументы то как UTC, то как локальное время в зависимости от формата. <code>new Date('2026-08-31')</code> — это UTC-полночь (ISO date-only трактуется как UTC), а <code>new Date('2026/08/31')</code> и <code>new Date(2026, 7, 31)</code> — локальная полночь. В зоне UTC−5 первый вариант даст <code>getDate() === 30</code>.</p>
    <p>Мутабельность: <code>setDate</code>, <code>setMonth</code> меняют объект на месте и возвращают число, а не дату, поэтому «удобная» цепочка невозможна, а случайно переданная наружу ссылка портит чужие данные. Арифметика вокруг перехода на летнее время неверна: сутки не всегда 24 часа, и прибавление 86400000 мс иногда даёт тот же календарный день.</p>
    <p><strong>Temporal</strong> решает это набором иммутабельных типов с разной семантикой: <code>PlainDate</code> (день без зоны — день рождения), <code>PlainTime</code>, <code>PlainDateTime</code>, <code>ZonedDateTime</code> (с IANA-зоной и корректным DST), <code>Instant</code> (точка на шкале), <code>Duration</code>, <code>PlainYearMonth</code>, <code>PlainMonthDay</code>. Арифметика явная: <code>add</code>, <code>subtract</code>, <code>until</code>, <code>since</code>, <code>round</code>, с настраиваемым разрешением неоднозначностей DST через <code>disambiguation</code> и <code>overflow</code>. Поддерживаются календари помимо григорианского.</p>
    <p>Статус: proposal на Stage 3, реализация есть в Firefox и появляется в других движках; в проде пока полифилл или date-fns/Luxon. Правило прямо сейчас: хранить UTC ISO-строку или epoch, форматировать через <code>Intl.DateTimeFormat</code> с <strong>явной</strong> <code>timeZone</code>, а арифметику делать библиотекой.</p>

    <h4>Почему так</h4>
    <p><code>Date</code> был скопирован с <code>java.util.Date</code> за десять дней в 1995 году — вместе со всеми его известными недостатками, которые Java потом исправила в java.time. Исправить <code>Date</code> задним числом нельзя: слишком много кода зависит от текущего поведения, включая мутабельность. Поэтому Temporal — новый API рядом, а не замена.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Сдвиг на день при отображении даты рождения — самый частый баг: дата хранится как UTC-полночь, а показывается в локальной зоне.</li>
      <li>Прибавление «одного месяца» неоднозначно: 31 января плюс месяц — это 28 февраля или 3 марта? Temporal требует явного <code>overflow</code>.</li>
      <li>Сравнение дат через <code>===</code> не работает: это объекты; нужен <code>getTime()</code> или <code>&lt;</code>/<code>&gt;</code>, которые сравнивают через ToPrimitive.</li>
      <li><code>Date.parse</code> нестандартных форматов зависит от движка: то, что работает в Chrome, даёт <code>Invalid Date</code> в Safari.</li>
      <li>Таймзона сервера отличается от таймзоны пользователя: без явной <code>timeZone</code> отчёты «за сутки» режутся по разным границам.</li>
      <li>Полифилл Temporal весит сотни килобайт — для одного форматирования его тянуть не стоит.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как хранить дату в БД?»</strong> — момент времени как UTC timestamp, календарную дату как <code>DATE</code> или строку <code>YYYY-MM-DD</code> без зоны; смешивать эти два смысла в одной колонке нельзя. <strong>«Как посчитать возраст?»</strong> — по календарным датам, а не по миллисекундам: разница в миллисекундах ломается на високосных годах и DST.</p>`,
    code: `const d = new Date('2026-08-31');   // UTC-полночь
d.getDate();                       // может быть 30 в зоне UTC-5

new Date('2026-08-31') - new Date('2026/08/31');   // не 0: разные зоны

// Temporal: смысл виден в типе
const birthday = Temporal.PlainDate.from('2026-08-31');   // без зоны
birthday.add({ months: 1 }).toString();                   // '2026-09-30'
Temporal.Now.zonedDateTimeISO('Europe/Moscow').hour;

// пока Temporal не везде: явная зона при форматировании
new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', dateStyle: 'long'
}).format(new Date());`,
    tip: 'Разделение «момент времени» и «календарная дата» — главная идея Temporal; сформулировав её, вы объясняете сразу весь класс багов с таймзонами, включая сдвиг дня рождения на сутки.' },

  { id: 'jsx56',
    q: 'Какие тонкости есть у деструктуризации? Приведи неочевидные случаи.',
    a: `<h4>Коротко</h4>
    <p>Значение по умолчанию срабатывает <strong>только на <code>undefined</code></strong>, но не на <code>null</code>, <code>0</code> или пустой строке — это роднит деструктуризацию с <code>??</code>, а не с <code>||</code>. Деструктуризация массива идёт через <strong>итератор</strong>, объекта — через доступ к свойствам.</p>

    <h4>Как это работает</h4>
    <p>Поскольку массивная форма использует <code>Symbol.iterator</code>, из <code>Set</code>, генератора, <code>Map</code> и <code>NodeList</code> можно деструктурировать по позициям — и на бесконечном генераторе это безопасно, потому что читается ровно столько элементов, сколько имён. Объектная форма читает свойства, поэтому работает с чем угодно, включая строки (<code>const { length } = 'abc'</code>), но не даёт позиционного доступа.</p>
    <p>Деструктуризация <code>null</code> или <code>undefined</code> бросает <code>TypeError</code> даже при наличии дефолтов у полей — дефолт применяется к свойству, а не к источнику. Поэтому у параметра-объекта всегда пишут <code>= {}</code>.</p>
    <p>Синтаксические нюансы. Переименование <code>{ a: b }</code> создаёт переменную <code>b</code>, а <code>a</code> не существует. Вложенное <code>{ a: { b } }</code> не создаёт <code>a</code> — только <code>b</code>. Присваивание без объявления требует скобок: <code>({ a } = obj)</code>, иначе парсер видит блок. Rest в объекте копирует только <strong>собственные перечисляемые</strong> свойства и не берёт геттеры с прототипа. Можно деструктурировать в вычисляемый ключ (<code>{ [key]: value }</code>) и прямо в свойство объекта (<code>({ p: obj.prop } = src)</code>).</p>
    <p>Дефолты вычисляются <strong>лениво и слева направо</strong>, поэтому предыдущие имена доступны последующим: <code>{ page = 1, size = page * 10 }</code> работает, а обратный порядок даёт TDZ-ошибку.</p>

    <h4>Почему так</h4>
    <p>Деструктуризация — синтаксический сахар над теми же операциями чтения, что и обычный код; поэтому она наследует всю их семантику, включая вызов геттеров, обращение к прототипу и работу итератора. Это же объясняет, почему у неё нет «магии»: <code>const { a } = obj</code> буквально равно <code>const a = obj.a</code> со всеми побочными эффектами.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Дефолт не спасает от <code>null</code>: <code>const { a = 1 } = { a: null }</code> даёт <code>null</code>, и дальше падает на <code>a.foo</code>.</li>
      <li>Деструктуризация вызывает геттеры источника — побочные эффекты и дорогие вычисления происходят «незаметно».</li>
      <li>Rest-свойство создаёт новый объект: в горячем коде это лишняя аллокация на каждый вызов.</li>
      <li>Деструктуризация массива из объекта без итератора даёт <code>TypeError: obj is not iterable</code>, а не <code>undefined</code>.</li>
      <li>Глубокая вложенная деструктуризация с дефолтами читается хуже, чем три обычные строки, и хуже отлаживается — стек не покажет, какое поле упало.</li>
      <li><code>const [a, b] = new Map(...)</code> даст пары <code>[key, value]</code>, а не значения — частая путаница.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Почему <code>{ a } = obj</code> без скобок — синтаксическая ошибка?»</strong> — в позиции инструкции фигурная скобка начинает блок; скобки переводят выражение в позицию значения. <strong>«Как взять первый элемент Set?»</strong> — <code>const [first] = set</code>: работает благодаря итератору и не создаёт массив целиком. <strong>«Чем rest отличается от spread?»</strong> — rest собирает остаток в связывающей позиции, spread раскладывает в позиции выражения; синтаксис один, роли противоположные.</p>`,
    code: `const { a = 1 } = { a: null };        // null, не 1
const [x = 1] = [undefined];         // 1
const { b: { c } = {} } = {};        // c === undefined, без падения
// const { d } = null;               // TypeError

const [first, ...rest] = new Set([1, 2, 3]);   // работает: итератор
({ p: window.name } = { p: 'hi' });            // присваивание в свойство

function f({ page = 1, size = page * 10 } = {}) { return size; }
f();          // 10
f({ page: 3 }); // 30

function* infinite() { let i = 0; while (true) yield i++; }
const [i0, i1] = infinite();   // читает ровно два значения`,
    tip: 'Уточните, что деструктуризация массива всегда идёт через итератор — это объясняет и работу с Set и генераторами, и почему из объекта так нельзя, и почему на бесконечном генераторе это безопасно.' },

  { id: 'jsx57',
    q: 'Что нужно знать про параметры по умолчанию и rest-параметры? Что происходит с arguments и length?',
    a: `<h4>Коротко</h4>
    <p>Дефолты вычисляются <strong>при каждом вызове</strong> и только когда аргумент строго равен <code>undefined</code>: явная передача <code>undefined</code> тоже триггерит дефолт, а <code>null</code> — нет. Функция с дефолтами, rest-параметром или деструктуризацией получает <strong>unmapped <code>arguments</code></strong> и отдельную область видимости для списка параметров.</p>

    <h4>Как это работает</h4>
    <p>Инициализаторы выполняются слева направо, и правые параметры видят левые: <code>function f(a, b = a + 1)</code> работает. Обратный порядок даёт <code>ReferenceError</code> по TDZ — параметры находятся в одном лексическом окружении, и обращение к ещё не инициализированному имени запрещено.</p>
    <p>Наличие дефолта создаёт <strong>отдельный scope для списка параметров</strong>, отдельный от тела функции. Отсюда неочевидность: переменная, объявленная в теле через <code>var</code> с тем же именем, — это уже другая привязка, и функция-дефолт замыкается на параметре, а не на локальной переменной тела. В такой функции директива <code>'use strict'</code> в теле запрещена — синтаксическая ошибка, потому что инициализаторы уже начали выполняться до того, как режим стал известен.</p>
    <p><strong><code>arguments</code></strong> в простой функции <strong>mapped</strong>: изменение <code>a</code> отражается в <code>arguments[0]</code> и наоборот. Как только появляется дефолт, rest или деструктуризация, объект становится <strong>unmapped</strong> — снимок значений на момент входа. В strict mode он unmapped всегда. Стрелки собственного <code>arguments</code> не имеют вовсе.</p>
    <p><strong><code>fn.length</code></strong> считает только параметры <strong>до</strong> первого дефолта и не включает rest. Это важно для библиотек, смотрящих на арность: Express различает middleware по числу аргументов (четыре — обработчик ошибок), Mocha решает по наличию <code>done</code>, синхронный тест или асинхронный, а мемоизаторы выбирают стратегию по <code>fn.length === 0</code>.</p>
    <p>Rest-параметр — настоящий массив, в отличие от <code>arguments</code>, и его можно сразу деструктурировать: <code>function f(...[a, b])</code>.</p>

    <h4>Почему так</h4>
    <p>Отдельный scope для параметров нужен, чтобы инициализаторы не видели ещё не созданные локальные переменные тела: иначе <code>function f(x = y) { let y = 1; }</code> имел бы неопределённое поведение. Unmapped <code>arguments</code> появился потому, что двусторонняя связь с параметрами несовместима с инициализаторами — непонятно, что должно произойти при записи в <code>arguments[0]</code> для параметра с дефолтом.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Дефолт-объект <code>function f(opts = {})</code> создаётся заново на каждом вызове — новая ссылка ломает мемоизацию по аргументам.</li>
      <li>Дефолт не срабатывает на <code>null</code>: <code>f(null)</code> передаст <code>null</code>, и код упадёт на обращении к полю.</li>
      <li><code>fn.length</code> у функции с дефолтом меньше ожидаемого — библиотеки, полагающиеся на арность, начинают вести себя иначе после безобидного рефакторинга.</li>
      <li>Мутирующий дефолт-массив в общей области (<code>const DEF = []</code>) разделяется между вызовами — классическая ошибка, знакомая по Python.</li>
      <li>Rest-параметр в горячем коде аллоцирует массив на каждый вызов; там иногда всё ещё выигрывает <code>arguments</code>.</li>
      <li><code>'use strict'</code> в теле функции с дефолтами — <code>SyntaxError</code>, что удивляет при переносе старого кода.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Чем rest отличается от arguments?»</strong> — rest это настоящий массив со всеми методами, он не включает уже названные параметры и есть у стрелок; <code>arguments</code> — array-like, только в обычных функциях. <strong>«Как сделать обязательный параметр?»</strong> — дефолт-выражение, которое бросает: <code>function f(a = required('a'))</code>; вычисляется лениво и только при отсутствии аргумента.</p>`,
    code: `function f(a, b = a + 1, ...rest) { return [a, b, rest]; }
f(1);                // [1, 2, []]
f(1, undefined, 9);  // [1, 2, [9]] — undefined триггерит дефолт
f(1, null);          // [1, null, []] — null не триггерит
f.length;            // 1 — считает только до первого дефолта

function g(x = 1) { var x = 2; return x; }   // отдельные скоупы
// function h(a = 1) { 'use strict'; }       // SyntaxError

const required = (name) => { throw new Error('missing ' + name); };
function createUser(name = required('name')) { return { name }; }

const cached = (fn) => fn.length === 0 ? memoZero(fn) : memoArgs(fn);`,
    tip: 'Отдельный скоуп для списка параметров — редкая деталь; хорошая иллюстрация того, что вы понимаете, почему в такой функции нельзя писать use strict и почему arguments становится unmapped.' },

  { id: 'jsx58',
    q: 'Какие структуры данных ты выбираешь под какие задачи в JS и почему?',
    a: `<h4>Коротко</h4>
    <p>Массив — по умолчанию; <code>Map</code> — когда ключи не строки или их много и они меняются; <code>Set</code> — для уникальности и членства; <code>WeakMap</code>/<code>WeakSet</code> — для метаданных на чужих объектах; <code>TypedArray</code> — для бинарных данных. Кучи, деревьев и LRU в стандарте нет, их пишут руками.</p>

    <h4>Как это работает</h4>
    <p><strong>Массив.</strong> Непрерывная память в <code>PACKED</code>-представлении, отличная локальность кеша, <code>push</code>/<code>pop</code> амортизированно O(1). Но <code>shift</code>, <code>unshift</code> и <code>splice</code> из начала — O(n), поэтому очередь на массиве через <code>shift</code> деградирует до O(n²) на большом объёме. Правильная очередь — кольцевой буфер, два стека или указатель головы без физического удаления.</p>
    <p><strong>Map.</strong> Ключом может быть что угодно, сравнение по SameValueZero, порядок вставки гарантирован, есть <code>size</code>. В отличие от объекта, у неё нет коллизий с <code>__proto__</code> и прототипными методами — критично, когда ключи приходят от пользователя. И она оптимизирована под частые добавления и удаления, тогда как объект в такой роли уходит в dictionary mode.</p>
    <p><strong>Set.</strong> Уникальность и проверка членства за O(1); с ES2025 — операции над множествами (<code>union</code>, <code>intersection</code>, <code>difference</code>) без ручных циклов.</p>
    <p><strong>WeakMap/WeakSet/WeakRef.</strong> Не удерживают ключи от сборки мусора — правильный инструмент для кеша, привязанного к времени жизни объекта, и для приватного состояния. Их нельзя перебрать: итерация раскрыла бы момент сборки мусора и сделала бы поведение недетерминированным.</p>
    <p><strong>TypedArray и ArrayBuffer.</strong> Фиксированный тип, отсутствие боксинга, предсказуемый размер, transferable в воркеры. Основа для WASM, графики, аудио и бинарных протоколов.</p>
    <p><strong>Чего нет.</strong> Приоритетная очередь (binary heap), сбалансированное дерево, LRU, deque. Типовая ошибка — эмулировать heap сортировкой массива на каждой вставке: O(n log n) вместо O(log n).</p>

    <h4>Почему так</h4>
    <p>Стандарт добавляет структуры только тогда, когда они нужны почти всем и их нельзя эффективно построить в пользовательском коде. Heap и дерево строятся на массиве без потери производительности, поэтому их и нет. Слабые коллекции, наоборот, невозможно реализовать в JS — они требуют кооперации со сборщиком мусора, поэтому это встроенный тип.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Очередь через <code>arr.shift()</code> в цикле — самая частая скрытая O(n²) в коде обхода графов и BFS.</li>
      <li>Объект как словарь с пользовательскими ключами — риск prototype pollution и мегаморфный доступ.</li>
      <li><code>Map</code> с объектными ключами удерживает их в памяти: если это кеш по DOM-узлам, нужен <code>WeakMap</code>.</li>
      <li><code>Set</code> сравнивает по SameValueZero, поэтому два одинаковых по содержимому объекта — разные элементы; для дедупликации по значению нужен ключ.</li>
      <li><code>WeakRef</code> и <code>FinalizationRegistry</code> недетерминированы: строить на них логику приложения нельзя, только диагностику и кеши.</li>
      <li>Конвертация <code>Map</code> в объект и обратно на каждом рендере съедает весь выигрыш от выбора структуры.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как сделать LRU?»</strong> — на <code>Map</code>: порядок вставки плюс переустановка ключа при чтении, вытеснение через <code>map.keys().next().value</code>. <strong>«Map или объект по производительности?»</strong> — объект быстрее при фиксированном небольшом наборе известных ключей, <code>Map</code> — при динамических ключах и частых удалениях; но выбирать надо по семантике, а не по микробенчмарку.</p>`,
    code: `// LRU на Map: гарантированный порядок вставки
class LRU {
  constructor(limit) { this.limit = limit; this.map = new Map(); }
  get(k) {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k);
    this.map.delete(k); this.map.set(k, v);      // освежили
    return v;
  }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.limit) {
      this.map.delete(this.map.keys().next().value);
    }
  }
}

// очередь без O(n) на shift
class Queue {
  #items = []; #head = 0;
  push(v) { this.#items.push(v); }
  shift() { return this.#head < this.#items.length ? this.#items[this.#head++] : undefined; }
}`,
    tip: 'LRU на Map за счёт гарантированного порядка вставки — красивый ответ: он показывает, что вы знаете не просто API, а свойства структуры. Второй сильный пункт — скрытая O(n²) в очереди через shift.' },

  { id: 'jsx59',
    q: 'Что такое сигналы (signals) и почему TC39 обсуждает их стандартизацию? Чем они отличаются от Observable и от промисов?',
    a: `<h4>Коротко</h4>
    <p>Сигнал — реактивный контейнер значения с автоматическим отслеживанием зависимостей. Чтение сигнала внутри <code>computed</code> или эффекта автоматически создаёт подписку; изменение источника помечает зависимых грязными, а пересчёт происходит при следующем чтении. Это <strong>pull-based модель с push-инвалидацией</strong>.</p>

    <h4>Как это работает</h4>
    <p>Есть три примитива. <code>Signal.State</code> — изменяемая ячейка с <code>get()</code> и <code>set()</code>. <code>Signal.Computed</code> — производное значение, вычисляемое лениво и мемоизируемое. <code>Signal.subtle.Watcher</code> — низкоуровневый механизм уведомления, на котором фреймворк строит свои эффекты и планирование.</p>
    <p>Во время выполнения функции <code>computed</code> рантайм ведёт «текущий вычисляемый» и записывает каждое прочитанное значение в его список зависимостей. Поэтому граф строится автоматически и <strong>перестраивается на каждом пересчёте</strong>: если ветка <code>if</code> перестала читать сигнал, зависимость исчезает — это то, чего ручные списки зависимостей не умеют.</p>
    <p>При <code>set()</code> изменение не пересчитывает ничего сразу: оно проталкивает флаг «грязно» вниз по графу. Реальный пересчёт происходит при чтении, и перед ним проверяется, изменились ли входы <strong>фактически</strong>. Отсюда две ключевые выгоды: отсутствие <strong>glitch</strong> — промежуточных несогласованных состояний, когда узел пересчитался по половине обновлённых входов, — и отсутствие лишних вычислений: если результат никто не читает, он не считается.</p>
    <p>Отличия от соседей. <strong>Promise</strong> — одно значение, один раз, без обновлений. <strong>Observable</strong> — поток событий во времени, push-based, зависимости объявляются вручную операторами (<code>combineLatest</code>), и glitch там штатное явление. <strong>Signal</strong> — всегда актуальное значение с автоматическим графом.</p>
    <p>Proposal TC39 находится на Stage 1 и написан авторами Angular, Vue, Solid, Preact, Ember, MobX и Qwik. Цель — общее ядро, чтобы стейт-логику можно было писать один раз и рендерить чем угодно; API нарочно низкоуровневое, эффекты и планирование остаются за фреймворком.</p>

    <h4>Почему так</h4>
    <p>Каждый фреймворк построил свою реактивность, и они несовместимы: библиотека состояния для Vue не работает в Angular. Стандартное ядро решает это так же, как <code>Promise</code> когда-то унифицировал асинхронность после эпохи разных Deferred. Цена — низкоуровневость: сам по себе proposal не даёт ни эффектов, ни батчинга, и пользоваться им напрямую в приложении не предполагается.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Побочные эффекты внутри <code>computed</code> — источник трудноуловимых багов: пересчёт ленив и может не произойти вовсе.</li>
      <li>Чтение сигнала вне отслеживаемого контекста не создаёт подписку, и UI молча перестаёт обновляться.</li>
      <li>Асинхронность в <code>computed</code> не поддерживается: граф синхронный, а async-значения выражаются отдельным состоянием загрузки.</li>
      <li>Мутация объекта внутри сигнала не заметна: сигнал сравнивает по <code>Object.is</code>, если не задан свой <code>equals</code>.</li>
      <li>Циклы в графе (сигнал читает сам себя через computed) дают ошибку в рантайме, а не бесконечный цикл, но найти их непросто.</li>
      <li>Stage 1 означает, что API ещё изменится: закладываться на конкретные имена методов рано.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Что такое glitch?»</strong> — состояние, когда узел графа успел пересчитаться по части обновлённых входов и выдал значение, которого никогда не должно было существовать; pull-модель его исключает по построению. <strong>«Чем сигнал лучше useState?»</strong> — обновляется только то, что реально читает значение, без перерисовки поддерева; цена — отход от модели «рендер как функция состояния».</p>`,
    code: `const count = new Signal.State(0);
const double = new Signal.Computed(() => count.get() * 2);

const w = new Signal.subtle.Watcher(() => queueMicrotask(flush));
w.watch(double);

count.set(5);
double.get();   // 10 — пересчитано лениво, при чтении

// динамический граф: зависимость от b исчезает, когда flag = false
const flag = new Signal.State(true);
const a = new Signal.State(1), b = new Signal.State(2);
const sum = new Signal.Computed(() => flag.get() ? a.get() + b.get() : a.get());
flag.set(false);
b.set(100);     // sum не пересчитывается — b больше не зависимость`,
    tip: 'Слово glitch (несогласованное промежуточное состояние) и фраза «pull-based с push-инвалидацией» точно объясняют, зачем сигналы, а не просто «это как ref во Vue». Добавьте про динамическую перестройку графа.' },

  { id: 'jsx60',
    q: 'Что выведет код? Объясни, как это работает и можно ли сделать иначе.',
    snippet: `let i = 0;
const a = { [Symbol.toPrimitive]() { return ++i; } };

if (a == 1 && a == 2 && a == 3) {
  console.log('yes');
}`,
    a: `<h4>Коротко</h4>
    <p>Выведет <code>'yes'</code>. Условие выполнимо, потому что <code>==</code> с числом запускает <code>ToPrimitive</code> на объекте, а мы контролируем это приведение через <code>Symbol.toPrimitive</code> и возвращаем каждый раз новое значение. Три сравнения — три вызова, три разных числа.</p>

    <h4>Как это работает</h4>
    <p>Оператор <code>==</code> между объектом и числом идёт по алгоритму Abstract Equality: объект приводится к примитиву с hint <code>'default'</code>, затем сравнивается уже как примитив. <code>ToPrimitive</code> сначала ищет метод <code>Symbol.toPrimitive</code>, и если он есть, вызывает <strong>только его</strong>. Наш метод инкрементирует замыкание и возвращает 1, 2, 3 на последовательных вызовах.</p>
    <p>Оператор <code>&amp;&amp;</code> вычисляет операнды слева направо и с коротким замыканием, поэтому три сравнения происходят строго по порядку. Убери первое — и последовательность сдвинется.</p>
    <p>Тот же трюк работает без <code>Symbol.toPrimitive</code>: для hint <code>'default'</code> порядок фолбэка — <code>valueOf</code>, затем <code>toString</code>. Так что достаточно объекта с изменяющимся <code>valueOf</code>. Ещё вариант — массив с переопределённым <code>join</code> или объект, у которого <code>toString</code> берёт значения из очереди.</p>
    <p>Со <strong>строгим равенством</strong> объект не поможет — <code>===</code> не вызывает приведение. Но можно сделать переменную геттером: <code>Object.defineProperty(globalThis, 'b', { get: () =&gt; ++j })</code>. Тогда каждое <strong>чтение переменной</strong> вызывает функцию и возвращает разные числа, и <code>b === 1 &amp;&amp; b === 2 &amp;&amp; b === 3</code> тоже истинно. В модуле то же самое делается через <code>with</code>-подобный прокси или через геттер на объекте, к которому идёт обращение.</p>

    <h4>Почему так</h4>
    <p>Задача проверяет не знание трюка, а понимание того, что <code>==</code> вызывает <strong>пользовательский код</strong>. Именно поэтому нестрогое равенство с объектами непредсказуемо: значение выражения зависит от чужой реализации <code>valueOf</code>, которая может иметь побочные эффекты, ходить в счётчик или даже бросать. В проде из-за этого используют <code>===</code>, а приведение делают явно.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Побочный эффект в <code>valueOf</code> означает, что число вызовов приведения — часть контракта; движок вправе вызвать его один раз, а вы предполагали два.</li>
      <li><code>Symbol.toPrimitive</code> обязан вернуть примитив: возврат объекта — сразу <code>TypeError</code>, без фолбэка на <code>valueOf</code>.</li>
      <li>Логирование объекта в консоли тоже вызывает приведение — счётчик «съезжает» во время отладки.</li>
      <li>Тот же приём делает объект непригодным для использования в качестве ключа: каждое обращение даст новый ключ.</li>
      <li>Геттер на <code>globalThis</code> в строгом модуле не поможет: локальные переменные модуля не проходят через объект.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«А с <code>===</code> можно?»</strong> — да, через геттер на глобальном объекте: строгое равенство не приводит типы, но чтение переменной всё равно может быть вызовом функции. <strong>«Какой hint здесь используется?»</strong> — <code>'default'</code>, потому что это <code>==</code>; для всех встроенных типов, кроме <code>Date</code>, он ведёт себя как <code>'number'</code>. <strong>«Сколько раз вызовется <code>valueOf</code>?»</strong> — ровно по одному разу на каждое сравнение, и полагаться на это число опасно: любое логирование или отладчик добавят лишние вызовы и собьют счётчик.</p>`,
    code: `// вариант без Symbol.toPrimitive: фолбэк на valueOf
let k = 0;
const c = { valueOf() { return ++k; } };
c == 1 && c == 2 && c == 3;        // true

// вариант со строгим равенством: геттер на globalThis
let j = 0;
Object.defineProperty(globalThis, 'b', { get: () => ++j });
if (b === 1 && b === 2 && b === 3) console.log('yes strict');

// почему == опасен: приведение вызывает чужой код
const evil = { valueOf() { sendAnalytics(); return 1; } };
evil == 1;                          // побочный эффект внутри сравнения`,
    tip: 'Дайте оба решения — через toPrimitive и через геттер на globalThis; второе отвечает на закономерное «а с === можно?». И закончите выводом: == вызывает пользовательский код, поэтому в проде только ===.' },

  { id: 'jsx61',
    q: 'Что выведет код и в каком порядке? Объясни каждый шаг.',
    snippet: `console.log('script start');

setTimeout(() => console.log('timeout'), 0);
requestAnimationFrame(() => console.log('raf'));

Promise.resolve().then(() => {
  console.log('micro 1');
  queueMicrotask(() => console.log('micro 2'));
});

console.log('script end');`,
    a: `<h4>Коротко</h4>
    <p>Порядок: <code>script start</code>, <code>script end</code>, <code>micro 1</code>, <code>micro 2</code>, затем <code>raf</code>, затем <code>timeout</code> — при условии, что кадр отрисовки наступает раньше срабатывания таймера, что типично для активной вкладки. Последние два в общем случае <strong>не гарантированы</strong>.</p>

    <h4>Как это работает</h4>
    <p>Шаг 1: синхронный код выполняется целиком — это тело текущей макрозадачи. Печатаются <code>script start</code> и <code>script end</code>; <code>setTimeout</code>, <code>requestAnimationFrame</code> и <code>then</code> только <strong>регистрируют</strong> колбэки и возвращаются мгновенно.</p>
    <p>Шаг 2: по завершении макрозадачи выполняется microtask checkpoint. Из очереди берётся <code>micro 1</code>; внутри него планируется <code>micro 2</code>, и он <strong>тоже выполняется в этом же дренаже</strong>, потому что очередь опустошается до конца, а не по одному элементу. Выхода к рендеру между ними нет.</p>
    <p>Шаг 3: браузер решает, нужен ли кадр. Если да, начинается «update the rendering», и внутри неё вызываются rAF-колбэки — до style, layout и paint. Печатается <code>raf</code>.</p>
    <p>Шаг 4: <code>setTimeout(fn, 0)</code> не означает «немедленно»: минимальная задержка обычно около 1 мс, а при вложенности глубже пяти уровней срабатывает клампинг до 4 мс. Его задача берётся уже на следующем обороте цикла, поэтому <code>timeout</code> оказывается последним.</p>
    <p><strong>Оговорка, которая и есть правильный финал ответа.</strong> Порядок <code>raf</code> и <code>timeout</code> зависит от того, запланирован ли кадр. На скрытой вкладке rAF не вызовется вовсе (а <code>setTimeout</code> будет троттлиться до одного раза в секунду), и <code>timeout</code> выйдет первым. На «холодном» тике, когда кадр не нужен, таймер тоже может опередить.</p>

    <h4>Почему так</h4>
    <p>Разделение очередей отражает разные контракты. Микрозадачи должны завершить начатую логическую операцию до того, как кто-то увидит промежуточное состояние, поэтому они дренируются целиком. Рендер привязан к частоте дисплея, поэтому rAF — не очередь задач, а фаза кадра. Таймеры живут в общей очереди макрозадач и конкурируют с событиями ввода и сетью.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Уверенное «rAF всегда раньше timeout» — ошибка: это верно только для активной вкладки с запланированным кадром.</li>
      <li>Рекурсивный <code>queueMicrotask</code> вместо одного вызова заморозил бы страницу: до <code>raf</code> и <code>timeout</code> дело не дошло бы никогда.</li>
      <li><code>setTimeout(fn, 0)</code> в цикле не даёт «мгновенных» итераций: после пятой вложенности каждая стоит минимум 4 мс.</li>
      <li>Если в код добавить <code>await</code>, продолжение станет ещё одной микрозадачей и встанет в этот же дренаж, а не после кадра.</li>
      <li>В Node вывод будет другим: там нет rAF, а <code>setTimeout</code> и <code>setImmediate</code> живут в разных фазах.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Что изменится, если обернуть всё в обработчик клика?»</strong> — обработчик сам является макрозадачей, порядок внутри тот же, но кадр после него почти наверняка будет запланирован, поэтому <code>raf</code> надёжнее опередит <code>timeout</code>. <strong>«Как гарантированно выполнить код после paint?»</strong> — <code>requestAnimationFrame(() =&gt; setTimeout(fn, 0))</code>: rAF попадает в кадр, а таймер — уже за ним.</p>`,
    code: `// как дождаться реального paint (частый рабочий приём)
function afterPaint(fn) {
  requestAnimationFrame(() => setTimeout(fn, 0));
}

setPending(true);        // синхронно обновили UI
afterPaint(heavyWork);   // тяжёлая работа уже после отрисовки

// микрозадача внутри микрозадачи — тот же дренаж
Promise.resolve().then(() => {
  console.log('a');
  Promise.resolve().then(() => console.log('b'));
});
Promise.resolve().then(() => console.log('c'));
// a, c, b — b встал в конец очереди, но до выхода к рендеру`,
    tip: 'Обязательно скажите, что порядок raf/timeout зависит от того, планируется ли кадр — уверенное «всегда raf раньше» это ошибка, а оговорка про скрытую вкладку сразу выделяет ответ.' },

  { id: 'jsx62',
    q: 'Что выведет код? Почему поле в подклассе ведёт себя не так, как ожидается?',
    snippet: `class Base {
  constructor() { this.render(); }
  render() { console.log('Base render'); }
}

class Child extends Base {
  size = 10;
  render() { console.log('size:', this.size); }
}

const c = new Child();
c.render();`,
    a: `<h4>Коротко</h4>
    <p>Выведет <code>'size: undefined'</code>, затем <code>'size: 10'</code>. Причина — порядок инициализации: <code>super()</code> выполняет конструктор базового класса целиком, включая <code>this.render()</code>, а поля производного класса создаются только <strong>после</strong> возврата из <code>super()</code>.</p>

    <h4>Как это работает</h4>
    <p>При <code>new Child()</code> вызывается неявный конструктор <code>Child</code>, который делает <code>super()</code>. Внутри <code>super()</code> создаётся объект с прототипом <code>Child.prototype</code>, инициализируются поля <code>Base</code> (их нет) и выполняется тело конструктора <code>Base</code> — там и происходит <code>this.render()</code>.</p>
    <p>Метод уже переопределён: методы живут на <strong>прототипе</strong> и существуют с момента вычисления класса, то есть задолго до создания объекта. Поэтому вызывается <code>Child.prototype.render</code>, а не <code>Base.prototype.render</code>. Но поле <code>size</code> ещё не создано — инициализаторы полей производного класса выполняются сразу после возврата из <code>super()</code>. Обращение к несуществующему свойству даёт <code>undefined</code>, а не ошибку.</p>
    <p>Второй вызов, <code>c.render()</code>, происходит после полного конструирования, поэтому поле уже на месте и печатается 10.</p>
    <p>Здесь же прячется вторая классическая ловушка того же механизма: если бы в <code>Child</code> было объявлено <strong>поле</strong> с именем <code>render</code>, оно бы <strong>перетёрло</strong> прототипный метод на инстансе. Поле создаётся через <code>[[DefineOwnProperty]]</code> на объекте, а собственное свойство всегда затеняет прототипное. Ровно так же поле производного класса перетирает одноимённый геттер базового.</p>

    <h4>Почему так</h4>
    <p>Порядок «сначала база, потом производный» — единственный корректный: производный класс может опираться на состояние базового, обратное неверно. Та же проблема есть в C++ и Java, где вызов виртуального метода из конструктора считается антипаттерном и ловится статическим анализом. В JS предупреждений нет, поэтому ответственность целиком на разработчике.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Баг проявляется только при наследовании: одиночный класс работает, и проблема всплывает при добавлении подкласса через месяцы.</li>
      <li><code>undefined</code> вместо ошибки означает, что вместо падения вы получаете <code>NaN</code> в расчётах или пустую строку в разметке.</li>
      <li>Поле-стрелка вместо метода не спасает: оно инициализируется ещё позже и в момент <code>super()</code> его вообще нет — будет <code>TypeError: this.render is not a function</code>.</li>
      <li>Обращение к <code>this</code> до <code>super()</code> — <code>ReferenceError</code>, а не <code>undefined</code>: <code>this</code> в TDZ.</li>
      <li>Транспиляция в ES5 может изменить порядок инициализации полей и «починить» баг локально, оставив его в проде.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как это правильно спроектировать?»</strong> — не вызывать перегружаемые методы из конструктора: вынести в явный <code>init()</code>, который зовёт статическая фабрика после создания объекта, либо передавать значения через аргументы <code>super()</code>. <strong>«Что если поле нужно базовому классу?»</strong> — принимать его параметром конструктора и присваивать в <code>Base</code>, тогда оно будет доступно к моменту <code>this.render()</code>. <strong>«А если <code>render</code> объявить полем-стрелкой?»</strong> — станет хуже: поля инициализируются после <code>super()</code>, поэтому в конструкторе базового класса метода ещё нет и будет <code>TypeError: this.render is not a function</code>.</p>`,
    code: `// фикс 1: значение приходит через super()
class Base {
  constructor(size) { this.size = size; this.render(); }
  render() { console.log('size:', this.size); }
}
class Child extends Base {
  constructor() { super(10); }
  render() { console.log('size:', this.size); }
}
new Child();      // 'size: 10'

// фикс 2: явная фаза инициализации
class Widget {
  static create(...args) { const w = new Widget(...args); w.init(); return w; }
  constructor(size) { this.size = size; }
  init() { this.render(); }
  render() { console.log('size:', this.size); }
}`,
    tip: 'Сформулируйте правило одной фразой: «поля производного класса создаются после super(), поэтому конструктор базового видит их undefined». Добавьте, что поле-стрелка здесь даст не undefined, а TypeError.' },

  { id: 'jsx63',
    q: 'Что выведет код? Разбери поведение методов на разреженном массиве.',
    snippet: `const arr = [1, , 3];

console.log(arr.length);
console.log(arr.map(x => x * 2));
console.log(arr.join('-'));
console.log([...arr]);
console.log(arr.filter(Boolean).length);
console.log(arr.indexOf(undefined));
console.log(arr.includes(undefined));`,
    a: `<h4>Коротко</h4>
    <p>Вывод: <code>3</code>, затем <code>[2, empty, 6]</code>, затем <code>'1--3'</code>, затем <code>[1, undefined, 3]</code>, затем <code>2</code>, затем <code>-1</code> и <code>true</code>. Все семь строк объясняются одним вопросом: знает конкретный метод про дырки или считает их за <code>undefined</code>.</p>

    <h4>Как это работает</h4>
    <p><code>length</code> равен 3, потому что длина определяется максимальным индексом плюс один, а не количеством реально существующих свойств. Индекс 1 у массива отсутствует: <code>1 in arr</code> даёт <code>false</code>.</p>
    <p><code>map</code> <strong>пропускает</strong> дырку — колбэк для неё не вызывается — но <strong>сохраняет</strong> её в результате. Это самая неинтуитивная часть: результат тоже разреженный, и на нём повторится то же поведение.</p>
    <p><code>join</code> трактует дырку как пустую строку (как и <code>null</code> с <code>undefined</code>), поэтому между 1 и 3 оказывается двойной дефис.</p>
    <p>Spread и <code>for...of</code> идут через <strong>итератор массива</strong>, который честно читает <code>arr[i]</code> для каждого <code>i</code> от 0 до <code>length</code>. Отсутствующее свойство читается как <code>undefined</code>, поэтому дырка материализуется в настоящее значение и массив становится плотным.</p>
    <p><code>filter</code> дырку пропускает, а 1 и 3 истинны, поэтому длина результата 2 — и результат при этом плотный, в отличие от <code>map</code>.</p>
    <p>И финальный контраст: <code>indexOf</code> использует <code>===</code> и пропускает дырки, поэтому <code>undefined</code> не находится — <code>-1</code>. <code>includes</code> использует SameValueZero и <strong>не</strong> пропускает дырки — читает их как <code>undefined</code> и возвращает <code>true</code>. Это самая ёмкая иллюстрация деления методов на две группы.</p>

    <h4>Почему так</h4>
    <p>Методы из ES5 проектировались, когда разреженный массив считался легитимной моделью «данных с пропусками», и пропуск дырок был осознанным решением. Итератор и <code>includes</code> появились в ES6 уже с другой философией: массив длины <code>n</code> — это <code>n</code> значений, часть из которых может быть <code>undefined</code>. Новые методы ES2023 продолжили эту линию. В языке сосуществуют две модели, и это цена совместимости.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>После <code>map</code> результат остаётся разреженным, и следующий <code>reduce</code> тоже пропустит позицию — ошибка накапливается по цепочке.</li>
      <li><code>arr.length</code> как «количество элементов» неверно для разреженного массива; честный счёт даёт <code>Object.keys(arr).length</code>.</li>
      <li><code>JSON.stringify([1,,3])</code> даёт <code>'[1,null,3]'</code>: после round-trip дырка превращается в <code>null</code>.</li>
      <li>В DevTools дырка печатается как <code>empty item</code>, а <code>undefined</code> — как <code>undefined</code>; в текстовом логе разница исчезает.</li>
      <li>Дырка переводит массив в <code>HOLEY</code>-представление V8 необратимо, и это влияет на скорость всех последующих операций.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как получить плотный массив?»</strong> — <code>Array.from(arr)</code>, <code>[...arr]</code> или <code>arr.flat(0)</code>: все они идут через чтение по индексам. <strong>«Откуда дырки берутся в реальном коде?»</strong> — <code>new Array(n)</code> для «пустого массива нужной длины», <code>delete arr[i]</code> и присваивание по индексу за пределами длины. <strong>«Почему <code>map</code> сохраняет дырку, а <code>filter</code> нет?»</strong> — <code>map</code> обязан сохранить длину и позиции, поэтому пропущенный индекс остаётся пропущенным; <code>filter</code> строит новый массив последовательным добавлением и потому всегда плотный.</p>`,
    code: `// плотная альтернатива каждому шагу
const dense = Array.from({ length: 3 }, (_, i) => i);   // [0,1,2]

const sparse = [1, , 3];
Object.keys(sparse).length;   // 2 — реальное число элементов
sparse.length;                // 3

Array.from(sparse);           // [1, undefined, 3] — материализовали
sparse.flat(0);               // [1, undefined, 3] — то же без копии итератором

// удаление без создания дырки
const items = [1, 2, 3];
items.splice(1, 1);           // [1, 3] — плотный
// delete items[1];           // [1, empty, 3] — так не надо`,
    tip: 'Контраст indexOf против includes на дырке — самая ёмкая иллюстрация того, что методы массива делятся на «знающие про дырки» и «не знающие»; и что map — единственный, кто дырку сохраняет в результате.' },

  { id: 'jsx64',
    q: 'Что вернут эти async-функции и почему? Разбери взаимодействие try/catch/finally и await.',
    snippet: `const fail = () => Promise.reject(new Error('boom'));

async function f1() {
  try { return 'try'; }
  finally { return 'finally'; }
}

async function f2() {
  try { return fail(); }
  catch { return 'caught'; }
}

async function f3() {
  try { return await fail(); }
  catch { return 'caught'; }
}`,
    a: `<h4>Коротко</h4>
    <p><code>f1()</code> резолвится значением <code>'finally'</code>. <code>f2()</code> <strong>отклоняется</strong> с <code>Error: boom</code>, а не возвращает <code>'caught'</code>. <code>f3()</code> резолвится значением <code>'caught'</code>. Разница между f2 и f3 — одно слово <code>await</code>.</p>

    <h4>Как это работает</h4>
    <p><strong>f1.</strong> Блок <code>try</code> формирует completion record типа «return» со значением <code>'try'</code>. Затем выполняется <code>finally</code>, и его собственный <code>return</code> порождает новую completion, которая <strong>вытесняет</strong> предыдущую. Более того, если бы <code>try</code> бросил исключение, <code>return</code> в <code>finally</code> проглотил бы и его — ошибка исчезла бы бесследно. Именно поэтому линтеры запрещают такой код правилом <code>no-unsafe-finally</code>.</p>
    <p><strong>f2.</strong> <code>return fail()</code> возвращает промис <strong>из</strong> функции. Точка возврата лексически внутри <code>try</code>, но <strong>отклонение</strong> происходит позже — уже после того, как управление покинуло блок. Async-функция резолвится этим промисом, и его отклонение становится отклонением самой <code>f2()</code>. <code>catch</code> его не видит, потому что в блоке не было точки приостановки. Это классический источник unhandled rejection.</p>
    <p><strong>f3.</strong> <code>return await fail()</code> создаёт точку приостановки <strong>внутри</strong> <code>try</code>. Когда промис отклоняется, движок возобновляет функцию через <code>throw</code> ровно в этой точке — то есть внутри блока, и <code>catch</code> срабатывает штатно.</p>
    <p>Отсюда правило: внутри <code>try</code> всегда пишите <code>return await</code>. Вне <code>try</code> разница только в двух лишних тиках микрозадач, и там <code>await</code> можно опустить. Старое правило линтера <code>no-return-await</code>, требовавшее убирать <code>await</code> везде, сегодня считается вредным именно из-за f2.</p>

    <h4>Почему так</h4>
    <p><code>try/catch</code> в async-функции работает не с промисами, а с точками приостановки конечного автомата: <code>await</code> — единственное место, где отклонение превращается в исключение. Это следствие того, что async/await — сахар над генераторами, а не отдельный механизм. Плата — визуальная ловушка: код <strong>выглядит</strong> так, будто ошибка возникает внутри блока.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>TypeScript не подсвечивает f2: типы совпадают, ошибка чисто рантаймовая; ловит только <code>no-floating-promises</code> и внимательное ревью.</li>
      <li><code>return</code> в <code>finally</code> проглатывает исключения молча — ни стека, ни причины в мониторинге.</li>
      <li>Ошибка в самом <code>finally</code> перекрывает исходную: диагностика показывает проблему очистки вместо причины падения.</li>
      <li><code>await</code> в <code>finally</code> задерживает завершение функции и может незаметно удлинить критический путь.</li>
      <li>То же поведение у промиса, созданного в <code>try</code> без <code>return</code>: <code>const p = fail()</code> отклонится вне блока.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как поймать ошибку от нескольких параллельных промисов?»</strong> — <code>await Promise.all([...])</code> внутри <code>try</code>: точка приостановки одна, а ошибка придёт первая; чтобы не терять остальные, нужен <code>allSettled</code> и <code>AggregateError</code>. <strong>«Что вернёт функция, если <code>finally</code> бросит?»</strong> — отклонится причиной из <code>finally</code>, исходная будет потеряна, если не передать её через <code>cause</code>. <strong>«Зачем тогда вообще <code>finally</code> в async?»</strong> — это единственное место, где освобождение ресурса гарантировано при любом исходе; главное не возвращать и не бросать оттуда, а ошибки очистки логировать отдельно.</p>`,
    code: `// исправленные версии
async function f1fixed() {
  try { return 'try'; }
  finally { cleanup(); }        // никакого return
}

async function f2fixed() {
  try { return await fail(); }  // await обязателен внутри try
  catch { return 'caught'; }
}

// не терять исходную ошибку при падении очистки
async function f4() {
  try { return await work(); }
  finally {
    try { await release(); }
    catch (e) { reportError(new Error('cleanup failed', { cause: e })); }
  }
}`,
    tip: 'Именно из-за f2 правило «return await внутри try» попало в typescript-eslint, а старое no-return-await признали вредным; назовите это — видно, что вы следите за практикой, а не только за спекой.' },

  { id: 'jsx65',
    q: 'Что выведет этот цикл валидации и в чём баг?',
    snippet: `const HAS_DIGIT = /\\d+/g;

for (const s of ['a1', 'b2', 'c3', 'd4']) {
  console.log(HAS_DIGIT.test(s));
}`,
    a: `<h4>Коротко</h4>
    <p>Выведет <code>true</code>, <code>false</code>, <code>true</code>, <code>false</code> — валидные строки считаются невалидными через одну. Баг в том, что регулярка объявлена с флагом <code>g</code> и вынесена в константу, а значит имеет <strong>изменяемое состояние</strong> <code>lastIndex</code>.</p>

    <h4>Как это работает</h4>
    <p>У регулярки с флагом <code>g</code> или <code>y</code> метод <code>test</code> начинает поиск не с начала строки, а с текущего <code>lastIndex</code>. Разберём по шагам. Первая строка <code>'a1'</code>: поиск с позиции 0, совпадение найдено на позиции 1, <code>lastIndex</code> выставляется в 2 — печатается <code>true</code>. Вторая строка <code>'b2'</code>: поиск начинается с позиции 2, а строка длиной 2 — совпадения нет, печатается <code>false</code>, и при неудаче <code>lastIndex</code> <strong>сбрасывается в 0</strong>. Третья строка снова начинает с нуля и совпадает. Отсюда идеальное чередование.</p>
    <p>Три способа починить. <strong>Убрать <code>g</code></strong> — правильный фикс: для проверки факта совпадения глобальный флаг не нужен вообще, и без него <code>lastIndex</code> не используется. <strong>Сбрасывать вручную</strong> <code>HAS_DIGIT.lastIndex = 0</code> перед каждым вызовом — работает, но легко забыть и невозможно проконтролировать в чужом коде. <strong>Использовать неомутирующие методы</strong>: <code>String.prototype.match</code>, <code>search</code> или <code>matchAll</code> — последняя специально работает с внутренним клоном регулярки, чтобы не трогать исходную.</p>
    <p>Тот же баг возникает с <code>exec</code> в цикле по разным строкам, с регуляркой, экспортируемой из общего модуля, и с константой в React-компоненте, которую переиспользуют несколько инстансов.</p>

    <h4>Почему так</h4>
    <p><code>lastIndex</code> появился в ES3 как единственный способ итерировать по всем совпадениям — итераторов тогда не было, и состояние приходилось держать на объекте регулярки. Убрать его нельзя из-за совместимости. Ирония в том, что баг провоцирует <strong>хороший</strong> совет «не создавай объект в цикле»: вынесенная в константу регулярка с <code>g</code> становится общим изменяемым состоянием.</p>

    <h4>Подводные камни</h4>
    <ul>
      <li>Юнит-тест на одной строке баг не ловит: он проявляется только при повторных вызовах, и обычно на проде.</li>
      <li><code>filter(s =&gt; RE.test(s))</code> отбрасывает половину валидных элементов и выглядит как ошибка данных, а не кода.</li>
      <li>Регулярка, экспортируемая из модуля, разделяется между всеми потребителями — состояние утекает через границы модулей.</li>
      <li>Пустое совпадение в <code>exec</code>-цикле не двигает <code>lastIndex</code> — получается бесконечный цикл.</li>
      <li><code>replaceAll</code> требует флаг <code>g</code> и бросает <code>TypeError</code> без него — то есть «просто убрать g» подходит не везде.</li>
      <li>Одна и та же регулярка, используемая и для <code>test</code>, и для <code>matchAll</code>, ведёт себя по-разному: вторая клонирует, первая мутирует.</li>
    </ul>

    <h4>Что спросят следом</h4>
    <p><strong>«Как поймать это на ревью?»</strong> — правило <code>eslint-plugin-regexp</code> о глобальных регулярках с <code>test</code>, плюс соглашение: константы только без <code>g</code>, а с <code>g</code> — создавать на месте использования. <strong>«Что делать, если нужен и <code>g</code>, и повторные проверки?»</strong> — держать две константы или использовать <code>matchAll</code>, которая не трогает исходный <code>lastIndex</code>.</p>`,
    code: `// фикс 1: без g — правильный вариант для проверки факта
const HAS_DIGIT = /\\d+/;
for (const s of ['a1', 'b2', 'c3', 'd4']) console.log(HAS_DIGIT.test(s));
// true, true, true, true

// фикс 2: явный сброс, если g действительно нужен
const RE = /\\d+/g;
for (const s of list) { RE.lastIndex = 0; check(RE.test(s)); }

// фикс 3: метод, не мутирующий состояние
for (const s of list) console.log([...s.matchAll(/\\d+/g)].length > 0);`,
    tip: 'Скажите, что баг не ловится юнит-тестом на одной строке — это добавляет ответу вес человека, который чинил такое в проде. И назовите правильный фикс первым: для test глобальный флаг просто не нужен.' },

];
