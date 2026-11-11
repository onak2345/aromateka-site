// JavaScript сайта «Ароматека».
document.addEventListener('DOMContentLoaded', () => {
  // Фильтр каталога по ароматическому семейству.
  const filter = document.getElementById('scentFilter');
  if (filter) {
    const cards = Array.from(document.querySelectorAll('.perfume-item'));
    const count = document.getElementById('catalogCount');
    const empty = document.getElementById('emptyState');

    const updateCatalog = () => {
      const selectedType = filter.value;
      let visibleCount = 0;

      cards.forEach((card) => {
        const types = (card.dataset.type || '').split(/\s+/).filter(Boolean);
        const isVisible = selectedType === 'all' || types.includes(selectedType);
        card.classList.toggle('d-none', !isVisible);
        if (isVisible) visibleCount += 1;
      });

      if (count) count.textContent = String(visibleCount);
      if (empty) empty.classList.toggle('d-none', visibleCount > 0);
    };

    filter.addEventListener('change', updateCatalog);
    updateCatalog();
  }

  // Проверка и демонстрационная обработка форм.
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
        if (modalElement) {
          window.bootstrap.Modal.getOrCreateInstance(modalElement).show();
        }
      }

      form.reset();
      form.classList.remove('was-validated');
    });
  });

  // На мобильных устройствах закрываем меню после выбора раздела.
  const navbar = document.getElementById('mainNavbar');
  if (navbar && window.bootstrap) {
    navbar.querySelectorAll('a.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.matchMedia('(max-width: 991.98px)').matches) {
          const collapse = window.bootstrap.Collapse.getInstance(navbar);
          if (collapse) collapse.hide();
        }
      });
    });
  }

  // Мягкая анимация чисел: показатели проявляются при прокрутке к ним.
  const numericItems = document.querySelectorAll(
    '.advantage-number, .hero-caption span:first-child, .stat-box strong, .card-meta b, .catalog-count, .hero-note__count, [data-number]'
  );
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const numberObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('number-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    numericItems.forEach((item) => {
      item.classList.add('number-animate');
      numberObserver.observe(item);
    });
  }
});
