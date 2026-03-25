console.log("SCRIPT LOADED SUCCESSFULLY");

const API_URL = "https://api.bionixstaff.com/api";

let currentUser = null;
let currentSalesRows = [];

let activeStaffList = [];
let activeStaffNames = [];

let allAdminTaskRows = [];
let allMyTaskRows = [];
let currentTaskSearch = "";
let currentOpenTaskId = null;

function $(id) {
  return document.getElementById(id);
}

async function apiFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (currentUser?.token) {
    headers["Authorization"] = `Bearer ${currentUser.token}`;
  }

  return fetch(url, {
    cache: "no-store",
    ...options,
    headers
  });
}

async function safeReadJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON parse failed:", text);
    throw err;
  }
}

function isAdminUser() {
  return String(currentUser?.role || "").toLowerCase() === "admin";
}

function logout() {
  currentUser = null;
  currentSalesRows = [];
  activeStaffList = [];
  activeStaffNames = [];
  allAdminTaskRows = [];
  allMyTaskRows = [];
  currentTaskSearch = "";
  currentOpenTaskId = null;

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
  if ($("myTaskTableBody")) $("myTaskTableBody").innerHTML = "";

  if ($("taskSummaryCards")) $("taskSummaryCards").innerHTML = "";
  if ($("myTaskSummaryCards")) $("myTaskSummaryCards").innerHTML = "";
  if ($("taskAlertBoxWrap")) $("taskAlertBoxWrap").innerHTML = "";
  if ($("myTaskAlertBoxWrap")) $("myTaskAlertBoxWrap").innerHTML = "";

  if ($("taskSearchInput")) $("taskSearchInput").value = "";

  showMessage("loginMsg", "");
  showMessage("salesMsg", "");
  showMessage("todayMsg", "");
  showMessage("adminMsg", "");
  showMessage("missingMsg", "");
  showMessage("taskMsg", "");
  showMessage("myTaskMsg", "");
}

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  bindEvents();
  initTaskAutocomplete();
  restoreSession();
}

function bindEvents() {
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

  if ($("taskSearchInput")) {
    $("taskSearchInput").addEventListener("input", function () {
      currentTaskSearch = this.value.trim().toLowerCase();
      renderFilteredAdminTasks();
    });
  }
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

function getTodayInputDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDubaiTodayInputDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getDateYmdInDubai(value) {
  if (!value) return "";

  const d = new Date(value);
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

function formatTaskDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatTaskDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });

  return `${day}-${month}-${year} ${time}`;
}

function formatDubaiDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);

  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(d);

  const timePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(d);

  return `${datePart} ${timePart}`;
}

async function loadActiveStaff() {
  try {
    const response = await apiFetch(`${API_URL}/Staff`);

    if (!response.ok) {
      activeStaffList = [];
      activeStaffNames = [];
      return;
    }

    const res = await safeReadJson(response);

    if (Array.isArray(res)) {
      activeStaffList = res.map(x => ({
        id: x.id,
        staffName: x.staffName,
        username: x.username,
        role: x.role,
        branch: x.branch
      }));

      activeStaffNames = activeStaffList.map(x => x.staffName).filter(Boolean);
      return;
    }

    activeStaffList = [];
    activeStaffNames = [];
  } catch (err) {
    console.log("Failed to load active staff", err);
    activeStaffList = [];
    activeStaffNames = [];
  }
}

function findActiveStaffByName(name) {
  const clean = String(name || "").trim().toLowerCase();
  if (!clean) return null;

  return activeStaffList.find(x =>
    String(x.staffName || "").trim().toLowerCase() === clean
  ) || null;
}

function findActiveStaffById(id) {
  const num = Number(id);
  if (!num) return null;
  return activeStaffList.find(x => Number(x.id) === num) || null;
}

function findCurrentUserStaffId() {
  if (currentUser && currentUser.id) return currentUser.id;
  if (!currentUser || !currentUser.staff_name) return null;

  const match = findActiveStaffByName(currentUser.staff_name);
  return match ? match.id : null;
}

function findExactActiveStaffName(value) {
  const cleanValue = String(value || "").trim().toLowerCase();
  if (!cleanValue) return "";
  return activeStaffNames.find(name => name.toLowerCase() === cleanValue) || "";
}

function filterActiveStaffNames(value) {
  const cleanValue = String(value || "").trim().toLowerCase();
  if (!cleanValue) return [...activeStaffNames];
  return activeStaffNames.filter(name => name.toLowerCase().includes(cleanValue));
}

function initAutocompleteField(config) {
  const input = $(config.inputId);
  const hidden = $(config.hiddenId);
  const suggestions = $(config.suggestionsId);
  const error = $(config.errorId);

  if (!input || !hidden || !suggestions || !error) return;

  let activeIndex = -1;

  function clearError() {
    input.classList.remove("invalid");
    error.classList.add("hidden");
  }

  function showError() {
    input.classList.add("invalid");
    error.classList.remove("hidden");
  }

  function hideSuggestions() {
    suggestions.classList.add("hidden");
    suggestions.innerHTML = "";
    activeIndex = -1;
  }

  function renderSuggestions(list) {
    if (!list.length) {
      hideSuggestions();
      return;
    }

    suggestions.innerHTML = list.map((name, index) => `
      <div class="autocomplete-item" data-index="${index}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</div>
    `).join("");

    suggestions.classList.remove("hidden");
  }

  function selectName(name) {
    input.value = name;
    hidden.value = name;
    clearError();
    hideSuggestions();
    if (typeof config.onSelect === "function") config.onSelect(name);
  }

  function validate() {
    const exact = findExactActiveStaffName(input.value);

    if (exact) {
      hidden.value = exact;
      clearError();
      hideSuggestions();
      return true;
    }

    hidden.value = "";
    if (String(input.value || "").trim()) {
      showError();
    } else {
      clearError();
    }
    return false;
  }

  input.addEventListener("input", function () {
    hidden.value = "";
    clearError();

    const exact = findExactActiveStaffName(this.value);
    if (exact) {
      selectName(exact);
      return;
    }

    renderSuggestions(filterActiveStaffNames(this.value));
  });

  input.addEventListener("focus", function () {
    const exact = findExactActiveStaffName(this.value);
    if (exact) {
      hidden.value = exact;
      hideSuggestions();
      return;
    }

    renderSuggestions(filterActiveStaffNames(this.value));
  });

  input.addEventListener("blur", function () {
    setTimeout(() => {
      validate();
      hideSuggestions();
    }, 120);
  });

  input.addEventListener("keydown", function (e) {
    const items = suggestions.querySelectorAll(".autocomplete-item");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (e.key === "Enter") {
      const exact = findExactActiveStaffName(input.value);
      if (exact) {
        e.preventDefault();
        selectName(exact);
        return;
      }

      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        selectName(items[activeIndex].dataset.name);
      }
      return;
    } else {
      return;
    }

    items.forEach(item => item.classList.remove("active"));
    if (items[activeIndex]) items[activeIndex].classList.add("active");
  });

  suggestions.addEventListener("mousedown", function (e) {
    const item = e.target.closest(".autocomplete-item");
    if (!item) return;
    selectName(item.dataset.name);
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest(`#${config.wrapId}`) && !e.target.closest(`.${config.wrapClass || "autocomplete-wrap"}`)) {
      hideSuggestions();
    }
  });

  config.validate = validate;
}

let validateTaskAssignSelection = () => true;
let validateTaskAssignedFilterSelection = () => true;

function initTaskAutocomplete() {
  initAutocompleteField({
    inputId: "taskAssign",
    hiddenId: "taskAssignValue",
    suggestionsId: "taskAssignSuggestions",
    errorId: "taskAssignError"
  });

  initAutocompleteField({
    inputId: "taskAssignedFilter",
    hiddenId: "taskAssignedValue",
    suggestionsId: "taskAssignedSuggestions",
    errorId: "taskAssignedError"
  });

  const assignInput = $("taskAssign");
  const filterInput = $("taskAssignedFilter");
  const assignHidden = $("taskAssignValue");
  const filterHidden = $("taskAssignedValue");

  validateTaskAssignSelection = function () {
    if (!assignInput || !assignHidden) return true;

    const exact = findExactActiveStaffName(assignInput.value);
    if (exact) {
      assignHidden.value = exact;
      assignInput.classList.remove("invalid");
      if ($("taskAssignError")) $("taskAssignError").classList.add("hidden");
      return true;
    }

    if (String(assignInput.value || "").trim()) {
      assignInput.classList.add("invalid");
      if ($("taskAssignError")) $("taskAssignError").classList.remove("hidden");
      assignHidden.value = "";
      return false;
    }

    return true;
  };

  validateTaskAssignedFilterSelection = function () {
    if (!filterInput || !filterHidden) return true;

    const raw = String(filterInput.value || "").trim();
    if (!raw) {
      filterHidden.value = "";
      filterInput.classList.remove("invalid");
      if ($("taskAssignedError")) $("taskAssignedError").classList.add("hidden");
      return true;
    }

    const exact = findExactActiveStaffName(raw);
    if (exact) {
      filterHidden.value = exact;
      filterInput.classList.remove("invalid");
      if ($("taskAssignedError")) $("taskAssignedError").classList.add("hidden");
      return true;
    }

    filterInput.classList.add("invalid");
    if ($("taskAssignedError")) $("taskAssignedError").classList.remove("hidden");
    filterHidden.value = "";
    return false;
  };
}

function persistSession(user) {
  localStorage.setItem("staffPortalUser", JSON.stringify(user));
}

function restoreSession() {
  const saved = localStorage.getItem("staffPortalUser");
  if (!saved) return;

  try {
    currentUser = JSON.parse(saved);

    if (!currentUser?.token) {
      localStorage.removeItem("staffPortalUser");
      currentUser = null;
      return;
    }

    showLoggedInUI();
  } catch {
    localStorage.removeItem("staffPortalUser");
    currentUser = null;
  }
}

async function doLogin() {
  const username = $("username").value.trim();
  const password = $("password").value.trim();

  showMessage("loginMsg", "Checking login...");

  try {
    const response = await fetch(`${API_URL}/Auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const res = await safeReadJson(response);

    if (!res || !res.ok) {
      showMessage("loginMsg", (res && res.message) || "Login failed.", "error");
      return;
    }

    currentUser = {
      id: res.user.id,
      username: res.user.username,
      staff_name: res.user.staffName,
      role: String(res.user.role || "").toLowerCase(),
      branch: res.user.branch,
      temp_password: !!res.user.tempPassword,
      token: res.token
    };

    if (currentUser.temp_password) {
      openChangePasswordModal();
      return;
    }

    persistSession(currentUser);
    showLoggedInUI();
  } catch (err) {
    console.error(err);
    showMessage("loginMsg", "Connection error.", "error");
  }
}

async function showLoggedInUI() {
  if ($("loginPage")) $("loginPage").classList.add("hidden");

  if (isAdminUser()) {
    if ($("adminPage")) $("adminPage").classList.remove("hidden");
    if ($("staffPage")) $("staffPage").classList.add("hidden");
    if ($("adminWelcome")) $("adminWelcome").textContent = `Welcome, ${currentUser.staff_name}`;

    await loadActiveStaff();
    await loadAdminData();
  } else {
    if ($("staffPage")) $("staffPage").classList.remove("hidden");
    if ($("adminPage")) $("adminPage").classList.add("hidden");
    if ($("staffWelcome")) $("staffWelcome").textContent = `Welcome, ${currentUser.staff_name}`;
    if ($("staffDate")) $("staffDate").value = getDubaiTodayInputDate();

    await loadTodaySubmissions();
    await loadMyTasks();
  }
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
    const response = await apiFetch(`${API_URL}/Auth/change-password`, {
      method: "POST",
      body: JSON.stringify({
        username: currentUser.username,
        newPassword: p1
      })
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      alert((res && res.message) || "Password change failed.");
      return;
    }

    currentUser.temp_password = false;
    persistSession(currentUser);
    closeModal();
    await showLoggedInUI();
  } catch (err) {
    console.error(err);
    alert("Password change failed.");
  }
}

/* ================= SALES ================= */

async function loadSales() {
  const date = $("staffDate").value;

  if (!date) {
    showMessage("salesMsg", "Please select a date.", "error");
    return;
  }

  showMessage("salesMsg", "Loading sales...");

  try {
    const response = await apiFetch(`${API_URL}/Sales?fromDate=${encodeURIComponent(date)}&toDate=${encodeURIComponent(date)}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sales load failed:", errorText);
      showMessage("salesMsg", "Failed to load sales.", "error");
      if ($("salesArea")) $("salesArea").classList.add("hidden");
      return;
    }

    const rows = await safeReadJson(response);
    currentSalesRows = Array.isArray(rows) ? rows : [];

    renderSalesTable(currentSalesRows);
    if ($("salesArea")) $("salesArea").classList.remove("hidden");
    showMessage("salesMsg", "");
  } catch (err) {
    console.error(err);
    showMessage("salesMsg", "Failed to load sales.", "error");
  }
}

function renderSalesTable(rows) {
  const body = $("salesTableBody");
  if (!body) return;

  body.innerHTML = "";

  if ($("rowsFound")) $("rowsFound").textContent = rows.length;
  if ($("selectedCount")) $("selectedCount").textContent = "0";
  if ($("selectedGross")) $("selectedGross").textContent = "0.00";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5">No sales found for selected date.</td></tr>`;
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Select"><input type="checkbox" class="sale-check" data-index="${index}"></td>
      <td data-label="File no">${escapeHtml(row.fileNo || "")}</td>
      <td data-label="Patient">${escapeHtml(row.patient || "")}</td>
      <td data-label="Treatment">${escapeHtml(row.treatment || "")}</td>
      <td data-label="Gross">AED ${Number(row.gross || 0).toFixed(2)}</td>
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

  if ($("selectedCount")) $("selectedCount").textContent = selected.length;
  if ($("selectedGross")) $("selectedGross").textContent = total.toFixed(2);
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
      <button onclick="submitSelectedSales()">Submit</button>
    </div>
  `);
}

async function submitSelectedSales() {
  closeModal();

  const rows = getSelectedRows();

  if (!rows.length) {
    showMessage("salesMsg", "Please select rows first.", "error");
    return;
  }

  showMessage("salesMsg", "Submitting...");

  let successCount = 0;
  let failedCount = 0;
  let lastError = "";

  try {
    for (const row of rows) {
      const response = await apiFetch(`${API_URL}/Sales/submit`, {
        method: "POST",
        body: JSON.stringify({
          staffName: currentUser.staff_name,
          saleDate: $("staffDate").value,
          fileNo: row.fileNo || "",
          patient: row.patient || "",
          mobileNo: row.mobileNo || "",
          treatment: row.treatment || "",
          gross: Number(row.gross || 0)
        })
      });

      const res = await safeReadJson(response);

      if (response.ok && res && res.ok) {
        successCount += 1;
      } else {
        failedCount += 1;
        lastError = (res && res.message) || "Submission failed.";
      }
    }

    if (successCount > 0 && failedCount === 0) {
      showMessage("salesMsg", `${successCount} sale(s) submitted successfully by ${currentUser.staff_name}.`, "success");
    } else if (successCount > 0 && failedCount > 0) {
      showMessage("salesMsg", `${successCount} sale(s) submitted, ${failedCount} failed. ${lastError}`, "error");
    } else {
      showMessage("salesMsg", lastError || "Submission failed.", "error");
    }

    await loadSales();
    await loadTodaySubmissions();
  } catch (err) {
    console.error(err);
    showMessage("salesMsg", "Submission failed.", "error");
  }
}

async function loadTodaySubmissions() {
  if (!currentUser || isAdminUser()) return;

  showMessage("todayMsg", "Loading today's submissions...");

  try {
    const response = await apiFetch(`${API_URL}/Sales/submissions`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Today submissions load failed:", errorText);
      showMessage("todayMsg", "Failed to load.", "error");
      return;
    }

    const rows = await safeReadJson(response);
    const todayDubai = getDubaiTodayInputDate();

    const finalRows = (Array.isArray(rows) ? rows : []).filter(r => {
      const rawDate = r.submittedAt || r.createdAt;
      const submittedDubaiDate = getDateYmdInDubai(rawDate);
      return submittedDubaiDate === todayDubai;
    });

    renderTodayTable(finalRows);
    showMessage("todayMsg", "");
  } catch (err) {
    console.error(err);
    showMessage("todayMsg", "Failed to load.", "error");
  }
}

function renderTodayTable(rows) {
  const body = $("todayTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="5">No submissions today.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");
    const submittedBy = r.staffName || currentUser?.staff_name || "";
    const submittedWhen = formatDubaiDateTime(r.submittedAt || r.createdAt);

    tr.innerHTML = `
      <td data-label="Time">
        <div>${escapeHtml(submittedWhen)}</div>
        <div class="small-note">Submitted by ${escapeHtml(submittedBy)}</div>
      </td>
      <td data-label="File no">${escapeHtml(r.fileNo || "")}</td>
      <td data-label="Patient">${escapeHtml(r.patient || "")}</td>
      <td data-label="Treatment">
        <div>${escapeHtml(r.treatment || "")}</div>
        <div class="small-note">Sale date: ${escapeHtml(formatTaskDate(r.saleDate))}</div>
      </td>
      <td data-label="Gross">AED ${Number(r.gross || 0).toFixed(2)}</td>
    `;
    body.appendChild(tr);
  });
}

/* ================= ADMIN + MISSING SALES ================= */

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
    const response = await apiFetch(`${API_URL}/MissingSales`, {
      method: "POST",
      body: JSON.stringify({
        staffName: currentUser.staff_name,
        fileNo: file,
        paymentDate,
        treatment,
        gross: Number(gross),
        adminNote: ""
      })
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      alert((res && res.message) || "Could not submit missing sale request.");
      return;
    }

    closeModal();
    alert("Missing sale request sent to admin.");
  } catch (err) {
    console.error(err);
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
    const singleDate = $("adminSingleDate") ? $("adminSingleDate").value : "";
    const fromDate = $("adminFromDate") ? $("adminFromDate").value : "";
    const toDate = $("adminToDate") ? $("adminToDate").value : "";

    const response = await apiFetch(`${API_URL}/Submissions`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Admin submissions load failed:", errorText);
      showMessage("adminMsg", "Failed to load submissions.", "error");
      return;
    }

    let rows = await safeReadJson(response);
    if (!Array.isArray(rows)) rows = [];

    if (singleDate) {
      rows = rows.filter(r => String(r.saleDate || "").slice(0, 10) === singleDate);
    } else {
      if (fromDate) rows = rows.filter(r => String(r.saleDate || "").slice(0, 10) >= fromDate);
      if (toDate) rows = rows.filter(r => String(r.saleDate || "").slice(0, 10) <= toDate);
    }

    renderAdminSubmissions(rows);
    showMessage("adminMsg", "");
  } catch (err) {
    console.error(err);
    showMessage("adminMsg", "Failed to load submissions.", "error");
  }
}

function renderAdminSubmissions(rows) {
  const body = $("adminTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8">No submissions found.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const safeRow = encodeURIComponent(JSON.stringify(r));
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Time">${escapeHtml(formatTaskDateTime(r.submittedAt))}</td>
      <td data-label="Staff">${escapeHtml(r.staffName || "")}</td>
      <td data-label="Sale date">${escapeHtml(formatTaskDate(r.saleDate))}</td>
      <td data-label="File no">${escapeHtml(r.fileNo || "")}</td>
      <td data-label="Patient">${escapeHtml(r.patient || "")}</td>
      <td data-label="Treatment">${escapeHtml(r.treatment || "")}</td>
      <td data-label="Gross">AED ${Number(r.gross || 0).toFixed(2)}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="btn-secondary btn-small" onclick="openEditSubmissionModal('${safeRow}')">Edit</button>
          <button class="btn-danger btn-small" onclick="deleteSubmission(${r.id})">Delete</button>
        </div>
      </td>
    `;

    body.appendChild(tr);
  });
}

function openEditSubmissionModal(encodedRow) {
  const row = JSON.parse(decodeURIComponent(encodedRow));

  openModal(`
    <h3>Edit Submission</h3>
    <div class="form-group">
      <label>Staff name</label>
      <input type="text" id="editStaff" value="${escapeHtml(row.staffName || "")}">
    </div>
    <div class="form-group">
      <label>Sale date</label>
      <input type="date" id="editSaleDate" value="${escapeHtml(String(row.saleDate || "").slice(0, 10))}">
    </div>
    <div class="form-group">
      <label>File no</label>
      <input type="text" id="editFile" value="${escapeHtml(row.fileNo || "")}">
    </div>
    <div class="form-group">
      <label>Patient</label>
      <input type="text" id="editPatient" value="${escapeHtml(row.patient || "")}">
    </div>
    <div class="form-group">
      <label>Mobile</label>
      <input type="text" id="editMobile" value="${escapeHtml(row.mobileNo || "")}">
    </div>
    <div class="form-group">
      <label>Treatment</label>
      <textarea id="editTreatment">${escapeHtml(row.treatment || "")}</textarea>
    </div>
    <div class="form-group">
      <label>Gross</label>
      <input type="number" id="editGross" value="${Number(row.gross || 0)}">
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button onclick="saveSubmissionEdit(${row.id})">Save</button>
    </div>
  `);
}

async function saveSubmissionEdit(id) {
  try {
    const response = await apiFetch(`${API_URL}/Submissions/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        staffName: $("editStaff").value.trim(),
        saleDate: $("editSaleDate").value,
        fileNo: $("editFile").value.trim(),
        patient: $("editPatient").value.trim(),
        mobileNo: $("editMobile").value.trim(),
        treatment: $("editTreatment").value.trim(),
        gross: Number($("editGross").value)
      })
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      alert((res && res.message) || "Update failed.");
      return;
    }

    closeModal();
    await loadAdminSubmissions();
  } catch (err) {
    console.error(err);
    alert("Update failed.");
  }
}

async function deleteSubmission(id) {
  if (!confirm("Delete this submission?")) return;

  try {
    const response = await apiFetch(`${API_URL}/Submissions/${id}`, {
      method: "DELETE"
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      alert((res && res.message) || "Delete failed.");
      return;
    }

    await loadAdminSubmissions();
  } catch (err) {
    console.error(err);
    alert("Delete failed.");
  }
}

async function loadMissingRequests() {
  if (!isAdminUser()) return;

  showMessage("missingMsg", "Loading missing sale requests...");

  try {
    const singleDate = $("adminSingleDate") ? $("adminSingleDate").value : "";
    const fromDate = $("adminFromDate") ? $("adminFromDate").value : "";
    const toDate = $("adminToDate") ? $("adminToDate").value : "";

    const params = new URLSearchParams();

    if (singleDate) {
      params.append("fromDate", singleDate);
      params.append("toDate", singleDate);
    } else {
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
    }

    const url = params.toString()
      ? `${API_URL}/MissingSales?${params.toString()}`
      : `${API_URL}/MissingSales`;

    const response = await apiFetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("MissingSales error:", errorText);
      showMessage("missingMsg", "Failed to load missing sale requests.", "error");
      return;
    }

    const rows = await safeReadJson(response);

    renderMissingRequests(Array.isArray(rows) ? rows : []);
    showMessage("missingMsg", "");
  } catch (err) {
    console.error(err);
    showMessage("missingMsg", "Failed to load missing sale requests.", "error");
  }
}

function renderMissingRequests(rows) {
  const body = $("missingTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9">No missing sale requests found.</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const status = String(r.status || "");
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td data-label="Requested">${escapeHtml(formatTaskDateTime(r.createdAt))}</td>
      <td data-label="Staff">${escapeHtml(r.staffName || "")}</td>
      <td data-label="File no">${escapeHtml(r.fileNo || "")}</td>
      <td data-label="Payment date">${escapeHtml(formatTaskDate(r.paymentDate))}</td>
      <td data-label="Treatment">${escapeHtml(r.treatment || "")}</td>
      <td data-label="Gross">AED ${Number(r.gross || 0).toFixed(2)}</td>
      <td data-label="Status">${escapeHtml(status)}</td>
      <td data-label="Admin note">${escapeHtml(r.adminNote || "")}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="btn-secondary btn-small" onclick='approveMissing(${r.id})' ${status !== "Pending" ? "disabled" : ""}>Approve</button>
          <button class="btn-danger btn-small" onclick='openRejectMissingModal(${r.id})' ${status !== "Pending" ? "disabled" : ""}>Reject</button>
        </div>
      </td>
    `;

    body.appendChild(tr);
  });
}

async function approveMissing(id) {
  if (!confirm("Approve this missing sale?")) return;

  try {
    const response = await apiFetch(`${API_URL}/MissingSales/${id}/approve`, {
      method: "PATCH"
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      alert((res && res.message) || "Approval failed.");
      return;
    }

    await loadMissingRequests();
  } catch (err) {
    console.error(err);
    alert("Approval failed.");
  }
}

function openRejectMissingModal(id) {
  openModal(`
    <h3>Reject Missing Sale</h3>
    <div class="form-group">
      <label>Rejection Reason</label>
      <textarea id="rejectReason" placeholder="Enter rejection reason"></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" onclick="submitRejectMissing(${id})">Reject</button>
    </div>
  `);
}

async function submitRejectMissing(id) {
  const note = $("rejectReason").value.trim();

  try {
    const response = await apiFetch(`${API_URL}/MissingSales/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify(note)
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      alert((res && res.message) || "Rejection failed.");
      return;
    }

    closeModal();
    await loadMissingRequests();
  } catch (err) {
    console.error(err);
    alert("Rejection failed.");
  }
}

/* ================= TASKS ================= */

function enrichTaskRows(rows) {
  return (rows || []).map(row => {
    const assignedStaff = findActiveStaffById(row.assignedTo);
    const createdByStaff = findActiveStaffById(row.createdBy);

    return {
      ...row,
      assignedToName: row.assignedToName || (assignedStaff ? assignedStaff.staffName : ""),
      createdByName: row.createdByName || (createdByStaff ? createdByStaff.staffName : "")
    };
  });
}

function enrichTaskLogs(rows) {
  return (rows || []).map(row => {
    const actionByStaff = findActiveStaffById(row.actionBy);
    return {
      ...row,
      actionByName: row.actionByName || (actionByStaff ? actionByStaff.staffName : "")
    };
  });
}

function taskMatchesSearch(row, searchTerm) {
  if (!searchTerm) return true;

  const text = [
    row.title,
    row.description,
    row.assignedToName,
    row.branch,
    row.priority,
    row.status
  ]
    .map(x => String(x || "").toLowerCase())
    .join(" ");

  return text.includes(searchTerm);
}

function getTaskCounts(rows) {
  const counts = {
    total: rows.length,
    new: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0
  };

  rows.forEach(r => {
    const status = String(r.status || "").toLowerCase();
    const due = r.dueDate ? new Date(r.dueDate) : null;
    const isOverdue = due && !isNaN(due.getTime()) &&
      due < new Date() &&
      status !== "completed" &&
      status !== "cancelled";

    if (status === "open" || status === "new") counts.new += 1;
    if (status === "in progress") counts.inProgress += 1;
    if (status === "completed") counts.completed += 1;
    if (isOverdue || status === "overdue") counts.overdue += 1;
  });

  return counts;
}

function renderTaskSummaryCards(rows, targetId) {
  const box = $(targetId);
  if (!box) return;

  const counts = getTaskCounts(rows);

  box.innerHTML = `
    <div class="summary-box">
      <div class="summary-label">Total</div>
      <div class="summary-value">${counts.total}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">New</div>
      <div class="summary-value">${counts.new}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">In Progress</div>
      <div class="summary-value">${counts.inProgress}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Completed</div>
      <div class="summary-value">${counts.completed}</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Overdue</div>
      <div class="summary-value">${counts.overdue}</div>
    </div>
  `;
}

function renderTaskAlertBox(rows, targetId, isMine = false) {
  const wrap = $(targetId);
  if (!wrap) return;

  const counts = getTaskCounts(rows);
  let html = "";

  if (counts.overdue > 0) {
    html = `<div class="alert-box alert-box-danger">${isMine ? "You have" : "Attention:"} ${counts.overdue} overdue task${counts.overdue > 1 ? "s" : ""}.</div>`;
  } else if (counts.new > 0) {
    html = `<div class="alert-box alert-box-info">${isMine ? "You have" : "There are"} ${counts.new} new task${counts.new > 1 ? "s" : ""}.</div>`;
  } else if (counts.inProgress > 0) {
    html = `<div class="alert-box alert-box-warning">${isMine ? "You have" : "Currently"} ${counts.inProgress} task${counts.inProgress > 1 ? "s" : ""} in progress.</div>`;
  }

  wrap.innerHTML = html;
}

async function loadTasks() {
  if (!isAdminUser()) return;

  showMessage("taskMsg", "Loading tasks...");

  try {
    if (!validateTaskAssignedFilterSelection()) {
      showMessage("taskMsg", "Please select a valid staff name.", "error");
      return;
    }

    const status = $("taskStatusFilter") ? $("taskStatusFilter").value : "All";
    const branch = $("taskBranchFilter") ? $("taskBranchFilter").value : "All";
    const assignedName = $("taskAssignedValue") ? $("taskAssignedValue").value.trim() : "";

    const params = new URLSearchParams();

    if (status && status !== "All" && status !== "Overdue") {
      params.append("status", status);
    }

    if (branch && branch !== "All") {
      params.append("branch", branch);
    }

    if (assignedName) {
      const assignedStaff = findActiveStaffByName(assignedName);
      if (assignedStaff) params.append("assignedTo", assignedStaff.id);
    }

    const query = params.toString() ? `?${params.toString()}` : "";
    const response = await apiFetch(`${API_URL}/Tasks${query}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Tasks load failed:", errorText);
      showMessage("taskMsg", "Failed to load tasks.", "error");
      return;
    }

    let rows = await safeReadJson(response);
    rows = enrichTaskRows(Array.isArray(rows) ? rows : []);

    if (status === "Overdue") {
      rows = rows.filter(r => {
        const due = r.dueDate ? new Date(r.dueDate) : null;
        const lower = String(r.status || "").toLowerCase();
        return due && !isNaN(due.getTime()) &&
          due < new Date() &&
          lower !== "completed" &&
          lower !== "cancelled";
      });
    }

    allAdminTaskRows = rows;
    renderFilteredAdminTasks();
    showMessage("taskMsg", "");
  } catch (err) {
    console.error(err);
    showMessage("taskMsg", "Failed to load tasks.", "error");
  }
}

function renderFilteredAdminTasks() {
  const rows = allAdminTaskRows.filter(r => taskMatchesSearch(r, currentTaskSearch));
  renderTaskSummaryCards(rows, "taskSummaryCards");
  renderTaskAlertBox(rows, "taskAlertBoxWrap", false);
  renderTasks(rows);
}

async function loadMyTasks() {
  if (!currentUser || isAdminUser()) return;

  showMessage("myTaskMsg", "Loading your tasks...");

  try {
    const response = await apiFetch(`${API_URL}/Tasks?scope=my`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("My tasks load failed:", errorText);
      showMessage("myTaskMsg", "Failed to load your tasks.", "error");
      return;
    }

    let rows = await safeReadJson(response);
    rows = enrichTaskRows(Array.isArray(rows) ? rows : []);

    allMyTaskRows = rows;
    renderTaskSummaryCards(allMyTaskRows, "myTaskSummaryCards");
    renderTaskAlertBox(allMyTaskRows, "myTaskAlertBoxWrap", true);
    renderMyTasks(allMyTaskRows);

    showMessage("myTaskMsg", "");
  } catch (err) {
    console.error(err);
    showMessage("myTaskMsg", "Failed to load your tasks.", "error");
  }
}

function getPriorityBadgeClass(priority) {
  const value = String(priority || "").toLowerCase();

  if (value === "urgent") return "badge badge-priority-urgent";
  if (value === "high") return "badge badge-priority-high";
  if (value === "medium") return "badge badge-priority-medium";
  return "badge badge-priority-low";
}

function getStatusBadgeClass(status) {
  const value = String(status || "").toLowerCase();

  if (value === "completed") return "badge badge-status-completed";
  if (value === "in progress") return "badge badge-status-progress";
  if (value === "waiting") return "badge badge-status-waiting";
  if (value === "cancelled") return "badge badge-status-cancelled";
  if (value === "overdue") return "badge badge-status-overdue";
  return "badge badge-status-new";
}

function getTaskActionButtons(taskId, status, options = {}) {
  const lower = String(status || "").toLowerCase();
  const includeEdit = !!options.includeEdit;

  let buttons = [];

  if (lower === "open" || lower === "new") {
    buttons.push(`<button class="btn-secondary btn-small" onclick='updateTaskStatus(${taskId}, "In Progress")'>Start</button>`);
    buttons.push(`<button class="btn-danger btn-small" onclick='updateTaskStatus(${taskId}, "Cancelled")'>Cancel</button>`);
  } else if (lower === "in progress") {
    buttons.push(`<button class="btn-light btn-small" onclick='updateTaskStatus(${taskId}, "Completed")'>Done</button>`);
    buttons.push(`<button class="btn-danger btn-small" onclick='updateTaskStatus(${taskId}, "Cancelled")'>Cancel</button>`);
  } else if (lower === "completed" || lower === "cancelled") {
    buttons.push(`<button class="btn-secondary btn-small" onclick='updateTaskStatus(${taskId}, "In Progress")'>Reopen</button>`);
  } else if (lower === "overdue") {
    buttons.push(`<button class="btn-secondary btn-small" onclick='updateTaskStatus(${taskId}, "In Progress")'>Start</button>`);
    buttons.push(`<button class="btn-light btn-small" onclick='updateTaskStatus(${taskId}, "Completed")'>Done</button>`);
    buttons.push(`<button class="btn-danger btn-small" onclick='updateTaskStatus(${taskId}, "Cancelled")'>Cancel</button>`);
  }

  if (includeEdit) {
    buttons.push(`<button class="btn-light btn-small" onclick='openEditTaskFromDetails(${taskId})'>Edit</button>`);
  }

  return buttons.join("");
}

function renderTasks(rows) {
  const body = $("taskTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8"><div class="empty-state">No tasks match your current filters.</div></td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const due = r.dueDate ? new Date(r.dueDate) : null;
    const lower = String(r.status || "").toLowerCase();
    const isOverdue = due && !isNaN(due.getTime()) &&
      due < new Date() &&
      lower !== "completed" &&
      lower !== "cancelled";

    if (isOverdue || lower === "overdue") {
      tr.classList.add("task-overdue-row");
    }

    tr.innerHTML = `
      <td data-label="Created">${escapeHtml(formatTaskDate(r.createdAt || r.created_at))}</td>
      <td data-label="Title">
        <div class="task-title-cell">
          <span class="task-title-link" onclick="openTaskDetails(${r.id})"><strong>${escapeHtml(r.title)}</strong></span>
          <div class="small-note">${escapeHtml(r.description || "")}</div>
        </div>
      </td>
      <td data-label="Assigned To">${escapeHtml(r.assignedToName || "")}</td>
      <td data-label="Branch">${escapeHtml(r.branch || "")}</td>
      <td data-label="Priority">
        <span class="${getPriorityBadgeClass(r.priority)}">${escapeHtml(r.priority || "")}</span>
      </td>
      <td data-label="Due Date">${escapeHtml(formatTaskDate(r.dueDate || r.due_date))}</td>
      <td data-label="Status">
        <span class="${getStatusBadgeClass(isOverdue ? "Overdue" : r.status)}">${escapeHtml(isOverdue ? "Overdue" : (r.status || ""))}</span>
      </td>
      <td data-label="Actions">
        <div class="table-actions">
          ${getTaskActionButtons(r.id, isOverdue ? "Overdue" : r.status, { includeEdit: true })}
        </div>
      </td>
    `;

    body.appendChild(tr);
  });
}

function renderMyTasks(rows) {
  const body = $("myTaskTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty-state">No tasks assigned to you yet.</div></td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");

    const due = r.dueDate ? new Date(r.dueDate) : null;
    const lower = String(r.status || "").toLowerCase();
    const isOverdue = due && !isNaN(due.getTime()) &&
      due < new Date() &&
      lower !== "completed" &&
      lower !== "cancelled";

    if (isOverdue || lower === "overdue") {
      tr.classList.add("task-overdue-row");
    }

    tr.innerHTML = `
      <td data-label="Created">${escapeHtml(formatTaskDate(r.createdAt || r.created_at))}</td>
      <td data-label="Title">
        <div class="task-title-cell">
          <span class="task-title-link" onclick="openTaskDetails(${r.id})"><strong>${escapeHtml(r.title)}</strong></span>
          <div class="small-note">${escapeHtml(r.description || "")}</div>
        </div>
      </td>
      <td data-label="Branch">${escapeHtml(r.branch || "")}</td>
      <td data-label="Priority">
        <span class="${getPriorityBadgeClass(r.priority)}">${escapeHtml(r.priority || "")}</span>
      </td>
      <td data-label="Due Date">${escapeHtml(formatTaskDate(r.dueDate || r.due_date))}</td>
      <td data-label="Status">
        <span class="${getStatusBadgeClass(isOverdue ? "Overdue" : r.status)}">${escapeHtml(isOverdue ? "Overdue" : (r.status || ""))}</span>
      </td>
      <td data-label="Actions">
        <div class="table-actions">
          ${getTaskActionButtons(r.id, isOverdue ? "Overdue" : r.status, { includeEdit: false })}
        </div>
      </td>
    `;

    body.appendChild(tr);
  });
}

async function createTask() {
  const title = $("taskTitle").value.trim();
  const description = $("taskDesc").value.trim();

  if (!validateTaskAssignSelection()) {
    showMessage("taskMsg", "Please select a valid active staff name.", "error");
    return;
  }

  const assignedName = $("taskAssignValue").value.trim();
  const assignedStaff = findActiveStaffByName(assignedName);
  const branch = $("taskBranch").value;
  const priority = $("taskPriority").value;
  const dueDate = $("taskDue").value;

  if (!title || !assignedName || !branch || !priority || !dueDate) {
    showMessage("taskMsg", "Please complete all task fields.", "error");
    return;
  }

  if (!assignedStaff) {
    showMessage("taskMsg", "Assigned staff not found.", "error");
    return;
  }

  try {
    const response = await apiFetch(`${API_URL}/Tasks`, {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        assignedTo: assignedStaff.id,
        branch,
        priority,
        dueDate,
        notes: ""
      })
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      showMessage("taskMsg", (res && res.message) || "Failed to create task.", "error");
      return;
    }

    if ($("taskTitle")) $("taskTitle").value = "";
    if ($("taskDesc")) $("taskDesc").value = "";
    if ($("taskAssign")) $("taskAssign").value = "";
    if ($("taskAssignValue")) $("taskAssignValue").value = "";
    if ($("taskDue")) $("taskDue").value = "";

    showMessage("taskMsg", "Task created successfully.", "success");
    await loadTasks();
  } catch (err) {
    console.error(err);
    showMessage("taskMsg", "Failed to create task.", "error");
  }
}

async function updateTaskStatus(taskId, status) {
  try {
    const response = await apiFetch(`${API_URL}/Tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status
      })
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      showMessage("taskMsg", (res && res.message) || "Failed to update task.", "error");
      showMessage("myTaskMsg", (res && res.message) || "Failed to update task.", "error");
      return;
    }

    showMessage("taskMsg", "Task updated successfully.", "success");
    showMessage("myTaskMsg", "Task updated successfully.", "success");

    if (isAdminUser()) {
      await loadTasks();
    } else {
      await loadMyTasks();
    }

    if (currentOpenTaskId === taskId) {
      await openTaskDetails(taskId);
    }
  } catch (err) {
    console.error(err);
    showMessage("taskMsg", "Failed to update task.", "error");
    showMessage("myTaskMsg", "Failed to update task.", "error");
  }
}

async function openTaskDetails(taskId) {
  currentOpenTaskId = taskId;

  try {
    const response = await apiFetch(`${API_URL}/Tasks/${taskId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Task details load failed:", errorText);
      alert("Could not load task details.");
      return;
    }

    const res = await safeReadJson(response);

    if (!res || !res.ok || !res.task) {
      alert((res && res.message) || "Could not load task details.");
      return;
    }

    const task = enrichTaskRows([res.task])[0];
    const logs = enrichTaskLogs(Array.isArray(res.logs) ? res.logs : []);

    renderTaskDetailsModal(task, logs);
  } catch (err) {
    console.error(err);
    alert("Could not load task details.");
  }
}

function renderTaskDetailsModal(task, activityRows) {
  const activityHtml = activityRows.length
    ? activityRows.map(row => `
        <div class="task-activity-item">
          <div class="task-activity-meta">${escapeHtml(formatTaskDateTime(row.createdAt))}${row.actionByName ? ` • ${escapeHtml(row.actionByName)}` : ""}</div>
          <div>${escapeHtml(row.actionText || "")}</div>
        </div>
      `).join("")
    : `<div class="empty-state">No activity yet.</div>`;

  openModal(`
    <h3>${escapeHtml(task.title || "Task Details")}</h3>
    <div class="task-details-grid">
      <div class="task-details-label">Status</div>
      <div><span class="${getStatusBadgeClass(task.status)}">${escapeHtml(task.status || "")}</span></div>

      <div class="task-details-label">Priority</div>
      <div><span class="${getPriorityBadgeClass(task.priority)}">${escapeHtml(task.priority || "")}</span></div>

      <div class="task-details-label">Assigned To</div>
      <div>${escapeHtml(task.assignedToName || "")}</div>

      <div class="task-details-label">Created By</div>
      <div>${escapeHtml(task.createdByName || "")}</div>

      <div class="task-details-label">Branch</div>
      <div>${escapeHtml(task.branch || "")}</div>

      <div class="task-details-label">Due Date</div>
      <div>${escapeHtml(formatTaskDate(task.dueDate))}</div>

      <div class="task-details-label">Created At</div>
      <div>${escapeHtml(formatTaskDateTime(task.createdAt))}</div>

      <div class="task-details-label">Updated At</div>
      <div>${escapeHtml(formatTaskDateTime(task.updatedAt))}</div>

      <div class="task-details-label">Description</div>
      <div>${escapeHtml(task.description || "")}</div>

      <div class="task-details-label">Notes</div>
      <div>${escapeHtml(task.notes || "")}</div>
    </div>

    <div class="section-head">
      <h3>Activity Log</h3>
    </div>
    <div class="task-activity-list">${activityHtml}</div>

    <div class="modal-actions">
      <button class="btn-light" onclick="closeModal()">Close</button>
      <button onclick="openEditTaskFromDetails(${task.id})">Edit Task</button>
    </div>
  `);
}

function getStaffOptionsHtml(selectedId) {
  return activeStaffList.map(staff => `
    <option value="${staff.id}" ${Number(selectedId) === Number(staff.id) ? "selected" : ""}>${escapeHtml(staff.staffName)}</option>
  `).join("");
}

async function openEditTaskFromDetails(taskId) {
  try {
    if (!activeStaffList.length && isAdminUser()) {
      await loadActiveStaff();
    }

    const response = await apiFetch(`${API_URL}/Tasks/${taskId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Open edit task failed:", errorText);
      alert("Could not open edit task.");
      return;
    }

    const res = await safeReadJson(response);

    if (!res || !res.ok || !res.task) {
      alert((res && res.message) || "Could not open edit task.");
      return;
    }

    const task = res.task;

    openModal(`
      <h3>Edit Task</h3>

      <div class="form-group">
        <label>Task Title</label>
        <input type="text" id="editTaskTitle" value="${escapeHtml(task.title || "")}">
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea id="editTaskDescription">${escapeHtml(task.description || "")}</textarea>
      </div>

      <div class="form-group">
        <label>Assign To</label>
        <select id="editTaskAssignedTo">
          ${getStaffOptionsHtml(task.assignedTo)}
        </select>
      </div>

      <div class="row three-col">
        <div class="form-group">
          <label>Branch</label>
          <select id="editTaskBranch">
            <option value="Jumeirah" ${task.branch === "Jumeirah" ? "selected" : ""}>Jumeirah</option>
            <option value="Al Barsha" ${task.branch === "Al Barsha" ? "selected" : ""}>Al Barsha</option>
            <option value="All" ${task.branch === "All" ? "selected" : ""}>All</option>
          </select>
        </div>

        <div class="form-group">
          <label>Priority</label>
          <select id="editTaskPriority">
            <option value="Low" ${task.priority === "Low" ? "selected" : ""}>Low</option>
            <option value="Medium" ${task.priority === "Medium" ? "selected" : ""}>Medium</option>
            <option value="High" ${task.priority === "High" ? "selected" : ""}>High</option>
            <option value="Urgent" ${task.priority === "Urgent" ? "selected" : ""}>Urgent</option>
          </select>
        </div>

        <div class="form-group">
          <label>Due Date</label>
          <input type="date" id="editTaskDueDate" value="${escapeHtml(String(task.dueDate || "").slice(0, 10))}">
        </div>
      </div>

      <div class="row two-col">
        <div class="form-group">
          <label>Status</label>
          <select id="editTaskStatus">
            <option value="Open" ${task.status === "Open" ? "selected" : ""}>Open</option>
            <option value="In Progress" ${task.status === "In Progress" ? "selected" : ""}>In Progress</option>
            <option value="Waiting" ${task.status === "Waiting" ? "selected" : ""}>Waiting</option>
            <option value="Completed" ${task.status === "Completed" ? "selected" : ""}>Completed</option>
            <option value="Cancelled" ${task.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
          </select>
        </div>

        <div class="form-group">
          <label>Notes</label>
          <input type="text" id="editTaskNotes" value="${escapeHtml(task.notes || "")}">
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn-light" onclick="openTaskDetails(${task.id})">Back</button>
        <button onclick="saveTaskEdit(${task.id})">Save Task</button>
      </div>
    `);
  } catch (err) {
    console.error(err);
    alert("Could not open edit task.");
  }
}

async function saveTaskEdit(taskId) {
  const title = $("editTaskTitle").value.trim();
  const description = $("editTaskDescription").value.trim();
  const assignedTo = Number($("editTaskAssignedTo").value || 0);
  const branch = $("editTaskBranch").value;
  const priority = $("editTaskPriority").value;
  const dueDate = $("editTaskDueDate").value;
  const status = $("editTaskStatus").value;
  const notes = $("editTaskNotes").value.trim();

  if (!title || !assignedTo || !branch || !priority || !dueDate || !status) {
    alert("Please complete all required task fields.");
    return;
  }

  try {
    const response = await apiFetch(`${API_URL}/Tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({
        title,
        description,
        assignedTo,
        branch,
        priority,
        dueDate,
        status,
        notes
      })
    });

    const res = await safeReadJson(response);

    if (!response.ok || !res || !res.ok) {
      alert((res && res.message) || "Failed to update task.");
      return;
    }

    if (isAdminUser()) {
      await loadTasks();
    } else {
      await loadMyTasks();
    }

    await openTaskDetails(taskId);
  } catch (err) {
    console.error(err);
    alert("Failed to update task.");
  }
}

/* ================= MONTHLY PDF ================= */

async function downloadMonthlyPdf() {
  try {
    const response = await apiFetch(`${API_URL}/Reports/monthly`);

    if (!response.ok) {
      const text = await response.text();
      console.error("Monthly report failed:", text);
      alert("Could not generate report.");
      return;
    }

    const res = await safeReadJson(response);

    if (!res || !res.ok) {
      alert((res && res.message) || "Could not generate report.");
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
      r.type || "Submission",
      r.date || "",
      r.file || "",
      r.patient || "-",
      r.treatment || "",
      `AED ${Number(r.gross || 0).toFixed(2)}`,
      r.timestamp || ""
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
  } catch (err) {
    console.error(err);
    alert("Could not generate PDF.");
  }
}

function openModal(html) {
  if (!$("modalHost")) return;

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
  if (!$("modalHost")) return;

  $("modalHost").classList.add("hidden");
  $("modalHost").innerHTML = "";
  currentOpenTaskId = null;
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
window.openTaskDetails = openTaskDetails;
window.openEditTaskFromDetails = openEditTaskFromDetails;
window.saveTaskEdit = saveTaskEdit;
