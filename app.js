// ================= KONFIGURASI URL APPS SCRIPT & GOOGLE CLIENT ID =================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxWEJ8rfi_18QdKJ8RWzjftTLsLEsW8ce4gN5o7B5E0nwpYYjOxj-M7tqNb-0aRzY37iQ/exec';
const GOOGLE_CLIENT_ID = '';

const WILAYAH_LIST = [
  'Gereja Induk Salib Putih',
  'Pepanthan Pandanan',
  'Pepanthan Warak',
  'Pepanthan Tetep',
  'Wilayah Kalibeji',
  'Unit Panti Wredha'
];

const JENIS_SURAT_LIST = [
  'Surat Keterangan Warga',
  'Surat Pengantar Nikah',
  'Surat Pengantar Baptis / Sidi',
  'Surat Atestasi Keluar',
  'Surat Keterangan Kematian',
  'Lainnya'
];

let currentUser = null;
let activeTab = 'dashboard';
let cache = { jemaat: [], users: [], surat: [], keuangan: [], warta: [] };

function renderIcons() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showToast(msg, isError = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = isError ? '#dc2626' : '#0f172a';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3800);
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================= HELPER OPSI "LAINNYA" PADA JENIS SURAT =================
function toggleJenisSuratInput(selectId, wrapperId, inputId) {
  const selectEl = document.getElementById(selectId);
  const wrapperEl = document.getElementById(wrapperId);
  const inputEl = document.getElementById(inputId);
  if (!selectEl || !wrapperEl || !inputEl) return;

  if (selectEl.value === 'Lainnya') {
    wrapperEl.classList.remove('hidden');
    inputEl.setAttribute('required', 'true');
    inputEl.focus();
  } else {
    wrapperEl.classList.add('hidden');
    inputEl.removeAttribute('required');
    inputEl.value = '';
  }
}

function resolveJenisSuratValue(selectId, inputId) {
  const selectVal = document.getElementById(selectId).value;
  if (selectVal === 'Lainnya') {
    return document.getElementById(inputId).value.trim();
  }
  return selectVal;
}

// ================= NAVIGASI LANDING, LOGIN & REGISTRASI =================
function toggleMobileNav() {
  const nav = document.getElementById('lpNavMenu');
  if (nav) nav.classList.toggle('open');
}

function closeMobileNav() {
  const nav = document.getElementById('lpNavMenu');
  if (nav) nav.classList.remove('open');
}

function showLandingView() {
  document.getElementById('landingView').classList.remove('hidden');
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appShell').classList.add('hidden');
  renderIcons();
}

function showLoginView() {
  document.getElementById('landingView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  switchAuthMode('login');
  initGoogleSignIn();
  renderIcons();
}

function showRegisterView() {
  document.getElementById('landingView').classList.add('hidden');
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
  switchAuthMode('register');
  renderIcons();
}

function switchAuthMode(mode) {
  const isLogin = mode === 'login';
  document.getElementById('tabBtnLogin').classList.toggle('active', isLogin);
  document.getElementById('tabBtnRegister').classList.toggle('active', !isLogin);
  document.getElementById('loginPanel').classList.toggle('hidden', !isLogin);
  document.getElementById('registerPanel').classList.toggle('hidden', isLogin);
  document.getElementById('authHeading').textContent = isLogin ? 'Portal Pelayanan Warga' : 'Registrasi Akun Warga';
  document.getElementById('authSubheading').textContent = isLogin
    ? 'Masuk menggunakan akun warga atau majelis GKJ Salib Putih'
    : 'Buat akun untuk mengajukan surat gerejawi & membaca arsip warta';
  renderIcons();
}

function initGoogleSignIn() {
  const wrapper = document.getElementById('googleBtnWrapper');
  if (!wrapper) return;
  if (!GOOGLE_CLIENT_ID) {
    wrapper.innerHTML = `<span style="font-size:11.5px;color:var(--muted);">Gunakan akun demo atau daftar akun warga baru di tab sebelah</span>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderIcons();
  const saved = localStorage.getItem('gkjsp_user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.username && parsed.nama && (parsed.role === 'admin' || parsed.role === 'jemaat')) {
        currentUser = parsed;
        initApp();
        return;
      }
    } catch (e) {}
    localStorage.removeItem('gkjsp_user');
  }
  showLandingView();
  loadLandingData();
});

async function loadLandingData() {
  const pill = document.getElementById('connectionStatus');
  const lpPill = document.getElementById('connectionStatusLanding');
  const grid = document.getElementById('landingWartaGrid');

  try {
    const res = await fetch(`${GAS_WEB_APP_URL}?action=getWarta`);
    const json = await res.json();
    if (json.success !== undefined) {
      if (pill) {
        pill.className = 'status-pill status-ok';
        pill.innerHTML = `<span class="status-dot"></span><span>Terhubung ke Google Sheets & Drive Live</span>`;
      }
      if (lpPill) {
        lpPill.innerHTML = `<span class="status-dot" style="background:#4ade80;"></span><span>Terhubung ke Layanan Digital GKJ Salib Putih</span>`;
      }
      const list = (json.data || []).slice(0, 3);
      if (grid) {
        grid.innerHTML = list.length ? list.map((w, idx) => `
          <div class="warta-card">
            <div class="warta-cover">
              ${idx === 0 ? `<span class="badge-terbaru">Terbaru</span>` : ''}
              <img src="${w.thumbnailUrl}" alt="${w.namaFile}" onerror="this.src='https://placehold.co/400x520/e2e8f0/1e3a8a?text=Warta+GKJSP'">
            </div>
            <div class="warta-body">
              <div class="warta-title">${w.namaFile}</div>
              <div class="warta-date">${w.updatedAt} (${w.bulan})</div>
              <div class="warta-actions">
                <button type="button" class="btn-buka" onclick="previewPdf('${w.previewUrl}', '${w.namaFile}')">
                  <i data-lucide="book-open" class="icon-sm"></i>
                  <span>Baca Warta</span>
                </button>
                <a href="${w.downloadUrl}" target="_blank" class="btn-unduh" title="Unduh PDF">
                  <i data-lucide="download" class="icon-sm"></i>
                </a>
              </div>
            </div>
          </div>
        `).join('') : '<div class="card">Belum ada edisi Warta Jemaat yang dipublikasikan.</div>';
        renderIcons();
      }
    }
  } catch (e) {
    if (pill) {
      pill.className = 'status-pill status-err';
      pill.innerHTML = `<span class="status-dot"></span><span>Gagal terhubung — periksa URL Web App di app.js</span>`;
    }
    if (lpPill) {
      lpPill.innerHTML = `<span class="status-dot" style="background:#f87171;"></span><span>Koneksi server tertunda</span>`;
    }
  }
}

// ================= PROSES LOGIN & REGISTRASI MANDIRI (MENUNGGU ACC ADMIN) =================
async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();

  const btn = document.getElementById('btnLogin');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) {
    showToast('Harap isi Username dan Kata Sandi.', true);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Memverifikasi akun...</span>';

  try {
    const res = await apiPost({ action: 'login', username, password });

    if (res.success && res.user) {
      currentUser = res.user;
      localStorage.setItem('gkjsp_user', JSON.stringify(currentUser));
      initApp();
    } else {
      showToast(res.message || 'Username atau kata sandi salah.', true);
    }
  } catch (err) {
    showToast('Gagal terhubung ke server Google Apps Script.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in" class="icon-sm"></i><span>Masuk ke Sistem</span>';
    renderIcons();
  }
}

async function handleRegister(e) {
  if (e && e.preventDefault) e.preventDefault();

  const btn = document.getElementById('btnRegister');
  const nama = document.getElementById('regNama')?.value.trim() || '';
  const wilayah = document.getElementById('regWilayah')?.value || 'Gereja Induk Salib Putih';
  const noInduk = document.getElementById('regNoInduk')?.value.trim() || '';
  const username = document.getElementById('regUsername')?.value.trim() || '';
  const password = document.getElementById('regPassword')?.value.trim() || '';

  if (!nama || !username || password.length < 3) {
    showToast('Nama, username, dan kata sandi (min. 3 karakter) wajib diisi.', true);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span>Mengirim pendaftaran...</span>';

  try {
    const json = await apiPost({
      action: 'registerJemaat',
      nama,
      wilayah,
      noInduk,
      username,
      password
    });

    if (json.success) {
      document.getElementById('registerForm').reset();
      switchAuthMode('login');
      document.getElementById('loginUsername').value = username;
      showToast(json.message || 'Pendaftaran berhasil! Silakan tunggu ACC dari Admin/Majelis.');
      alert('Pendaftaran Berhasil!\n\nAkun Anda ("' + username + '") telah masuk ke daftar verifikasi Sekretariat / Majelis Gereja. Silakan coba login kembali setelah akun di-ACC oleh Admin.');
    } else {
      showToast(json.message || 'Gagal mendaftar.', true);
    }
  } catch (err) {
    showToast('Error: ' + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="user-plus" class="icon-sm"></i><span>Ajukan Pendaftaran Akun</span>';
    renderIcons();
  }
}

function logout() {
  localStorage.removeItem('gkjsp_user');
  currentUser = null;
  showLandingView();
  loadLandingData();
}

// ================= INISIALISASI DASHBOARD =================
function initApp() {
  document.getElementById('landingView').classList.add('hidden');
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  const isAdmin = currentUser.role === 'admin';
  document.getElementById('roleBadgeSidebar').textContent = isAdmin ? 'Admin / Majelis' : 'Portal Warga Jemaat';
  document.getElementById('userNameDisplay').textContent = currentUser.nama;
  document.getElementById('userWilayahDisplay').textContent = currentUser.wilayah;

  const menus = isAdmin ? [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'jemaat', label: 'Data Jemaat', icon: 'users' },
    { id: 'surat', label: 'Layanan Surat', icon: 'file-text' },
    { id: 'keuangan', label: 'Keuangan Gereja', icon: 'wallet' },
    { id: 'warta', label: 'Warta Jemaat', icon: 'book-open' },
    { id: 'users', label: 'Manajemen Akun', icon: 'shield-check' }
  ] : [
    { id: 'dashboard', label: 'Beranda Warga', icon: 'layout-dashboard' },
    { id: 'jemaat', label: 'Data Jemaat', icon: 'users' },
    { id: 'surat', label: 'Pengajuan Surat', icon: 'file-plus' },
    { id: 'warta', label: 'Warta Jemaat', icon: 'book-open' },
    { id: 'keuangan', label: 'Laporan Keuangan', icon: 'wallet' }
  ];

  document.getElementById('sidebarNav').innerHTML = menus.map(m => `
    <button type="button" class="nav-item" data-tab="${m.id}" onclick="switchTab('${m.id}')">
      <i data-lucide="${m.icon}" class="icon-sm"></i>
      <span>${m.label}</span>
    </button>
  `).join('');

  document.getElementById('bottomNav').innerHTML = menus.slice(0, 5).map(m => `
    <button type="button" data-tab="${m.id}" onclick="switchTab('${m.id}')">
      <i data-lucide="${m.icon}" class="icon-sm"></i>
      <span>${m.label.split(' ')[0]}</span>
    </button>
  `).join('');

  switchTab('dashboard');
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabId);
  });

  const titles = {
    dashboard: ['Dashboard Utama', 'Ringkasan Pelayanan & Administrasi GKJ Salib Putih'],
    jemaat: ['Buku Induk & Data Jemaat', 'Direktori warga jemaat seluruh wilayah & pepanthan'],
    surat: ['Layanan Administrasi Surat', 'Pengajuan, verifikasi, dan arsip surat keterangan gerejawi'],
    keuangan: ['Laporan Keuangan Gereja', 'Transparansi pemasukan persembahan & pengeluaran bidang'],
    warta: ['Warta Jemaat & Tata Ibadah', 'Arsip digital Warta Jemaat GKJ Salib Putih'],
    users: ['Manajemen Akun & Verifikasi', 'ACC pendaftaran warga baru dan kelola akun pengguna']
  };
  document.getElementById('pageTitle').textContent = titles[tabId][0];
  document.getElementById('pageDesc').textContent = titles[tabId][1];
  refreshCurrentTab();
}

async function apiGet(action) {
  const res = await fetch(`${GAS_WEB_APP_URL}?action=${action}`);
  return await res.json();
}

async function apiPost(payload) {
  const res = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Respon server tidak valid. Pastikan Web App Google Apps Script sudah di-deploy ulang (New Version).');
  }
}

async function refreshCurrentTab() {
  const container = document.getElementById('contentContainer');
  container.innerHTML = `<div class="card">Memuat data terbaru dari server...</div>`;

  try {
    if (activeTab === 'dashboard') await renderDashboard(container);
    else if (activeTab === 'jemaat') await renderJemaat(container);
    else if (activeTab === 'surat') await renderSurat(container);
    else if (activeTab === 'keuangan') await renderKeuangan(container);
    else if (activeTab === 'warta') await renderWarta(container);
    else if (activeTab === 'users') await renderUsers(container);
    renderIcons();
  } catch (err) {
    container.innerHTML = `<div class="card">Terjadi kesalahan saat memuat data: ${err.message}</div>`;
  }
}

// ================= 1. DASHBOARD =================
async function renderDashboard(container) {
  const isAdmin = currentUser.role === 'admin';
  const requests = [
    apiGet('getJemaat'),
    apiGet('getSurat'),
    apiGet('getKeuangan'),
    apiGet('getWarta')
  ];
  if (isAdmin) requests.push(apiGet('getUsers'));

  const [resJemaat, resSurat, resKeu, resWarta, resUsers] = await Promise.all(requests);
  cache.jemaat = resJemaat.data || [];
  cache.surat = resSurat.data || [];
  cache.keuangan = resKeu.data || [];
  cache.warta = resWarta.data || [];
  if (isAdmin && resUsers) cache.users = resUsers.data || [];

  const totalIn = cache.keuangan.filter(k => k.jenis === 'Pemasukan').reduce((a, b) => a + Number(b.nominal), 0);
  const totalOut = cache.keuangan.filter(k => k.jenis === 'Pengeluaran').reduce((a, b) => a + Number(b.nominal), 0);
  const saldo = totalIn - totalOut;
  const suratProses = cache.surat.filter(s => s.status === 'Proses').length;
  const pendingUsersCount = isAdmin ? cache.users.filter(u => (u.status || '').toLowerCase() === 'pending').length : 0;

  const wilayahCounts = WILAYAH_LIST.map(w => ({
    nama: w,
    jumlah: cache.jemaat.filter(j => j.wilayah === w).length
  }));
  const maxW = Math.max(...wilayahCounts.map(w => w.jumlah), 1);

  const latestWartaList = cache.warta.slice(0, 3);

  container.innerHTML = `
    ${isAdmin && pendingUsersCount > 0 ? `
      <div style="background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:14px 18px;border-radius:14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <i data-lucide="user-check" class="icon-md"></i>
          <div>
            <strong>Ada ${pendingUsersCount} Pendaftaran Akun Warga Menunggu ACC!</strong>
            <div style="font-size:12.5px;">Segera verifikasi agar warga jemaat dapat masuk dan menggunakan layanan surat.</div>
          </div>
        </div>
        <button type="button" class="btn-primary btn-sm" onclick="switchTab('users')">Verifikasi Sekarang →</button>
      </div>
    ` : ''}

    <div class="hero-banner">
      <div>
        <span class="hero-tag">${isAdmin ? 'Panel Majelis & Sekretariat' : 'Portal Warga Jemaat'}</span>
        <h3>Sugeng Rawuh, ${currentUser.nama}</h3>
        <p>${currentUser.wilayah} • Nomor Induk: ${currentUser.noInduk || '-'}</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" class="btn-banner-white" onclick="switchTab('surat')">
          <i data-lucide="file-plus" class="icon-sm"></i>
          <span>${isAdmin ? 'Kelola Surat' : 'Ajukan Surat'}</span>
        </button>
        <button type="button" class="btn-banner-white" onclick="switchTab('warta')">
          <i data-lucide="book-open" class="icon-sm"></i>
          <span>Arsip Warta</span>
        </button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-icon kpi-blue"><i data-lucide="users" class="icon-md"></i></div>
        <div>
          <div class="kpi-label">Total Warga Jemaat</div>
          <div class="kpi-value">${cache.jemaat.length} Jiwa</div>
          <div class="kpi-sub">Tersebar di 6 Wilayah & Pepanthan</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-amber"><i data-lucide="file-clock" class="icon-md"></i></div>
        <div>
          <div class="kpi-label">Permohonan Surat</div>
          <div class="kpi-value">${suratProses} Proses</div>
          <div class="kpi-sub">Total ${cache.surat.length} pengajuan tercatat</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-emerald"><i data-lucide="wallet" class="icon-md"></i></div>
        <div>
          <div class="kpi-label">Saldo Kas Gereja</div>
          <div class="kpi-value">${formatRupiah(saldo)}</div>
          <div class="kpi-sub">Masuk: ${formatRupiah(totalIn)}</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon kpi-rose"><i data-lucide="book-open" class="icon-md"></i></div>
        <div>
          <div class="kpi-label">Edisi Warta Jemaat</div>
          <div class="kpi-value">${cache.warta.length} Edisi</div>
          <div class="kpi-sub">Tersimpan di Arsip Google Drive</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-header">
        <div>
          <h3>Warta Jemaat Terbaru</h3>
          <p style="font-size:12.5px;color:var(--muted);margin-top:2px;">Edisi Warta Jemaat & Tata Ibadah terkini yang baru diunggah ke sistem</p>
        </div>
        <button type="button" class="link-more" onclick="switchTab('warta')">Lihat Semua Warta →</button>
      </div>
      <div class="warta-grid">
        ${latestWartaList.length ? latestWartaList.map((w, idx) => `
          <div class="warta-card">
            <div class="warta-cover">
              ${idx === 0 ? `<span class="badge-terbaru">Terbaru</span>` : ''}
              <img src="${w.thumbnailUrl}" alt="${w.namaFile}" onerror="this.src='https://placehold.co/400x520/e2e8f0/1e3a8a?text=Warta+GKJSP'">
            </div>
            <div class="warta-body">
              <div class="warta-title">${w.namaFile}</div>
              <div class="warta-date">${w.updatedAt} (${w.bulan})</div>
              <div class="warta-actions">
                <button type="button" class="btn-buka" onclick="previewPdf('${w.previewUrl}', '${w.namaFile}')">
                  <i data-lucide="book-open" class="icon-sm"></i><span>Baca Warta</span>
                </button>
                <a href="${w.downloadUrl}" target="_blank" class="btn-unduh" title="Unduh PDF">
                  <i data-lucide="download" class="icon-sm"></i>
                </a>
              </div>
            </div>
          </div>
        `).join('') : '<p style="font-size:13px;color:var(--muted);">Belum ada edisi Warta Jemaat yang tersedia.</p>'}
      </div>
    </div>

    <div class="dash-grid-2">
      <div class="card">
        <div class="card-header">
          <h3>Sebaran Jemaat per Wilayah & Pepanthan</h3>
          <button type="button" class="link-more" onclick="switchTab('jemaat')">Lihat Data Jemaat →</button>
        </div>
        ${wilayahCounts.map(w => `
          <div class="wilayah-row">
            <div class="wilayah-meta"><span>${w.nama}</span><span>${w.jumlah} Jiwa</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${Math.round((w.jumlah / maxW) * 100)}%"></div></div>
          </div>
        `).join('')}
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Permohonan Surat Terbaru</h3>
          <button type="button" class="link-more" onclick="switchTab('surat')">Semua Surat →</button>
        </div>
        <div class="activity-list">
          ${cache.surat.slice(0, 4).map(s => `
            <div class="activity-item">
              <div>
                <strong>${s.jenisSurat}</strong>
                <span>${s.pemohon} • ${s.tanggal}</span>
              </div>
              <span class="badge ${s.status === 'Selesai' ? 'badge-selesai' : (s.status === 'Ditolak' ? 'badge-ditolak' : 'badge-proses')}">${s.status}</span>
            </div>
          `).join('') || '<p style="font-size:13px;color:var(--muted);">Belum ada permohonan surat.</p>'}
        </div>
      </div>
    </div>
  `;
}

// ================= HELPER KOMPONEN SEARCH BAR & DETAIL VIEW =================
function renderSearchBar(inputId, placeholder, handlerName) {
  return `
    <div class="search-toolbar">
      <div class="search-input-wrap">
        <i data-lucide="search" class="icon-sm"></i>
        <input type="text" id="${inputId}" class="search-input" placeholder="${placeholder}"
          oninput="${handlerName}()" onkeyup="if(event.key==='Enter') ${handlerName}()" />
      </div>
      <button type="button" class="btn-search" onclick="${handlerName}()">
        <i data-lucide="search" class="icon-sm"></i>
        <span>Cari</span>
      </button>
      <button type="button" class="btn-reset-search" onclick="resetSearch('${inputId}', ${handlerName})">Reset</button>
    </div>
  `;
}

function resetSearch(inputId, handlerFn) {
  const el = document.getElementById(inputId);
  if (el) {
    el.value = '';
    handlerFn();
  }
}

function renderDetailTable(rows) {
  return `
    <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:14px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${rows.map(([label, val]) => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="width:38%;background:#f8fafc;font-weight:700;color:#475569;font-size:12.5px;padding:10px 12px;">${label}</td>
              <td style="font-size:13px;color:#0f172a;padding:10px 12px;">${val || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ================= 2. DATA JEMAAT =================
async function renderJemaat(container) {
  const res = await apiGet('getJemaat');
  cache.jemaat = res.data || [];
  const isAdmin = currentUser.role === 'admin';

  if (!isAdmin) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3>Direktori Warga Jemaat (${cache.jemaat.length} Jiwa)</h3>
            <p style="font-size:12.5px;color:var(--muted);margin-top:2px;">Menampilkan nama dan wilayah pelayanan warga GKJ Salib Putih</p>
          </div>
        </div>
        ${renderSearchBar('searchJemaatInput', 'Cari nama warga atau wilayah / pepanthan...', 'filterJemaat')}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:60px;">No.</th>
                <th>Nama Warga Jemaat</th>
                <th>Wilayah / Pepanthan</th>
              </tr>
            </thead>
            <tbody id="jemaatTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    filterJemaat();
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Daftar Warga Jemaat (${cache.jemaat.length} Jiwa)</h3>
        <button type="button" class="btn-primary" onclick="openJemaatModal()">
          <i data-lucide="user-plus" class="icon-sm"></i><span>Tambah Jemaat</span>
        </button>
      </div>
      ${renderSearchBar('searchJemaatInput', 'Cari nama, no. induk, no. KK, wilayah, atau alamat...', 'filterJemaat')}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>No. Induk</th><th>Nama Lengkap</th><th>L/P</th><th>Wilayah</th><th>Baptis / Sidi</th><th>No. HP</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody id="jemaatTableBody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterJemaat();
}

function filterJemaat() {
  const tbody = document.getElementById('jemaatTableBody');
  if (!tbody) return;
  const q = (document.getElementById('searchJemaatInput')?.value || '').trim().toLowerCase();
  const isAdmin = currentUser.role === 'admin';

  const filtered = cache.jemaat.filter(j => {
    if (!q) return true;
    if (!isAdmin) return `${j.nama} ${j.wilayah}`.toLowerCase().includes(q);
    return `${j.noInduk} ${j.noKK} ${j.nama} ${j.wilayah} ${j.statusBaptisSidi} ${j.noHP} ${j.alamat}`.toLowerCase().includes(q);
  });

  if (!isAdmin) {
    tbody.innerHTML = filtered.map((j, index) => `
      <tr>
        <td><strong>#${index + 1}</strong></td>
        <td><strong>${j.nama}</strong></td>
        <td>${j.wilayah}</td>
      </tr>
    `).join('') || '<tr><td colspan="3">Data warga jemaat tidak ditemukan.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(j => `
    <tr>
      <td><strong>${j.noInduk}</strong><br><small style="color:var(--muted)">${j.noKK || ''}</small></td>
      <td><strong>${j.nama}</strong><br><small style="color:var(--muted)">${j.alamat || ''}</small></td>
      <td>${j.jenisKelamin}</td>
      <td>${j.wilayah}</td>
      <td>${j.statusBaptisSidi}</td>
      <td>${j.noHP || '-'}</td>
      <td style="white-space:nowrap;">
        <div class="action-group">
          <button type="button" class="btn-outline btn-sm" onclick="viewJemaatDetail('${j.noInduk}')">Detail</button>
          <button type="button" class="btn-outline btn-sm" onclick="openJemaatModal('${j.noInduk}')">Edit</button>
          <button type="button" class="btn-danger" onclick="hapusJemaat('${j.noInduk}')">Hapus</button>
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7">Data jemaat tidak ditemukan.</td></tr>';
}

function viewJemaatDetail(noInduk) {
  const j = cache.jemaat.find(x => x.noInduk === noInduk);
  if (!j) return;
  openModal('Detail Data Warga Jemaat', `
    ${renderDetailTable([
      ['Nomor Induk Jemaat', `<strong>${j.noInduk}</strong>`],
      ['Nomor KK Gereja', j.noKK],
      ['Nama Lengkap', `<strong>${j.nama}</strong>`],
      ['Jenis Kelamin', j.jenisKelamin === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'],
      ['Tempat, Tanggal Lahir', j.tempatTglLahir],
      ['Wilayah / Pepanthan', j.wilayah],
      ['Status Sakramen', j.statusBaptisSidi],
      ['Status Keanggotaan', `<span class="badge badge-selesai">${j.statusKeanggotaan || 'Aktif'}</span>`],
      ['No. HP / WhatsApp', j.noHP],
      ['Alamat Lengkap', j.alamat]
    ])}
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button type="button" class="btn-outline" onclick="closeModal()">Tutup</button>
      <button type="button" class="btn-primary" onclick="openJemaatModal('${j.noInduk}')">Edit Data Ini</button>
    </div>
  `);
}

function openJemaatModal(noInduk = null) {
  const j = noInduk ? cache.jemaat.find(x => x.noInduk === noInduk) : {};
  openModal(noInduk ? 'Edit Data Jemaat' : 'Tambah Data Jemaat Baru', `
    <form onsubmit="submitJemaat(event, '${noInduk || ''}')">
      <div class="input-group"><label>Nomor KK Gereja</label><input id="jmKK" value="${j.noKK || 'KK-GKJSP-'}" required></div>
      <div class="input-group"><label>Nama Lengkap</label><input id="jmNama" value="${j.nama || ''}" required></div>
      <div class="input-group"><label>Jenis Kelamin</label>
        <select id="jmJK">
          <option value="L" ${j.jenisKelamin === 'L' ? 'selected' : ''}>Laki-laki (L)</option>
          <option value="P" ${j.jenisKelamin === 'P' ? 'selected' : ''}>Perempuan (P)</option>
        </select>
      </div>
      <div class="input-group"><label>Tempat, Tanggal Lahir</label><input id="jmTTL" value="${j.tempatTglLahir || ''}" placeholder="Salatiga, 12 Mei 1985"></div>
      <div class="input-group"><label>Wilayah / Pepanthan</label>
        <select id="jmWilayah">${WILAYAH_LIST.map(w => `<option value="${w}" ${j.wilayah === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Status Sakramen</label>
        <select id="jmBaptis">
          <option value="Baptis & Sidi" ${j.statusBaptisSidi === 'Baptis & Sidi' ? 'selected' : ''}>Baptis & Sidi</option>
          <option value="Baptis Anak" ${j.statusBaptisSidi === 'Baptis Anak' ? 'selected' : ''}>Baptis Anak</option>
          <option value="Simpatisan" ${j.statusBaptisSidi === 'Simpatisan' ? 'selected' : ''}>Simpatisan</option>
        </select>
      </div>
      <div class="input-group"><label>Status Keanggotaan</label>
        <select id="jmStatusAnggota">
          <option value="Aktif" ${(j.statusKeanggotaan || 'Aktif') === 'Aktif' ? 'selected' : ''}>Aktif</option>
          <option value="Pindah / Atestasi" ${j.statusKeanggotaan === 'Pindah / Atestasi' ? 'selected' : ''}>Pindah / Atestasi</option>
          <option value="Meninggal Dunia" ${j.statusKeanggotaan === 'Meninggal Dunia' ? 'selected' : ''}>Meninggal Dunia</option>
        </select>
      </div>
      <div class="input-group"><label>No. HP / WhatsApp</label><input id="jmHP" value="${j.noHP || ''}"></div>
      <div class="input-group"><label>Alamat Lengkap</label><textarea id="jmAlamat" rows="2">${j.alamat || ''}</textarea></div>
      <button type="submit" class="btn-primary btn-full">Simpan Data Jemaat</button>
    </form>
  `);
}

async function submitJemaat(e, noInduk) {
  e.preventDefault();
  const payload = {
    action: noInduk ? 'updateJemaat' : 'addJemaat',
    noInduk,
    noKK: document.getElementById('jmKK').value,
    nama: document.getElementById('jmNama').value,
    jenisKelamin: document.getElementById('jmJK').value,
    tempatTglLahir: document.getElementById('jmTTL').value,
    wilayah: document.getElementById('jmWilayah').value,
    statusBaptisSidi: document.getElementById('jmBaptis').value,
    statusKeanggotaan: document.getElementById('jmStatusAnggota').value,
    noHP: document.getElementById('jmHP').value,
    alamat: document.getElementById('jmAlamat').value
  };
  const res = await apiPost(payload);
  if (res.success) {
    closeModal();
    showToast('Data jemaat berhasil disimpan.');
    refreshCurrentTab();
  } else showToast(res.message || 'Gagal menyimpan.', true);
}

async function hapusJemaat(noInduk) {
  if (!confirm('Hapus data jemaat ' + noInduk + '?')) return;
  const res = await apiPost({ action: 'deleteJemaat', noInduk });
  if (res.success) { showToast('Data jemaat dihapus.'); refreshCurrentTab(); }
}

// ================= 3. LAYANAN SURAT (OPSI "LAINNYA" + KETIK MANUAL) =================
async function renderSurat(container) {
  const res = await apiGet('getSurat');
  const all = res.data || [];
  const isAdmin = currentUser.role === 'admin';
  cache.surat = isAdmin ? all : all.filter(s => s.pemohon === currentUser.nama || (currentUser.noInduk !== '-' && s.noInduk === currentUser.noInduk));

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>${isAdmin ? 'Daftar Permohonan Surat Jemaat' : 'Riwayat Pengajuan Surat Saya'}</h3>
        <button type="button" class="btn-primary" onclick="openSuratModal()">
          <i data-lucide="file-plus" class="icon-sm"></i><span>Ajukan Surat Baru</span>
        </button>
      </div>
      ${renderSearchBar('searchSuratInput', 'Cari ID surat, pemohon, jenis surat, tujuan, atau status...', 'filterSurat')}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID & Tgl</th><th>Pemohon</th><th>Jenis Surat</th><th>Tujuan</th><th>Berkas</th><th>Status</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody id="suratTableBody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterSurat();
}

function filterSurat() {
  const tbody = document.getElementById('suratTableBody');
  if (!tbody) return;
  const q = (document.getElementById('searchSuratInput')?.value || '').trim().toLowerCase();
  const isAdmin = currentUser.role === 'admin';

  const filtered = cache.surat.filter(s =>
    !q || `${s.idSurat} ${s.pemohon} ${s.wilayah} ${s.jenisSurat} ${s.tujuanSurat} ${s.status} ${s.tanggal}`.toLowerCase().includes(q)
  );

  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td><strong>${s.idSurat}</strong><br><small style="color:var(--muted)">${s.tanggal}</small></td>
      <td><strong>${s.pemohon}</strong><br><small style="color:var(--muted)">${s.wilayah}</small></td>
      <td>${s.jenisSurat}</td>
      <td>${s.tujuanSurat}</td>
      <td>
        ${s.berkasPendukungUrl ? `<button type="button" class="link-more" onclick="previewPdf('${s.berkasPendukungUrl}', 'Berkas Pendukung ${s.idSurat}')">Lihat Berkas</button><br>` : ''}
        ${s.arsipSuratUrl ? `<button type="button" class="link-more" style="color:var(--success)" onclick="previewPdf('${s.arsipSuratUrl}', 'Surat Resmi ${s.idSurat}')">Surat Resmi PDF</button>` : (!s.berkasPendukungUrl ? '-' : '')}
      </td>
      <td><span class="badge ${s.status === 'Selesai' ? 'badge-selesai' : (s.status === 'Ditolak' ? 'badge-ditolak' : 'badge-proses')}">${s.status}</span></td>
      <td style="white-space:nowrap;">
        <div class="action-group">
          <button type="button" class="btn-outline btn-sm" onclick="viewSuratDetail('${s.idSurat}')">Detail</button>
          ${isAdmin ? `<button type="button" class="btn-outline btn-sm" onclick="openSuratAdminModal('${s.idSurat}')">Edit / Proses</button>` : ''}
          ${isAdmin ? `<button type="button" class="btn-danger" onclick="hapusSurat('${s.idSurat}')">Hapus</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7">Data permohonan surat tidak ditemukan.</td></tr>';
}

function viewSuratDetail(idSurat) {
  const s = cache.surat.find(x => x.idSurat === idSurat);
  if (!s) return;
  const isAdmin = currentUser.role === 'admin';
  openModal('Detail Permohonan Surat ' + s.idSurat, `
    ${renderDetailTable([
      ['ID Permohonan', `<strong>${s.idSurat}</strong>`],
      ['Tanggal Pengajuan', s.tanggal],
      ['Nama Pemohon', `<strong>${s.pemohon}</strong>`],
      ['Nomor Induk Jemaat', s.noInduk],
      ['Wilayah / Pepanthan', s.wilayah],
      ['Jenis Surat', s.jenisSurat],
      ['Instansi / Gereja Tujuan', s.tujuanSurat],
      ['Alamat Tujuan', s.alamatTujuan],
      ['No. WhatsApp Aktif', s.noWA],
      ['Status Permohonan', `<span class="badge ${s.status === 'Selesai' ? 'badge-selesai' : (s.status === 'Ditolak' ? 'badge-ditolak' : 'badge-proses')}">${s.status}</span>`],
      ['Lampiran Pemohon', s.berkasPendukungUrl ? `<button type="button" class="btn-outline btn-sm" onclick="previewPdf('${s.berkasPendukungUrl}', 'Berkas ${s.idSurat}')">Buka Berkas Pendukung</button>` : 'Tidak ada lampiran'],
      ['Arsip Surat Resmi', s.arsipSuratUrl ? `<button type="button" class="btn-primary btn-sm" onclick="previewPdf('${s.arsipSuratUrl}', 'Surat Resmi ${s.idSurat}')">Buka Surat Resmi PDF</button>` : 'Belum diterbitkan']
    ])}
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button type="button" class="btn-outline" onclick="closeModal()">Tutup</button>
      ${isAdmin ? `<button type="button" class="btn-primary" onclick="openSuratAdminModal('${s.idSurat}')">Edit / Proses Surat</button>` : ''}
    </div>
  `);
}

function openSuratModal() {
  openModal('Form Pengajuan Surat Gerejawi', `
    <form onsubmit="submitSuratBaru(event)">
      <div class="input-group"><label>Nama Pemohon</label><input id="srPemohon" value="${currentUser.nama}" required></div>
      <div class="input-group"><label>Nomor Induk Jemaat</label><input id="srNoInduk" value="${currentUser.noInduk || ''}"></div>
      <div class="input-group"><label>Wilayah / Pepanthan</label>
        <select id="srWilayah">${WILAYAH_LIST.map(w => `<option value="${w}" ${currentUser.wilayah === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Jenis Surat</label>
        <select id="srJenis" onchange="toggleJenisSuratInput('srJenis', 'srJenisLainnyaWrap', 'srJenisLainnya')">
          ${JENIS_SURAT_LIST.map(j => `<option value="${j}">${j === 'Lainnya' ? 'Lainnya (Ketik manual...)' : j}</option>`).join('')}
        </select>
      </div>
      <div id="srJenisLainnyaWrap" class="input-group hidden">
        <label>Tulis Jenis Surat yang Dibutuhkan</label>
        <input type="text" id="srJenisLainnya" placeholder="Contoh: Surat Keterangan Belum Menikah / Surat Rekomendasi">
      </div>
      <div class="input-group"><label>Instansi / Gereja Tujuan</label><input id="srTujuan" placeholder="Contoh: Majelis GKJ Salatiga / KUA" required></div>
      <div class="input-group"><label>Alamat Tujuan</label><input id="srAlamat" placeholder="Alamat instansi tujuan"></div>
      <div class="input-group"><label>No. WhatsApp Aktif</label><input id="srWA" placeholder="0812..." required></div>
      <div class="input-group">
        <label>Upload Berkas Pendukung (KTP/KK/Surat Baptis - PDF/JPG/PNG, Maks. 5 MB)</label>
        <input type="file" id="srFile" accept=".pdf,image/*">
      </div>
      <button type="submit" id="btnSubmitSurat" class="btn-primary btn-full">Kirim Permohonan Surat</button>
    </form>
  `);
}

async function submitSuratBaru(e) {
  e.preventDefault();
  const jenisSuratFinal = resolveJenisSuratValue('srJenis', 'srJenisLainnya');
  if (!jenisSuratFinal) {
    showToast('Harap isi jenis surat yang dibutuhkan.', true);
    return;
  }

  const btn = document.getElementById('btnSubmitSurat');
  const fileInput = document.getElementById('srFile');
  let berkasBase64 = '', berkasName = '', berkasMime = '';

  if (fileInput.files && fileInput.files[0]) {
    const f = fileInput.files[0];
    if (f.size > 5 * 1024 * 1024) {
      showToast('Ukuran berkas terlalu besar (maksimal 5 MB).', true);
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Mengunggah berkas ke Google Drive...';
    berkasBase64 = await fileToBase64(f);
    berkasName = f.name;
    berkasMime = f.type || 'application/pdf';
  } else {
    btn.disabled = true;
    btn.textContent = 'Mengirim permohonan...';
  }

  try {
    const res = await apiPost({
      action: 'addSurat',
      pemohon: document.getElementById('srPemohon').value,
      noInduk: document.getElementById('srNoInduk').value,
      wilayah: document.getElementById('srWilayah').value,
      jenisSurat: jenisSuratFinal,
      tujuanSurat: document.getElementById('srTujuan').value,
      alamatTujuan: document.getElementById('srAlamat').value,
      noWA: document.getElementById('srWA').value,
      berkasBase64,
      berkasName,
      berkasMime,
      status: 'Proses'
    });

    if (res.success) {
      closeModal();
      showToast('Permohonan surat & berkas berhasil dikirim.');
      refreshCurrentTab();
    } else {
      throw new Error(res.message || 'Gagal mengirim permohonan.');
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Kirim Permohonan Surat';
    showToast(err.message, true);
  }
}

function openSuratAdminModal(idSurat) {
  const s = cache.surat.find(x => x.idSurat === idSurat);
  if (!s) return;

  const opsiStandar = JENIS_SURAT_LIST.filter(j => j !== 'Lainnya');
  const isCustomJenis = s.jenisSurat && !opsiStandar.includes(s.jenisSurat);

  openModal('Edit & Proses Surat ' + idSurat, `
    <form onsubmit="submitUpdateSurat(event, '${idSurat}')">
      <div class="input-group"><label>Nama Pemohon</label><input id="admSrPemohon" value="${s.pemohon}" required></div>
      <div class="input-group"><label>Nomor Induk Jemaat</label><input id="admSrNoInduk" value="${s.noInduk || ''}"></div>
      <div class="input-group"><label>Wilayah / Pepanthan</label>
        <select id="admSrWilayah">${WILAYAH_LIST.map(w => `<option value="${w}" ${s.wilayah === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Jenis Surat</label>
        <select id="admSrJenis" onchange="toggleJenisSuratInput('admSrJenis', 'admSrJenisLainnyaWrap', 'admSrJenisLainnya')">
          ${JENIS_SURAT_LIST.map(j => {
            const isSelected = (j === 'Lainnya' && isCustomJenis) || (!isCustomJenis && s.jenisSurat === j);
            return `<option value="${j}" ${isSelected ? 'selected' : ''}>${j === 'Lainnya' ? 'Lainnya (Ketik manual...)' : j}</option>`;
          }).join('')}
        </select>
      </div>
      <div id="admSrJenisLainnyaWrap" class="input-group ${isCustomJenis ? '' : 'hidden'}">
        <label>Tulis Jenis Surat (Manual)</label>
        <input type="text" id="admSrJenisLainnya" value="${isCustomJenis ? s.jenisSurat : ''}" ${isCustomJenis ? 'required' : ''} placeholder="Masukkan jenis surat...">
      </div>
      <div class="input-group"><label>Instansi / Gereja Tujuan</label><input id="admSrTujuan" value="${s.tujuanSurat || ''}" required></div>
      <div class="input-group"><label>Alamat Tujuan</label><input id="admSrAlamat" value="${s.alamatTujuan || ''}"></div>
      <div class="input-group"><label>No. WhatsApp</label><input id="admSrWA" value="${s.noWA || ''}"></div>
      <div class="input-group"><label>Status Permohonan</label>
        <select id="admSrStatus">
          <option value="Proses" ${s.status === 'Proses' ? 'selected' : ''}>Proses</option>
          <option value="Selesai" ${s.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
          <option value="Ditolak" ${s.status === 'Ditolak' ? 'selected' : ''}>Ditolak</option>
        </select>
      </div>
      <div class="input-group"><label>Unggah PDF Surat Resmi (Opsional)</label><input type="file" id="admSrPdf" accept=".pdf"></div>
      <button type="submit" id="btnUpdSurat" class="btn-primary btn-full">Simpan Perubahan Surat</button>
    </form>
  `);
}

async function submitUpdateSurat(e, idSurat) {
  e.preventDefault();
  const jenisSuratFinal = resolveJenisSuratValue('admSrJenis', 'admSrJenisLainnya');
  if (!jenisSuratFinal) {
    showToast('Harap isi jenis surat.', true);
    return;
  }

  const btn = document.getElementById('btnUpdSurat');
  btn.disabled = true; btn.textContent = 'Menyimpan perubahan...';

  const fileInput = document.getElementById('admSrPdf');
  let arsipBase64 = '', arsipFileName = '';
  if (fileInput.files && fileInput.files[0]) {
    arsipBase64 = await fileToBase64(fileInput.files[0]);
    arsipFileName = fileInput.files[0].name;
  }

  try {
    const res = await apiPost({
      action: 'updateSurat',
      idSurat,
      pemohon: document.getElementById('admSrPemohon').value,
      noInduk: document.getElementById('admSrNoInduk').value,
      wilayah: document.getElementById('admSrWilayah').value,
      jenisSurat: jenisSuratFinal,
      tujuanSurat: document.getElementById('admSrTujuan').value,
      alamatTujuan: document.getElementById('admSrAlamat').value,
      noWA: document.getElementById('admSrWA').value,
      status: document.getElementById('admSrStatus').value,
      arsipBase64,
      arsipFileName
    });

    if (res.success) {
      closeModal();
      showToast('Data & status surat diperbarui.');
      refreshCurrentTab();
    } else {
      throw new Error(res.message || 'Gagal memperbarui surat.');
    }
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Simpan Perubahan Surat';
    showToast(err.message, true);
  }
}

async function hapusSurat(idSurat) {
  if (!confirm('Hapus permohonan surat ' + idSurat + '?')) return;
  const res = await apiPost({ action: 'deleteSurat', idSurat });
  if (res.success) { showToast('Surat dihapus.'); refreshCurrentTab(); }
}

// ================= 4. KEUANGAN GEREJA =================
async function renderKeuangan(container) {
  const res = await apiGet('getKeuangan');
  cache.keuangan = res.data || [];
  const isAdmin = currentUser.role === 'admin';

  const totalIn = cache.keuangan.filter(k => k.jenis === 'Pemasukan').reduce((a, b) => a + Number(b.nominal), 0);
  const totalOut = cache.keuangan.filter(k => k.jenis === 'Pengeluaran').reduce((a, b) => a + Number(b.nominal), 0);

  container.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-icon kpi-emerald"><i data-lucide="arrow-down-left" class="icon-md"></i></div><div><div class="kpi-label">Total Pemasukan</div><div class="kpi-value">${formatRupiah(totalIn)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon kpi-rose"><i data-lucide="arrow-up-right" class="icon-md"></i></div><div><div class="kpi-label">Total Pengeluaran</div><div class="kpi-value">${formatRupiah(totalOut)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon kpi-blue"><i data-lucide="wallet" class="icon-md"></i></div><div><div class="kpi-label">Saldo Akhir Kas</div><div class="kpi-value">${formatRupiah(totalIn - totalOut)}</div></div></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Buku Kas & Laporan Keuangan</h3>
        ${isAdmin ? `<button type="button" class="btn-primary" onclick="openKeuanganModal()"><i data-lucide="plus" class="icon-sm"></i><span>Catat Transaksi</span></button>` : ''}
      </div>
      ${renderSearchBar('searchKeuInput', 'Cari tanggal, uraian transaksi, bidang/pos, atau pemasukan/pengeluaran...', 'filterKeuangan')}
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Uraian Transaksi</th><th>Bidang / Pos</th><th>Jenis</th><th>Nominal</th><th>Aksi</th></tr>
          </thead>
          <tbody id="keuanganTableBody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterKeuangan();
}

function filterKeuangan() {
  const tbody = document.getElementById('keuanganTableBody');
  if (!tbody) return;
  const q = (document.getElementById('searchKeuInput')?.value || '').trim().toLowerCase();
  const isAdmin = currentUser.role === 'admin';

  const filtered = cache.keuangan.filter(k =>
    !q || `${k.tanggal} ${k.uraian} ${k.bidangPos} ${k.jenis} ${k.sumberWarta}`.toLowerCase().includes(q)
  );

  tbody.innerHTML = filtered.map(k => `
    <tr>
      <td>${k.tanggal}</td>
      <td><strong>${k.uraian}</strong><br><small style="color:var(--muted)">Ref: ${k.sumberWarta || '-'}</small></td>
      <td>${k.bidangPos}</td>
      <td><span class="badge ${k.jenis === 'Pemasukan' ? 'badge-in' : 'badge-out'}">${k.jenis}</span></td>
      <td><strong>${formatRupiah(k.nominal)}</strong></td>
      <td style="white-space:nowrap;">
        <div class="action-group">
          <button type="button" class="btn-outline btn-sm" onclick="viewKeuanganDetail('${k.idTransaksi}')">Detail</button>
          ${isAdmin ? `<button type="button" class="btn-outline btn-sm" onclick="openKeuanganModal('${k.idTransaksi}')">Edit</button>` : ''}
          ${isAdmin ? `<button type="button" class="btn-danger" onclick="hapusKeuangan('${k.idTransaksi}')">Hapus</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6">Data transaksi keuangan tidak ditemukan.</td></tr>`;
}

function viewKeuanganDetail(idTransaksi) {
  const k = cache.keuangan.find(x => x.idTransaksi === idTransaksi);
  if (!k) return;
  const isAdmin = currentUser.role === 'admin';
  openModal('Detail Transaksi Keuangan ' + k.idTransaksi, `
    ${renderDetailTable([
      ['ID Transaksi', `<strong>${k.idTransaksi}</strong>`],
      ['Tanggal Transaksi', k.tanggal],
      ['Uraian Transaksi', `<strong>${k.uraian}</strong>`],
      ['Bidang / Pos Anggaran', k.bidangPos],
      ['Jenis Mutasi', `<span class="badge ${k.jenis === 'Pemasukan' ? 'badge-in' : 'badge-out'}">${k.jenis}</span>`],
      ['Nominal', `<strong>${formatRupiah(k.nominal)}</strong>`],
      ['Sumber / Referensi Warta', k.sumberWarta]
    ])}
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button type="button" class="btn-outline" onclick="closeModal()">Tutup</button>
      ${isAdmin ? `<button type="button" class="btn-primary" onclick="openKeuanganModal('${k.idTransaksi}')">Edit Transaksi</button>` : ''}
    </div>
  `);
}

function openKeuanganModal(idTransaksi = null) {
  const k = idTransaksi ? cache.keuangan.find(x => x.idTransaksi === idTransaksi) : {};
  openModal(idTransaksi ? 'Edit Transaksi Keuangan ' + idTransaksi : 'Catat Transaksi Keuangan Baru', `
    <form onsubmit="submitKeuangan(event, '${idTransaksi || ''}')">
      <div class="input-group"><label>Tanggal</label><input id="keuTgl" value="${k.tanggal || '21 Nov 2026'}" required></div>
      <div class="input-group"><label>Uraian Transaksi</label><input id="keuUraian" value="${k.uraian || ''}" placeholder="Contoh: Persembahan Ibadah Minggu" required></div>
      <div class="input-group"><label>Bidang / Pos Anggaran</label><input id="keuPos" value="${k.bidangPos || 'Persembahan Rutin'}" required></div>
      <div class="input-group"><label>Jenis Transaksi</label>
        <select id="keuJenis">
          <option value="Pemasukan" ${k.jenis === 'Pemasukan' ? 'selected' : ''}>Pemasukan</option>
          <option value="Pengeluaran" ${k.jenis === 'Pengeluaran' ? 'selected' : ''}>Pengeluaran</option>
        </select>
      </div>
      <div class="input-group"><label>Nominal (Rupiah)</label><input type="number" id="keuNom" value="${k.nominal || ''}" placeholder="500000" required></div>
      <div class="input-group"><label>Sumber / Nomor Warta</label><input id="keuRef" value="${k.sumberWarta || 'WG-47-GKJSP-XI-2026'}"></div>
      <button type="submit" class="btn-primary btn-full">Simpan Transaksi</button>
    </form>
  `);
}

async function submitKeuangan(e, idTransaksi) {
  e.preventDefault();
  const res = await apiPost({
    action: idTransaksi ? 'updateKeuangan' : 'addKeuangan',
    idTransaksi,
    tanggal: document.getElementById('keuTgl').value,
    uraian: document.getElementById('keuUraian').value,
    bidangPos: document.getElementById('keuPos').value,
    jenis: document.getElementById('keuJenis').value,
    nominal: document.getElementById('keuNom').value,
    sumberWarta: document.getElementById('keuRef').value
  });
  if (res.success) {
    closeModal();
    showToast(idTransaksi ? 'Transaksi diperbarui.' : 'Transaksi keuangan dicatat.');
    refreshCurrentTab();
  }
}

async function hapusKeuangan(idTransaksi) {
  if (!confirm('Hapus catatan transaksi ' + idTransaksi + '?')) return;
  const res = await apiPost({ action: 'deleteKeuangan', idTransaksi });
  if (res.success) { showToast('Transaksi dihapus.'); refreshCurrentTab(); }
}

// ================= 5. WARTA JEMAAT =================
async function renderWarta(container) {
  const res = await apiGet('getWarta');
  cache.warta = res.data || [];
  const isAdmin = currentUser.role === 'admin';

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Arsip Warta Jemaat (${cache.warta.length} Dokumen PDF)</h3>
        ${isAdmin ? `<button type="button" class="btn-primary" onclick="openUploadWartaModal()"><i data-lucide="upload" class="icon-sm"></i><span>Unggah Warta PDF</span></button>` : ''}
      </div>
      ${renderSearchBar('searchWartaInput', 'Cari judul edisi warta, tanggal, atau bulan (misal: November 2026)...', 'filterWarta')}
      <div id="wartaGridBody" class="warta-grid"></div>
    </div>
  `;
  filterWarta();
}

function filterWarta() {
  const grid = document.getElementById('wartaGridBody');
  if (!grid) return;
  const q = (document.getElementById('searchWartaInput')?.value || '').trim().toLowerCase();
  const isAdmin = currentUser.role === 'admin';

  const filtered = cache.warta.filter(w =>
    !q || `${w.namaFile} ${w.bulan} ${w.updatedAt}`.toLowerCase().includes(q)
  );

  grid.innerHTML = filtered.map((w, idx) => `
    <div class="warta-card">
      <div class="warta-cover">
        ${!q && idx === 0 ? `<span class="badge-terbaru">Terbaru</span>` : ''}
        <img src="${w.thumbnailUrl}" alt="${w.namaFile}" onerror="this.src='https://placehold.co/400x520/e2e8f0/1e3a8a?text=Warta+GKJSP'">
      </div>
      <div class="warta-body">
        <div class="warta-title">${w.namaFile}</div>
        <div class="warta-date">${w.updatedAt} (${w.bulan})</div>
        <div class="warta-actions" style="flex-wrap:wrap;">
          <button type="button" class="btn-buka" onclick="previewPdf('${w.previewUrl}', '${w.namaFile}')">
            <i data-lucide="book-open" class="icon-sm"></i><span>Baca</span>
          </button>
          <a href="${w.downloadUrl}" target="_blank" class="btn-unduh" title="Unduh"><i data-lucide="download" class="icon-sm"></i></a>
          ${isAdmin ? `<button type="button" class="btn-outline btn-sm" onclick="viewWartaDetail('${w.id}')">Detail</button>` : ''}
          ${isAdmin ? `<button type="button" class="btn-outline btn-sm" onclick="openEditWartaModal('${w.id}')">Edit</button>` : ''}
          ${isAdmin ? `<button type="button" class="btn-danger" onclick="hapusWarta('${w.id}')">Hapus</button>` : ''}
        </div>
      </div>
    </div>
  `).join('') || '<p style="color:var(--muted);font-size:13.5px;">Edisi Warta Jemaat tidak ditemukan.</p>';
  renderIcons();
}

function viewWartaDetail(fileId) {
  const w = cache.warta.find(x => x.id === fileId);
  if (!w) return;
  openModal('Detail Dokumen Warta Jemaat', `
    ${renderDetailTable([
      ['Judul Edisi Warta', `<strong>${w.namaFile}</strong>`],
      ['Folder Bulan', w.bulan],
      ['Terakhir Diperbarui', w.updatedAt],
      ['ID File Google Drive', `<code>${w.id}</code>`],
      ['Tautan Unduhan', `<a href="${w.downloadUrl}" target="_blank" class="link-more">Unduh File PDF</a>`]
    ])}
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
      <button type="button" class="btn-outline" onclick="closeModal()">Tutup</button>
      <button type="button" class="btn-outline" onclick="previewPdf('${w.previewUrl}', '${w.namaFile}')">Pratinjau PDF</button>
      <button type="button" class="btn-primary" onclick="openEditWartaModal('${w.id}')">Edit Judul / Folder</button>
    </div>
  `);
}

function openEditWartaModal(fileId) {
  const w = cache.warta.find(x => x.id === fileId);
  if (!w) return;
  openModal('Edit Informasi Warta Jemaat', `
    <form onsubmit="submitEditWarta(event, '${fileId}')">
      <div class="input-group"><label>Judul / Nama File Warta</label><input id="edWrNama" value="${w.namaFile}" required></div>
      <div class="input-group"><label>Folder Bulan</label><input id="edWrBulan" value="${w.bulan}" required></div>
      <button type="submit" id="btnEdWarta" class="btn-primary btn-full">Simpan Perubahan Warta</button>
    </form>
  `);
}

async function submitEditWarta(e, fileId) {
  e.preventDefault();
  const btn = document.getElementById('btnEdWarta');
  btn.disabled = true; btn.textContent = 'Menyimpan perubahan...';
  const res = await apiPost({
    action: 'updateWarta',
    fileId,
    namaFile: document.getElementById('edWrNama').value,
    bulan: document.getElementById('edWrBulan').value
  });
  if (res.success) {
    closeModal();
    showToast('Informasi warta berhasil diperbarui.');
    refreshCurrentTab();
  } else {
    btn.disabled = false; btn.textContent = 'Simpan Perubahan Warta';
    showToast(res.message || 'Gagal memperbarui warta.', true);
  }
}

function openUploadWartaModal() {
  openModal('Unggah Warta Jemaat Baru (PDF)', `
    <form onsubmit="submitUploadWarta(event)">
      <div class="input-group"><label>Nama Edisi Warta</label><input id="wrNama" placeholder="Contoh: Warta Jemaat Minggu 22 Nov 2026" required></div>
      <div class="input-group"><label>Folder Bulan</label><input id="wrBulan" value="November 2026" required></div>
      <div class="input-group"><label>Pilih File PDF</label><input type="file" id="wrFile" accept=".pdf" required></div>
      <button type="submit" id="btnUpWarta" class="btn-primary btn-full">Unggah ke Google Drive</button>
    </form>
  `);
}

async function submitUploadWarta(e) {
  e.preventDefault();
  const btn = document.getElementById('btnUpWarta');
  btn.disabled = true; btn.textContent = 'Mengunggah ke Drive...';

  const file = document.getElementById('wrFile').files[0];
  const fileBase64 = await fileToBase64(file);
  const res = await apiPost({
    action: 'uploadWarta',
    namaFile: document.getElementById('wrNama').value,
    bulan: document.getElementById('wrBulan').value,
    fileBase64
  });
  if (res.success) { closeModal(); showToast('Warta Jemaat berhasil diunggah.'); refreshCurrentTab(); }
}

async function hapusWarta(fileId) {
  if (!confirm('Hapus file Warta ini dari Google Drive?')) return;
  const res = await apiPost({ action: 'deleteWarta', fileId });
  if (res.success) { showToast('Warta dihapus.'); refreshCurrentTab(); }
}

// ================= 6. MANAJEMEN AKUN USERS =================
async function renderUsers(container) {
  const res = await apiGet('getUsers');
  cache.users = res.data || [];
  const pendingCount = cache.users.filter(u => (u.status || '').toLowerCase() === 'pending').length;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3>Daftar Akun Pengguna (${cache.users.length} Akun)</h3>
          <p style="font-size:12.5px;color:var(--muted);margin-top:2px;">
            ${pendingCount > 0 ? `<strong style="color:#d97706;">${pendingCount} pendaftaran warga menunggu persetujuan (ACC)</strong>` : 'Seluruh akun terdaftar sudah terverifikasi'}
          </p>
        </div>
        <button type="button" class="btn-primary" onclick="openUserModal()"><i data-lucide="user-plus" class="icon-sm"></i><span>Tambah Akun</span></button>
      </div>
      ${renderSearchBar('searchUsersInput', 'Cari username, nama pengguna, peran (admin/jemaat), status (pending/aktif), atau wilayah...', 'filterUsers')}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Username</th><th>Nama & No. Induk</th><th>Peran</th><th>Wilayah</th><th>Status Akun</th><th>Aksi</th></tr></thead>
          <tbody id="usersTableBody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterUsers();
}

function filterUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  const q = (document.getElementById('searchUsersInput')?.value || '').trim().toLowerCase();

  const sorted = [...cache.users].sort((a, b) => {
    const aPend = (a.status || '').toLowerCase() === 'pending' ? 0 : 1;
    const bPend = (b.status || '').toLowerCase() === 'pending' ? 0 : 1;
    return aPend - bPend;
  });

  const filtered = sorted.filter(u =>
    !q || `${u.username} ${u.nama} ${u.role} ${u.wilayah} ${u.noInduk} ${u.status}`.toLowerCase().includes(q)
  );

  tbody.innerHTML = filtered.map(u => {
    const st = (u.status || 'Aktif').trim();
    const isPending = st.toLowerCase() === 'pending';
    const isRejected = st.toLowerCase() === 'ditolak';
    const badgeClass = isPending ? 'badge-proses' : (isRejected ? 'badge-ditolak' : 'badge-selesai');

    return `
      <tr style="${isPending ? 'background:#fffbeb;' : ''}">
        <td><strong>${u.username}</strong></td>
        <td><strong>${u.nama}</strong><br><small style="color:var(--muted)">Induk: ${u.noInduk || '-'}</small></td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-proses' : 'badge-selesai'}">${u.role.toUpperCase()}</span></td>
        <td>${u.wilayah}</td>
        <td><span class="badge ${badgeClass}">${isPending ? 'Menunggu ACC' : st}</span></td>
        <td style="white-space:nowrap;">
          <div class="action-group">
            ${isPending ? `<button type="button" class="btn-primary btn-sm" onclick="accUser('${u.username}', 'Aktif')">ACC</button>` : ''}
            ${isPending ? `<button type="button" class="btn-danger" onclick="accUser('${u.username}', 'Ditolak')">Tolak</button>` : ''}
            <button type="button" class="btn-outline btn-sm" onclick="viewUserDetail('${u.username}')">Detail</button>
            <button type="button" class="btn-outline btn-sm" onclick="openUserModal('${u.username}')">Edit</button>
            ${u.username !== 'admin' ? `<button type="button" class="btn-danger" onclick="hapusUser('${u.username}')">Hapus</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6">Akun pengguna tidak ditemukan.</td></tr>';
}

async function accUser(username, status) {
  const label = status === 'Aktif' ? 'menyetujui (ACC)' : 'menolak';
  if (!confirm(`Apakah Anda yakin ingin ${label} pendaftaran akun "${username}"?`)) return;
  const res = await apiPost({ action: 'approveUser', username, status });
  if (res.success) {
    showToast(`Akun "${username}" berhasil diubah menjadi ${status}.`);
    refreshCurrentTab();
  } else {
    showToast(res.message || 'Gagal memperbarui status akun.', true);
  }
}

function viewUserDetail(username) {
  const u = cache.users.find(x => x.username === username);
  if (!u) return;
  openModal('Detail Akun Pengguna', `
    ${renderDetailTable([
      ['Username Login', `<strong>${u.username}</strong>`],
      ['Kata Sandi', `<code>${u.password}</code>`],
      ['Nama Lengkap', `<strong>${u.nama}</strong>`],
      ['Peran (Role)', u.role.toUpperCase()],
      ['Wilayah / Pepanthan', u.wilayah],
      ['Nomor Induk Jemaat', u.noInduk || '-'],
      ['Status Verifikasi Akun', `<strong>${u.status || 'Aktif'}</strong>`]
    ])}
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button type="button" class="btn-outline" onclick="closeModal()">Tutup</button>
      <button type="button" class="btn-primary" onclick="openUserModal('${u.username}')">Edit Akun</button>
    </div>
  `);
}

function openUserModal(username = null) {
  const u = username ? cache.users.find(x => x.username === username) : {};
  openModal(username ? 'Edit Akun Pengguna: ' + username : 'Tambah Akun Login Baru', `
    <form onsubmit="submitUser(event, '${username || ''}')">
      <div class="input-group"><label>Username</label><input id="usName" value="${u.username || ''}" ${username === 'admin' ? 'readonly' : ''} required></div>
      <div class="input-group"><label>Kata Sandi</label><input id="usPass" value="${u.password || '123'}" required></div>
      <div class="input-group"><label>Peran (Role)</label>
        <select id="usRole" ${username === 'admin' ? 'disabled' : ''}>
          <option value="jemaat" ${u.role === 'jemaat' ? 'selected' : ''}>Jemaat (Warga)</option>
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin / Majelis</option>
        </select>
      </div>
      <div class="input-group"><label>Nama Lengkap</label><input id="usNama" value="${u.nama || ''}" required></div>
      <div class="input-group"><label>Wilayah</label>
        <select id="usWilayah">${WILAYAH_LIST.map(w => `<option value="${w}" ${u.wilayah === w ? 'selected' : ''}>${w}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Nomor Induk Jemaat</label><input id="usInduk" value="${u.noInduk || ''}" placeholder="JM-2026-..."></div>
      <div class="input-group"><label>Status Verifikasi Akun</label>
        <select id="usStatus">
          <option value="Aktif" ${(u.status || 'Aktif') === 'Aktif' ? 'selected' : ''}>Aktif (Sudah Di-ACC)</option>
          <option value="Pending" ${u.status === 'Pending' ? 'selected' : ''}>Pending (Menunggu ACC)</option>
          <option value="Ditolak" ${u.status === 'Ditolak' ? 'selected' : ''}>Ditolak</option>
        </select>
      </div>
      <button type="submit" class="btn-primary btn-full">${username ? 'Simpan Perubahan Akun' : 'Buat Akun'}</button>
    </form>
  `);
}

async function submitUser(e, originalUsername) {
  e.preventDefault();
  const res = await apiPost({
    action: originalUsername ? 'updateUser' : 'addUser',
    originalUsername,
    username: document.getElementById('usName').value,
    password: document.getElementById('usPass').value,
    role: document.getElementById('usRole').value,
    nama: document.getElementById('usNama').value,
    wilayah: document.getElementById('usWilayah').value,
    noInduk: document.getElementById('usInduk').value,
    status: document.getElementById('usStatus').value
  });
  if (res.success) {
    closeModal();
    showToast(originalUsername ? 'Akun berhasil diperbarui.' : 'Akun baru ditambahkan.');
    refreshCurrentTab();
  } else {
    showToast(res.message || 'Gagal menyimpan akun.', true);
  }
}

async function hapusUser(username) {
  if (!confirm('Hapus akun ' + username + '?')) return;
  const res = await apiPost({ action: 'deleteUser', username });
  if (res.success) { showToast('Akun dihapus.'); refreshCurrentTab(); }
}

function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.remove('hidden');
  renderIcons();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalBody').innerHTML = '';
}

function previewPdf(previewUrl, title) {
  openModal(title, `<iframe src="${previewUrl}" style="width:100%;height:70vh;border:none;border-radius:10px;"></iframe>`);
}