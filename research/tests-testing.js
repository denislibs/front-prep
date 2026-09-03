/**
 * Автотесты секции «Тестирование» (задачи tst-t1–tst-t10 из research/tasks-testing.js).
 *
 * Задачи здесь перевёрнутые: пользователь пишет не решение, а тест —
 * функцию-проверяльщик вида checkFormatPrice(impl), которая бросает исключение,
 * если переданная реализация нарушает спецификацию.
 *
 * Поэтому и набор устроен наоборот:
 *  - первый кейс передаёт проверяльщику ПРАВИЛЬНУЮ реализацию; слишком строгий
 *    тест здесь падает;
 *  - остальные кейсы передают мутацию — реализацию, сломанную ровно в одном
 *    месте, — и требуют, чтобы проверяльщик на ней бросил исключение.
 *
 * Реализации объявляются прямо в теле кейса и пользователю не показываются.
 * Все наборы исполняются в воркере: предметы проверки синхронные и чистые,
 * поэтому мутационная проверка получается честной.
 */

const TESTS_TESTING = {

  /* ─────────────────── Форматирование и валидация ─────────────────── */

  'tst-t1': {
    env: 'worker',
    entry: 'checkFormatPrice',
    starter: `function checkFormatPrice(formatPrice) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(cents, currency) {
  var conf = currency === 'RUB' ? { dec: ',', grp: ' ' } : currency === 'USD' ? { dec: '.', grp: ',' } : null;
  if (!conf) throw new Error('неизвестная валюта: ' + currency);
  var sign = cents < 0 ? '-' : '';
  var abs = Math.abs(cents);
  var whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, conf.grp);
  var frac = String(abs % 100).length === 1 ? '0' + (abs % 100) : String(abs % 100);
  return currency === 'RUB' ? sign + whole + conf.dec + frac + ' ₽' : sign + '$' + whole + conf.dec + frac;
}

checkFormatPrice(impl);` },

      { name: 'ловит реализацию без разделителя разрядов',
        body: `function impl(cents, currency) {
  var conf = currency === 'RUB' ? { dec: ',', grp: ' ' } : currency === 'USD' ? { dec: '.', grp: ',' } : null;
  if (!conf) throw new Error('неизвестная валюта');
  var sign = cents < 0 ? '-' : '';
  var abs = Math.abs(cents);
  var whole = String(Math.floor(abs / 100));
  var frac = String(abs % 100).length === 1 ? '0' + (abs % 100) : String(abs % 100);
  return currency === 'RUB' ? sign + whole + conf.dec + frac + ' ₽' : sign + '$' + whole + conf.dec + frac;
}

assert.throws(function () { checkFormatPrice(impl); }, 'тест не заметил, что тысячи слиплись в 1234,56');` },

      { name: 'ловит реализацию, которая не дополняет копейки до двух цифр',
        body: `function impl(cents, currency) {
  var conf = currency === 'RUB' ? { dec: ',', grp: ' ' } : currency === 'USD' ? { dec: '.', grp: ',' } : null;
  if (!conf) throw new Error('неизвестная валюта');
  var sign = cents < 0 ? '-' : '';
  var abs = Math.abs(cents);
  var whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, conf.grp);
  var frac = String(abs % 100);
  return currency === 'RUB' ? sign + whole + conf.dec + frac + ' ₽' : sign + '$' + whole + conf.dec + frac;
}

assert.throws(function () { checkFormatPrice(impl); }, 'тест не заметил, что пять копеек превратились в 0,5');` },

      { name: 'ловит реализацию, у которой десятичный разделитель не зависит от валюты',
        body: `function impl(cents, currency) {
  var grp = currency === 'RUB' ? ' ' : currency === 'USD' ? ',' : null;
  if (!grp) throw new Error('неизвестная валюта');
  var sign = cents < 0 ? '-' : '';
  var abs = Math.abs(cents);
  var whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, grp);
  var frac = String(abs % 100).length === 1 ? '0' + (abs % 100) : String(abs % 100);
  return currency === 'RUB' ? sign + whole + '.' + frac + ' ₽' : sign + '$' + whole + '.' + frac;
}

assert.throws(function () { checkFormatPrice(impl); }, 'тест не заметил точку там, где в рублях нужна запятая');` },

      { name: 'ловит реализацию, которая теряет минус у отрицательной суммы',
        body: `function impl(cents, currency) {
  var conf = currency === 'RUB' ? { dec: ',', grp: ' ' } : currency === 'USD' ? { dec: '.', grp: ',' } : null;
  if (!conf) throw new Error('неизвестная валюта');
  var abs = Math.abs(cents);
  var whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, conf.grp);
  var frac = String(abs % 100).length === 1 ? '0' + (abs % 100) : String(abs % 100);
  return currency === 'RUB' ? whole + conf.dec + frac + ' ₽' : '$' + whole + conf.dec + frac;
}

assert.throws(function () { checkFormatPrice(impl); }, 'тест не заметил, что возврат средств показан как приход');` },

      { name: 'ловит реализацию, которая ставит минус после знака доллара',
        body: `function impl(cents, currency) {
  var conf = currency === 'RUB' ? { dec: ',', grp: ' ' } : currency === 'USD' ? { dec: '.', grp: ',' } : null;
  if (!conf) throw new Error('неизвестная валюта');
  var sign = cents < 0 ? '-' : '';
  var abs = Math.abs(cents);
  var whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, conf.grp);
  var frac = String(abs % 100).length === 1 ? '0' + (abs % 100) : String(abs % 100);
  return currency === 'RUB' ? sign + whole + conf.dec + frac + ' ₽' : '$' + sign + whole + conf.dec + frac;
}

assert.throws(function () { checkFormatPrice(impl); }, 'тест не заметил $-1,234.56 вместо -$1,234.56');` },

      { name: 'ловит реализацию, которая теряет ведущий ноль у сумм меньше единицы валюты',
        body: `function impl(cents, currency) {
  var conf = currency === 'RUB' ? { dec: ',', grp: ' ' } : currency === 'USD' ? { dec: '.', grp: ',' } : null;
  if (!conf) throw new Error('неизвестная валюта');
  var sign = cents < 0 ? '-' : '';
  var abs = Math.abs(cents);
  var units = Math.floor(abs / 100);
  var whole = units ? String(units).replace(/\\B(?=(\\d{3})+(?!\\d))/g, conf.grp) : '';
  var frac = String(abs % 100).length === 1 ? '0' + (abs % 100) : String(abs % 100);
  return currency === 'RUB' ? sign + whole + conf.dec + frac + ' ₽' : sign + '$' + whole + conf.dec + frac;
}

assert.throws(function () { checkFormatPrice(impl); }, 'тест не заметил ,00 ₽ вместо 0,00 ₽');` },

      { name: 'ловит реализацию, которая молча принимает неизвестную валюту',
        body: `function impl(cents, currency) {
  var conf = currency === 'USD' ? { dec: '.', grp: ',' } : { dec: ',', grp: ' ' };
  var sign = cents < 0 ? '-' : '';
  var abs = Math.abs(cents);
  var whole = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, conf.grp);
  var frac = String(abs % 100).length === 1 ? '0' + (abs % 100) : String(abs % 100);
  return currency === 'USD' ? sign + '$' + whole + conf.dec + frac : sign + whole + conf.dec + frac + ' ₽';
}

assert.throws(function () { checkFormatPrice(impl); }, 'тест не потребовал исключения на валюте EUR');` },
    ],
  },

  'tst-t2': {
    env: 'worker',
    entry: 'checkValidateEmail',
    starter: `function checkValidateEmail(validateEmail) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(value) {
  if (typeof value !== 'string') return false;
  var parts = value.split('@');
  if (parts.length !== 2) return false;
  var local = parts[0];
  var domain = parts[1];
  if (!/^[A-Za-z0-9._+-]+$/.test(local)) return false;
  if (/^\\.|\\.$|\\.\\./.test(local)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  var labels = domain.split('.');
  if (labels.length < 2) return false;
  for (var i = 0; i < labels.length; i++) if (!labels[i]) return false;
  return labels[labels.length - 1].length >= 2;
}

checkValidateEmail(impl);` },

      { name: 'ловит слишком общую регулярку вида точка-собака-точка',
        body: `function impl(value) {
  return typeof value === 'string' && /^.+@.+$/.test(value);
}

assert.throws(function () { checkValidateEmail(impl); }, 'тест прошёл на реализации, которая требует только собаку');` },

      { name: 'ловит реализацию, которая падает на не-строковом значении',
        body: `function impl(value) {
  var parts = value.split('@');
  if (parts.length !== 2) return false;
  var local = parts[0];
  var domain = parts[1];
  if (!/^[A-Za-z0-9._+-]+$/.test(local)) return false;
  if (/^\\.|\\.$|\\.\\./.test(local)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  var labels = domain.split('.');
  if (labels.length < 2) return false;
  for (var i = 0; i < labels.length; i++) if (!labels[i]) return false;
  return labels[labels.length - 1].length >= 2;
}

assert.throws(function () { checkValidateEmail(impl); }, 'тест не проверил null и undefined, а на них реализация бросает TypeError');` },

      { name: 'ловит регистрозависимую реализацию',
        body: `function impl(value) {
  if (typeof value !== 'string') return false;
  var parts = value.split('@');
  if (parts.length !== 2) return false;
  var local = parts[0];
  var domain = parts[1];
  if (!/^[a-z0-9._+-]+$/.test(local)) return false;
  if (/^\\.|\\.$|\\.\\./.test(local)) return false;
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;
  var labels = domain.split('.');
  if (labels.length < 2) return false;
  for (var i = 0; i < labels.length; i++) if (!labels[i]) return false;
  return labels[labels.length - 1].length >= 2;
}

assert.throws(function () { checkValidateEmail(impl); }, 'тест не проверил адрес заглавными буквами');` },

      { name: 'ловит реализацию, которая сама обрезает пробелы по краям',
        body: `function impl(value) {
  if (typeof value !== 'string') return false;
  var parts = value.trim().split('@');
  if (parts.length !== 2) return false;
  var local = parts[0];
  var domain = parts[1];
  if (!/^[A-Za-z0-9._+-]+$/.test(local)) return false;
  if (/^\\.|\\.$|\\.\\./.test(local)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  var labels = domain.split('.');
  if (labels.length < 2) return false;
  for (var i = 0; i < labels.length; i++) if (!labels[i]) return false;
  return labels[labels.length - 1].length >= 2;
}

assert.throws(function () { checkValidateEmail(impl); }, 'тест не проверил адрес с пробелом в начале');` },

      { name: 'ловит реализацию, которая пропускает вторую собаку',
        body: `function impl(value) {
  if (typeof value !== 'string') return false;
  var at = value.lastIndexOf('@');
  if (at < 0) return false;
  var local = value.slice(0, at);
  var domain = value.slice(at + 1);
  if (!/^[A-Za-z0-9._+@-]+$/.test(local)) return false;
  if (/^\\.|\\.$|\\.\\./.test(local)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  var labels = domain.split('.');
  if (labels.length < 2) return false;
  for (var i = 0; i < labels.length; i++) if (!labels[i]) return false;
  return labels[labels.length - 1].length >= 2;
}

assert.throws(function () { checkValidateEmail(impl); }, 'тест не проверил адрес с двумя собаками');` },

      { name: 'ловит реализацию, которая принимает домен без точки',
        body: `function impl(value) {
  if (typeof value !== 'string') return false;
  var parts = value.split('@');
  if (parts.length !== 2) return false;
  var local = parts[0];
  var domain = parts[1];
  if (!/^[A-Za-z0-9._+-]+$/.test(local)) return false;
  if (/^\\.|\\.$|\\.\\./.test(local)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  var labels = domain.split('.');
  for (var i = 0; i < labels.length; i++) if (!labels[i]) return false;
  return labels[labels.length - 1].length >= 2;
}

assert.throws(function () { checkValidateEmail(impl); }, 'тест не проверил домен без точки — user@example');` },

      { name: 'ловит реализацию, которая принимает пустую локальную часть',
        body: `function impl(value) {
  if (typeof value !== 'string') return false;
  var parts = value.split('@');
  if (parts.length !== 2) return false;
  var local = parts[0];
  var domain = parts[1];
  if (!/^[A-Za-z0-9._+-]*$/.test(local)) return false;
  if (/^\\.|\\.$|\\.\\./.test(local)) return false;
  if (!/^[A-Za-z0-9.-]+$/.test(domain)) return false;
  var labels = domain.split('.');
  if (labels.length < 2) return false;
  for (var i = 0; i < labels.length; i++) if (!labels[i]) return false;
  return labels[labels.length - 1].length >= 2;
}

assert.throws(function () { checkValidateEmail(impl); }, 'тест не проверил адрес без имени — @example.com');` },
    ],
  },

  /* ─────────────────── Состояние и данные ─────────────────── */

  'tst-t3': {
    env: 'worker',
    entry: 'checkCartReducer',
    starter: `function checkCartReducer(cartReducer) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    var exists = state.items.some(function (i) { return i.id === action.item.id; });
    var items = exists
      ? state.items.map(function (i) { return i.id === action.item.id ? { id: i.id, price: i.price, qty: i.qty + 1 } : i; })
      : state.items.concat([{ id: action.item.id, price: action.item.price, qty: 1 }]);
    return Object.assign({}, state, { items: items });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    var next = action.qty <= 0
      ? state.items.filter(function (i) { return i.id !== action.id; })
      : state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; });
    return Object.assign({}, state, { items: next });
  }
  if (action.type === 'clear') return Object.assign({}, state, { items: [] });
  return state;
}

checkCartReducer(impl);` },

      { name: 'ловит реализацию, которая кладёт дубль вместо увеличения количества',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    return Object.assign({}, state, { items: state.items.concat([{ id: action.item.id, price: action.item.price, qty: 1 }]) });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    var next = action.qty <= 0
      ? state.items.filter(function (i) { return i.id !== action.id; })
      : state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; });
    return Object.assign({}, state, { items: next });
  }
  if (action.type === 'clear') return Object.assign({}, state, { items: [] });
  return state;
}

assert.throws(function () { checkCartReducer(impl); }, 'тест не добавил в корзину товар, который там уже лежит');` },

      { name: 'ловит реализацию, которая мутирует переданное состояние',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    var found = null;
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === action.item.id) found = state.items[i];
    if (found) found.qty = found.qty + 1;
    else state.items.push({ id: action.item.id, price: action.item.price, qty: 1 });
    return Object.assign({}, state, { items: state.items.slice() });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    var next = action.qty <= 0
      ? state.items.filter(function (i) { return i.id !== action.id; })
      : state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; });
    return Object.assign({}, state, { items: next });
  }
  if (action.type === 'clear') return Object.assign({}, state, { items: [] });
  return state;
}

assert.throws(function () { checkCartReducer(impl); }, 'тест смотрел только на результат и не сравнил исходное состояние с эталоном');` },

      { name: 'ловит реализацию, которая на нулевом количестве оставляет позицию',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    var exists = state.items.some(function (i) { return i.id === action.item.id; });
    var items = exists
      ? state.items.map(function (i) { return i.id === action.item.id ? { id: i.id, price: i.price, qty: i.qty + 1 } : i; })
      : state.items.concat([{ id: action.item.id, price: action.item.price, qty: 1 }]);
    return Object.assign({}, state, { items: items });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    return Object.assign({}, state, {
      items: state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; }),
    });
  }
  if (action.type === 'clear') return Object.assign({}, state, { items: [] });
  return state;
}

assert.throws(function () { checkCartReducer(impl); }, 'тест не проверил setQty с нулём — в корзине осталась позиция с количеством 0');` },

      { name: 'ловит реализацию, которая на неизвестном экшене возвращает копию состояния',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    var exists = state.items.some(function (i) { return i.id === action.item.id; });
    var items = exists
      ? state.items.map(function (i) { return i.id === action.item.id ? { id: i.id, price: i.price, qty: i.qty + 1 } : i; })
      : state.items.concat([{ id: action.item.id, price: action.item.price, qty: 1 }]);
    return Object.assign({}, state, { items: items });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    var next = action.qty <= 0
      ? state.items.filter(function (i) { return i.id !== action.id; })
      : state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; });
    return Object.assign({}, state, { items: next });
  }
  if (action.type === 'clear') return Object.assign({}, state, { items: [] });
  return Object.assign({}, state);
}

assert.throws(function () { checkCartReducer(impl); }, 'тест сравнил состояния по значению и не заметил новую ссылку');` },

      { name: 'ловит реализацию, у которой clear теряет остальные поля состояния',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    var exists = state.items.some(function (i) { return i.id === action.item.id; });
    var items = exists
      ? state.items.map(function (i) { return i.id === action.item.id ? { id: i.id, price: i.price, qty: i.qty + 1 } : i; })
      : state.items.concat([{ id: action.item.id, price: action.item.price, qty: 1 }]);
    return Object.assign({}, state, { items: items });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    var next = action.qty <= 0
      ? state.items.filter(function (i) { return i.id !== action.id; })
      : state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; });
    return Object.assign({}, state, { items: next });
  }
  if (action.type === 'clear') return { items: [] };
  return state;
}

assert.throws(function () { checkCartReducer(impl); }, 'тест проверил только items и не заметил потерянный промокод');` },

      { name: 'ловит реализацию, которая добавляет новый товар в начало списка',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    var exists = state.items.some(function (i) { return i.id === action.item.id; });
    var items = exists
      ? state.items.map(function (i) { return i.id === action.item.id ? { id: i.id, price: i.price, qty: i.qty + 1 } : i; })
      : [{ id: action.item.id, price: action.item.price, qty: 1 }].concat(state.items);
    return Object.assign({}, state, { items: items });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    var next = action.qty <= 0
      ? state.items.filter(function (i) { return i.id !== action.id; })
      : state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; });
    return Object.assign({}, state, { items: next });
  }
  if (action.type === 'clear') return Object.assign({}, state, { items: [] });
  return state;
}

assert.throws(function () { checkCartReducer(impl); }, 'тест проверил состав корзины, но не её порядок');` },

      { name: 'ловит реализацию, которая добавляет товар без количества',
        body: `function impl(state, action) {
  if (action.type === 'add') {
    var exists = state.items.some(function (i) { return i.id === action.item.id; });
    var items = exists
      ? state.items.map(function (i) { return i.id === action.item.id ? { id: i.id, price: i.price, qty: i.qty + 1 } : i; })
      : state.items.concat([{ id: action.item.id, price: action.item.price }]);
    return Object.assign({}, state, { items: items });
  }
  if (action.type === 'remove') {
    return Object.assign({}, state, { items: state.items.filter(function (i) { return i.id !== action.id; }) });
  }
  if (action.type === 'setQty') {
    var next = action.qty <= 0
      ? state.items.filter(function (i) { return i.id !== action.id; })
      : state.items.map(function (i) { return i.id === action.id ? { id: i.id, price: i.price, qty: action.qty } : i; });
    return Object.assign({}, state, { items: next });
  }
  if (action.type === 'clear') return Object.assign({}, state, { items: [] });
  return state;
}

assert.throws(function () { checkCartReducer(impl); }, 'тест не сверил добавленную позицию целиком — у неё нет qty');` },
    ],
  },

  'tst-t4': {
    env: 'worker',
    entry: 'checkParseQueryString',
    starter: `function checkParseQueryString(parseQueryString) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(search) {
  function dec(s) { try { return decodeURIComponent(s.replace(/\\+/g, ' ')); } catch (e) { return s; } }
  var out = {};
  var query = String(search == null ? '' : search).replace(/^[?#]/, '');
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var eq = parts[i].indexOf('=');
    var key = dec(eq === -1 ? parts[i] : parts[i].slice(0, eq));
    var value = dec(eq === -1 ? '' : parts[i].slice(eq + 1));
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

checkParseQueryString(impl);` },

      { name: 'ловит реализацию, которая не отрезает ведущий вопросительный знак',
        body: `function impl(search) {
  function dec(s) { try { return decodeURIComponent(s.replace(/\\+/g, ' ')); } catch (e) { return s; } }
  var out = {};
  var query = String(search == null ? '' : search);
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var eq = parts[i].indexOf('=');
    var key = dec(eq === -1 ? parts[i] : parts[i].slice(0, eq));
    var value = dec(eq === -1 ? '' : parts[i].slice(eq + 1));
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

assert.throws(function () { checkParseQueryString(impl); }, 'тест не подал строку с ведущим вопросительным знаком');` },

      { name: 'ловит реализацию, которая не декодирует percent-encoding',
        body: `function impl(search) {
  function dec(s) { return s.replace(/\\+/g, ' '); }
  var out = {};
  var query = String(search == null ? '' : search).replace(/^[?#]/, '');
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var eq = parts[i].indexOf('=');
    var key = dec(eq === -1 ? parts[i] : parts[i].slice(0, eq));
    var value = dec(eq === -1 ? '' : parts[i].slice(eq + 1));
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

assert.throws(function () { checkParseQueryString(impl); }, 'тест не проверил значение с процентами — кириллица осталась в escape-виде');` },

      { name: 'ловит реализацию, которая не превращает плюс в пробел',
        body: `function impl(search) {
  function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  var out = {};
  var query = String(search == null ? '' : search).replace(/^[?#]/, '');
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var eq = parts[i].indexOf('=');
    var key = dec(eq === -1 ? parts[i] : parts[i].slice(0, eq));
    var value = dec(eq === -1 ? '' : parts[i].slice(eq + 1));
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

assert.throws(function () { checkParseQueryString(impl); }, 'тест не проверил hello+world');` },

      { name: 'ловит реализацию, которая при повторе ключа оставляет последнее значение',
        body: `function impl(search) {
  function dec(s) { try { return decodeURIComponent(s.replace(/\\+/g, ' ')); } catch (e) { return s; } }
  var out = {};
  var query = String(search == null ? '' : search).replace(/^[?#]/, '');
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var eq = parts[i].indexOf('=');
    var key = dec(eq === -1 ? parts[i] : parts[i].slice(0, eq));
    var value = dec(eq === -1 ? '' : parts[i].slice(eq + 1));
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

assert.throws(function () { checkParseQueryString(impl); }, 'тест не подал один ключ дважды — два тега из трёх потерялись');` },

      { name: 'ловит реализацию, которая режет значение по каждому знаку равенства',
        body: `function impl(search) {
  function dec(s) { try { return decodeURIComponent(s.replace(/\\+/g, ' ')); } catch (e) { return s; } }
  var out = {};
  var query = String(search == null ? '' : search).replace(/^[?#]/, '');
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var pair = parts[i].split('=');
    var key = dec(pair[0]);
    var value = dec(pair.length > 1 ? pair[1] : '');
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

assert.throws(function () { checkParseQueryString(impl); }, 'тест не проверил значение со знаком равенства внутри — адрес возврата обрезан');` },

      { name: 'ловит реализацию, которая пропускает ключ без значения',
        body: `function impl(search) {
  function dec(s) { try { return decodeURIComponent(s.replace(/\\+/g, ' ')); } catch (e) { return s; } }
  var out = {};
  var query = String(search == null ? '' : search).replace(/^[?#]/, '');
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    var eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    var key = dec(parts[i].slice(0, eq));
    var value = dec(parts[i].slice(eq + 1));
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

assert.throws(function () { checkParseQueryString(impl); }, 'тест не проверил параметр-флаг без знака равенства');` },

      { name: 'ловит реализацию, которая делает пустой ключ из пустых сегментов',
        body: `function impl(search) {
  function dec(s) { try { return decodeURIComponent(s.replace(/\\+/g, ' ')); } catch (e) { return s; } }
  var out = {};
  var query = String(search == null ? '' : search).replace(/^[?#]/, '');
  var parts = query.split('&');
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    var key = dec(eq === -1 ? parts[i] : parts[i].slice(0, eq));
    var value = dec(eq === -1 ? '' : parts[i].slice(eq + 1));
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

assert.throws(function () { checkParseQueryString(impl); }, 'тест не подал пустую строку и двойной амперсанд');` },
    ],
  },

  'tst-t5': {
    env: 'worker',
    entry: 'checkGroupBy',
    starter: `function checkGroupBy(groupBy) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(items, keyFn) {
  var out = {};
  for (var i = 0; i < items.length; i++) {
    var key = String(keyFn(items[i], i));
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = [];
    out[key].push(items[i]);
  }
  return out;
}

checkGroupBy(impl);` },

      { name: 'ловит реализацию, которая возвращает Map вместо объекта',
        body: `function impl(items, keyFn) {
  var out = new Map();
  for (var i = 0; i < items.length; i++) {
    var key = String(keyFn(items[i], i));
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(items[i]);
  }
  return out;
}

assert.throws(function () { checkGroupBy(impl); }, 'тест не зафиксировал форму результата');` },

      { name: 'ловит реализацию, которая переворачивает порядок внутри группы',
        body: `function impl(items, keyFn) {
  var out = {};
  for (var i = 0; i < items.length; i++) {
    var key = String(keyFn(items[i], i));
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = [];
    out[key].unshift(items[i]);
  }
  return out;
}

assert.throws(function () { checkGroupBy(impl); }, 'тест проверил состав групп, но не порядок элементов внутри');` },

      { name: 'ловит реализацию, которая ломается на пустом массиве',
        body: `function impl(items, keyFn) {
  if (!items.length) return null;
  var out = {};
  for (var i = 0; i < items.length; i++) {
    var key = String(keyFn(items[i], i));
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = [];
    out[key].push(items[i]);
  }
  return out;
}

assert.throws(function () { checkGroupBy(impl); }, 'тест не подал пустой массив');` },

      { name: 'ловит реализацию, которая не передаёт индекс в keyFn',
        body: `function impl(items, keyFn) {
  var out = {};
  for (var i = 0; i < items.length; i++) {
    var key = String(keyFn(items[i]));
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = [];
    out[key].push(items[i]);
  }
  return out;
}

assert.throws(function () { checkGroupBy(impl); }, 'тест не проверил ключевую функцию, которой нужен индекс');` },

      { name: 'ловит реализацию, которая сортирует ключи вместо порядка первого появления',
        body: `function impl(items, keyFn) {
  var raw = {};
  for (var i = 0; i < items.length; i++) {
    var key = String(keyFn(items[i], i));
    if (!Object.prototype.hasOwnProperty.call(raw, key)) raw[key] = [];
    raw[key].push(items[i]);
  }
  var out = {};
  Object.keys(raw).sort().forEach(function (key) { out[key] = raw[key]; });
  return out;
}

assert.throws(function () { checkGroupBy(impl); }, 'тест сравнил объекты целиком, а порядок ключей глубокое сравнение не видит');` },

      { name: 'ловит реализацию, которая теряет элементы с ключом 0 или пустой строкой',
        body: `function impl(items, keyFn) {
  var out = {};
  for (var i = 0; i < items.length; i++) {
    var raw = keyFn(items[i], i);
    if (!raw) continue;
    var key = String(raw);
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = [];
    out[key].push(items[i]);
  }
  return out;
}

assert.throws(function () { checkGroupBy(impl); }, 'тест не проверил ложные ключи — ноль и пустую строку');` },

      { name: 'ловит реализацию, которая мутирует входной массив',
        body: `function impl(items, keyFn) {
  var out = {};
  items.reverse();
  for (var i = items.length - 1; i >= 0; i--) {
    var key = String(keyFn(items[i], items.length - 1 - i));
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = [];
    out[key].push(items[i]);
  }
  return out;
}

assert.throws(function () { checkGroupBy(impl); }, 'тест смотрел только на результат — входной массив остался перевёрнутым');` },
    ],
  },

  /* ─────────────────── Строки, числа и границы ─────────────────── */

  'tst-t6': {
    env: 'worker',
    entry: 'checkTruncate',
    starter: `function checkTruncate(truncate) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(text, limit) {
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  var room = limit - 1;
  var cut = text.slice(0, room + 1);
  var lastSpace = cut.lastIndexOf(' ');
  cut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, room);
  return cut.replace(/\\s+$/, '') + '…';
}

checkTruncate(impl);` },

      { name: 'ловит реализацию, у которой многоточие не входит в лимит',
        body: `function impl(text, limit) {
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  var room = limit;
  var cut = text.slice(0, room + 1);
  var lastSpace = cut.lastIndexOf(' ');
  cut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, room);
  return cut.replace(/\\s+$/, '') + '…';
}

assert.throws(function () { checkTruncate(impl); }, 'тест не проверил длину результата — она на символ больше лимита');` },

      { name: 'ловит реализацию, которая режет посреди слова',
        body: `function impl(text, limit) {
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1).replace(/\\s+$/, '') + '…';
}

assert.throws(function () { checkTruncate(impl); }, 'тест не проверил, что обрезка идёт по границе слова');` },

      { name: 'ловит реализацию, которая вешает многоточие на текст, который и так помещается',
        body: `function impl(text, limit) {
  if (limit <= 0) return '';
  var room = limit - 1;
  var cut = text.slice(0, room + 1);
  var lastSpace = cut.lastIndexOf(' ');
  cut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, room);
  return cut.replace(/\\s+$/, '') + '…';
}

assert.throws(function () { checkTruncate(impl); }, 'тест не проверил текст короче лимита');` },

      { name: 'ловит реализацию, которая обрезает текст ровно по лимиту',
        body: `function impl(text, limit) {
  if (limit <= 0) return '';
  if (text.length < limit) return text;
  var room = limit - 1;
  var cut = text.slice(0, room + 1);
  var lastSpace = cut.lastIndexOf(' ');
  cut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, room);
  return cut.replace(/\\s+$/, '') + '…';
}

assert.throws(function () { checkTruncate(impl); }, 'тест не проверил границу: текст длиной ровно в лимит');` },

      { name: 'ловит реализацию, которая оставляет пробел перед многоточием',
        body: `function impl(text, limit) {
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  var room = limit - 1;
  var cut = text.slice(0, room + 1);
  var lastSpace = cut.lastIndexOf(' ');
  cut = lastSpace > 0 ? cut.slice(0, lastSpace + 1) : cut.slice(0, room);
  return cut + '…';
}

assert.throws(function () { checkTruncate(impl); }, 'тест не заметил пробел между текстом и многоточием');` },

      { name: 'ловит реализацию, которая на слове длиннее лимита возвращает одно многоточие',
        body: `function impl(text, limit) {
  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  var room = limit - 1;
  var cut = text.slice(0, room + 1);
  var lastSpace = cut.lastIndexOf(' ');
  cut = lastSpace > 0 ? cut.slice(0, lastSpace) : '';
  return cut.replace(/\\s+$/, '') + '…';
}

assert.throws(function () { checkTruncate(impl); }, 'тест не подал текст без пробелов');` },

      { name: 'ловит реализацию, которая на нулевом лимите возвращает многоточие',
        body: `function impl(text, limit) {
  if (text.length <= limit) return text;
  var room = limit - 1;
  var cut = text.slice(0, room + 1);
  var lastSpace = cut.lastIndexOf(' ');
  cut = lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, room);
  return cut.replace(/\\s+$/, '') + '…';
}

assert.throws(function () { checkTruncate(impl); }, 'тест не проверил нулевой и отрицательный лимит');` },
    ],
  },

  'tst-t7': {
    env: 'worker',
    entry: 'checkPluralize',
    starter: `function checkPluralize(pluralize) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(count, forms) {
  var n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return forms[2];
  var last = n % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

checkPluralize(impl);` },

      { name: 'ловит реализацию, которая не знает про исключение 11–14',
        body: `function impl(count, forms) {
  var last = Math.abs(count) % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

assert.throws(function () { checkPluralize(impl); }, 'тест не проверил числа от 11 до 14 — получился «11 товар»');` },

      { name: 'ловит реализацию, у которой исключение 11–14 работает только в первой сотне',
        body: `function impl(count, forms) {
  var abs = Math.abs(count);
  if (abs >= 11 && abs <= 14) return forms[2];
  var last = abs % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

assert.throws(function () { checkPluralize(impl); }, 'тест остановился на первой сотне и не дошёл до 111');` },

      { name: 'ловит реализацию, которая на нуле даёт первую форму',
        body: `function impl(count, forms) {
  var n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return forms[2];
  var last = n % 10;
  if (last <= 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

assert.throws(function () { checkPluralize(impl); }, 'тест не проверил ноль — вышло «0 товар»');` },

      { name: 'ловит реализацию, которая смотрит на всё число вместо последней цифры',
        body: `function impl(count, forms) {
  var n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return forms[2];
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

assert.throws(function () { checkPluralize(impl); }, 'тест не проверил 21 и 22');` },

      { name: 'ловит реализацию, которая ломается на отрицательных числах',
        body: `function impl(count, forms) {
  var n = count % 100;
  if (n >= 11 && n <= 14) return forms[2];
  var last = n % 10;
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

assert.throws(function () { checkPluralize(impl); }, 'тест не проверил отрицательные значения');` },

      { name: 'ловит реализацию, которая промахивается на границах диапазона 2–4',
        body: `function impl(count, forms) {
  var n = Math.abs(count) % 100;
  if (n >= 11 && n <= 14) return forms[2];
  var last = n % 10;
  if (last === 1) return forms[0];
  if (last > 2 && last < 4) return forms[1];
  return forms[2];
}

assert.throws(function () { checkPluralize(impl); }, 'тест проверил только 3 и не тронул 2 и 4');` },

      { name: 'ловит реализацию, которая возвращает число вместе со словом',
        body: `function impl(count, forms) {
  var n = Math.abs(count) % 100;
  var last = n % 10;
  var form = (n >= 11 && n <= 14) ? forms[2] : last === 1 ? forms[0] : (last >= 2 && last <= 4) ? forms[1] : forms[2];
  return count + ' ' + form;
}

assert.throws(function () { checkPluralize(impl); }, 'тест не зафиксировал, что возвращается только форма слова');` },
    ],
  },

  'tst-t8': {
    env: 'worker',
    entry: 'checkMergeDeep',
    starter: `function checkMergeDeep(mergeDeep) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(a, b) {
  function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  var out = Object.assign({}, a);
  Object.keys(b).forEach(function (key) {
    var next = b[key];
    if (next === undefined) return;
    var prev = out[key];
    if (Array.isArray(next)) out[key] = next.slice();
    else if (isPlain(next)) out[key] = isPlain(prev) ? impl(prev, next) : impl({}, next);
    else out[key] = next;
  });
  return out;
}

checkMergeDeep(impl);` },

      { name: 'ловит поверхностное слияние, при котором вложенный объект заменяется целиком',
        body: `function impl(a, b) {
  function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  var out = Object.assign({}, a);
  Object.keys(b).forEach(function (key) {
    var next = b[key];
    if (next === undefined) return;
    if (Array.isArray(next)) out[key] = next.slice();
    else if (isPlain(next)) out[key] = Object.assign({}, next);
    else out[key] = next;
  });
  return out;
}

assert.throws(function () { checkMergeDeep(impl); }, 'тест не проверил вложенный объект — размер шрифта затёр всю тему');` },

      { name: 'ловит реализацию, которая мутирует первый аргумент',
        body: `function impl(a, b) {
  function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  var out = a;
  Object.keys(b).forEach(function (key) {
    var next = b[key];
    if (next === undefined) return;
    var prev = out[key];
    if (Array.isArray(next)) out[key] = next.slice();
    else if (isPlain(next)) out[key] = isPlain(prev) ? impl(prev, next) : impl({}, next);
    else out[key] = next;
  });
  return out;
}

assert.throws(function () { checkMergeDeep(impl); }, 'тест смотрел только на результат — настройки по умолчанию испорчены');` },

      { name: 'ловит реализацию, у которой undefined затирает значение',
        body: `function impl(a, b) {
  function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  var out = Object.assign({}, a);
  Object.keys(b).forEach(function (key) {
    var next = b[key];
    var prev = out[key];
    if (Array.isArray(next)) out[key] = next.slice();
    else if (isPlain(next)) out[key] = isPlain(prev) ? impl(prev, next) : impl({}, next);
    else out[key] = next;
  });
  return out;
}

assert.throws(function () { checkMergeDeep(impl); }, 'тест не различил undefined и null в патче');` },

      { name: 'ловит реализацию, которая падает на null в патче',
        body: `function impl(a, b) {
  function isPlain(v) { return typeof v === 'object' && !Array.isArray(v); }
  var out = Object.assign({}, a);
  Object.keys(b).forEach(function (key) {
    var next = b[key];
    if (next === undefined) return;
    var prev = out[key];
    if (Array.isArray(next)) out[key] = next.slice();
    else if (isPlain(next)) out[key] = isPlain(prev) ? impl(prev, next) : impl({}, next);
    else out[key] = next;
  });
  return out;
}

assert.throws(function () { checkMergeDeep(impl); }, 'тест не подал null — а typeof null это object, и рекурсия падает');` },

      { name: 'ловит реализацию, которая сливает массивы вместо замены',
        body: `function impl(a, b) {
  function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  var out = Object.assign({}, a);
  Object.keys(b).forEach(function (key) {
    var next = b[key];
    if (next === undefined) return;
    var prev = out[key];
    if (Array.isArray(next)) out[key] = (Array.isArray(prev) ? prev : []).concat(next);
    else if (isPlain(next)) out[key] = isPlain(prev) ? impl(prev, next) : impl({}, next);
    else out[key] = next;
  });
  return out;
}

assert.throws(function () { checkMergeDeep(impl); }, 'тест не проверил, что массив из патча заменяет значение целиком');` },

      { name: 'ловит реализацию, которая кладёт значения из патча по ссылке',
        body: `function impl(a, b) {
  function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  var out = Object.assign({}, a);
  Object.keys(b).forEach(function (key) {
    var next = b[key];
    if (next === undefined) return;
    var prev = out[key];
    if (Array.isArray(next)) out[key] = next;
    else if (isPlain(next)) out[key] = isPlain(prev) ? impl(prev, next) : next;
    else out[key] = next;
  });
  return out;
}

assert.throws(function () { checkMergeDeep(impl); }, 'тест сравнил значения и не заметил, что результат делит ссылки с патчем');` },

      { name: 'ловит реализацию, которая теряет ключи, которых не было в первом объекте',
        body: `function impl(a, b) {
  function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  var out = Object.assign({}, a);
  Object.keys(a).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return;
    var next = b[key];
    if (next === undefined) return;
    var prev = out[key];
    if (Array.isArray(next)) out[key] = next.slice();
    else if (isPlain(next)) out[key] = isPlain(prev) ? impl(prev, next) : impl({}, next);
    else out[key] = next;
  });
  return out;
}

assert.throws(function () { checkMergeDeep(impl); }, 'тест не положил в патч ключ, которого нет в настройках по умолчанию');` },
    ],
  },

  /* ─────────────────── Порядок и сравнение коллекций ─────────────────── */

  'tst-t9': {
    env: 'worker',
    entry: 'checkSortByPriority',
    starter: `function checkSortByPriority(sortByPriority) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(tasks) {
  var rank = { high: 0, medium: 1, low: 2 };
  function weight(p) { return Object.prototype.hasOwnProperty.call(rank, p) ? rank[p] : 2; }
  return tasks.slice().sort(function (a, b) {
    return (a.done ? 1 : 0) - (b.done ? 1 : 0) || weight(a.priority) - weight(b.priority) || a.createdAt - b.createdAt;
  });
}

checkSortByPriority(impl);` },

      { name: 'ловит реализацию, которая не поднимает невыполненные задачи наверх',
        body: `function impl(tasks) {
  var rank = { high: 0, medium: 1, low: 2 };
  function weight(p) { return Object.prototype.hasOwnProperty.call(rank, p) ? rank[p] : 2; }
  return tasks.slice().sort(function (a, b) {
    return weight(a.priority) - weight(b.priority) || a.createdAt - b.createdAt;
  });
}

assert.throws(function () { checkSortByPriority(impl); }, 'тест не проверил, что выполненные задачи уходят вниз');` },

      { name: 'ловит реализацию, которая сортирует входной массив на месте',
        body: `function impl(tasks) {
  var rank = { high: 0, medium: 1, low: 2 };
  function weight(p) { return Object.prototype.hasOwnProperty.call(rank, p) ? rank[p] : 2; }
  return tasks.sort(function (a, b) {
    return (a.done ? 1 : 0) - (b.done ? 1 : 0) || weight(a.priority) - weight(b.priority) || a.createdAt - b.createdAt;
  });
}

assert.throws(function () { checkSortByPriority(impl); }, 'тест не проверил ни исходный массив после вызова, ни то, что вернулся новый массив');` },

      { name: 'ловит реализацию, которая сравнивает приоритеты как строки',
        body: `function impl(tasks) {
  return tasks.slice().sort(function (a, b) {
    if ((a.done ? 1 : 0) !== (b.done ? 1 : 0)) return (a.done ? 1 : 0) - (b.done ? 1 : 0);
    if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

assert.throws(function () { checkSortByPriority(impl); }, 'тест не проверил пару medium и low — по алфавиту low оказывается выше');` },

      { name: 'ловит реализацию, которая игнорирует дату создания',
        body: `function impl(tasks) {
  var rank = { high: 0, medium: 1, low: 2 };
  function weight(p) { return Object.prototype.hasOwnProperty.call(rank, p) ? rank[p] : 2; }
  return tasks.slice().sort(function (a, b) {
    return (a.done ? 1 : 0) - (b.done ? 1 : 0) || weight(a.priority) - weight(b.priority);
  });
}

assert.throws(function () { checkSortByPriority(impl); }, 'тест не проверил порядок двух задач с одинаковым приоритетом');` },

      { name: 'ловит реализацию, которая сортирует по дате в обратную сторону',
        body: `function impl(tasks) {
  var rank = { high: 0, medium: 1, low: 2 };
  function weight(p) { return Object.prototype.hasOwnProperty.call(rank, p) ? rank[p] : 2; }
  return tasks.slice().sort(function (a, b) {
    return (a.done ? 1 : 0) - (b.done ? 1 : 0) || weight(a.priority) - weight(b.priority) || b.createdAt - a.createdAt;
  });
}

assert.throws(function () { checkSortByPriority(impl); }, 'тест не зафиксировал направление сортировки по дате');` },

      { name: 'ловит реализацию, которая добавляет свой тайбрейк и ломает устойчивость',
        body: `function impl(tasks) {
  var rank = { high: 0, medium: 1, low: 2 };
  function weight(p) { return Object.prototype.hasOwnProperty.call(rank, p) ? rank[p] : 2; }
  return tasks.slice().sort(function (a, b) {
    return (a.done ? 1 : 0) - (b.done ? 1 : 0) || weight(a.priority) - weight(b.priority) ||
      a.createdAt - b.createdAt || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
  });
}

assert.throws(function () { checkSortByPriority(impl); }, 'тест не подал задачи с полностью совпадающими ключами');` },

      { name: 'ловит реализацию, которая ставит неизвестный приоритет выше всех',
        body: `function impl(tasks) {
  var rank = { high: 0, medium: 1, low: 2 };
  function weight(p) { return Object.prototype.hasOwnProperty.call(rank, p) ? rank[p] : -1; }
  return tasks.slice().sort(function (a, b) {
    return (a.done ? 1 : 0) - (b.done ? 1 : 0) || weight(a.priority) - weight(b.priority) || a.createdAt - b.createdAt;
  });
}

assert.throws(function () { checkSortByPriority(impl); }, 'тест не подал задачу с приоритетом, которого нет в спецификации');` },
    ],
  },

  'tst-t10': {
    env: 'worker',
    entry: 'checkDiffArrays',
    starter: `function checkDiffArrays(diffArrays) {
  // Прогоните переданную реализацию по спецификации и бросьте исключение,
  // если она ведёт себя неправильно. Доступен assert: equal, ok, throws.
}`,
    cases: [
      { name: 'пропускает правильную реализацию',
        body: `function impl(before, after) {
  var beforeSet = new Set(before);
  var afterSet = new Set(after);
  var added = [];
  var kept = [];
  var removed = [];
  afterSet.forEach(function (v) { (beforeSet.has(v) ? kept : added).push(v); });
  beforeSet.forEach(function (v) { if (!afterSet.has(v)) removed.push(v); });
  return { added: added, removed: removed, kept: kept };
}

checkDiffArrays(impl);` },

      { name: 'ловит реализацию, у которой added и removed поменяны местами',
        body: `function impl(before, after) {
  var beforeSet = new Set(before);
  var afterSet = new Set(after);
  var added = [];
  var kept = [];
  var removed = [];
  afterSet.forEach(function (v) { (beforeSet.has(v) ? kept : added).push(v); });
  beforeSet.forEach(function (v) { if (!afterSet.has(v)) removed.push(v); });
  return { added: removed, removed: added, kept: kept };
}

assert.throws(function () { checkDiffArrays(impl); }, 'тест не подал случай, где непусты сразу и added, и removed');` },

      { name: 'ловит реализацию, которая не схлопывает дубликаты',
        body: `function impl(before, after) {
  var beforeSet = new Set(before);
  var afterSet = new Set(after);
  return {
    added: after.filter(function (v) { return !beforeSet.has(v); }),
    removed: before.filter(function (v) { return !afterSet.has(v); }),
    kept: after.filter(function (v) { return beforeSet.has(v); }),
  };
}

assert.throws(function () { checkDiffArrays(impl); }, 'тест не подал массивы с повторяющимися значениями');` },

      { name: 'ловит реализацию, которая сравнивает значения как строки',
        body: `function impl(before, after) {
  var beforeSet = new Set(before.map(String));
  var afterSet = new Set(after.map(String));
  var added = [];
  var kept = [];
  var removed = [];
  new Set(after).forEach(function (v) { (beforeSet.has(String(v)) ? kept : added).push(v); });
  new Set(before).forEach(function (v) { if (!afterSet.has(String(v))) removed.push(v); });
  return { added: added, removed: removed, kept: kept };
}

assert.throws(function () { checkDiffArrays(impl); }, 'тест не смешал число и строку с тем же видом');` },

      { name: 'ловит реализацию, которая на пустом входе возвращает не все три поля',
        body: `function impl(before, after) {
  if (!before.length) return { added: Array.from(new Set(after)) };
  var beforeSet = new Set(before);
  var afterSet = new Set(after);
  var added = [];
  var kept = [];
  var removed = [];
  afterSet.forEach(function (v) { (beforeSet.has(v) ? kept : added).push(v); });
  beforeSet.forEach(function (v) { if (!afterSet.has(v)) removed.push(v); });
  return { added: added, removed: removed, kept: kept };
}

assert.throws(function () { checkDiffArrays(impl); }, 'тест не проверил пустые входы и форму результата целиком');` },

      { name: 'ловит реализацию, которая сортирует added вместо порядка появления',
        body: `function impl(before, after) {
  var beforeSet = new Set(before);
  var afterSet = new Set(after);
  var added = [];
  var kept = [];
  var removed = [];
  afterSet.forEach(function (v) { (beforeSet.has(v) ? kept : added).push(v); });
  beforeSet.forEach(function (v) { if (!afterSet.has(v)) removed.push(v); });
  return { added: added.sort(), removed: removed, kept: kept };
}

assert.throws(function () { checkDiffArrays(impl); }, 'тест не проверил порядок в added на двух и более значениях');` },

      { name: 'ловит реализацию, которая собирает kept в порядке первого массива',
        body: `function impl(before, after) {
  var beforeSet = new Set(before);
  var afterSet = new Set(after);
  var added = [];
  var kept = [];
  var removed = [];
  afterSet.forEach(function (v) { if (!beforeSet.has(v)) added.push(v); });
  beforeSet.forEach(function (v) { if (afterSet.has(v)) kept.push(v); else removed.push(v); });
  return { added: added, removed: removed, kept: kept };
}

assert.throws(function () { checkDiffArrays(impl); }, 'тест не подал входы, у которых порядок общих значений различается');` },

      { name: 'ловит реализацию на indexOf, которая теряет NaN',
        body: `function impl(before, after) {
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }
  var b = uniq(before);
  var a = uniq(after);
  return {
    added: a.filter(function (v) { return b.indexOf(v) === -1; }),
    removed: b.filter(function (v) { return a.indexOf(v) === -1; }),
    kept: a.filter(function (v) { return b.indexOf(v) !== -1; }),
  };
}

assert.throws(function () { checkDiffArrays(impl); }, 'тест не подал NaN — indexOf его никогда не находит');` },
    ],
  },
};
