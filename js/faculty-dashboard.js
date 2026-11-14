document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item[data-view]');
  const host = document.getElementById('viewContent');
  const pageTitle = document.getElementById('pageTitle');
  const WEIGHTS = { q: 0.2, ac: 0.2, as: 0.2, ex: 0.4 };
  const PASSING = 75;

  const views = {
    dashboard: { file: 'tabs/dashboard.html', label: 'Dashboard' },
    'my-classes': { file: 'tabs/my-classes.html', label: 'My Classes' },
    students: { file: 'tabs/students.html', label: 'Students' },
    'academic-analytics': { file: 'tabs/academic-analytics.html', label: 'Academic Analytics' },
    settings: { file: 'tabs/settings.html', label: 'Settings' }
  };

  const secondaryFiles = {
    'grade-management': 'tabs/academic/grade-management.html',
    'class-performance': 'tabs/academic/class-performance.html',
    'student-performance': 'tabs/academic/student-performance.html'
  };

  const cache = new Map();

  function addRipple(event) {
    const button = event.currentTarget;
    if (!button || button.disabled) return;

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  }

  document.querySelectorAll('.primary-button, .secondary-button, .ghost-button, .action-button').forEach((button) => {
    button.addEventListener('pointerdown', addRipple);
  });

  const loadError = (title) =>
    `<section class="panel"><h2 class="panel-title">${title}</h2><p class="metric-label">Check the file path and try again. If you opened this page directly from a folder, run it through a local server.</p></section>`;

  async function fetchHtml(path) {
    if (cache.has(path)) return cache.get(path);
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    const html = await response.text();
    cache.set(path, html);
    return html;
  }

  function setActiveNav(name) {
    navItems.forEach((item) => {
      const on = item.dataset.view === name;
      item.classList.toggle('active', on);
      if (on) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
  }

  async function loadSecondary(button) {
    const target = document.getElementById('secondaryContent');
    const file = secondaryFiles[button.dataset.secondaryTab];
    if (!target || !file) return;

    document.querySelectorAll('.secondary-tab').forEach((b) => {
      const active = b === button;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });

    try {
      target.innerHTML = await fetchHtml(file);
    } catch {
      target.innerHTML = loadError('Unable to load this tab');
    }
  }

  async function renderView(name) {
    const view = views[name];
    if (!view) return;

    setActiveNav(name);
    pageTitle.textContent = view.label;
    history.replaceState(null, '', '#' + name);
    host.setAttribute('aria-busy', 'true');

    try {
      host.innerHTML = await fetchHtml(view.file);
      const revealEls = host.querySelectorAll('.metric-card, .panel, .summary-card, .table-card, .class-card, .setting-card');
      revealEls.forEach((el) => {
        el.classList.add('rv');
      });
      if (name === 'academic-analytics') {
        const first = host.querySelector('.secondary-tab.active') || host.querySelector('.secondary-tab');
        if (first) await loadSecondary(first);
      }
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

        revealEls.forEach((el) => io.observe(el));
      } else {
        revealEls.forEach((el) => el.classList.add('in'));
      }
    } catch {
      host.innerHTML = loadError('Unable to load this page');
    }

    host.removeAttribute('aria-busy');
  }

  function computeRow(row) {
    const val = (key) => Math.min(100, Math.max(0, parseFloat(row.querySelector(`[data-k="${key}"]`).value) || 0));
    const final = Math.round(Object.keys(WEIGHTS).reduce((sum, key) => sum + WEIGHTS[key] * val(key), 0));
    row.querySelector('.final-grade').textContent = final;
    const remark = row.querySelector('.remark');
    remark.className = 'remark status-badge ' + (final >= PASSING ? '' : 'warning');
    remark.textContent = final >= PASSING ? 'Passed' : 'Below passing';
  }

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('.nav-item[data-view]');
    if (nav) {
      if (nav.dataset.view === 'logout') {
        window.location.href = 'login.html';
      } else {
        renderView(nav.dataset.view);
      }
      return;
    }

    const secondary = event.target.closest('.secondary-tab');
    if (secondary) {
      loadSecondary(secondary);
      return;
    }

    const inner = event.target.closest('.inner-tab');
    if (inner) {
      const scope = inner.closest('.inner-scope');
      scope.querySelectorAll('.inner-tab').forEach((b) => {
        b.classList.toggle('active', b === inner);
        b.setAttribute('aria-selected', String(b === inner));
      });
      scope.querySelectorAll('.inner-panel').forEach((p) => {
        p.classList.toggle('active', p.dataset.panel === inner.dataset.tab);
      });
      return;
    }

    const action = event.target.closest('[data-action]');
    if (!action) return;

    if (action.dataset.action === 'compute') {
      document.querySelectorAll('tr[data-grade-row]').forEach(computeRow);
    }

    if (action.dataset.action === 'submit-grades') {
      const status = document.getElementById('submitStatus');
      if (status) {
        status.className = 'status-badge pending';
        status.textContent = 'Submitted for review';
      }
      action.disabled = true;
    }
  });

  document.addEventListener('input', (event) => {
    if (event.target.classList.contains('score-input')) {
      computeRow(event.target.closest('tr'));
    }
  });

  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-student-select]');
    if (!select) return;

    select.closest('.inner-panel').querySelectorAll('[data-student-view]').forEach((p) => {
      p.hidden = p.dataset.studentView !== select.value;
    });
  });

  renderView((location.hash.slice(1) && views[location.hash.slice(1)]) ? location.hash.slice(1) : 'dashboard');
});