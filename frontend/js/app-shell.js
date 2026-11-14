(() => {
  if (document.body.classList.contains('auth-page') || document.querySelector('.app-shell')) return;

  const navigation = [
    { href: '/pages/dashboard.html', label: 'Dashboard', icon: '▦' },
    { href: '/pages/patient-list.html', label: 'Patients', icon: '♙' },
    { href: '/pages/medication-history.html', label: 'Medication history', icon: '◷' },
    { href: '/pages/medication-alerts.html', label: 'Medication alerts', icon: '!' },
    { href: '/pages/medication-reconciliation.html', label: 'Reconciliation', icon: '✓' },
    { href: '/pages/medication-catalog.html', label: 'Medication catalog', icon: '▤' },
    { href: '/pages/medication-orders.html', label: 'Medication orders', icon: '＋' },
    { href: '/pages/medication-schedules.html', label: 'Medication schedules', icon: '◷' },
    { href: '/pages/medication-administration.html', label: 'Administration', icon: '✚' },
    { href: '/pages/medication-exceptions.html', label: 'Exceptions', icon: '◇' },
    { href: '/pages/reports.html', label: 'Reports', icon: '▥' },
    { href: '/pages/settings.html', label: 'Settings', icon: '⚙', roles: ['medication_admin'] },
    { href: '/pages/audit-logs.html', label: 'Audit logs', icon: '≡', roles: ['medication_admin', 'medication_auditor'] }
  ];

  const scripts = Array.from(document.body.querySelectorAll('script'));
  const pageNodes = Array.from(document.body.childNodes).filter((node) => !scripts.includes(node));
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const backdrop = document.createElement('button');
  backdrop.className = 'sidebar-backdrop';
  backdrop.type = 'button';
  backdrop.setAttribute('aria-label', 'Close navigation menu');

  const sidebar = document.createElement('aside');
  sidebar.className = 'app-sidebar';
  sidebar.setAttribute('aria-label', 'Application navigation');

  const brand = document.createElement('a');
  brand.className = 'app-brand';
  brand.href = '/pages/dashboard.html';
  const brandMark = document.createElement('span');
  brandMark.className = 'brand-mark';
  brandMark.setAttribute('aria-hidden', 'true');
  brandMark.textContent = 'M';
  const brandCopy = document.createElement('span');
  const brandName = document.createElement('strong');
  brandName.textContent = 'MediLink';
  const brandTag = document.createElement('small');
  brandTag.textContent = 'Medication services';
  brandCopy.append(brandName, brandTag);
  brand.append(brandMark, brandCopy);
  sidebar.appendChild(brand);

  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';
  nav.setAttribute('aria-label', 'Main navigation');
  const currentPath = window.location.pathname;
  const activePath = ['/pages/patient-details.html', '/pages/patient-form.html'].includes(currentPath)
    ? '/pages/patient-list.html'
    : currentPath;
  for (const item of navigation) {
    const link = document.createElement('a');
    link.className = 'sidebar-link';
    link.href = item.href;
    if (item.roles) link.dataset.roles = item.roles.join(',');
    if (activePath === item.href) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }

    const icon = document.createElement('span');
    icon.className = 'sidebar-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;
    const label = document.createElement('span');
    label.textContent = item.label;
    link.append(icon, label);
    nav.appendChild(link);
  }
  sidebar.appendChild(nav);

  const sidebarFooter = document.createElement('div');
  sidebarFooter.className = 'sidebar-footer';
  sidebarFooter.textContent = 'Hospital medication administration';
  sidebar.appendChild(sidebarFooter);

  const workspace = document.createElement('div');
  workspace.className = 'app-workspace';

  const topbar = document.createElement('header');
  topbar.className = 'app-topbar';
  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'menu-toggle';
  menuButton.setAttribute('aria-label', 'Open navigation menu');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.textContent = '☰';

  const pageHeading = document.createElement('div');
  pageHeading.className = 'topbar-heading';
  const pageLabel = document.createElement('strong');
  pageLabel.textContent = document.title.replace(/^MediLink\s*/i, '') || 'Medication services';
  const pageSubheading = document.createElement('span');
  pageSubheading.textContent = 'Hospital Patient Medication Administration and Tracking';
  pageHeading.append(pageLabel, pageSubheading);

  const topbarMeta = document.createElement('div');
  topbarMeta.className = 'topbar-meta';
  const clock = document.createElement('time');
  clock.className = 'app-clock';
  clock.dateTime = new Date().toISOString();

  const notificationsLink = document.createElement('a');
  notificationsLink.className = 'topbar-notifications';
  notificationsLink.href = '/pages/medication-alerts.html';
  notificationsLink.setAttribute('aria-label', 'Medication alerts');
  const notificationIcon = document.createElement('span');
  notificationIcon.setAttribute('aria-hidden', 'true');
  notificationIcon.textContent = '!';
  const notificationCount = document.createElement('span');
  notificationCount.className = 'notification-count';
  notificationCount.setAttribute('aria-live', 'polite');
  notificationCount.setAttribute('aria-atomic', 'true');
  notificationCount.hidden = true;
  notificationsLink.append(notificationIcon, notificationCount);
  topbarMeta.append(clock, notificationsLink);

  const profile = document.createElement('div');
  profile.className = 'user-profile';
  const userInitial = document.createElement('span');
  userInitial.className = 'user-avatar';
  userInitial.setAttribute('aria-hidden', 'true');
  const userCopy = document.createElement('span');
  userCopy.className = 'user-copy';
  const userName = document.createElement('strong');
  const userRole = document.createElement('small');
  userCopy.append(userName, userRole);
  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.className = 'button-quiet';
  logoutButton.textContent = 'Sign out';
  profile.append(userInitial, userCopy, logoutButton);
  topbarMeta.appendChild(profile);
  topbar.append(menuButton, pageHeading, topbarMeta);

  const content = document.createElement('main');
  content.className = 'app-content';
  for (const node of pageNodes) {
    if (node.nodeType === Node.ELEMENT_NODE && node.matches('nav.nav')) continue;
    content.appendChild(node);
  }
  content.querySelectorAll('nav.nav').forEach((pageNavigation) => pageNavigation.remove());
  workspace.append(topbar, content);
  shell.append(sidebar, workspace, backdrop);
  document.body.replaceChildren(shell, ...scripts);

  function updateClock() {
    const now = new Date();
    clock.dateTime = now.toISOString();
    clock.textContent = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(now);
  }
  updateClock();
  window.setInterval(updateClock, 60000);

  function closeSidebar() {
    shell.classList.remove('sidebar-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
  menuButton.addEventListener('click', () => {
    const open = shell.classList.toggle('sidebar-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  backdrop.addEventListener('click', closeSidebar);
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeSidebar();
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
      window.location.replace('/pages/login.html');
    } catch (error) {
      logoutButton.disabled = false;
      showAlert(error.message || 'Unable to sign out.');
    }
  });

  apiFetch('/api/v1/auth/me')
    .then(({ user }) => {
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
      userName.textContent = name;
      userRole.textContent = user.role.replace(/_/g, ' ');
      userInitial.textContent = name.trim().charAt(0).toUpperCase();
      document.body.dataset.role = user.role;
      nav.querySelectorAll('[data-roles]').forEach((link) => {
        const allowedRoles = link.dataset.roles.split(',');
        link.hidden = !allowedRoles.includes(user.role);
      });
      document.querySelectorAll('[data-edit-role]').forEach((control) => {
        control.hidden = user.role === 'medication_auditor';
      });
    })
    .catch((error) => {
      if (error.status !== 401) showAlert(error.message || 'Unable to load your session.');
    });

  let notificationErrorShown = false;
  async function updateNotificationCount() {
    try {
      const alerts = await apiFetch('/api/v1/medication-alerts');
      const count = alerts.filter((alert) => alert.reviewed !== true).length;
      notificationCount.textContent = count > 99 ? '99+' : String(count);
      notificationCount.hidden = count === 0;
      notificationsLink.setAttribute(
        'aria-label',
        count > 0 ? `${count} unreviewed medication alerts` : 'Medication alerts'
      );
      notificationErrorShown = false;
    } catch (error) {
      if (error.status !== 401 && !notificationErrorShown) {
        showAlert(error.message || 'Unable to load medication alerts.');
        notificationErrorShown = true;
      }
    }
  }
  updateNotificationCount();
  window.setInterval(() => {
    if (document.visibilityState === 'visible') updateNotificationCount();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updateNotificationCount();
  });

  const tableStates = new WeakMap();

  function initializeTable(table) {
    if (tableStates.has(table) || table.classList.contains('patient-table')) return;
    const body = table.tBodies[0];
    if (!body) return;

    const host = table.closest('.table-wrap') || table;
    const controls = document.createElement('div');
    controls.className = 'table-tools';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'table-search';
    search.setAttribute('aria-label', 'Filter table rows');
    search.placeholder = 'Filter this table…';
    const pageSize = document.createElement('select');
    pageSize.className = 'table-page-size';
    pageSize.setAttribute('aria-label', 'Rows per page');
    for (const size of [10, 25, 50]) {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = `${size} rows`;
      pageSize.appendChild(option);
    }
    const status = document.createElement('span');
    status.className = 'table-tools-status';
    status.setAttribute('aria-live', 'polite');
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'secondary table-page-button';
    previous.textContent = 'Previous';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'secondary table-page-button';
    next.textContent = 'Next';
    controls.append(search, pageSize, status, previous, next);
    host.parentElement.insertBefore(controls, host);

    const state = {
      body,
      search,
      pageSize,
      status,
      previous,
      next,
      page: 1,
      sortColumn: -1,
      sortDirection: 1
    };

    function currentRows() {
      return Array.from(body.rows).filter((row) => {
        return !(row.cells.length === 1 && row.cells[0].colSpan > 1);
      });
    }

    function render() {
      const query = search.value.trim().toLocaleLowerCase();
      const rows = currentRows();
      const matches = rows.filter((row) => row.textContent.toLocaleLowerCase().includes(query));
      const pageCount = Math.max(1, Math.ceil(matches.length / Number(pageSize.value)));
      state.page = Math.min(state.page, pageCount);
      const start = (state.page - 1) * Number(pageSize.value);
      const visibleRows = new Set(matches.slice(start, start + Number(pageSize.value)));

      for (const row of rows) row.hidden = !visibleRows.has(row);
      const emptyRows = Array.from(body.rows).filter((row) => row.cells.length === 1 && row.cells[0].colSpan > 1);
      for (const row of emptyRows) row.hidden = matches.length > 0;

      status.textContent = matches.length === 0
        ? (query ? 'No matching rows' : 'No records')
        : `Showing ${start + 1}–${Math.min(start + Number(pageSize.value), matches.length)} of ${matches.length}`;
      previous.disabled = state.page <= 1;
      next.disabled = state.page >= pageCount;
    }

    table.querySelectorAll('thead th').forEach((header, index) => {
      if (header.querySelector('button, a, input, select') || !header.textContent.trim()) return;
      const originalLabel = header.textContent.trim();
      const sortButton = document.createElement('button');
      sortButton.type = 'button';
      sortButton.className = 'table-sort-button';
      sortButton.textContent = originalLabel;
      sortButton.setAttribute('aria-label', `Sort by ${originalLabel}`);
      sortButton.addEventListener('click', () => {
        if (state.sortColumn === index) state.sortDirection *= -1;
        else {
          state.sortColumn = index;
          state.sortDirection = 1;
        }
        const sortedRows = currentRows().sort((first, second) => {
          const firstValue = first.cells[index]?.textContent.trim() || '';
          const secondValue = second.cells[index]?.textContent.trim() || '';
          const datePattern = /^(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b)/i;
          const numericPattern = /^-?\d+(?:\.\d+)?$/;
          const firstNumber = Number(firstValue);
          const secondNumber = Number(secondValue);
          const firstIsDate = datePattern.test(firstValue) && Number.isFinite(Date.parse(firstValue));
          const secondIsDate = datePattern.test(secondValue) && Number.isFinite(Date.parse(secondValue));
          const firstIsNumeric = numericPattern.test(firstValue);
          const secondIsNumeric = numericPattern.test(secondValue);
          let comparison;
          if (firstIsDate && secondIsDate) comparison = Date.parse(firstValue) - Date.parse(secondValue);
          else if (firstIsNumeric && secondIsNumeric) comparison = firstNumber - secondNumber;
          else comparison = firstValue.localeCompare(secondValue, undefined, { numeric: true, sensitivity: 'base' });
          return comparison * state.sortDirection;
        });
        for (const row of sortedRows) body.appendChild(row);
        table.querySelectorAll('.table-sort-button').forEach((button) => {
          button.closest('th').removeAttribute('aria-sort');
          button.dataset.direction = '';
        });
        header.setAttribute('aria-sort', state.sortDirection === 1 ? 'ascending' : 'descending');
        sortButton.dataset.direction = state.sortDirection === 1 ? 'ascending' : 'descending';
        state.page = 1;
        render();
      });
      header.replaceChildren(sortButton);
    });

    search.addEventListener('input', () => {
      state.page = 1;
      render();
    });
    pageSize.addEventListener('change', () => {
      state.page = 1;
      render();
    });
    previous.addEventListener('click', () => {
      state.page -= 1;
      render();
    });
    next.addEventListener('click', () => {
      state.page += 1;
      render();
    });

    const observer = new MutationObserver(() => render());
    observer.observe(body, { childList: true, subtree: true, characterData: true });
    state.observer = observer;
    tableStates.set(table, state);
    render();
  }

  function findTables(root) {
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (root.matches('table')) initializeTable(root);
    root.querySelectorAll('table').forEach(initializeTable);
  }

  findTables(content);
  const tableObserver = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) findTables(node);
    }
  });
  tableObserver.observe(content, { childList: true, subtree: true });
})();
