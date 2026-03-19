const API_URL = "https://script.google.com/macros/s/AKfycbzYwnjDR3s97mfl7TG3HSxRw1zpfy-N9DVMXsluE2o7COg9pFZq-WcQZQ1MBMQPZfPQpg/exec";

let currentUser = null;
let currentSalesRows = [];
let pendingDuplicateOverrideRows = [];

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  bindEvents();
  restoreSession();
}

function bindEvents() {
  const $ = id => document.getElementById(id);

  if ($("loginBtn")) $("loginBtn").addEventListener("click", doLogin);
  if ($("logoutBtn1")) $("logoutBtn1").addEventListener("click", logout);
  if ($("logoutBtn2")) $("logoutBtn2").addEventListener("click", logout);
  if ($("loadSalesBtn")) $("loadSalesBtn").addEventListener("click", loadSales);
  if ($("submitSalesBtn")) $("submitSalesBtn").addEventListener("click", openSubmitConfirm);
  if ($("refreshAdminBtn")) $("refreshAdminBtn").addEventListener("click", loadAdminData);
  if ($("applyAdminFilterBtn")) $("applyAdminFilterBtn").addEventListener("click", loadAdminData);
  if ($("downloadMonthlyPdfBtn")) $("downloadMonthlyPdfBtn").addEventListener("click", downloadMonthlyPdf);
  if ($("openMissingSaleBtn")) $("openMissingSaleBtn").addEventListener("click", openMissingSaleModal);

  if ($("createTaskBtn")) $("createTaskBtn").addEventListener("click", createTask);
  if ($("refreshTasksBtn")) $("refreshTasksBtn").addEventListener("click", loadTasks);
  if ($("applyTaskFilterBtn")) $("applyTaskFilterBtn").addEventListener("click", loadTasks);
}

function $(id) {
  return document.getElementById(id);
}

function showMessage(id, text, type = "") {
  const el = $(id);
  if (!el) return;
  el.className = `msg ${type}`;
  el.textContent = text || "";
}

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function apiRequest(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  return await response.json();
}

function persistSession(user) {
  localStorage.setItem("staffPortalUser", JSON.stringify(user));
}

function restoreSession() {
  const saved = localStorage.getItem("staffPortalUser");
  if (!saved) return;

  try {
    currentUser = JSON.parse(saved);
    showLoggedInUI();
  } catch {
    localStorage.removeItem("staffPortalUser");
  }
}

function logout() {
  currentUser = null;
  currentSalesRows = [];
  pendingDuplicateOverrideRows = [];
  localStorage.removeItem("staffPortalUser");

  if ($("loginPage")) $("loginPage").classList.remove("hidden");
  if ($("staffPage")) $("staffPage").classList.add("hidden");
  if ($("adminPage")) $("adminPage").classList.add("hidden");
  if ($("username")) $("username").value = "";
  if ($("password")) $("password").value = "";
  if ($("salesArea")) $("salesArea").classList.add("hidden");
  if ($("salesTableBody")) $("salesTableBody").innerHTML = "";
  if ($("todayTableBody")) $("todayTableBody").innerHTML = "";
  if ($("adminTableBody")) $("adminTableBody").innerHTML = "";
  if ($("missingTableBody")) $("missingTableBody").innerHTML = "";
  if ($("taskTableBody")) $("taskTableBody").innerHTML = "";

  showMessage("loginMsg", "");
  showMessage("salesMsg", "");
  showMessage("todayMsg", "");
  showMessage("adminMsg", "");
  showMessage("missingMsg", "");
  showMessage("taskMsg", "");
}

async function doLogin() {
  const username = $("username").value.trim();
  const password = $("password").value.trim();

  showMessage("loginMsg", "Checking login...");

  try {
    const res = await apiRequest({
      action: "login",
      username,
      password
    });

    if (!res.ok) {
      showMessage("loginMsg", res.message || "Login failed.", "error");
      return;
    }

    currentUser = res.user;

    if (currentUser.temp_password) {
      openChangePasswordModal();
      return;
    }

    persistSession(currentUser);
    showLoggedInUI();
  } catch (err) {
    showMessage("loginMsg", "Connection error.", "error");
  }
}

function showLoggedInUI() {
  if ($("loginPage")) $("loginPage").classList.add("hidden");

  if (currentUser.role === "admin") {
    if ($("adminPage")) $("adminPage").classList.remove("hidden");
    if ($("staffPage")) $("staffPage").classList.add("hidden");
    if ($("adminWelcome")) $("adminWelcome").textContent = `Welcome, ${currentUser.staff_name}`;
    loadAdminData();
  } else {
    if ($("staffPage")) $("staffPage").classList.remove("hidden");
    if ($("adminPage")) $("adminPage").classList.add("hidden");
    if ($("staffWelcome")) $("staffWelcome").textContent = `Welcome, ${currentUser.staff_name}`;
    if ($("staffDate")) $("staffDate").value = getTodayInputDate();
    loadTodaySubmissions();
  }
}

function getTodayInputDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function openChangePasswordModal() {
  openModal(`
    <h3>Create New Password</h3>
    <p class="modal-text">Please create your new password before continuing.</p>
    <div class="form-group">
      <label>New Password</label>
      <input type="password" id="newPassword1" placeholder="Enter new password">
    </div>
    <div class="form-group">
      <label>Confirm New Password</label>
      <input type="password" id="newPassword2" placeholder="Confirm new password">
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="submitPasswordChange()">Save Password</button>
    </div>
  `);
}

async function submitPasswordChange() {
  const p1 = $("newPassword1").value.trim();
  const p2 = $("newPassword2").value.trim();

  if (!p1 || !p2) {
    alert("Please enter the new password.");
    return;
  }

  if (p1 !== p2) {
    alert("Passwords do not match.");
    return;
  }

  try {
    const res = await apiRequest({
      action: "changePassword",
      username: currentUser.username,
      new_password: p1
    });

    if (!res.ok) {
      alert(res.message || "Password change failed.");
      return;
    }

    currentUser.temp_password = false;
    persistSession(currentUser);
    closeModal();
    showLoggedInUI();
  } catch {
    alert("Password change failed.");
  }
}

async function loadSales() {
  const date = $("staffDate").value;

  if (!date) {
    showMessage("salesMsg", "Please select a date.", "error");
    return;
  }

  showMessage("salesMsg", "Loading sales...");

  try {
    const res = await apiRequest({
      action: "getSales",
      date,
      role: currentUser.role
    });

    if (!res.ok) {
      showMessage("salesMsg", res.message || "Failed to load sales.", "error");
      if ($("salesArea")) $("salesArea").classList.add("hidden");
      return;
    }

    currentSalesRows = res.rows || [];
    renderSalesTable(currentSalesRows);
    if ($("salesArea")) $("salesArea").classList.remove("hidden");
    showMessage("salesMsg", "");
  } catch {
    showMessage("salesMsg", "Failed to load sales.", "error");
  }
}

function renderSalesTable(rows) {
  const body = $("salesTableBody");
  body.innerHTML = "";

  $("rowsFound").textContent = rows.length;
  $("selectedCount").textContent = "0";
  $("selectedGross").textContent = "0.00";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5">No sales found for selected date.</td></tr>`;
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    if (row.is_submitted) tr.classList.add("submitted-row");

    const note = row.is_submitted
      ? `<span class="small-note">Submitted by ${escapeHtml(row.submitted_by)}</span>`
      : "";

    tr.innerHTML = `
      <td data-label="Select"><input type="checkbox" class="sale-check" data-index="${index}"></td>
      <td data-label="File no">${escapeHtml(row.file)}</td>
      <td data-label="Patient">${escapeHtml(row.patient)}${note}</td>
      <td data-label="Treatment">${escapeHtml(row.treatment)}</td>
      <td data-label="Gross">AED ${Number(row.gross).toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });

  document.querySelectorAll(".sale-check").forEach(chk => {
    chk.addEventListener("change", updateSelectedSummary);
  });
}

function getSelectedRows() {
  const selected = [];
  document.querySelectorAll(".sale-check:checked").forEach(chk => {
    const idx = Number(chk.dataset.index);
    if (!isNaN(idx) && currentSalesRows[idx]) {
      selected.push(currentSalesRows[idx]);
    }
  });
  return selected;
}

function updateSelectedSummary() {
  const selected = getSelectedRows();
  const total = selected.reduce((sum, row) => sum + Number(row.gross || 0), 0);

  $("selectedCount").textContent = selected.length;
  $("selectedGross").textContent = total.toFixed(2);
}

function openSubmitConfirm() {
  const rows = getSelectedRows();

  if (!rows.length) {
    showMessage("salesMsg", "Please select at least one row.", "error");
    return;
  }

  const total = rows.reduce((sum, row) => sum + Number(row.gross || 0), 0);

  openModal(`
    <h3>Confirm Submission</h3>
    <p class="modal-text">You selected <strong>${rows.length}</strong> row(s).</p>
    <p class="modal-text">Total Gross: <strong>AED ${total.toFixed(2)}</strong></p>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="submitSelectedSales(false)">Submit</button>
    </div>
  `);
}

async function submitSelectedSales(allowDuplicate) {
  closeModal();

  const rows = pendingDuplicateOverrideRows.length
    ? pendingDuplicateOverrideRows
    : getSelectedRows();

  if (!rows.length) {
    showMessage("salesMsg", "Please select rows first.", "error");
    return;
  }

  showMessage("salesMsg", "Submitting...");

  try {
    const res = await apiRequest({
      action: "submitSales",
      staff: currentUser.staff_name,
      role: currentUser.role,
      date: $("staffDate").value,
      rows,
      allowDuplicate
    });

    if (!res.ok && res.duplicateWarning) {
      pendingDuplicateOverrideRows = rows;
      openDuplicateModal(res.duplicates || []);
      return;
    }

    if (!res.ok) {
      showMessage("salesMsg", res.message || "Submission failed.", "error");
      pendingDuplicateOverrideRows = [];
      return;
    }

    pendingDuplicateOverrideRows = [];
    showMessage("salesMsg", res.message || "Submitted successfully.", "success");
    await loadSales();
    await loadTodaySubmissions();
  } catch {
    showMessage("salesMsg", "Submission failed.", "error");
  }
}

function openDuplicateModal(duplicates) {
  const rows = duplicates.map(d => `
    <tr>
      <td>File no</td>
      <td>${escapeHtml(d.file)}</td>
    </tr>
    <tr>
      <td>Patient</td>
      <td>${escapeHtml(d.patient)}</td>
    </tr>
    <tr>
      <td>Submitted by</td>
      <td>${escapeHtml(d.submitted_by)}</td>
    </tr>
    <tr>
      <td>Time</td>
      <td>${escapeHtml(d.submitted_at)}</td>
    </tr>
  `).join("");

  openModal(`
    <h3>Duplicate Warning</h3>
    <p class="modal-text">Some selected rows were already submitted.</p>
    <div class="table-wrap compact-table">
      <table>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="submitSelectedSales(true)">Submit Anyway</button>
    </div>
  `);
}

async function loadTodaySubmissions() {
  if (!currentUser || currentUser.role !== "staff") return;

  showMessage("todayMsg", "Loading today's submissions...");

  try {
    const res = await apiRequest({
      action: "todaySubmissions",
      staff: currentUser.staff_name
    });

    if (!res.ok) {
      showMessage("todayMsg", res.message || "Failed to load.", "error");
      return;
    }

    renderTodayTable(res.rows || []);
    showMessage("todayMsg", "");
  } catch {
    showMessage("todayMsg", "Failed to load.", "error");
  }
}

function renderTodayTable(rows) {
  const body = $("todayTableBody");
  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5">No submissions today.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Time">${escapeHtml(r.time)}</td>
      <td data-label="File no">${escapeHtml(r.file)}</td>
      <td data-label="Patient">${escapeHtml(r.patient)}</td>
      <td data-label="Treatment">${escapeHtml(r.treatment)}</td>
      <td data-label="Gross">AED ${Number(r.gross).toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });
}

function openMissingSaleModal() {
  openModal(`
    <h3>Add Missing Sale</h3>
    <p class="modal-text">This request will go to admin for approval.</p>
    <div class="form-group">
      <label>Client File Number</label>
      <input type="text" id="missingFile" placeholder="Enter file number">
    </div>
    <div class="form-group">
      <label>Date of Payment</label>
      <input type="date" id="missingDate">
    </div>
    <div class="form-group">
      <label>Treatment</label>
      <input type="text" id="missingTreatment" placeholder="Enter treatment">
    </div>
    <div class="form-group">
      <label>Gross without VAT</label>
      <input type="number" id="missingGross" placeholder="Enter amount">
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="submitMissingSale()">Submit Request</button>
    </div>
  `);
}

async function submitMissingSale() {
  const file = $("missingFile").value.trim();
  const paymentDate = $("missingDate").value.trim();
  const treatment = $("missingTreatment").value.trim();
  const gross = $("missingGross").value.trim();

  if (!file || !paymentDate || !treatment || !gross) {
    alert("Please complete all fields.");
    return;
  }

  try {
    const res = await apiRequest({
      action: "addMissingSale",
      staff: currentUser.staff_name,
      file,
      payment_date: paymentDate,
      treatment,
      gross
    });

    if (!res.ok) {
      alert(res.message || "Could not submit missing sale request.");
      return;
    }

    closeModal();
    alert("Missing sale request sent to admin.");
  } catch {
    alert("Could not submit missing sale request.");
  }
}

async function loadAdminData() {
  await loadAdminSubmissions();
  await loadMissingRequests();
  await loadTasks();
}

async function loadAdminSubmissions() {
  showMessage("adminMsg", "Loading submissions...");

  try {
    const res = await apiRequest({
      action: "getAdminSubmissions",
      singleDate: $("adminSingleDate") ? $("adminSingleDate").value : "",
      fromDate: $("adminFromDate") ? $("adminFromDate").value : "",
      toDate: $("adminToDate") ? $("adminToDate").value : ""
    });

    if (!res.ok) {
      showMessage("adminMsg", res.message || "Failed to load submissions.", "error");
      return;
    }

    renderAdminSubmissions(res.rows || []);
    showMessage("adminMsg", "");
  } catch {
    showMessage("adminMsg", "Failed to load submissions.", "error");
  }
}

function renderAdminSubmissions(rows) {
  const body = $("adminTableBody");
  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8">No submissions found.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Time">${escapeHtml(r.timestamp)}</td>
      <td data-label="Staff">${escapeHtml(r.staff)}</td>
      <td data-label="Sale date">${escapeHtml(r.sale_date)}</td>
      <td data-label="File no">${escapeHtml(r.file)}</td>
      <td data-label="Patient">${escapeHtml(r.patient)}</td>
      <td data-label="Treatment">${escapeHtml(r.treatment)}</td>
      <td data-label="Gross">AED ${Number(r.gross).toFixed(2)}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="btn-secondary btn-small" onclick='openEditSubmissionModal(${JSON.stringify(JSON.stringify(r))})'>Edit</button>
          <button class="btn-danger btn-small" onclick='deleteSubmission(${r.row_number})'>Delete</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

function openEditSubmissionModal(rowJson) {
  const row = JSON.parse(rowJson);

  openModal(`
    <h3>Edit Submission</h3>
    <div class="form-group">
      <label>Staff name</label>
      <input type="text" id="editStaff" value="${escapeHtml(row.staff)}">
    </div>
    <div class="form-group">
      <label>Sale date</label>
      <input type="date" id="editSaleDate" value="${escapeHtml(row.sale_date)}">
    </div>
    <div class="form-group">
      <label>File no</label>
      <input type="text" id="editFile" value="${escapeHtml(row.file)}">
    </div>
    <div class="form-group">
      <label>Patient</label>
      <input type="text" id="editPatient" value="${escapeHtml(row.patient)}">
    </div>
    <div class="form-group">
      <label>Mobile</label>
      <input type="text" id="editMobile" value="${escapeHtml(row.mobile || "")}">
    </div>
    <div class="form-group">
      <label>Treatment</label>
      <textarea id="editTreatment">${escapeHtml(row.treatment)}</textarea>
    </div>
    <div class="form-group">
      <label>Gross</label>
      <input type="number" id="editGross" value="${Number(row.gross)}">
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="saveSubmissionEdit(${row.row_number})">Save</button>
    </div>
  `);
}

async function saveSubmissionEdit(rowNumber) {
  const record = {
    staff: $("editStaff").value.trim(),
    sale_date: $("editSaleDate").value.trim(),
    file: $("editFile").value.trim(),
    patient: $("editPatient").value.trim(),
    mobile: $("editMobile").value.trim(),
    treatment: $("editTreatment").value.trim(),
    gross: $("editGross").value.trim()
  };

  try {
    const res = await apiRequest({
      action: "updateSubmission",
      row_number: rowNumber,
      record
    });

    if (!res.ok) {
      alert(res.message || "Update failed.");
      return;
    }

    closeModal();
    loadAdminSubmissions();
  } catch {
    alert("Update failed.");
  }
}

async function deleteSubmission(rowNumber) {
  if (!confirm("Delete this submission?")) return;

  try {
    const res = await apiRequest({
      action: "deleteSubmission",
      row_number: rowNumber
    });

    if (!res.ok) {
      alert(res.message || "Delete failed.");
      return;
    }

    loadAdminSubmissions();
  } catch {
    alert("Delete failed.");
  }
}

async function loadMissingRequests() {
  showMessage("missingMsg", "Loading missing sale requests...");

  try {
    const res = await apiRequest({
      action: "getMissingRequests",
      singleDate: $("adminSingleDate") ? $("adminSingleDate").value : "",
      fromDate: $("adminFromDate") ? $("adminFromDate").value : "",
      toDate: $("adminToDate") ? $("adminToDate").value : ""
    });

    if (!res.ok) {
      showMessage("missingMsg", res.message || "Failed to load missing sale requests.", "error");
      return;
    }

    renderMissingRequests(res.rows || []);
    showMessage("missingMsg", "");
  } catch {
    showMessage("missingMsg", "Failed to load missing sale requests.", "error");
  }
}

function renderMissingRequests(rows) {
  const body = $("missingTableBody");
  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9">No missing sale requests found.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Requested">${escapeHtml(r.timestamp)}</td>
      <td data-label="Staff">${escapeHtml(r.staff)}</td>
      <td data-label="File no">${escapeHtml(r.file)}</td>
      <td data-label="Payment date">${escapeHtml(r.payment_date)}</td>
      <td data-label="Treatment">${escapeHtml(r.treatment)}</td>
      <td data-label="Gross">AED ${Number(r.gross).toFixed(2)}</td>
      <td data-label="Status">${escapeHtml(r.status)}</td>
      <td data-label="Admin note">${escapeHtml(r.note || "")}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="btn-secondary btn-small" onclick='approveMissing(${r.row_number})' ${r.status !== "Pending" ? "disabled" : ""}>Approve</button>
          <button class="btn-danger btn-small" onclick='openRejectMissingModal(${r.row_number})' ${r.status !== "Pending" ? "disabled" : ""}>Reject</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

async function approveMissing(rowNumber) {
  if (!confirm("Approve this missing sale?")) return;

  try {
    const res = await apiRequest({
      action: "approveMissing",
      row_number: rowNumber
    });

    if (!res.ok) {
      alert(res.message || "Approval failed.");
      return;
    }

    loadMissingRequests();
  } catch {
    alert("Approval failed.");
  }
}

function openRejectMissingModal(rowNumber) {
  openModal(`
    <h3>Reject Missing Sale</h3>
    <div class="form-group">
      <label>Rejection Reason</label>
      <textarea id="rejectReason" placeholder="Enter rejection reason"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="submitRejectMissing(${rowNumber})">Reject</button>
    </div>
  `);
}

async function submitRejectMissing(rowNumber) {
  const note = $("rejectReason").value.trim();

  try {
    const res = await apiRequest({
      action: "rejectMissing",
      row_number: rowNumber,
      note
    });

    if (!res.ok) {
      alert(res.message || "Rejection failed.");
      return;
    }

    closeModal();
    loadMissingRequests();
  } catch {
    alert("Rejection failed.");
  }
}

async function loadTasks() {
  showMessage("taskMsg", "Loading tasks...");

  try {
    const assignedValue = $("taskAssignedFilter") ? $("taskAssignedFilter").value.trim() : "";

    const res = await apiRequest({
      action: "getTasks",
      status: $("taskStatusFilter") ? $("taskStatusFilter").value : "All",
      branch: $("taskBranchFilter") ? $("taskBranchFilter").value : "All",
      assigned_to: assignedValue || "All"
    });

    if (!res.ok) {
      showMessage("taskMsg", res.message || "Failed to load tasks.", "error");
      return;
    }

    renderTasks(res.rows || []);
    showMessage("taskMsg", "");
  } catch {
    showMessage("taskMsg", "Failed to load tasks.", "error");
  }
}

function renderTasks(rows) {
  const body = $("taskTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8">No tasks found.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Created">${escapeHtml(r.timestamp)}</td>
      <td data-label="Title">
        <strong>${escapeHtml(r.title)}</strong><br>
        <span class="small-note">${escapeHtml(r.description || "")}</span>
      </td>
      <td data-label="Assigned To">${escapeHtml(r.assigned_to)}</td>
      <td data-label="Branch">${escapeHtml(r.branch)}</td>
      <td data-label="Priority">${escapeHtml(r.priority)}</td>
      <td data-label="Due Date">${escapeHtml(r.due_date)}</td>
      <td data-label="Status">${escapeHtml(r.status)}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="btn-secondary btn-small" onclick='updateTaskStatus(${r.row_number}, "In Progress")'>Start</button>
          <button class="btn-light btn-small" onclick='updateTaskStatus(${r.row_number}, "Completed")'>Done</button>
          <button class="btn-danger btn-small" onclick='updateTaskStatus(${r.row_number}, "Cancelled")'>Cancel</button>
        </div>
      </td>
    `;

    body.appendChild(tr);
  });
}

async function createTask() {
  const title = $("taskTitle") ? $("taskTitle").value.trim() : "";
  const description = $("taskDesc") ? $("taskDesc").value.trim() : "";
  const assignedTo = $("taskAssign") ? $("taskAssign").value.trim() : "";
  const branch = $("taskBranch") ? $("taskBranch").value : "";
  const priority = $("taskPriority") ? $("taskPriority").value : "";
  const dueDate = $("taskDue") ? $("taskDue").value : "";

  if (!title || !assignedTo || !branch || !priority || !dueDate) {
    showMessage("taskMsg", "Please complete all task fields.", "error");
    return;
  }

  showMessage("taskMsg", "Creating task...");

  try {
    const res = await apiRequest({
      action: "addTask",
      title,
      description,
      assigned_to: assignedTo,
      created_by: currentUser.staff_name,
      branch,
      priority,
      due_date: dueDate
    });

    if (!res.ok) {
      showMessage("taskMsg", res.message || "Failed to create task.", "error");
      return;
    }

    if ($("taskTitle")) $("taskTitle").value = "";
    if ($("taskDesc")) $("taskDesc").value = "";
    if ($("taskAssign")) $("taskAssign").value = "";
    if ($("taskBranch")) $("taskBranch").value = "Jumeirah";
    if ($("taskPriority")) $("taskPriority").value = "Low";
    if ($("taskDue")) $("taskDue").value = "";

    showMessage("taskMsg", res.message || "Task created successfully.", "success");
    await loadTasks();
  } catch {
    showMessage("taskMsg", "Failed to create task.", "error");
  }
}

async function updateTaskStatus(rowNumber, status) {
  try {
    const res = await apiRequest({
      action: "updateTaskStatus",
      row_number: rowNumber,
      status
    });

    if (!res.ok) {
      showMessage("taskMsg", res.message || "Failed to update task.", "error");
      return;
    }

    showMessage("taskMsg", "Task updated successfully.", "success");
    await loadTasks();
  } catch {
    showMessage("taskMsg", "Failed to update task.", "error");
  }
}

async function downloadMonthlyPdf() {
  try {
    const res = await apiRequest({
      action: "getMonthlyReport",
      staff: currentUser.staff_name
    });

    if (!res.ok) {
      alert(res.message || "Could not generate report.");
      return;
    }

    if (!res.rows || !res.rows.length) {
      alert("No records found for the current month.");
      return;
    }

    const logoData = await loadLogoAsPngDataUrl("assets/logo.svg");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "pt", "a4");

    if (logoData) {
      doc.addImage(logoData, "PNG", 40, 30, 120, 40);
    }

    doc.setFontSize(18);
    doc.text("Monthly Submission Report", 40, 95);

    doc.setFontSize(11);
    doc.text(`Staff: ${currentUser.staff_name}`, 40, 115);
    doc.text(`Month: ${res.month}`, 40, 132);
    doc.text(`Total Gross: AED ${Number(res.total_gross || 0).toFixed(2)}`, 40, 149);

    const tableBody = res.rows.map(r => [
      r.type,
      r.date,
      r.file,
      r.patient || "-",
      r.treatment,
      `AED ${Number(r.gross).toFixed(2)}`,
      r.timestamp
    ]);

    doc.autoTable({
      startY: 170,
      head: [[
        "Type",
        "Date",
        "File no",
        "Patient",
        "Treatment",
        "Gross",
        "Recorded"
      ]],
      body: tableBody,
      styles: {
        fontSize: 9,
        cellPadding: 5
      },
      headStyles: {
        fillColor: [184, 155, 94]
      }
    });

    doc.save(`monthly-report-${currentUser.staff_name}-${res.month}.pdf`);
  } catch {
    alert("Could not generate PDF.");
  }
}

function loadLogoAsPngDataUrl(path) {
  return fetch(path)
    .then(r => r.text())
    .then(svgText => {
      return new Promise(resolve => {
        const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = function () {
          const canvas = document.createElement("canvas");
          canvas.width = img.width || 400;
          canvas.height = img.height || 120;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };

        img.onerror = function () {
          resolve(null);
        };

        img.src = url;
      });
    })
    .catch(() => null);
}

function openModal(html) {
  $("modalHost").classList.remove("hidden");
  $("modalHost").innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        ${html}
      </div>
    </div>
  `;
}

function closeModal() {
  $("modalHost").classList.add("hidden");
  $("modalHost").innerHTML = "";
}

window.closeModal = closeModal;
window.submitSelectedSales = submitSelectedSales;
window.submitPasswordChange = submitPasswordChange;
window.openEditSubmissionModal = openEditSubmissionModal;
window.saveSubmissionEdit = saveSubmissionEdit;
window.deleteSubmission = deleteSubmission;
window.approveMissing = approveMissing;
window.openRejectMissingModal = openRejectMissingModal;
window.submitRejectMissing = submitRejectMissing;
window.submitMissingSale = submitMissingSale;
window.updateTaskStatus = updateTaskStatus;
