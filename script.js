const API_URL = "/.netlify/functions/api";

let currentUser = null;
let currentSalesRows = [];

const loginPage = document.getElementById('loginPage');
const staffPage = document.getElementById('staffPage');
const adminPage = document.getElementById('adminPage');
const modalHost = document.getElementById('modalHost');

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('logoutBtn1').addEventListener('click', logout);
document.getElementById('logoutBtn2').addEventListener('click', logout);
document.getElementById('loadSalesBtn').addEventListener('click', loadSales);
document.getElementById('submitSalesBtn').addEventListener('click', openSubmitConfirmation);
document.getElementById('refreshAdminBtn').addEventListener('click', loadAdminSubmissions);

function showMessage(id, text, type = '') {
  const el = document.getElementById(id);
  el.className = `msg ${type}`;
  el.textContent = text || '';
}

function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiRequest(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return await response.json();
}

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();

  showMessage('loginMsg', 'Checking login...');

  try {
    const res = await apiRequest({
      action: 'login',
      username,
      password
    });

    if (!res.ok) {
      showMessage('loginMsg', res.message || 'Login failed.', 'error');
      return;
    }

    currentUser = res.user;
    loginPage.classList.add('hidden');

    if (currentUser.role === 'admin') {
      adminPage.classList.remove('hidden');
      document.getElementById('adminWelcome').textContent = `Welcome, ${currentUser.staff_name}`;
      loadAdminSubmissions();
    } else {
      staffPage.classList.remove('hidden');
      document.getElementById('staffWelcome').textContent = `Welcome, ${currentUser.staff_name}`;
      document.getElementById('staffDate').value = getTodayInputDate();
      loadTodaySubmissions();
    }
  } catch (err) {
    showMessage('loginMsg', 'Login error.', 'error');
  }
}

function logout() {
  currentUser = null;
  currentSalesRows = [];

  loginPage.classList.remove('hidden');
  staffPage.classList.add('hidden');
  adminPage.classList.add('hidden');

  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('salesArea').classList.add('hidden');

  document.getElementById('salesTableBody').innerHTML = '';
  document.getElementById('todayTableBody').innerHTML = '';
  document.getElementById('adminTableBody').innerHTML = '';

  showMessage('loginMsg', '');
  showMessage('salesMsg', '');
  showMessage('todayMsg', '');
  showMessage('adminMsg', '');
}

function getTodayInputDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadSales() {
  const selectedDate = document.getElementById('staffDate').value;

  if (!selectedDate) {
    showMessage('salesMsg', 'Please select a date.', 'error');
    return;
  }

  showMessage('salesMsg', 'Loading sales...');

  try {
    const res = await apiRequest({
      action: 'getSalesByDate',
      selectedDate
    });

    if (!res.ok) {
      showMessage('salesMsg', res.message || 'Failed to load sales.', 'error');
      return;
    }

    currentSalesRows = res.rows || [];
    renderSalesTable(currentSalesRows);
    document.getElementById('salesArea').classList.remove('hidden');
    showMessage('salesMsg', '');
  } catch (err) {
    showMessage('salesMsg', 'Failed to load sales.', 'error');
  }
}

function renderSalesTable(rows) {
  const body = document.getElementById('salesTableBody');
  body.innerHTML = '';

  document.getElementById('rowsFound').textContent = rows.length;
  document.getElementById('selectedCount').textContent = '0';
  document.getElementById('selectedGross').textContent = '0.00';

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5">No sales found for selected date.</td></tr>';
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (row.is_submitted) tr.classList.add('submitted-row');

    const submittedNote = row.is_submitted
      ? `<span class="small-note">Submitted by ${escapeHtml(row.submitted_by)} on ${escapeHtml(row.submitted_at)}</span>`
      : '';

    tr.innerHTML = `
      <td><input type="checkbox" class="sale-check" data-index="${index}"></td>
      <td>${escapeHtml(row.file_no)}</td>
      <td>${escapeHtml(row.patient)}${submittedNote}</td>
      <td>${escapeHtml(row.treatment)}</td>
      <td>AED ${Number(row.gross).toFixed(2)}</td>
    `;

    body.appendChild(tr);
  });

  document.querySelectorAll('.sale-check').forEach(chk => {
    chk.addEventListener('change', updateSelectedSummary);
  });
}

function getSelectedRows() {
  const selected = [];
  document.querySelectorAll('.sale-check:checked').forEach(chk => {
    const index = Number(chk.dataset.index);
    if (!isNaN(index) && currentSalesRows[index]) {
      selected.push(currentSalesRows[index]);
    }
  });
  return selected;
}

function updateSelectedSummary() {
  const selected = getSelectedRows();
  const total = selected.reduce((sum, row) => sum + Number(row.gross || 0), 0);

  document.getElementById('selectedCount').textContent = selected.length;
  document.getElementById('selectedGross').textContent = total.toFixed(2);
}

function openSubmitConfirmation() {
  const selected = getSelectedRows();

  if (!selected.length) {
    showMessage('salesMsg', 'Please select at least one row.', 'error');
    return;
  }

  const total = selected.reduce((sum, row) => sum + Number(row.gross || 0), 0);

  openModal(`
    <h3>Confirm Submission</h3>
    <p>You selected <strong>${selected.length}</strong> row(s).</p>
    <p>Total Gross: <strong>AED ${total.toFixed(2)}</strong></p>
    <p>Are you sure you want to submit these sales?</p>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="submitSelected(false)">Confirm Submit</button>
    </div>
  `);
}

async function submitSelected(overrideDuplicates) {
  closeModal();

  const selected = getSelectedRows();

  if (!selected.length) {
    showMessage('salesMsg', 'Please select at least one row.', 'error');
    return;
  }

  showMessage('salesMsg', 'Submitting sales...');

  try {
    const res = await apiRequest({
      action: 'submitSales',
      staffName: currentUser.staff_name,
      rows: selected,
      overrideDuplicates: !!overrideDuplicates
    });

    if (!res.ok && res.duplicateWarning) {
      showDuplicateModal(res.duplicates || []);
      return;
    }

    if (!res.ok) {
      showMessage('salesMsg', res.message || 'Submit failed.', 'error');
      return;
    }

    showMessage('salesMsg', res.message || 'Submitted successfully.', 'success');
    loadSales();
    loadTodaySubmissions();
  } catch (err) {
    showMessage('salesMsg', 'Submit failed.', 'error');
  }
}

function showDuplicateModal(duplicates) {
  let rows = duplicates.map(d => `
    <tr>
      <td>${escapeHtml(d.file_no)}</td>
      <td>${escapeHtml(d.patient)}</td>
      <td>${escapeHtml(d.submitted_by)}</td>
      <td>${escapeHtml(d.submitted_at)}</td>
    </tr>
  `).join('');

  openModal(`
    <h3>Duplicate Warning</h3>
    <p>Some selected sales were already submitted.</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>File no</th>
            <th>Patient</th>
            <th>Submitted by</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="submitSelected(true)">Submit Anyway</button>
    </div>
  `);
}

async function loadTodaySubmissions() {
  if (!currentUser || currentUser.role !== 'staff') return;

  showMessage('todayMsg', 'Loading today submissions...');

  try {
    const res = await apiRequest({
      action: 'getTodaySubmissions',
      staffName: currentUser.staff_name
    });

    if (!res.ok) {
      showMessage('todayMsg', res.message || 'Failed to load today submissions.', 'error');
      return;
    }

    renderTodayTable(res.rows || []);
    showMessage('todayMsg', '');
  } catch (err) {
    showMessage('todayMsg', 'Failed to load today submissions.', 'error');
  }
}

function renderTodayTable(rows) {
  const body = document.getElementById('todayTableBody');
  body.innerHTML = '';

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="5">No submissions today.</td></tr>';
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.timestamp)}</td>
      <td>${escapeHtml(row.file_no)}</td>
      <td>${escapeHtml(row.patient)}</td>
      <td>${escapeHtml(row.treatment)}</td>
      <td>AED ${Number(row.gross).toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });
}

async function loadAdminSubmissions() {
  showMessage('adminMsg', 'Loading submissions...');

  try {
    const res = await apiRequest({
      action: 'getAllSubmissions'
    });

    if (!res.ok) {
      showMessage('adminMsg', res.message || 'Failed to load admin submissions.', 'error');
      return;
    }

    renderAdminTable(res.rows || []);
    showMessage('adminMsg', '');
  } catch (err) {
    showMessage('adminMsg', 'Failed to load admin submissions.', 'error');
  }
}

function renderAdminTable(rows) {
  const body = document.getElementById('adminTableBody');
  body.innerHTML = '';

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8">No submissions found.</td></tr>';
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(row.timestamp)}</td>
      <td>${escapeHtml(row.staff_name)}</td>
      <td>${escapeHtml(row.sale_date)}</td>
      <td>${escapeHtml(row.file_no)}</td>
      <td>${escapeHtml(row.patient)}</td>
      <td>${escapeHtml(row.treatment)}</td>
      <td>AED ${Number(row.gross).toFixed(2)}</td>
      <td>
        <button class="btn-secondary" onclick='openEditModal(${JSON.stringify(JSON.stringify(row))})'>Edit</button>
        <button class="btn-danger" onclick="deleteAdminSubmission(${row.row_number})">Delete</button>
      </td>
    `;
    body.appendChild(tr);
  });
}

function openEditModal(rowJson) {
  const row = JSON.parse(rowJson);

  openModal(`
    <h3>Edit Submission</h3>
    <div class="form-group">
      <label>Staff name</label>
      <input type="text" id="edit_staff_name" value="${escapeHtml(row.staff_name)}">
    </div>
    <div class="form-group">
      <label>Sale date</label>
      <input type="text" id="edit_sale_date" value="${escapeHtml(row.sale_date)}">
    </div>
    <div class="form-group">
      <label>File no</label>
      <input type="text" id="edit_file_no" value="${escapeHtml(row.file_no)}">
    </div>
    <div class="form-group">
      <label>Patient</label>
      <input type="text" id="edit_patient" value="${escapeHtml(row.patient)}">
    </div>
    <div class="form-group">
      <label>Mobile</label>
      <input type="text" id="edit_mobile" value="${escapeHtml(row.mobile)}">
    </div>
    <div class="form-group">
      <label>Treatment</label>
      <textarea id="edit_treatment">${escapeHtml(row.treatment)}</textarea>
    </div>
    <div class="form-group">
      <label>Gross</label>
      <input type="number" id="edit_gross" value="${Number(row.gross)}">
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="saveAdminEdit(${row.row_number})">Save</button>
    </div>
  `);
}

async function saveAdminEdit(rowNumber) {
  const record = {
    staff_name: document.getElementById('edit_staff_name').value.trim(),
    sale_date: document.getElementById('edit_sale_date').value.trim(),
    file_no: document.getElementById('edit_file_no').value.trim(),
    patient: document.getElementById('edit_patient').value.trim(),
    mobile: document.getElementById('edit_mobile').value.trim(),
    treatment: document.getElementById('edit_treatment').value.trim(),
    gross: document.getElementById('edit_gross').value.trim()
  };

  try {
    const res = await apiRequest({
      action: 'updateSubmission',
      rowNumber,
      record
    });

    if (!res.ok) {
      alert(res.message || 'Update failed.');
      return;
    }

    closeModal();
    loadAdminSubmissions();
  } catch (err) {
    alert('Update failed.');
  }
}

async function deleteAdminSubmission(rowNumber) {
  if (!confirm('Are you sure you want to delete this submission?')) return;

  try {
    const res = await apiRequest({
      action: 'deleteSubmission',
      rowNumber
    });

    if (!res.ok) {
      alert(res.message || 'Delete failed.');
      return;
    }

    loadAdminSubmissions();
  } catch (err) {
    alert('Delete failed.');
  }
}

function openModal(html) {
  modalHost.classList.remove('hidden');
  modalHost.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        ${html}
      </div>
    </div>
  `;
}

function closeModal() {
  modalHost.classList.add('hidden');
  modalHost.innerHTML = '';
}

window.closeModal = closeModal;
window.submitSelected = submitSelected;
window.openEditModal = openEditModal;
window.deleteAdminSubmission = deleteAdminSubmission;
window.saveAdminEdit = saveAdminEdit;
