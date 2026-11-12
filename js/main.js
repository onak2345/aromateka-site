// JavaScript сайта «Ароматека».
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCatalog();
  initForms();
  initNavbar();
  initNumbers();
});

/* ---------- Смена темы с анимацией ---------- */
function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById('themeToggle');
  const KEY = 'aromateka-theme';
  const current = () => (root.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light');

  const apply = (theme) => {
    root.setAttribute('data-bs-theme', theme);
    if (!btn) return;
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Включить светлую тему' : 'Включить тёмную тему');
    btn.title = dark ? 'Светлая тема' : 'Тёмная тема';
  };
  apply(current());
  if (!btn) return;

  const save = (theme) => { try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ } };

  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    save(next);

    btn.classList.add('is-spinning');
    setTimeout(() => btn.classList.remove('is-spinning'), 600);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply(next);
      return;
    }

    if (typeof document.startViewTransition === 'function') {
      // Круговая волна от кнопки: новая тема «растёт» из точки клика.
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = document.startViewTransition(() => apply(next));
      transition.ready.then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(() => {});
    } else {
      // Запасной вариант: плавное перетекание цветов.
      root.classList.add('theme-fade');
      apply(next);
      setTimeout(() => root.classList.remove('theme-fade'), 700);
    }
  });

  // Если пользователь не выбирал тему сам, следуем за системной.
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) {
    mq.addEventListener('change', (e) => {
      let saved = null;
      try { saved = localStorage.getItem(KEY); } catch (err) { /* ignore */ }
      if (!saved) apply(e.matches ? 'dark' : 'light');
    });
  }
}

/* ---------- Каталог: поиск, фильтр, сортировка, избранное, быстрый просмотр, «Удиви меня» ---------- */
function initCatalog() {
  const grid = document.getElementById('perfumeGrid');
  if (!grid) return;

  const $ = (id) => document.getElementById(id);
  const cards = Array.from(grid.querySelectorAll('.perfume-item'));
  const filter = $('scentFilter');
  const search = $('catalogSearch');
  const clearBtn = $('searchClear');
  const sort = $('sortSelect');
  const favBtn = $('favFilter');
  const favCountEl = $('favCount');
  const randomBtn = $('randomPick');
  const count = $('catalogCount');
  const empty = $('emptyState');
  const emptyText = $('emptyText');
  const resetBtn = $('resetFilters');

  const FAMILIES = {
    floral: 'цветочные цветочный цветы',
    woody: 'древесные древесный дерево',
    citrus: 'цитрусовые цитрусовый цитрус',
    oriental: 'восточные восточный пряный',
    fresh: 'свежие свежий свежесть'
  };
  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const text = (el, sel) => { const n = el.querySelector(sel); return n ? n.textContent : ''; };

  // Подготовка карточек: текст для поиска и «стойкость» для сортировки.
  cards.forEach((card, i) => {
    card.dataset.order = String(i);
    const types = (card.dataset.type || '').split(/\s+/).filter(Boolean);
    card._hay = norm([
      text(card, 'h3'), text(card, '.perfume-brand'), text(card, '.perfume-card__body > p'),
      card.dataset.notes, types.map((t) => FAMILIES[t] || '').join(' ')
    ].join(' '));
    const nums = (text(card, '.card-meta b').match(/\d+/g) || []).map(Number);
    card._hold = nums.length ? Math.max(...nums) : 0;
  });

  /* Избранное (хранится в localStorage) */
  const FAV_KEY = 'aromateka-favs';
  let favs = new Set();
  try { favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (e) { /* ignore */ }
  const saveFavs = () => { try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(favs))); } catch (e) { /* ignore */ } };
  let favOnly = false;

  let snackEl = null;
  let snackTimer = null;
  const snack = (msg) => {
    if (!snackEl) {
      snackEl = document.createElement('div');
      snackEl.className = 'snack';
      snackEl.setAttribute('role', 'status');
      document.body.appendChild(snackEl);
    }
    snackEl.textContent = msg;
    snackEl.classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => snackEl.classList.remove('show'), 1900);
  };

  const paintFav = (card) => {
    const on = favs.has(card.dataset.id);
    const b = card.querySelector('[data-fav]');
    if (!b) return;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', on ? 'Убрать из избранного' : 'Добавить в избранное');
  };

  /* Применение поиска + фильтра + избранного */
  const update = () => {
    const type = filter.value;
    const words = norm(search.value).split(' ').filter(Boolean);
    let visible = 0;
    cards.forEach((card) => {
      const types = (card.dataset.type || '').split(/\s+/);
      const ok = (type === 'all' || types.includes(type))
        && words.every((w) => card._hay.includes(w))
        && (!favOnly || favs.has(card.dataset.id));
      card.classList.toggle('d-none', !ok);
      if (ok) visible += 1;
    });
    count.textContent = String(visible);
    empty.classList.toggle('d-none', visible > 0);
    if (visible === 0) {
      if (favOnly && favs.size === 0) emptyText.textContent = 'В избранном пока пусто — нажмите ♡ на карточке аромата.';
      else if (words.length) emptyText.textContent = `По запросу «${search.value.trim()}» ничего не найдено. Попробуйте другое название или ноту.`;
      else emptyText.textContent = 'Ароматов этого семейства пока нет. Попробуйте выбрать другую категорию.';
    }
    clearBtn.classList.toggle('d-none', !search.value);
    favCountEl.textContent = String(favs.size);
    favBtn.classList.toggle('is-on', favOnly);
    favBtn.setAttribute('aria-pressed', String(favOnly));
  };

  const applySort = () => {
    const v = sort.value;
    const arr = cards.slice();
    if (v === 'name') arr.sort((a, b) => text(a, 'h3').localeCompare(text(b, 'h3'), 'ru'));
    else if (v === 'hold') arr.sort((a, b) => (b._hold - a._hold) || (Number(a.dataset.order) - Number(b.dataset.order)));
    else arr.sort((a, b) => Number(a.dataset.order) - Number(b.dataset.order));
    arr.forEach((card) => grid.appendChild(card));
  };

  const resetAll = () => {
    filter.value = 'all';
    search.value = '';
    sort.value = 'default';
    favOnly = false;
    applySort();
    update();
  };

  /* Быстрый просмотр (Bootstrap Modal) */
  const modalEl = $('quickView');
  const bsModal = modalEl && window.bootstrap ? window.bootstrap.Modal.getOrCreateInstance(modalEl) : null;
  let qvCard = null;

  const photoOf = (card) => {
    const img = card.querySelector('img.perfume-card__photo');
    if (img) return img.currentSrc || img.src;
    const holder = card.querySelector('.perfume-card__image');
    const bg = holder ? getComputedStyle(holder).backgroundImage : '';
    const m = bg.match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : '';
  };

  const paintQvFav = () => {
    const b = $('qvFav');
    if (!b || !qvCard) return;
    const on = favs.has(qvCard.dataset.id);
    b.textContent = on ? '♥ В избранном' : '♡ В избранное';
    b.classList.toggle('is-on', on);
  };

  const openQuickView = (card) => {
    if (!bsModal) return;
    qvCard = card;
    const meta = card.querySelectorAll('.card-meta b');
    $('qvImg').src = photoOf(card);
    $('qvImg').alt = text(card, 'h3');
    $('qvBrand').textContent = text(card, '.perfume-brand');
    $('qvTitle').textContent = text(card, 'h3');
    $('qvDesc').textContent = text(card, '.perfume-card__body > p');
    $('qvNotes').textContent = card.dataset.notes || '—';
    $('qvHold').textContent = meta[0] ? meta[0].textContent : '—';
    $('qvTrail').textContent = meta[1] ? meta[1].textContent : '—';
    paintQvFav();
    bsModal.show();
  };

  const toggleFav = (card) => {
    const id = card.dataset.id;
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs();
    paintFav(card);
    const b = card.querySelector('[data-fav]');
    if (b) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    snack(favs.has(id) ? 'Добавлено в избранное' : 'Убрано из избранного');
    if (favOnly) update(); else favCountEl.textContent = String(favs.size);
    paintQvFav();
  };

  grid.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { toggleFav(fav.closest('.perfume-item')); return; }
    const qv = e.target.closest('[data-quickview]');
    if (qv) openQuickView(qv.closest('.perfume-item'));
  });
  const qvFav = $('qvFav');
  if (qvFav) qvFav.addEventListener('click', () => { if (qvCard) toggleFav(qvCard); });

  /* «Удиви меня»: случайный аромат из видимых */
  randomBtn.addEventListener('click', () => {
    let pool = cards.filter((c) => !c.classList.contains('d-none'));
    if (!pool.length) { resetAll(); pool = cards.slice(); }
    cards.forEach((c) => c.classList.remove('is-picked'));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    pick.classList.add('is-picked');
    pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
    snack(`Сегодня вам выпал: ${text(pick, 'h3')}`);
    setTimeout(() => openQuickView(pick), 750);
    setTimeout(() => pick.classList.remove('is-picked'), 2600);
  });

  /* События */
  search.addEventListener('input', update);
  clearBtn.addEventListener('click', () => { search.value = ''; update(); search.focus(); });
  filter.addEventListener('change', update);
  sort.addEventListener('change', applySort);
  favBtn.addEventListener('click', () => { favOnly = !favOnly; update(); });
  resetBtn.addEventListener('click', resetAll);
  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); search.focus(); }
  });

  // Поисковый запрос с главной: catalog.html?q=...
  const q = new URLSearchParams(window.location.search).get('q');
  if (q) search.value = q;

  cards.forEach(paintFav);
  update();
}

/* ---------- Формы ---------- */
function initForms() {
  const formSettings = [
    { id: 'orderForm', alertId: 'orderAlert', showModal: true },
    { id: 'contactForm', alertId: 'contactAlert', showModal: false }
  ];

  formSettings.forEach(({ id, alertId, showModal }) => {
    const form = document.getElementById(id);
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();

      form.classList.add('was-validated');
      if (!form.checkValidity()) {
        const firstInvalid = form.querySelector(':invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      const alertBox = document.getElementById(alertId);
      if (alertBox) {
        alertBox.classList.remove('d-none');
        alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      if (showModal && window.bootstrap) {
        const modalElement = document.getElementById('successModal');
        if (modalElement) window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
      }

      form.reset();
      form.classList.remove('was-validated');
    });
  });
}

/* ---------- Мобильное меню закрывается после выбора раздела ---------- */
function initNavbar() {
  const navbar = document.getElementById('mainNavbar');
  if (!navbar || !window.bootstrap) return;
  navbar.querySelectorAll('a.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 991.98px)').matches) {
        const collapse = window.bootstrap.Collapse.getInstance(navbar);
        if (collapse) collapse.hide();
      }
    });
  });
}

/* ---------- Мягкая анимация чисел ---------- */
function initNumbers() {
  const items = document.querySelectorAll(
    '.advantage-number, .hero-caption span:first-child, .stat-box strong, .card-meta b, .catalog-count, .hero-note__count, [data-number]'
  );
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('number-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });
  items.forEach((item) => {
    item.classList.add('number-animate');
    observer.observe(item);
  });
}
