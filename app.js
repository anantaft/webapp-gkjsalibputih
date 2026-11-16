// ================= KONFIGURASI URL APPS SCRIPT =================
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxWEJ8rfi_18QdKJ8RWzjftTLsLEsW8ce4gN5o7B5E0nwpYYjOxj-M7tqNb-0aRzY37iQ/exec';

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
  'Surat Keterangan Kematian'
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
  setTimeout(() => el.classList.add('hidden'), 3200);
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

// ================= NAVIGASI LANDING, LOGIN & SHELL =================
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
  renderIcons();
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

// ================= PROSES LOGIN =================
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
    const res = await fetch(GAS_WEB_APP_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password })
    });
    const json = await res.json();

    if (json.success && json.user) {
      currentUser = json.user;
      localStorage.setItem('gkjsp_user', JSON.stringify(currentUser));
      initApp();
    } else {
      showToast(json.message || 'Username atau kata sandi salah.', true);
    }
  } catch (err) {
    showToast('Gagal terhubung ke server Google Apps Script.', true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="log-in" class="icon-sm"></i><span>Masuk ke Sistem</span>';
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
    jemaat: ['Buku Induk & Data Jemaat', 'Kelola data warga jemaat seluruh wilayah & pepanthan'],
    surat: ['Layanan Administrasi Surat', 'Pengajuan, verifikasi, dan arsip surat keterangan gerejawi'],
    keuangan: ['Laporan Keuangan Gereja', 'Transparansi pemasukan persembahan & pengeluaran bidang'],
    warta: ['Warta Jemaat & Tata Ibadah', 'Arsip digital Warta Jemaat GKJ Salib Putih'],
    users: ['Manajemen Akun Pengguna', 'Kelola akun login Admin Majelis dan Warga Jemaat']
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
    body: JSON.stringify(payload)
  });
  return await res.json();
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
  const [resJemaat, resSurat, resKeu, resWarta] = await Promise.all([
    apiGet('getJemaat'), apiGet('getSurat'), apiGet('getKeuangan'), apiGet('getWarta')
  ]);
  cache.jemaat = resJemaat.data || [];
  cache.surat = resSurat.data || [];
  cache.keuangan = resKeu.data || [];
  cache.warta = resWarta.data || [];

  const isAdmin = currentUser.role === 'admin';
  const totalIn = cache.keuangan.filter(k => k.jenis === 'Pemasukan').reduce((a, b) => a + Number(b.nominal), 0);
  const totalOut = cache.keuangan.filter(k => k.jenis === 'Pengeluaran').reduce((a, b) => a + Number(b.nominal), 0);
  const saldo = totalIn - totalOut;
  const suratProses = cache.surat.filter(s => s.status === 'Proses').length;

  const wilayahCounts = WILAYAH_LIST.map(w => ({
    nama: w,
    jumlah: cache.jemaat.filter(j => j.wilayah === w).length
  }));
  const maxW = Math.max(...wilayahCounts.map(w => w.jumlah), 1);

  container.innerHTML = `
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
          <span>Baca Warta</span>
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

    <div class="dash-grid-2">
      <div class="card">
        <div class="card-header">
          <h3>Sebaran Jemaat per Wilayah & Pepanthan</h3>
          ${isAdmin ? `<button type="button" class="link-more" onclick="switchTab('jemaat')">Lihat Buku Induk →</button>` : ''}
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
              <span class="badge ${s.status === 'Selesai' ? 'badge-selesai' : 'badge-proses'}">${s.status}</span>
            </div>
          `).join('') || '<p style="font-size:13px;color:var(--muted);">Belum ada permohonan surat.</p>'}
        </div>
      </div>
    </div>
  `;
}

// ================= 2. DATA JEMAAT =================
async function renderJemaat(container) {
  const res = await apiGet('getJemaat');
  cache.jemaat = res.data || [];

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Daftar Warga Jemaat (${cache.jemaat.length} Jiwa)</h3>
        <button type="button" class="btn-primary" onclick="openJemaatModal()">
          <i data-lucide="user-plus" class="icon-sm"></i><span>Tambah Jemaat</span>
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>No. Induk</th><th>Nama Lengkap</th><th>L/P</th><th>Wilayah</th><th>Baptis / Sidi</th><th>No. HP</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${cache.jemaat.map(j => `
              <tr>
                <td><strong>${j.noInduk}</strong><br><small style="color:var(--muted)">${j.noKK || ''}</small></td>
                <td><strong>${j.nama}</strong><br><small style="color:var(--muted)">${j.alamat || ''}</small></td>
                <td>${j.jenisKelamin}</td>
                <td>${j.wilayah}</td>
                <td>${j.statusBaptisSidi}</td>
                <td>${j.noHP || '-'}</td>
                <td style="white-space:nowrap;">
                  <button type="button" class="btn-outline btn-sm" onclick="openJemaatModal('${j.noInduk}')">Edit</button>
                  <button type="button" class="btn-danger" onclick="hapusJemaat('${j.noInduk}')">Hapus</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
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
    statusKeanggotaan: 'Aktif',
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

// ================= 3. LAYANAN SURAT =================
async function renderSurat(container) {
  const res = await apiGet('getSurat');
  const all = res.data || [];
  const isAdmin = currentUser.role === 'admin';
  cache.surat = isAdmin ? all : all.filter(s => s.pemohon === currentUser.nama || s.noInduk === currentUser.noInduk);

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>${isAdmin ? 'Daftar Permohonan Surat Jemaat' : 'Riwayat Pengajuan Surat Saya'}</h3>
        <button type="button" class="btn-primary" onclick="openSuratModal()">
          <i data-lucide="file-plus" class="icon-sm"></i><span>Ajukan Surat Baru</span>
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID & Tgl</th><th>Pemohon</th><th>Jenis Surat</th><th>Tujuan</th><th>Berkas</th><th>Status</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${cache.surat.map(s => `
              <tr>
                <td><strong>${s.idSurat}</strong><br><small style="color:var(--muted)">${s.tanggal}</small></td>
                <td><strong>${s.pemohon}</strong><br><small style="color:var(--muted)">${s.wilayah}</small></td>
                <td>${s.jenisSurat}</td>
                <td>${s.tujuanSurat}</td>
                <td>
                  ${s.berkasPendukungUrl ? `<a href="${s.berkasPendukungUrl}" target="_blank" class="link-more">Berkas Pemohon</a><br>` : ''}
                  ${s.arsipSuratUrl ? `<a href="${s.arsipSuratUrl}" target="_blank" class="link-more" style="color:var(--success)">Surat Resmi PDF</a>` : '-'}
                </td>
                <td><span class="badge ${s.status === 'Selesai' ? 'badge-selesai' : (s.status === 'Ditolak' ? 'badge-ditolak' : 'badge-proses')}">${s.status}</span></td>
                <td style="white-space:nowrap;">
                  ${isAdmin ? `<button type="button" class="btn-outline btn-sm" onclick="openSuratAdminModal('${s.idSurat}')">Proses</button>` : ''}
                  ${isAdmin ? `<button type="button" class="btn-danger" onclick="hapusSurat('${s.idSurat}')">Hapus</button>` : '-'}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7">Belum ada data surat.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
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
        <select id="srJenis">${JENIS_SURAT_LIST.map(j => `<option value="${j}">${j}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Instansi / Gereja Tujuan</label><input id="srTujuan" placeholder="Contoh: Majelis GKJ Salatiga / KUA" required></div>
      <div class="input-group"><label>Alamat Tujuan</label><input id="srAlamat" placeholder="Alamat instansi tujuan"></div>
      <div class="input-group"><label>No. WhatsApp Aktif</label><input id="srWA" placeholder="0812..." required></div>
      <div class="input-group"><label>Lampiran Berkas Pendukung (PDF/Foto, Opsional)</label><input type="file" id="srFile" accept=".pdf,image/*"></div>
      <button type="submit" id="btnSubmitSurat" class="btn-primary btn-full">Kirim Permohonan Surat</button>
    </form>
  `);
}

async function submitSuratBaru(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSubmitSurat');
  btn.disabled = true; btn.textContent = 'Mengunggah & mengirim...';

  const fileInput = document.getElementById('srFile');
  let berkasBase64 = '', berkasName = '', berkasMime = '';
  if (fileInput.files && fileInput.files[0]) {
    const f = fileInput.files[0];
    berkasBase64 = await fileToBase64(f);
    berkasName = f.name;
    berkasMime = f.type;
  }

  const res = await apiPost({
    action: 'addSurat',
    pemohon: document.getElementById('srPemohon').value,
    noInduk: document.getElementById('srNoInduk').value,
    wilayah: document.getElementById('srWilayah').value,
    jenisSurat: document.getElementById('srJenis').value,
    tujuanSurat: document.getElementById('srTujuan').value,
    alamatTujuan: document.getElementById('srAlamat').value,
    noWA: document.getElementById('srWA').value,
    berkasBase64, berkasName, berkasMime,
    status: 'Proses'
  });

  if (res.success) {
    closeModal();
    showToast('Permohonan surat berhasil dikirim.');
    refreshCurrentTab();
  } else {
    btn.disabled = false; btn.textContent = 'Kirim Permohonan Surat';
    showToast(res.message || 'Gagal mengirim.', true);
  }
}

function openSuratAdminModal(idSurat) {
  const s = cache.surat.find(x => x.idSurat === idSurat);
  openModal('Proses & Arsipkan Surat ' + idSurat, `
    <form onsubmit="submitUpdateSurat(event, '${idSurat}')">
      <div class="input-group"><label>Pemohon</label><input value="${s.pemohon} (${s.jenisSurat})" disabled></div>
      <div class="input-group"><label>Status Permohonan</label>
        <select id="admSrStatus">
          <option value="Proses" ${s.status === 'Proses' ? 'selected' : ''}>Proses</option>
          <option value="Selesai" ${s.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
          <option value="Ditolak" ${s.status === 'Ditolak' ? 'selected' : ''}>Ditolak</option>
        </select>
      </div>
      <div class="input-group"><label>Unggah PDF Surat Resmi (Opsional)</label><input type="file" id="admSrPdf" accept=".pdf"></div>
      <button type="submit" id="btnUpdSurat" class="btn-primary btn-full">Simpan Perubahan Status</button>
    </form>
  `);
}

async function submitUpdateSurat(e, idSurat) {
  e.preventDefault();
  const btn = document.getElementById('btnUpdSurat');
  btn.disabled = true; btn.textContent = 'Menyimpan...';

  const fileInput = document.getElementById('admSrPdf');
  let arsipBase64 = '', arsipFileName = '';
  if (fileInput.files && fileInput.files[0]) {
    arsipBase64 = await fileToBase64(fileInput.files[0]);
    arsipFileName = fileInput.files[0].name;
  }

  const res = await apiPost({
    action: 'updateSurat',
    idSurat,
    status: document.getElementById('admSrStatus').value,
    arsipBase64,
    arsipFileName
  });

  if (res.success) {
    closeModal();
    showToast('Status surat diperbarui.');
    refreshCurrentTab();
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
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Uraian Transaksi</th><th>Bidang / Pos</th><th>Jenis</th><th>Nominal</th>${isAdmin ? '<th>Aksi</th>' : ''}</tr>
          </thead>
          <tbody>
            ${cache.keuangan.map(k => `
              <tr>
                <td>${k.tanggal}</td>
                <td><strong>${k.uraian}</strong><br><small style="color:var(--muted)">Ref: ${k.sumberWarta || '-'}</small></td>
                <td>${k.bidangPos}</td>
                <td><span class="badge ${k.jenis === 'Pemasukan' ? 'badge-in' : 'badge-out'}">${k.jenis}</span></td>
                <td><strong>${formatRupiah(k.nominal)}</strong></td>
                ${isAdmin ? `<td><button type="button" class="btn-danger" onclick="hapusKeuangan('${k.idTransaksi}')">Hapus</button></td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openKeuanganModal() {
  openModal('Catat Transaksi Keuangan Baru', `
    <form onsubmit="submitKeuangan(event)">
      <div class="input-group"><label>Tanggal</label><input id="keuTgl" value="16 Nov 2026" required></div>
      <div class="input-group"><label>Uraian Transaksi</label><input id="keuUraian" placeholder="Contoh: Persembahan Ibadah Minggu" required></div>
      <div class="input-group"><label>Bidang / Pos Anggaran</label><input id="keuPos" value="Persembahan Rutin" required></div>
      <div class="input-group"><label>Jenis Transaksi</label>
        <select id="keuJenis"><option value="Pemasukan">Pemasukan</option><option value="Pengeluaran">Pengeluaran</option></select>
      </div>
      <div class="input-group"><label>Nominal (Rupiah)</label><input type="number" id="keuNom" placeholder="500000" required></div>
      <div class="input-group"><label>Sumber / Nomor Warta</label><input id="keuRef" value="WG-46-GKJSP-XI-2026"></div>
      <button type="submit" class="btn-primary btn-full">Simpan Transaksi</button>
    </form>
  `);
}

async function submitKeuangan(e) {
  e.preventDefault();
  const res = await apiPost({
    action: 'addKeuangan',
    tanggal: document.getElementById('keuTgl').value,
    uraian: document.getElementById('keuUraian').value,
    bidangPos: document.getElementById('keuPos').value,
    jenis: document.getElementById('keuJenis').value,
    nominal: document.getElementById('keuNom').value,
    sumberWarta: document.getElementById('keuRef').value
  });
  if (res.success) { closeModal(); showToast('Transaksi keuangan dicatat.'); refreshCurrentTab(); }
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
      <div class="warta-grid">
        ${cache.warta.map((w, idx) => `
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
                  <i data-lucide="book-open" class="icon-sm"></i><span>Baca</span>
                </button>
                <a href="${w.downloadUrl}" target="_blank" class="btn-unduh" title="Unduh"><i data-lucide="download" class="icon-sm"></i></a>
                ${isAdmin ? `<button type="button" class="btn-danger" onclick="hapusWarta('${w.id}')">Hapus</button>` : ''}
              </div>
            </div>
          </div>
        `).join('') || '<p>Belum ada Warta Jemaat di folder Google Drive.</p>'}
      </div>
    </div>
  `;
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

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Daftar Akun Pengguna (${cache.users.length} Akun)</h3>
        <button type="button" class="btn-primary" onclick="openUserModal()"><i data-lucide="user-plus" class="icon-sm"></i><span>Tambah Akun</span></button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Username</th><th>Nama Pengguna</th><th>Peran</th><th>Wilayah</th><th>No. Induk</th><th>Aksi</th></tr></thead>
          <tbody>
            ${cache.users.map(u => `
              <tr>
                <td><strong>${u.username}</strong></td>
                <td>${u.nama}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-proses' : 'badge-selesai'}">${u.role.toUpperCase()}</span></td>
                <td>${u.wilayah}</td>
                <td>${u.noInduk || '-'}</td>
                <td>
                  ${u.username !== 'admin' ? `<button type="button" class="btn-danger" onclick="hapusUser('${u.username}')">Hapus</button>` : '<small style="color:var(--muted)">Utama</small>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openUserModal() {
  openModal('Tambah Akun Login Baru', `
    <form onsubmit="submitUser(event)">
      <div class="input-group"><label>Username</label><input id="usName" required></div>
      <div class="input-group"><label>Kata Sandi</label><input id="usPass" value="123" required></div>
      <div class="input-group"><label>Peran (Role)</label>
        <select id="usRole"><option value="jemaat">Jemaat (Warga)</option><option value="admin">Admin / Majelis</option></select>
      </div>
      <div class="input-group"><label>Nama Lengkap</label><input id="usNama" required></div>
      <div class="input-group"><label>Wilayah</label>
        <select id="usWilayah">${WILAYAH_LIST.map(w => `<option value="${w}">${w}</option>`).join('')}</select>
      </div>
      <div class="input-group"><label>Nomor Induk Jemaat</label><input id="usInduk" placeholder="JM-2026-..."></div>
      <button type="submit" class="btn-primary btn-full">Buat Akun</button>
    </form>
  `);
}

async function submitUser(e) {
  e.preventDefault();
  const res = await apiPost({
    action: 'addUser',
    username: document.getElementById('usName').value,
    password: document.getElementById('usPass').value,
    role: document.getElementById('usRole').value,
    nama: document.getElementById('usNama').value,
    wilayah: document.getElementById('usWilayah').value,
    noInduk: document.getElementById('usInduk').value
  });
  if (res.success) { closeModal(); showToast('Akun baru ditambahkan.'); refreshCurrentTab(); }
  else showToast(res.message || 'Gagal menambah akun.', true);
}

async function hapusUser(username) {
  if (!confirm('Hapus akun ' + username + '?')) return;
  const res = await apiPost({ action: 'deleteUser', username });
  if (res.success) { showToast('Akun dihapus.'); refreshCurrentTab(); }
}

// ================= MODAL & PREVIEW PDF =================
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