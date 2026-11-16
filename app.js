const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxWEJ8rfi_18QdKJ8RWzjftTLsLEsW8ce4gN5o7B5E0nwpYYjOxj-M7tqNb-0aRzY37iQ/exec';

let currentUser = null;
let activeTab = '';
let cache = { jemaat: [], users: [], surat: [], keuangan: [], warta: [] };

const WILAYAH_LIST = [
  'Gereja Induk Salib Putih',
  'Pepanthan Pandanan',
  'Pepanthan Warak',
  'Pepanthan Tetep',
  'Wilayah Kalibeji',
  'Unit Panti Wredha'
];

const JENIS_SURAT_LIST = [
  { title: 'Surat Pengantar Nikah', desc: 'Pernikahan Kudus / Catatan Sipil' },
  { title: 'Surat Baptis Anak / Dewasa', desc: 'Pelayanan Sakramen Baptis' },
  { title: 'Surat Pengakuan Percaya (Sidi)', desc: 'Peneguhan Sidi Jemaat' },
  { title: 'Surat Atestasi Masuk / Keluar', desc: 'Pindah Domisili / Keanggotaan' },
  { title: 'Surat Keterangan Warga', desc: 'Surat Keterangan Keanggotaan Aktif' }
];

function renderIcons() {
  try {
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  } catch (err) {
    console.warn('Lucide icon skipped:', err);
  }
}

// ================= INISIALISASI & AUTH =================
document.addEventListener('DOMContentLoaded', () => {
  renderIcons();
  checkConnection();
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
});

async function checkConnection() {
  const pill = document.getElementById('connectionStatus');
  if (!pill) return;
  try {
    const res = await fetch(`${GAS_WEB_APP_URL}?action=getWarta`);
    const json = await res.json();
    if (json.success !== undefined) {
      pill.className = 'status-pill status-ok';
      pill.innerHTML = `<span class="status-dot"></span><span>Terhubung ke Google Sheets & Drive Live</span>`;
    }
  } catch (e) {
    pill.className = 'status-pill status-err';
    pill.innerHTML = `<span class="status-dot"></span><span>Gagal terhubung — periksa URL Web App di app.js</span>`;
  }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnLogin');
  btn.innerHTML = `<span>Memverifikasi...</span>`;
  btn.disabled = true;

  try {
    const res = await apiPost({
      action: 'login',
      username: document.getElementById('loginUsername').value,
      password: document.getElementById('loginPassword').value
    });
    if (res.success) {
      currentUser = res.user;
      localStorage.setItem('gkjsp_user', JSON.stringify(currentUser));
      initApp();
    } else {
      showToast(res.message || 'Login gagal');
    }
  } catch (err) {
    showToast('Terjadi kesalahan koneksi.');
  } finally {
    btn.innerHTML = `<i data-lucide="log-in" class="icon-sm"></i><span>Masuk ke Sistem</span>`;
    btn.disabled = false;
    renderIcons();
  }
});

function logout() {
  localStorage.removeItem('gkjsp_user');
  location.reload();
}

function initApp() {
  document.getElementById('loginView').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');

  const role = String(currentUser.role || 'jemaat').trim().toLowerCase();
  currentUser.role = role;

  document.getElementById('userNameDisplay').textContent = currentUser.nama || currentUser.username || 'Pengguna';
  document.getElementById('userWilayahDisplay').textContent = currentUser.wilayah || 'GKJ Salib Putih';
  document.getElementById('roleBadgeSidebar').textContent =
    role === 'admin' ? 'Panel Sekretariat & Majelis' : 'Portal Warga Jemaat';

  const menus = role === 'admin'
    ? [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
        { id: 'jemaat', icon: 'users', label: 'Data Jemaat' },
        { id: 'users', icon: 'shield-check', label: 'Manajemen Akun' },
        { id: 'surat', icon: 'file-text', label: 'Layanan Surat' },
        { id: 'keuangan', icon: 'wallet', label: 'Keuangan' },
        { id: 'warta', icon: 'newspaper', label: 'Warta Jemaat' }
      ]
    : [
        { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' },
        { id: 'jemaat', icon: 'users', label: 'Data Jemaat' },
        { id: 'surat', icon: 'file-plus-2', label: 'Pengajuan Surat' },
        { id: 'warta', icon: 'newspaper', label: 'Warta Jemaat' },
        { id: 'keuangan', icon: 'pie-chart', label: 'Info Keuangan' }
      ];

  const sideNav = document.getElementById('sidebarNav');
  const botNav = document.getElementById('bottomNav');

  sideNav.innerHTML = menus.map(m => `
    <button type="button" class="nav-item" data-tab="${m.id}" onclick="switchTab('${m.id}')">
      <i data-lucide="${m.icon}" class="icon-sm"></i>
      <span>${m.label}</span>
    </button>
  `).join('');

  botNav.innerHTML = menus.map(m => `
    <button type="button" data-tab="${m.id}" onclick="switchTab('${m.id}')">
      <i data-lucide="${m.icon}" class="icon-md"></i>
      <span>${m.label}</span>
    </button>
  `).join('');

  renderIcons();
  switchTab(menus[0].id);
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabId);
  });
  refreshCurrentTab();
}

function refreshCurrentTab() {
  if (activeTab === 'dashboard') renderDashboard();
  else if (activeTab === 'jemaat') renderJemaat();
  else if (activeTab === 'users') renderUsers();
  else if (activeTab === 'surat') renderSurat();
  else if (activeTab === 'keuangan') renderKeuangan();
  else if (activeTab === 'warta') renderWarta();
}

// ================= API HELPER =================
async function apiGet(action) {
  const res = await fetch(`${GAS_WEB_APP_URL}?action=${action}`);
  return res.json();
}

async function apiPost(payload) {
  const res = await fetch(GAS_WEB_APP_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ================= 0. MODUL DASHBOARD RINGKASAN =================
async function renderDashboard() {
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('pageTitle').textContent = 'Dashboard Utama';
  document.getElementById('pageDesc').textContent = 'Ringkasan informasi pelayanan, warta jemaat, dan administrasi GKJ Salib Putih';

  const container = document.getElementById('contentContainer');
  container.innerHTML = `<div class="card">Memuat ringkasan data pelayanan...</div>`;

  const [resJemaat, resSurat, resKeu, resWarta] = await Promise.all([
    apiGet('getJemaat'),
    apiGet('getSurat'),
    apiGet('getKeuangan'),
    apiGet('getWarta')
  ]);

  cache.jemaat = resJemaat.data || [];
  cache.surat = resSurat.data || [];
  cache.keuangan = resKeu.data || [];
  cache.warta = resWarta.data || [];

  const masuk = cache.keuangan.filter(k => k.jenis === 'Pemasukan').reduce((a, b) => a + b.nominal, 0);
  const keluar = cache.keuangan.filter(k => k.jenis === 'Pengeluaran').reduce((a, b) => a + b.nominal, 0);
  const saldo = masuk - keluar;
  const suratProses = cache.surat.filter(s => s.status === 'Proses').length;

  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const totalWarga = cache.jemaat.length || 1;
  const wilayahStats = WILAYAH_LIST.map(w => {
    const cleanKey = w.replace('Gereja ', '').toLowerCase();
    const count = cache.jemaat.filter(j =>
      String(j.wilayah).toLowerCase().includes(cleanKey) || j.wilayah === w
    ).length;
    return { name: w, count, pct: Math.round((count / totalWarga) * 100) };
  }).filter(x => x.count > 0);

  const topWarta = cache.warta.slice(0, 3);
  const recentSurat = cache.surat.slice(0, 4);
  const recentKeu = cache.keuangan.slice(0, 4);

  container.innerHTML = `
    <div class="welcome-banner">
      <div>
        <h3>Selamat Datang, ${currentUser.nama}</h3>
        <p>${currentUser.wilayah} • ${todayStr}</p>
      </div>
      <div class="welcome-actions">
        <span class="welcome-pill"><i data-lucide="calendar" class="icon-sm"></i> Ibadah Minggu: 07.00 & 09.00 WIB</span>
        <button class="btn-banner-white" onclick="switchTab('surat')">
          <i data-lucide="file-plus-2" class="icon-sm"></i>
          <span>${isAdmin ? 'Kelola Surat' : 'Ajukan Surat'}</span>
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label"><i data-lucide="users" class="icon-xs" style="color:#1e3a8a;"></i> Total Warga Jemaat</div>
        <div class="stat-val" style="color:#1e3a8a;">${cache.jemaat.length} Jiwa</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i data-lucide="file-clock" class="icon-xs" style="color:#c2410c;"></i> Surat Dalam Proses</div>
        <div class="stat-val" style="color:#c2410c;">${suratProses} Permohonan</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i data-lucide="landmark" class="icon-xs" style="color:#15803d;"></i> Saldo Kas Tercatat</div>
        <div class="stat-val" style="color:#15803d;">Rp ${saldo.toLocaleString('id-ID')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i data-lucide="newspaper" class="icon-xs" style="color:#0f766e;"></i> Arsip Warta Jemaat</div>
        <div class="stat-val" style="color:#0f766e;">${cache.warta.length} Edisi</div>
      </div>
    </div>

    <div class="dash-main-grid">
      <div class="dash-col">
        <div class="card">
          <div class="section-head">
            <h3><i data-lucide="newspaper" class="icon-sm" style="color:var(--primary);"></i> Warta Jemaat Terbaru</h3>
            <button class="link-more" onclick="switchTab('warta')">Lihat Semua →</button>
          </div>
          ${topWarta.length ? `
            <div class="mini-warta-grid">
              ${topWarta.map(w => `
                <div class="mini-warta-card">
                  <div class="mini-warta-cover">
                    <img src="${w.thumbnailUrl}" alt="${w.namaFile}" onerror="this.src='https://placehold.co/300x400/e2e8f0/1e3a8a?text=Warta+GKJSP'">
                  </div>
                  <div class="mini-warta-info">
                    <div>
                      <div class="mini-warta-title" title="${w.namaFile}">${w.namaFile}</div>
                      <div class="mini-warta-sub">${w.bulan}</div>
                    </div>
                    <button class="btn-buka" style="padding:7px 10px;font-size:12px;" onclick="previewPdf('${w.previewUrl}', '${w.namaFile}')">
                      <i data-lucide="book-open" class="icon-xs"></i> Baca Warta
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="font-size:13px;color:var(--muted);">Belum ada warta tersedia.</p>'}
        </div>

        <div class="card">
          <div class="section-head">
            <h3><i data-lucide="wallet" class="icon-sm" style="color:var(--accent);"></i> Mutasi Kas Terakhir</h3>
            <button class="link-more" onclick="switchTab('keuangan')">Buku Kas →</button>
          </div>
          <div class="activity-list">
            ${recentKeu.length ? recentKeu.map(k => `
              <div class="activity-row">
                <div>
                  <div class="activity-title">${k.uraian}</div>
                  <div class="activity-sub">${k.tanggal} • ${k.bidangPos}</div>
                </div>
                <div style="font-weight:800;white-space:nowrap;color:${k.jenis === 'Pemasukan' ? '#15803d' : '#b91c1c'};">
                  ${k.jenis === 'Pemasukan' ? '+' : '-'} Rp ${Number(k.nominal).toLocaleString('id-ID')}
                </div>
              </div>
            `).join('') : '<p style="font-size:13px;color:var(--muted);">Belum ada catatan transaksi.</p>'}
          </div>
        </div>
      </div>

      <div class="dash-col">
        <div class="card">
          <div class="section-head">
            <h3><i data-lucide="church" class="icon-sm" style="color:var(--primary);"></i> Sebaran Warga per Wilayah</h3>
            <button class="link-more" onclick="switchTab('jemaat')">Direktori →</button>
          </div>
          <div>
            ${wilayahStats.length ? wilayahStats.map(ws => `
              <div class="wilayah-row">
                <div class="wilayah-meta">
                  <span>${ws.name}</span>
                  <span class="wilayah-count">${ws.count} Jiwa (${ws.pct}%)</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${ws.pct}%;"></div>
                </div>
              </div>
            `).join('') : '<p style="font-size:13px;color:var(--muted);">Data wilayah belum tersedia.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="section-head">
            <h3><i data-lucide="file-text" class="icon-sm" style="color:var(--primary);"></i> Permohonan Surat Terbaru</h3>
            <button class="link-more" onclick="switchTab('surat')">Semua Surat →</button>
          </div>
          <div class="activity-list">
            ${recentSurat.length ? recentSurat.map(s => `
              <div class="activity-row">
                <div>
                  <div class="activity-title">${s.jenisSurat}</div>
                  <div class="activity-sub">${s.pemohon} • ${s.tanggal}</div>
                </div>
                <span class="badge ${s.status === 'Selesai' ? 'badge-selesai' : 'badge-proses'}">${s.status}</span>
              </div>
            `).join('') : '<p style="font-size:13px;color:var(--muted);">Belum ada permohonan surat.</p>'}
          </div>
        </div>
      </div>
    </div>
  `;
  renderIcons();
}

// ================= 1. MODUL DATA JEMAAT =================
async function renderJemaat() {
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('pageTitle').textContent = isAdmin ? 'Manajemen Data Jemaat' : 'Direktori Warga Jemaat';
  document.getElementById('pageDesc').textContent = isAdmin
    ? 'Kelola data induk warga jemaat seluruh wilayah & pepanthan'
    : 'Daftar nama warga jemaat dan wilayah pelayanan GKJ Salib Putih';

  const container = document.getElementById('contentContainer');
  container.innerHTML = `<div class="card">Memuat data jemaat...</div>`;

  const res = await apiGet('getJemaat');
  cache.jemaat = res.data || [];

  container.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <i data-lucide="search" class="icon-sm"></i>
          <input type="text" id="searchJemaat" class="search-input" placeholder="Cari nama warga atau wilayah..." oninput="filterJemaatTable()" />
        </div>
        ${isAdmin ? `
          <button class="btn-primary" onclick="openJemaatModal()">
            <i data-lucide="user-plus" class="icon-sm"></i>
            <span>Tambah Warga Jemaat</span>
          </button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            ${isAdmin
              ? `<tr><th>No. Induk</th><th>Nama Lengkap</th><th>L/P</th><th>Wilayah / Pepanthan</th><th>Baptis/Sidi</th><th>No. HP</th><th>Aksi</th></tr>`
              : `<tr><th>No.</th><th>Nama Lengkap Warga</th><th>Wilayah / Pepanthan</th></tr>`}
          </thead>
          <tbody id="jemaatTbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterJemaatTable();
}

function filterJemaatTable() {
  const isAdmin = currentUser.role === 'admin';
  const q = (document.getElementById('searchJemaat')?.value || '').toLowerCase();
  const filtered = cache.jemaat.filter(j =>
    String(j.nama).toLowerCase().includes(q) || String(j.wilayah).toLowerCase().includes(q)
  );

  const tbody = document.getElementById('jemaatTbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7">Tidak ada data ditemukan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((j, idx) => isAdmin
    ? `<tr>
        <td><strong>${j.noInduk}</strong></td>
        <td>${j.nama}</td>
        <td>${j.jenisKelamin}</td>
        <td>${j.wilayah}</td>
        <td>${j.statusBaptisSidi}</td>
        <td>${j.noHP}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm btn-edit" onclick="openJemaatModal('${j.noInduk}')"><i data-lucide="pencil" class="icon-xs"></i> Edit</button>
            <button class="btn-sm btn-del" onclick="deleteJemaat('${j.noInduk}')"><i data-lucide="trash-2" class="icon-xs"></i> Hapus</button>
          </div>
        </td>
      </tr>`
    : `<tr>
        <td>${idx + 1}</td>
        <td><strong>${j.nama}</strong></td>
        <td><span class="badge" style="background:#eff6ff;color:#1e3a8a;"><i data-lucide="church" class="icon-xs"></i> ${j.wilayah}</span></td>
      </tr>`
  ).join('');
  renderIcons();
}

function openJemaatModal(noInduk = null) {
  const item = noInduk ? cache.jemaat.find(x => x.noInduk === noInduk) : null;
  openModal(item ? 'Edit Data Jemaat' : 'Tambah Data Jemaat Baru', `
    <form id="formJemaat" class="form-stack">
      <div class="input-group"><label>No. Kartu Keluarga (KK)</label><input name="noKK" value="${item?.noKK || 'KK-GKJSP-'}" required></div>
      <div class="input-group"><label>Nama Lengkap</label><input name="nama" value="${item?.nama || ''}" required></div>
      <div class="input-group"><label>Jenis Kelamin</label>
        <select name="jenisKelamin">
          <option value="L" ${item?.jenisKelamin === 'L' ? 'selected' : ''}>Laki-laki (L)</option>
          <option value="P" ${item?.jenisKelamin === 'P' ? 'selected' : ''}>Perempuan (P)</option>
        </select>
      </div>
      <div class="input-group"><label>Tempat, Tanggal Lahir</label><input name="tempatTglLahir" value="${item?.tempatTglLahir || ''}"></div>
      <div class="input-group"><label>Wilayah / Pepanthan</label>
        <select name="wilayah">
          ${WILAYAH_LIST.map(w => `<option value="${w}" ${item?.wilayah === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Status Baptis / Sidi</label><input name="statusBaptisSidi" value="${item?.statusBaptisSidi || 'Baptis & Sidi'}"></div>
      <div class="input-group"><label>No. WhatsApp / HP</label><input name="noHP" value="${item?.noHP || ''}"></div>
      <div class="input-group"><label>Alamat Domisili</label><textarea name="alamat" rows="2">${item?.alamat || ''}</textarea></div>
      <button type="submit" class="btn-primary"><i data-lucide="save" class="icon-sm"></i><span>Simpan Data Jemaat</span></button>
    </form>
  `);

  document.getElementById('formJemaat').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    fd.action = item ? 'updateJemaat' : 'addJemaat';
    if (item) fd.noInduk = item.noInduk;
    await apiPost(fd);
    closeModal();
    showToast('Data jemaat berhasil disimpan.');
    renderJemaat();
  };
}

async function deleteJemaat(noInduk) {
  if (!confirm('Hapus data jemaat ' + noInduk + '?')) return;
  await apiPost({ action: 'deleteJemaat', noInduk });
  showToast('Data jemaat dihapus.');
  renderJemaat();
}

// ================= 2. MODUL MANAJEMEN AKUN PENGGUNA =================
async function renderUsers() {
  document.getElementById('pageTitle').textContent = 'Manajemen Akun Pengguna';
  document.getElementById('pageDesc').textContent = 'Kelola hak akses login Admin Sekretariat dan Warga Jemaat';

  const container = document.getElementById('contentContainer');
  container.innerHTML = `<div class="card">Memuat daftar akun...</div>`;

  const res = await apiGet('getUsers');
  cache.users = res.data || [];

  container.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <i data-lucide="search" class="icon-sm"></i>
          <input type="text" id="searchUser" class="search-input" placeholder="Cari username atau nama pengguna..." oninput="filterUsersTable()" />
        </div>
        <button class="btn-primary" onclick="openUserModal()">
          <i data-lucide="plus" class="icon-sm"></i>
          <span>Tambah Akun Baru</span>
        </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Username</th><th>Nama Lengkap</th><th>Role</th><th>Wilayah</th><th>No. Induk</th><th>Aksi</th></tr></thead>
          <tbody id="usersTbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterUsersTable();
}

function filterUsersTable() {
  const q = (document.getElementById('searchUser')?.value || '').toLowerCase();
  const list = cache.users.filter(u =>
    String(u.username).toLowerCase().includes(q) || String(u.nama).toLowerCase().includes(q)
  );
  document.getElementById('usersTbody').innerHTML = list.map(u => `
    <tr>
      <td><strong>${u.username}</strong></td>
      <td>${u.nama}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-proses' : 'badge-selesai'}">${u.role.toUpperCase()}</span></td>
      <td>${u.wilayah}</td>
      <td>${u.noInduk}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-sm btn-edit" onclick="openUserModal('${u.username}')"><i data-lucide="pencil" class="icon-xs"></i> Edit</button>
          <button class="btn-sm btn-del" onclick="deleteUser('${u.username}')"><i data-lucide="trash-2" class="icon-xs"></i> Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
  renderIcons();
}

function openUserModal(username = null) {
  const item = username ? cache.users.find(x => x.username === username) : null;
  openModal(item ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna', `
    <form id="formUser" class="form-stack">
      <div class="input-group"><label>Username Login</label><input name="username" value="${item?.username || ''}" required></div>
      <div class="input-group"><label>Kata Sandi</label><input name="password" value="${item?.password || ''}" required></div>
      <div class="input-group"><label>Hak Akses (Role)</label>
        <select name="role">
          <option value="jemaat" ${item?.role === 'jemaat' ? 'selected' : ''}>Jemaat</option>
          <option value="admin" ${item?.role === 'admin' ? 'selected' : ''}>Admin Sekretariat</option>
        </select>
      </div>
      <div class="input-group"><label>Nama Lengkap</label><input name="nama" value="${item?.nama || ''}" required></div>
      <div class="input-group"><label>Wilayah</label>
        <select name="wilayah">
          ${WILAYAH_LIST.map(w => `<option value="${w}" ${item?.wilayah === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>No. Induk Jemaat / Admin</label><input name="noInduk" value="${item?.noInduk || 'JM-2026-'}"></div>
      <button type="submit" class="btn-primary"><i data-lucide="save" class="icon-sm"></i><span>Simpan Akun</span></button>
    </form>
  `);

  document.getElementById('formUser').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    fd.action = item ? 'updateUser' : 'addUser';
    if (item) fd.originalUsername = item.username;
    const res = await apiPost(fd);
    if (!res.success) return showToast(res.message);
    closeModal();
    showToast('Akun pengguna berhasil disimpan.');
    renderUsers();
  };
}

async function deleteUser(username) {
  if (!confirm('Hapus akun "' + username + '"?')) return;
  const res = await apiPost({ action: 'deleteUser', username });
  if (!res.success) return showToast(res.message);
  showToast('Akun dihapus.');
  renderUsers();
}

// ================= 3. MODUL LAYANAN SURAT =================
async function renderSurat() {
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('pageTitle').textContent = isAdmin ? 'Layanan & Arsip Surat Gerejawi' : 'Pengajuan Surat Keterangan';
  document.getElementById('pageDesc').textContent = isAdmin
    ? 'Verifikasi permohonan surat warga dan unggah PDF arsip resmi ke Google Drive'
    : 'Ajukan permohonan surat keterangan gerejawi secara daring';

  const container = document.getElementById('contentContainer');
  container.innerHTML = `<div class="card">Memuat data layanan surat...</div>`;

  const res = await apiGet('getSurat');
  cache.surat = res.data || [];

  if (isAdmin) {
    container.innerHTML = `
      <div class="card">
        <div class="toolbar">
          <div class="search-box">
            <i data-lucide="search" class="icon-sm"></i>
            <input type="text" id="searchSurat" class="search-input" placeholder="Cari nama pemohon, jenis surat, atau wilayah..." oninput="filterSuratAdmin()" />
          </div>
          <button class="btn-primary" onclick="openSuratAdminModal()">
            <i data-lucide="plus" class="icon-sm"></i>
            <span>Catat Surat Baru</span>
          </button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID & Tgl</th><th>Pemohon & Wilayah</th><th>Jenis & Tujuan Surat</th>
                <th>Berkas Jemaat</th><th>Arsip PDF Admin</th><th>Status</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody id="suratAdminTbody"></tbody>
          </table>
        </div>
      </div>
    `;
    filterSuratAdmin();
  } else {
    const myHistory = cache.surat.filter(s =>
      String(s.pemohon).toLowerCase().includes(currentUser.nama.toLowerCase()) ||
      String(s.noInduk) === String(currentUser.noInduk)
    );

    container.innerHTML = `
      <div class="surat-layout">
        <form id="formPengajuanJemaat">
          <div class="step-card">
            <div class="step-header">
              <div class="step-title"><span class="step-num">1</span> Pilih Jenis Surat</div>
              <span class="tag-wajib">*Wajib</span>
            </div>
            ${JENIS_SURAT_LIST.map((j, i) => `
              <label class="radio-option">
                <div class="radio-left">
                  <input type="radio" name="jenisSurat" value="${j.title}" ${i === 0 ? 'checked' : ''} required>
                  <div>
                    <div class="radio-title">${j.title}</div>
                    <div class="radio-desc">${j.desc}</div>
                  </div>
                </div>
              </label>
            `).join('')}
            <p class="helper-note">Pilih format permohonan sesuai kebutuhan administrasi Anda.</p>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-title"><span class="step-num">2</span> Nama Lengkap Pemohon</div>
              <span class="tag-wajib">*Wajib</span>
            </div>
            <div class="input-group">
              <input type="text" name="pemohon" value="${currentUser.nama}" required />
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-title"><span class="step-num">3</span> Bagian / Pepanthan Induk</div>
              <span class="tag-wajib">*Wajib</span>
            </div>
            ${WILAYAH_LIST.slice(0, 5).map(w => `
              <label class="radio-option">
                <div class="radio-left">
                  <input type="radio" name="wilayah" value="${w}" ${currentUser.wilayah === w ? 'checked' : ''} required>
                  <span class="radio-title">${w}</span>
                </div>
                <i data-lucide="church" class="icon-sm" style="color:var(--primary);"></i>
              </label>
            `).join('')}
            <p class="helper-note">Pilih wilayah persekutuan jemaat tempat Anda terdaftar saat ini.</p>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-title"><span class="step-num">4</span> Tujuan Surat</div>
              <span class="tag-wajib">*Wajib</span>
            </div>
            <div class="input-group">
              <input type="text" name="tujuanSurat" placeholder="Contoh: Majelis GKJ Salatiga / KUA / Dukcapil" required />
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-title"><span class="step-num">5</span> Alamat Lengkap Instansi / Tujuan</div>
              <span class="tag-wajib">*Wajib</span>
            </div>
            <div class="input-group">
              <textarea name="alamatTujuan" rows="2" placeholder="Jl. Diponegoro No. 52, Salatiga, Jawa Tengah" required></textarea>
            </div>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-title"><span class="step-num">6</span> No. WhatsApp / HP Aktif</div>
              <span class="tag-wajib">*Wajib</span>
            </div>
            <div class="input-group">
              <input type="text" name="noWA" placeholder="+62 812-3456-7890" required />
            </div>
            <p class="helper-note">Sekretariat akan mengabarkan status surat via WhatsApp.</p>
          </div>

          <div class="step-card">
            <div class="step-header">
              <div class="step-title"><span class="step-num">7</span> Berkas Pendukung</div>
              <span class="tag-opt">Opsional</span>
            </div>
            <label class="upload-dropzone" for="berkasInput">
              <div class="upload-icon"><i data-lucide="upload-cloud" class="icon-md"></i></div>
              <div style="font-weight:700;font-size:13.5px;" id="berkasLabelText">Ketuk untuk unggah berkas ke Google Drive</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px;">KTP, Kartu Keluarga, atau Akta Baptis (PDF, JPG, PNG maks. 3MB)</div>
              <input type="file" id="berkasInput" accept=".pdf,.jpg,.jpeg,.png" class="hidden" onchange="updateBerkasLabel(this)" />
            </label>
          </div>

          <p class="helper-note" style="margin-bottom:14px;">
            <i data-lucide="shield-check" class="icon-sm" style="color:var(--accent);"></i>
            <span>Data permohonan surat tersimpan aman dalam Sistem Kearsipan GKJ Salib Putih dan terhubung langsung ke Google Drive Sekretariat.</span>
          </p>
          <button type="submit" id="btnKirimSurat" class="btn-primary btn-full">
            <span>Kirim Permohonan Surat</span>
            <i data-lucide="send" class="icon-sm"></i>
          </button>
        </form>

        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
            <i data-lucide="history" class="icon-sm" style="color:var(--primary);"></i>
            <h3 style="font-size:15px;">Riwayat Pengajuan Terakhir</h3>
          </div>
          ${myHistory.length ? myHistory.map(h => `
            <div class="history-item">
              <div>
                <div style="font-weight:700;font-size:13.5px;">${h.jenisSurat}</div>
                <div style="font-size:12px;color:var(--muted);">Diajukan ${h.tanggal} • Tujuan: ${h.tujuanSurat}</div>
                ${h.arsipSuratUrl ? `
                  <a href="${h.arsipSuratUrl}" target="_blank" class="btn-sm btn-view" style="margin-top:6px;">
                    <i data-lucide="download" class="icon-xs"></i> Unduh Surat Resmi PDF
                  </a>` : ''}
              </div>
              <span class="badge ${h.status === 'Selesai' ? 'badge-selesai' : 'badge-proses'}">
                <i data-lucide="${h.status === 'Selesai' ? 'check-circle-2' : 'clock'}" class="icon-xs"></i>
                ${h.status}
              </span>
            </div>
          `).join('') : '<p style="font-size:13px;color:var(--muted);">Belum ada riwayat pengajuan surat.</p>'}
        </div>
      </div>
    `;

    renderIcons();
    document.getElementById('formPengajuanJemaat').onsubmit = submitSuratJemaat;
  }
}

function updateBerkasLabel(input) {
  if (input.files && input.files[0]) {
    document.getElementById('berkasLabelText').textContent = 'File terpilih: ' + input.files[0].name;
  }
}

async function submitSuratJemaat(e) {
  e.preventDefault();
  const btn = document.getElementById('btnKirimSurat');
  btn.innerHTML = `<span>Mengunggah & Mengirim...</span>`;
  btn.disabled = true;

  try {
    const fd = Object.fromEntries(new FormData(e.target));
    fd.action = 'addSurat';
    fd.noInduk = currentUser.noInduk;

    const fileInput = document.getElementById('berkasInput');
    if (fileInput.files && fileInput.files[0]) {
      const f = fileInput.files[0];
      if (f.size > 3 * 1024 * 1024) throw new Error('Ukuran file maksimal 3MB.');
      fd.berkasBase64 = await fileToBase64(f);
      fd.berkasName = f.name;
      fd.berkasMime = f.type;
    }

    await apiPost(fd);
    showToast('Permohonan surat & berkas berhasil dikirim.');
    renderSurat();
  } catch (err) {
    showToast(err.message || 'Gagal mengirim permohonan.');
  } finally {
    btn.innerHTML = `<span>Kirim Permohonan Surat</span><i data-lucide="send" class="icon-sm"></i>`;
    btn.disabled = false;
    renderIcons();
  }
}

function filterSuratAdmin() {
  const q = (document.getElementById('searchSurat')?.value || '').toLowerCase();
  const list = cache.surat.filter(s =>
    String(s.pemohon).toLowerCase().includes(q) ||
    String(s.jenisSurat).toLowerCase().includes(q) ||
    String(s.wilayah).toLowerCase().includes(q)
  );

  document.getElementById('suratAdminTbody').innerHTML = list.map(s => `
    <tr>
      <td><strong>${s.idSurat}</strong><br><small>${s.tanggal}</small></td>
      <td><strong>${s.pemohon}</strong><br><small>${s.wilayah} (${s.noWA})</small></td>
      <td>${s.jenisSurat}<br><small>Tujuan: ${s.tujuanSurat}</small></td>
      <td>${s.berkasPendukungUrl ? `<a href="${s.berkasPendukungUrl}" target="_blank" class="btn-sm btn-view"><i data-lucide="paperclip" class="icon-xs"></i> Berkas</a>` : '-'}</td>
      <td>${s.arsipSuratUrl ? `<a href="${s.arsipSuratUrl}" target="_blank" class="btn-sm btn-view"><i data-lucide="file-check" class="icon-xs"></i> Arsip PDF</a>` : '<small style="color:#94a3b8;">Belum diunggah</small>'}</td>
      <td><span class="badge ${s.status === 'Selesai' ? 'badge-selesai' : 'badge-proses'}">${s.status}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-sm btn-edit" onclick="openSuratAdminModal('${s.idSurat}')"><i data-lucide="upload" class="icon-xs"></i> Proses / PDF</button>
          <button class="btn-sm btn-del" onclick="deleteSurat('${s.idSurat}')"><i data-lucide="trash-2" class="icon-xs"></i> Hapus</button>
        </div>
      </td>
    </tr>
  `).join('');
  renderIcons();
}

function openSuratAdminModal(idSurat = null) {
  const item = idSurat ? cache.surat.find(x => x.idSurat === idSurat) : null;
  openModal(item ? `Kelola Surat ${item.idSurat}` : 'Catat Pengajuan Surat Baru', `
    <form id="formSuratAdmin" class="form-stack">
      <div class="input-group"><label>Nama Pemohon</label><input name="pemohon" value="${item?.pemohon || ''}" required></div>
      <div class="input-group"><label>Wilayah / Pepanthan</label>
        <select name="wilayah">
          ${WILAYAH_LIST.map(w => `<option value="${w}" ${item?.wilayah === w ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Jenis Surat</label>
        <select name="jenisSurat">
          ${JENIS_SURAT_LIST.map(j => `<option value="${j.title}" ${item?.jenisSurat === j.title ? 'selected' : ''}>${j.title}</option>`).join('')}
        </select>
      </div>
      <div class="input-group"><label>Tujuan Surat</label><input name="tujuanSurat" value="${item?.tujuanSurat || ''}" required></div>
      <div class="input-group"><label>Alamat Instansi / Tujuan</label><input name="alamatTujuan" value="${item?.alamatTujuan || ''}"></div>
      <div class="input-group"><label>No. WhatsApp</label><input name="noWA" value="${item?.noWA || ''}"></div>
      <div class="input-group"><label>Status Layanan</label>
        <select name="status">
          <option value="Proses" ${item?.status === 'Proses' ? 'selected' : ''}>Proses</option>
          <option value="Selesai" ${item?.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
        </select>
      </div>
      ${item ? `
        <div class="input-group">
          <label>Upload Arsip PDF Surat Resmi ke Google Drive (Opsional)</label>
          <input type="file" id="arsipPdfInput" accept="application/pdf" />
        </div>
      ` : ''}
      <button type="submit" id="btnSaveSuratAdmin" class="btn-primary">
        <i data-lucide="save" class="icon-sm"></i>
        <span>Simpan & Sinkron ke Google Drive</span>
      </button>
    </form>
  `);

  document.getElementById('formSuratAdmin').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSaveSuratAdmin');
    btn.textContent = 'Menyimpan...';
    btn.disabled = true;

    const fd = Object.fromEntries(new FormData(e.target));
    fd.action = item ? 'updateSurat' : 'addSurat';
    if (item) {
      fd.idSurat = item.idSurat;
      const pdfFile = document.getElementById('arsipPdfInput')?.files[0];
      if (pdfFile) {
        fd.arsipBase64 = await fileToBase64(pdfFile);
        fd.arsipFileName = pdfFile.name;
      }
    }
    await apiPost(fd);
    closeModal();
    showToast('Data surat & arsip berhasil diperbarui.');
    renderSurat();
  };
}

async function deleteSurat(idSurat) {
  if (!confirm('Hapus data surat ' + idSurat + '?')) return;
  await apiPost({ action: 'deleteSurat', idSurat });
  showToast('Data surat dihapus.');
  renderSurat();
}

// ================= 4. MODUL KEUANGAN =================
async function renderKeuangan() {
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('pageTitle').textContent = isAdmin ? 'Manajemen Kas & Keuangan' : 'Laporan Keuangan Jemaat';
  document.getElementById('pageDesc').textContent = 'Rekapitulasi pemasukan, persembahan, dan pengeluaran pelayanan GKJ Salib Putih';

  const container = document.getElementById('contentContainer');
  container.innerHTML = `<div class="card">Memuat buku kas...</div>`;

  const res = await apiGet('getKeuangan');
  cache.keuangan = res.data || [];

  const masuk = cache.keuangan.filter(k => k.jenis === 'Pemasukan').reduce((a, b) => a + b.nominal, 0);
  const keluar = cache.keuangan.filter(k => k.jenis === 'Pengeluaran').reduce((a, b) => a + b.nominal, 0);
  const saldo = masuk - keluar;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label"><i data-lucide="arrow-down-left" class="icon-xs" style="color:#15803d;"></i> Total Pemasukan</div>
        <div class="stat-val" style="color:#15803d;">Rp ${masuk.toLocaleString('id-ID')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i data-lucide="arrow-up-right" class="icon-xs" style="color:#b91c1c;"></i> Total Pengeluaran</div>
        <div class="stat-val" style="color:#b91c1c;">Rp ${keluar.toLocaleString('id-ID')}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i data-lucide="landmark" class="icon-xs" style="color:#1e3a8a;"></i> Saldo Kas Tercatat</div>
        <div class="stat-val" style="color:#1e3a8a;">Rp ${saldo.toLocaleString('id-ID')}</div>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="search-box">
          <i data-lucide="search" class="icon-sm"></i>
          <input type="text" id="searchKeu" class="search-input" placeholder="Cari uraian atau bidang pos..." oninput="filterKeuTable()" />
        </div>
        ${isAdmin ? `
          <button class="btn-primary" onclick="openKeuModal()">
            <i data-lucide="plus" class="icon-sm"></i>
            <span>Catat Transaksi</span>
          </button>` : ''}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th><th>Uraian Transaksi</th><th>Bidang / Pos</th><th>Jenis</th><th>Nominal</th>
              ${isAdmin ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody id="keuTbody"></tbody>
        </table>
      </div>
    </div>
  `;
  filterKeuTable();
}

function filterKeuTable() {
  const isAdmin = currentUser.role === 'admin';
  const q = (document.getElementById('searchKeu')?.value || '').toLowerCase();
  const list = cache.keuangan.filter(k =>
    String(k.uraian).toLowerCase().includes(q) || String(k.bidangPos).toLowerCase().includes(q)
  );

  document.getElementById('keuTbody').innerHTML = list.map(k => `
    <tr>
      <td>${k.tanggal}</td>
      <td><strong>${k.uraian}</strong><br><small style="color:#64748b;">${k.sumberWarta}</small></td>
      <td>${k.bidangPos}</td>
      <td><span class="badge ${k.jenis === 'Pemasukan' ? 'badge-selesai' : 'badge-proses'}">${k.jenis}</span></td>
      <td><strong>Rp ${Number(k.nominal).toLocaleString('id-ID')}</strong></td>
      ${isAdmin ? `
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm btn-edit" onclick="openKeuModal('${k.idTransaksi}')"><i data-lucide="pencil" class="icon-xs"></i> Edit</button>
            <button class="btn-sm btn-del" onclick="deleteKeu('${k.idTransaksi}')"><i data-lucide="trash-2" class="icon-xs"></i> Hapus</button>
          </div>
        </td>` : ''}
    </tr>
  `).join('');
  renderIcons();
}

function openKeuModal(idTransaksi = null) {
  const item = idTransaksi ? cache.keuangan.find(x => x.idTransaksi === idTransaksi) : null;
  openModal(item ? 'Edit Transaksi Keuangan' : 'Catat Transaksi Keuangan Baru', `
    <form id="formKeu" class="form-stack">
      <div class="input-group"><label>Tanggal</label><input name="tanggal" value="${item?.tanggal || '16 Nov 2026'}" required></div>
      <div class="input-group"><label>Uraian Transaksi</label><input name="uraian" value="${item?.uraian || ''}" required></div>
      <div class="input-group"><label>Bidang / Pos Anggaran</label><input name="bidangPos" value="${item?.bidangPos || 'Persembahan Rutin'}" required></div>
      <div class="input-group"><label>Jenis Transaksi</label>
        <select name="jenis">
          <option value="Pemasukan" ${item?.jenis === 'Pemasukan' ? 'selected' : ''}>Pemasukan</option>
          <option value="Pengeluaran" ${item?.jenis === 'Pengeluaran' ? 'selected' : ''}>Pengeluaran</option>
        </select>
      </div>
      <div class="input-group"><label>Nominal (Rp)</label><input type="number" name="nominal" value="${item?.nominal || ''}" required></div>
      <div class="input-group"><label>Keterangan / Nomor Warta</label><input name="sumberWarta" value="${item?.sumberWarta || 'Input Sekretariat'}"></div>
      <button type="submit" class="btn-primary"><i data-lucide="save" class="icon-sm"></i><span>Simpan Transaksi</span></button>
    </form>
  `);

  document.getElementById('formKeu').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    fd.action = item ? 'updateKeuangan' : 'addKeuangan';
    if (item) fd.idTransaksi = item.idTransaksi;
    await apiPost(fd);
    closeModal();
    showToast('Transaksi keuangan disimpan.');
    renderKeuangan();
  };
}

async function deleteKeu(idTransaksi) {
  if (!confirm('Hapus transaksi ' + idTransaksi + '?')) return;
  await apiPost({ action: 'deleteKeuangan', idTransaksi });
  showToast('Transaksi dihapus.');
  renderKeuangan();
}

// ================= 5. MODUL WARTA JEMAAT =================
async function renderWarta() {
  const isAdmin = currentUser.role === 'admin';
  document.getElementById('pageTitle').textContent = isAdmin ? 'Manajemen Warta Jemaat' : 'Warta Jemaat & Tata Ibadah';
  document.getElementById('pageDesc').textContent = 'Arsip digital Warta Jemaat GKJ Salib Putih langsung dari Google Drive';

  const container = document.getElementById('contentContainer');
  container.innerHTML = `<div class="card">Memuat arsip Warta Jemaat...</div>`;

  const res = await apiGet('getWarta');
  cache.warta = res.data || [];

  container.innerHTML = `
    <div class="toolbar">
      <div class="search-box">
        <i data-lucide="search" class="icon-sm"></i>
        <input type="text" id="searchWarta" class="search-input" placeholder="Cari edisi warta, bulan, atau tanggal..." oninput="filterWartaGrid()" />
      </div>
      ${isAdmin ? `
        <button class="btn-primary" onclick="openUploadWartaModal()">
          <i data-lucide="file-up" class="icon-sm"></i>
          <span>Unggah Warta PDF</span>
        </button>` : ''}
    </div>
    <div id="wartaGrid" class="warta-grid"></div>
  `;
  filterWartaGrid();
}

function filterWartaGrid() {
  const isAdmin = currentUser.role === 'admin';
  const q = (document.getElementById('searchWarta')?.value || '').toLowerCase();
  const list = cache.warta.filter(w =>
    String(w.namaFile).toLowerCase().includes(q) ||
    String(w.bulan).toLowerCase().includes(q) ||
    String(w.updatedAt).toLowerCase().includes(q)
  );

  const grid = document.getElementById('wartaGrid');
  if (!list.length) {
    grid.innerHTML = `<div class="card">Tidak ada edisi warta yang cocok dengan pencarian.</div>`;
    renderIcons();
    return;
  }

  grid.innerHTML = list.map((w, index) => `
    <div class="warta-card">
      <div class="warta-cover">
        ${index === 0 ? `<span class="badge-terbaru">Terbaru</span>` : ''}
        <img src="${w.thumbnailUrl}" alt="${w.namaFile}" onerror="this.src='https://placehold.co/400x520/e2e8f0/1e3a8a?text=Warta+GKJSP'">
      </div>
      <div class="warta-body">
        <div class="warta-title">${w.namaFile}</div>
        <div class="warta-date">${w.updatedAt} (${w.bulan})</div>
        <div class="warta-actions">
          <button class="btn-buka" onclick="previewPdf('${w.previewUrl}', '${w.namaFile}')">
            <i data-lucide="book-open" class="icon-sm"></i>
            <span>Buka</span>
          </button>
          <a href="${w.downloadUrl}" target="_blank" class="btn-unduh" title="Unduh PDF" aria-label="Unduh PDF">
            <i data-lucide="download" class="icon-sm"></i>
          </a>
        </div>
        ${isAdmin ? `
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="btn-sm btn-edit" style="flex:1;" onclick="renameWarta('${w.id}', '${w.namaFile}')">
              <i data-lucide="pencil" class="icon-xs"></i> Ubah Nama
            </button>
            <button class="btn-sm btn-del" onclick="deleteWarta('${w.id}', '${w.namaFile}')">
              <i data-lucide="trash-2" class="icon-xs"></i> Hapus
            </button>
          </div>` : ''}
      </div>
    </div>
  `).join('');
  renderIcons();
}

function previewPdf(url, title) {
  openModal(title, `<iframe src="${url}" style="width:100%;height:72vh;border:none;border-radius:10px;"></iframe>`);
}

function openUploadWartaModal() {
  openModal('Unggah Warta Jemaat Baru (PDF)', `
    <form id="formUploadWarta" class="form-stack">
      <div class="input-group"><label>Nama Folder Bulan (di Google Drive)</label><input name="bulan" value="November 2026" required></div>
      <div class="input-group"><label>Judul / Nomor Warta</label><input name="namaFile" placeholder="Contoh: Warta Jemaat WG-46 GKJSP" required></div>
      <div class="input-group"><label>Pilih File PDF Warta</label><input type="file" id="wartaPdfFile" accept="application/pdf" required></div>
      <button type="submit" id="btnUploadWarta" class="btn-primary">
        <i data-lucide="upload-cloud" class="icon-sm"></i>
        <span>Unggah ke Google Drive</span>
      </button>
    </form>
  `);

  document.getElementById('formUploadWarta').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnUploadWarta');
    btn.textContent = 'Mengunggah PDF...';
    btn.disabled = true;

    const fd = Object.fromEntries(new FormData(e.target));
    const file = document.getElementById('wartaPdfFile').files[0];
    fd.action = 'uploadWarta';
    fd.fileBase64 = await fileToBase64(file);

    await apiPost(fd);
    closeModal();
    showToast('Warta Jemaat berhasil diunggah ke Google Drive.');
    renderWarta();
  };
}

async function renameWarta(fileId, oldName) {
  const namaFile = prompt('Masukkan judul baru untuk Warta Jemaat:', oldName);
  if (!namaFile || namaFile === oldName) return;
  await apiPost({ action: 'updateWarta', fileId, namaFile });
  showToast('Judul warta diperbarui.');
  renderWarta();
}

async function deleteWarta(fileId, name) {
  if (!confirm('Pindahkan "' + name + '" ke sampah Google Drive?')) return;
  await apiPost({ action: 'deleteWarta', fileId });
  showToast('Warta berhasil dihapus.');
  renderWarta();
}

// ================= MODAL & TOAST UTILS =================
function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalOverlay').classList.remove('hidden');
  renderIcons();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3200);
}