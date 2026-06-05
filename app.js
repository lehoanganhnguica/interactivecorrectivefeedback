const config = window.WFS_CONFIG || {};
const isSupabaseConfigured = Boolean(
  config.supabaseUrl &&
  config.supabaseAnonKey &&
  !config.supabaseUrl.includes("your-project")
);

const guestCollectionsKey = "wfs.cloud.guest.collections.v1";
const guestPapersKey = "wfs.cloud.guest.papers.v1";
const guestDbName = "wfs-cloud-guest-storage";
const guestDbStore = "keyValue";
const guestMemoryStore = new Map();

const feedbackTypes = [
  ["grammar", "Grammar"],
  ["vocabulary", "Vocabulary"],
  ["spelling", "Spelling"],
  ["coherence", "Coherence"],
  ["task", "Task response/achievement"],
  ["style", "Style"],
  ["idea", "Idea development"]
];

const scoreCriteria = [
  ["task", "Task response/achievement"],
  ["coherence", "Coherence and cohesion"],
  ["lexical", "Lexical resource"],
  ["grammar", "Grammatical range and accuracy"]
];

const starterCollections = [];

function sampleDraftPaper() {
  return {
    id: "sample-draft",
    collection_id: null,
    title: "Sample draft",
    student_name: "",
    status: "sample",
    word_count: 0,
    updated_at: "",
    session_json: null,
    is_sample: true
  };
}

const state = {
  view: "landing",
  authMode: "signup",
  authRole: "teacher",
  mode: "guest",
  user: null,
  profile: null,
  collections: [],
  papers: [],
  classes: [],
  classMembers: [],
  selectedClassId: "",
  classPanelOpen: false,
  sharedPapers: [],
  activeShare: null,
  selectedCollectionId: "all",
  activePaper: null,
  editorOpen: false,
  sidebarCollapsed: false,
  paperPanelOpen: false,
  searchTerm: "",
  supabase: null,
  autosaveTimer: null,
  lastPersistedSnapshot: "",
  autosaveInFlight: false
};

const dom = {
  landingView: document.getElementById("landingView"),
  authView: document.getElementById("authView"),
  workspaceView: document.getElementById("workspaceView"),
  authTitle: document.getElementById("authTitle"),
  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authSubmit: document.getElementById("authSubmit"),
  authSwitch: document.getElementById("authSwitch"),
  authRoleGroup: document.getElementById("authRoleGroup"),
  authNotice: document.getElementById("authNotice"),
  modePill: document.getElementById("modePill"),
  sidebarHomeBtn: document.getElementById("sidebarHomeBtn"),
  sidebarHomeLabel: document.getElementById("sidebarHomeLabel"),
  sidebarHomeShort: document.getElementById("sidebarHomeShort"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  workspaceNotice: document.getElementById("workspaceNotice"),
  collectionList: document.getElementById("collectionList"),
  collectionForm: document.getElementById("collectionForm"),
  guestCollectionNote: document.getElementById("guestCollectionNote"),
  collectionName: document.getElementById("collectionName"),
  classesTab: document.getElementById("classesTab"),
  allCount: document.getElementById("allCount"),
  classCount: document.getElementById("classCount"),
  statTotal: document.getElementById("statTotal"),
  statDrafts: document.getElementById("statDrafts"),
  statCompleted: document.getElementById("statCompleted"),
  paperSearch: document.getElementById("paperSearch"),
  paperList: document.getElementById("paperList"),
  paperPanelTitle: document.getElementById("paperPanelTitle"),
  currentPaperTitle: document.getElementById("currentPaperTitle"),
  autosaveStatus: document.getElementById("autosaveStatus"),
  editorEmpty: document.getElementById("editorEmpty"),
  editorFrame: document.getElementById("editorFrame"),
  sharePaperBtn: document.getElementById("sharePaperBtn"),
  classPanel: document.getElementById("classPanel"),
  classForm: document.getElementById("classForm"),
  className: document.getElementById("className"),
  classList: document.getElementById("classList"),
  selectedClassTitle: document.getElementById("selectedClassTitle"),
  studentForm: document.getElementById("studentForm"),
  studentEmail: document.getElementById("studentEmail"),
  studentName: document.getElementById("studentName"),
  studentList: document.getElementById("studentList"),
  shareClassBtn: document.getElementById("shareClassBtn")
};

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function localStorageHandle() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function indexedDbHandle() {
  try {
    return window.indexedDB;
  } catch {
    return null;
  }
}

function readJson(key, fallback) {
  const storage = localStorageHandle();
  if (!storage) return fallback;
  try {
    const saved = storage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  const storage = localStorageHandle();
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function openGuestDb() {
  return new Promise((resolve, reject) => {
    const indexedDb = indexedDbHandle();
    if (!indexedDb) {
      reject(new Error("IndexedDB is unavailable."));
      return;
    }
    const request = indexedDb.open(guestDbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(guestDbStore)) db.createObjectStore(guestDbStore);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open guest storage."));
    request.onblocked = () => reject(new Error("Guest storage is blocked by another tab."));
  });
}

async function readIndexedValue(key) {
  const db = await openGuestDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(guestDbStore, "readonly");
    const request = transaction.objectStore(guestDbStore).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not read guest storage."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || request.error || new Error("Could not read guest storage."));
    };
  });
}

async function writeIndexedValue(key, value) {
  const db = await openGuestDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(guestDbStore, "readwrite");
    const request = transaction.objectStore(guestDbStore).put(value, key);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("Could not write guest storage."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || request.error || new Error("Could not write guest storage."));
    };
  });
}

async function readPersistedJson(key, fallback) {
  const localValue = readJson(key, undefined);
  if (localValue !== undefined) return localValue;
  try {
    const indexedValue = await readIndexedValue(key);
    if (indexedValue) return JSON.parse(indexedValue);
  } catch {
    // Fall through to the in-memory copy or fallback.
  }
  if (guestMemoryStore.has(key)) {
    try {
      return JSON.parse(guestMemoryStore.get(key));
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function writePersistedJson(key, value) {
  const serialized = JSON.stringify(value);
  guestMemoryStore.set(key, serialized);
  const localSaved = writeJson(key, value);
  let indexedSaved = false;
  try {
    await writeIndexedValue(key, serialized);
    indexedSaved = true;
  } catch {
    indexedSaved = false;
  }
  return localSaved || indexedSaved;
}

async function saveGuestWorkspace() {
  const [collectionsSaved, papersSaved] = await Promise.all([
    writePersistedJson(guestCollectionsKey, state.collections),
    writePersistedJson(guestPapersKey, realPapers())
  ]);
  return collectionsSaved && papersSaved;
}

function wordCountFromHtml(html = "") {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function formatDate(value) {
  if (!value) return "Not saved yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function paperStatusLabel(status) {
  if (status === "sample") return "Sample draft";
  if (status === "completed") return "Completed";
  if (status === "review") return "For review";
  return "Draft";
}

function isSamplePaper(paper = {}) {
  return Boolean(paper.is_sample)
    || paper.status === "sample"
    || paper.id === "sample-draft"
    || paper.id === "sample-paper-1"
    || paper.id === "sample-paper-2";
}

function realPapers() {
  return state.papers.filter((paper) => !isSamplePaper(paper));
}

function cleanGuestCollections(collections = []) {
  return Array.isArray(collections)
    ? collections.filter((collection) => !["guest-review", "guest-completed"].includes(collection.id))
    : [];
}

function cleanGuestPapers(papers = []) {
  const real = Array.isArray(papers) ? papers.filter((paper) => !isSamplePaper(paper)) : [];
  return real.length ? real : [sampleDraftPaper()];
}

async function loadGuestCollections() {
  return cleanGuestCollections(await readPersistedJson(guestCollectionsKey, starterCollections));
}

async function loadGuestPapers() {
  return cleanGuestPapers(await readPersistedJson(guestPapersKey, []));
}

function shortCollectionName(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "List";
  if (words.length === 1) return words[0].slice(0, 3);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function setNotice(target, message = "") {
  target.textContent = message;
  target.classList.toggle("hidden", !message);
}

function setAutosaveStatus(message = "Autosave ready", status = "idle") {
  if (!dom.autosaveStatus) return;
  dom.autosaveStatus.textContent = message;
  dom.autosaveStatus.dataset.status = status;
}

function isTeacherMode() {
  return state.mode === "teacher";
}

function isStudentMode() {
  return state.mode === "student";
}

function isSignedInMode() {
  return isTeacherMode() || isStudentMode();
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function roleLabel(role) {
  return role === "student" ? "student" : "teacher";
}

function selectedClass() {
  return state.classes.find((item) => item.id === state.selectedClassId) || null;
}

function membersForSelectedClass() {
  return state.classMembers.filter((member) => member.class_id === state.selectedClassId);
}

function normalizedSessionForSnapshot(session = {}) {
  return { ...session, autosavedAt: "" };
}

function paperSnapshotKey(paperId, status, session) {
  return JSON.stringify({
    paperId,
    status,
    session: normalizedSessionForSnapshot(session)
  });
}

function setView(view) {
  state.view = view;
  dom.landingView.classList.toggle("hidden", view !== "landing");
  dom.authView.classList.toggle("hidden", view !== "auth");
  dom.workspaceView.classList.toggle("hidden", view !== "workspace");
}

function editorUrlForPaper(paper) {
  return "./editor.html?paper=" + encodeURIComponent(paper.id) + "&v=" + Date.now();
}

function resizeEditorFrame() {
  if (!dom.editorFrame || dom.editorFrame.classList.contains("hidden")) return;
  try {
    const doc = dom.editorFrame.contentDocument;
    if (!doc) return;
    const body = doc.body;
    const root = doc.documentElement;
    const height = Math.max(
      720,
      body?.scrollHeight || 0,
      root?.scrollHeight || 0,
      body?.offsetHeight || 0,
      root?.offsetHeight || 0
    );
    dom.editorFrame.style.height = `${height + 24}px`;
  } catch {
    dom.editorFrame.style.height = "900px";
  }
}

function editorFrameScrollableTarget(event, doc) {
  const win = doc.defaultView;
  const ElementCtor = win?.Element || Element;
  let element = event.target instanceof ElementCtor ? event.target : null;
  while (element && element !== doc.body && element !== doc.documentElement) {
    const style = win?.getComputedStyle(element);
    const scrollableY = style && ["auto", "scroll"].includes(style.overflowY);
    const canScrollY = element.scrollHeight > element.clientHeight + 1;
    if (scrollableY && canScrollY) {
      const maxScroll = element.scrollHeight - element.clientHeight;
      if ((event.deltaY < 0 && element.scrollTop > 0) || (event.deltaY > 0 && element.scrollTop < maxScroll)) {
        return element;
      }
    }
    element = element.parentElement;
  }
  return null;
}

function bindEditorFrameScrollForwarding() {
  if (!dom.editorFrame || dom.editorFrame.classList.contains("hidden")) return;
  try {
    const doc = dom.editorFrame.contentDocument;
    if (!doc || doc.__wfsParentScrollBound) return;
    doc.__wfsParentScrollBound = true;
    doc.addEventListener("wheel", (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
      if (editorFrameScrollableTarget(event, doc)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      event.preventDefault();
      window.scrollBy({
        top: event.deltaY * unit,
        left: event.deltaX * unit,
        behavior: "auto"
      });
    }, { passive: false });
  } catch {
    // Same-origin frame access can fail while the iframe is between loads.
  }
}

function syncEditorFrameLayout() {
  bindEditorFrameScrollForwarding();
  resizeEditorFrame();
}

function scheduleEditorFrameResize() {
  window.requestAnimationFrame(syncEditorFrameLayout);
  window.setTimeout(syncEditorFrameLayout, 200);
  window.setTimeout(syncEditorFrameLayout, 800);
}

function prepareActiveEditor() {
  window.clearTimeout(state.autosaveTimer);
  if (!state.activePaper) {
    state.editorOpen = false;
    state.lastPersistedSnapshot = "";
    setAutosaveStatus("Open a paper to start autosaving", "idle");
    dom.editorFrame.style.height = "";
    dom.editorFrame.removeAttribute("src");
    dom.editorFrame.removeAttribute("srcdoc");
    return;
  }
  state.editorOpen = true;
  state.lastPersistedSnapshot = state.activePaper.session_json
    ? paperSnapshotKey(state.activePaper.id, state.activePaper.status || "draft", state.activePaper.session_json)
    : "";
  setAutosaveStatus("Loading paper...", "saving");
  dom.editorFrame.removeAttribute("srcdoc");
  dom.editorFrame.style.height = "720px";
  dom.editorFrame.src = editorUrlForPaper(state.activePaper);
}

async function getSupabase() {
  if (!isSupabaseConfigured) throw new Error("Account storage is not connected yet.");
  if (state.supabase) return state.supabase;
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return state.supabase;
}

async function tryRestoreCloudSession() {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      state.user = data.session.user;
      await openCloudWorkspace(data.session.user);
    }
  } catch {
    setNotice(dom.workspaceNotice, "");
  }
}

async function openGuestWorkspace() {
  state.mode = "guest";
  state.user = null;
  state.profile = null;
  state.collections = await loadGuestCollections();
  state.papers = await loadGuestPapers();
  state.classes = [];
  state.classMembers = [];
  state.selectedClassId = "";
  state.classPanelOpen = false;
  state.sharedPapers = [];
  state.activeShare = null;
  state.selectedCollectionId = "all";
  state.paperPanelOpen = false;
  state.activePaper = state.papers[0] || null;
  prepareActiveEditor();
  setView("workspace");
  setNotice(dom.workspaceNotice, "Guest mode autosaves in this browser only. Create an account when you want cloud sync across devices.");
  renderWorkspace();
}

async function openCloudWorkspace(user) {
  const profile = await loadOrCreateProfile(user);
  if (profile.account_role === "student") {
    await openStudentWorkspace(user, profile);
    return;
  }
  await openTeacherWorkspace(user, profile);
}

async function openTeacherWorkspace(user, profile) {
  const supabase = await getSupabase();
  const [
    { data: collections, error: collectionError },
    { data: papers, error: paperError },
    { data: classes, error: classError },
    { data: classMembers, error: memberError }
  ] = await Promise.all([
    supabase.from("collections").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("papers").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("classes").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("class_members").select("*").eq("teacher_id", user.id).order("created_at", { ascending: true })
  ]);
  if (collectionError) throw collectionError;
  if (paperError) throw paperError;
  if (classError) throw classError;
  if (memberError) throw memberError;
  state.mode = "teacher";
  state.user = user;
  state.profile = profile;
  state.collections = collections || [];
  state.papers = papers || [];
  state.classes = classes || [];
  state.classMembers = classMembers || [];
  state.selectedClassId = state.classes[0]?.id || "";
  state.classPanelOpen = false;
  state.sharedPapers = [];
  state.activeShare = null;
  state.selectedCollectionId = "all";
  state.paperPanelOpen = false;
  state.activePaper = state.papers[0] || null;
  prepareActiveEditor();
  setView("workspace");
  setNotice(dom.workspaceNotice, "Signed in as a teacher. Papers autosave here and can be shared with student accounts by class.");
  renderWorkspace();
}

async function openStudentWorkspace(user, profile) {
  const supabase = await getSupabase();
  const { data: shares, error } = await supabase
    .from("paper_shares")
    .select("*")
    .order("shared_at", { ascending: false });
  if (error) throw error;
  state.mode = "student";
  state.user = user;
  state.profile = profile;
  state.collections = [];
  state.papers = [];
  state.classes = [];
  state.classMembers = [];
  state.selectedClassId = "all";
  state.classPanelOpen = false;
  state.sharedPapers = shares || [];
  state.activePaper = null;
  state.activeShare = state.sharedPapers[0] || null;
  state.editorOpen = Boolean(state.activeShare);
  state.paperPanelOpen = !state.activeShare;
  state.lastPersistedSnapshot = "";
  dom.editorFrame.removeAttribute("src");
  setView("workspace");
  setNotice(dom.workspaceNotice, "Signed in as a student. Open a shared paper and click highlighted feedback to read the teacher comments.");
  renderWorkspace();
  if (state.activeShare) openSharedPaper(state.activeShare, { skipRender: true });
}

function setAuthRole(role) {
  state.authRole = role === "student" ? "student" : "teacher";
  dom.authRoleGroup?.querySelectorAll("[data-role]").forEach((button) => {
    button.classList.toggle("active", button.dataset.role === state.authRole);
  });
  if (state.authMode === "signup") {
    dom.authTitle.textContent = state.authRole === "student"
      ? "Create your student account"
      : "Create your teacher workspace";
  }
}

function showAuth(mode, role = state.authRole) {
  state.authMode = mode;
  setAuthRole(role);
  dom.authTitle.textContent = mode === "signup"
    ? (state.authRole === "student" ? "Create your student account" : "Create your teacher workspace")
    : "Log in to your workspace";
  dom.authSubmit.textContent = mode === "signup" ? "Create account" : "Log in";
  dom.authSwitch.textContent = mode === "signup" ? "I already have an account" : "Create a new account";
  dom.authRoleGroup.classList.toggle("hidden", mode !== "signup");
  setNotice(dom.authNotice, "");
  setView("auth");
}

function getAuthRedirectUrl() {
  if (window.location.protocol === "file:") return "";
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  if (url.pathname.endsWith("/index.html")) {
    url.pathname = url.pathname.slice(0, -"index.html".length);
  }
  return url.href;
}

async function submitAuth(event) {
  event.preventDefault();
  if (!isSupabaseConfigured) {
    setNotice(dom.authNotice, "Account login is not active in this local preview yet. Continue as guest for now.");
    return;
  }
  dom.authSubmit.disabled = true;
  try {
    const supabase = await getSupabase();
    const credentials = { email: dom.authEmail.value.trim(), password: dom.authPassword.value };
    const authOptions = { data: { account_role: state.authRole } };
    const emailRedirectTo = getAuthRedirectUrl();
    if (emailRedirectTo) authOptions.emailRedirectTo = emailRedirectTo;
    const response = state.authMode === "signup"
      ? await supabase.auth.signUp({
        ...credentials,
        options: authOptions
      })
      : await supabase.auth.signInWithPassword(credentials);
    if (response.error) throw response.error;
    if (response.data.session?.user) await openCloudWorkspace(response.data.session.user);
    else setNotice(dom.authNotice, "Check your email to confirm the account, then log in.");
  } catch (error) {
    setNotice(dom.authNotice, error.message || "Authentication failed.");
  } finally {
    dom.authSubmit.disabled = false;
  }
}

async function signOut() {
  if (isSignedInMode() && state.supabase) await state.supabase.auth.signOut();
  window.clearTimeout(state.autosaveTimer);
  state.user = null;
  state.profile = null;
  state.collections = [];
  state.papers = [];
  state.classes = [];
  state.classMembers = [];
  state.selectedClassId = "";
  state.classPanelOpen = false;
  state.sharedPapers = [];
  state.activeShare = null;
  state.activePaper = null;
  state.editorOpen = false;
  state.lastPersistedSnapshot = "";
  state.paperPanelOpen = false;
  state.sidebarCollapsed = false;
  setAutosaveStatus("Autosave ready", "idle");
  setNotice(dom.workspaceNotice, "");
  setView("landing");
}

async function loadOrCreateProfile(user) {
  const supabase = await getSupabase();
  const fallbackRole = roleLabel(user.user_metadata?.account_role || state.authRole);
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return { ...data, account_role: roleLabel(data.account_role) };
  const profile = {
    id: user.id,
    email: user.email,
    account_role: fallbackRole,
    display_name: user.user_metadata?.display_name || ""
  };
  const { data: created, error: createError } = await supabase
    .from("profiles")
    .upsert(profile)
    .select()
    .single();
  if (createError) throw createError;
  return { ...created, account_role: roleLabel(created.account_role) };
}

function selectedCollection() {
  return state.collections.find((collection) => collection.id === state.selectedCollectionId) || null;
}

function visiblePapers() {
  const sampleOnly = state.mode === "guest" && !realPapers().length;
  return state.papers
    .filter((paper) => sampleOnly || !isSamplePaper(paper))
    .filter((paper) => state.selectedCollectionId === "all" || paper.collection_id === state.selectedCollectionId)
    .filter((paper) => `${paper.title || ""} ${paper.student_name || ""}`.toLowerCase().includes(state.searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
}

function studentClassFilters() {
  const classes = new Map();
  state.sharedPapers.forEach((share) => {
    const id = share.class_id || "unfiled";
    if (!classes.has(id)) {
      classes.set(id, {
        id,
        name: share.class_name || "Shared papers",
        count: 0
      });
    }
    classes.get(id).count += 1;
  });
  return Array.from(classes.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function visibleSharedPapers() {
  return state.sharedPapers
    .filter((share) => state.selectedCollectionId === "all" || (share.class_id || "unfiled") === state.selectedCollectionId)
    .filter((share) => `${share.paper_title || ""} ${share.student_name || ""} ${share.teacher_email || ""}`.toLowerCase().includes(state.searchTerm.toLowerCase()))
    .sort((a, b) => new Date(b.shared_at || 0) - new Date(a.shared_at || 0));
}

function renderWorkspace() {
  const isAccount = isSignedInMode();
  const homeLabel = isAccount ? "Log out" : "Home";
  const homeTitle = isAccount ? "Log out and return home" : "Return to home screen";
  dom.sidebarHomeLabel.textContent = homeLabel;
  dom.sidebarHomeShort.textContent = isAccount ? "Out" : "Home";
  dom.sidebarHomeBtn.setAttribute("aria-label", homeTitle);
  dom.sidebarHomeBtn.title = homeTitle;
  dom.workspaceView.classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
  dom.workspaceView.classList.toggle("paper-list-open", state.paperPanelOpen);
  dom.workspaceView.classList.toggle("class-manager-open", isTeacherMode() && state.classPanelOpen);
  dom.workspaceView.classList.toggle("student-workspace", isStudentMode());
  dom.sidebarToggle.textContent = state.sidebarCollapsed ? ">>" : "<<";
  dom.sidebarToggle.setAttribute("aria-expanded", String(!state.sidebarCollapsed));
  dom.sidebarToggle.setAttribute("aria-label", state.sidebarCollapsed ? "Expand workspace sidebar" : "Collapse workspace sidebar");
  dom.sidebarToggle.title = state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";

  if (isStudentMode()) {
    renderStudentWorkspace();
    return;
  }

  renderTeacherWorkspace();
}

function renderTeacherWorkspace() {
  const collection = selectedCollection();
  const savedPapers = realPapers();
  const completed = savedPapers.filter((paper) => paper.status === "completed").length;
  const drafts = savedPapers.length - completed;
  dom.modePill.textContent = isTeacherMode() ? "Teacher workspace" : "Guest workspace";
  dom.modePill.className = `mode-pill ${isTeacherMode() ? "cloud" : "guest"}`;
  dom.paperPanelTitle.textContent = collection ? collection.name : "All papers";
  dom.allCount.textContent = savedPapers.length;
  dom.classCount.textContent = state.classes.length;
  dom.statTotal.textContent = savedPapers.length;
  dom.statDrafts.textContent = drafts;
  dom.statCompleted.textContent = completed;
  const statLabels = document.querySelectorAll(".stat-grid span");
  if (statLabels[0]) statLabels[0].textContent = "Saved papers";
  if (statLabels[1]) statLabels[1].textContent = "Drafts to review";
  if (statLabels[2]) statLabels[2].textContent = "Completed exports";
  dom.currentPaperTitle.textContent = state.activePaper?.title || "Start a new marked paper";
  const allLabel = document.querySelector("[data-collection-id='all'] .collection-label");
  const allShort = document.querySelector("[data-collection-id='all'] .collection-short");
  if (allLabel) allLabel.textContent = "All papers";
  if (allShort) allShort.textContent = "All";
  dom.classesTab.classList.toggle("hidden", !isTeacherMode());
  dom.classesTab.classList.toggle("active", state.classPanelOpen);
  dom.collectionForm.classList.toggle("hidden", !isTeacherMode());
  dom.guestCollectionNote.classList.toggle("hidden", state.mode !== "guest");
  dom.sharePaperBtn.classList.toggle("hidden", !isTeacherMode());
  document.querySelectorAll(".workspace-actions [data-action='new-paper'], .workspace-actions [data-action='save-complete']").forEach((button) => {
    button.classList.remove("hidden");
  });
  dom.shareClassBtn.disabled = !state.activePaper || !selectedClass() || !membersForSelectedClass().length;

  document.querySelectorAll("[data-collection-id]").forEach((button) => {
    button.classList.toggle("active", button.dataset.collectionId === state.selectedCollectionId);
  });

  dom.collectionList.innerHTML = state.collections.map((item) => {
    const count = savedPapers.filter((paper) => paper.collection_id === item.id).length;
    return `<button type="button" class="collection-btn ${item.id === state.selectedCollectionId ? "active" : ""}" data-collection-id="${escapeHtml(item.id)}" aria-label="Open ${escapeHtml(item.name)} list" title="${escapeHtml(item.name)}">
      <span class="collection-label">${escapeHtml(item.name)}</span>
      <span class="collection-short" aria-hidden="true">${escapeHtml(shortCollectionName(item.name))}</span>
      <span>${count}</span>
    </button>`;
  }).join("");

  const papers = visiblePapers();
  dom.paperList.innerHTML = papers.length ? papers.map((paper) => `
    <article class="paper-card ${isSamplePaper(paper) ? "sample" : ""} ${state.activePaper?.id === paper.id ? "active" : ""}">
      <button type="button" data-action="open-paper" data-paper-id="${escapeHtml(paper.id)}">
        <strong>${escapeHtml(paper.title || "Untitled marked paper")}</strong>
        <span>${isSamplePaper(paper) ? "Sample draft" : `${escapeHtml(paper.student_name || "No student name")} · ${paperStatusLabel(paper.status)}`}</span>
        <small>${isSamplePaper(paper) ? "Preview only. Your saved papers will appear here after you create them." : `${paper.word_count || 0} words · ${formatDate(paper.updated_at)}`}</small>
      </button>
      ${isSamplePaper(paper) ? "" : `<button type="button" class="remove-paper" data-action="remove-paper" data-paper-id="${escapeHtml(paper.id)}">Remove</button>`}
    </article>
  `).join("") : `
    <div class="empty-state">
      <strong>No papers here yet</strong>
      <span>Create a paper, mark it in the editor, and it will autosave here.</span>
    </div>
  `;

  dom.editorEmpty.classList.toggle("hidden", state.editorOpen);
  dom.editorFrame.classList.toggle("hidden", !state.editorOpen);
  if (state.editorOpen) scheduleEditorFrameResize();
  renderClassPanel();
}

function renderStudentWorkspace() {
  const filters = studentClassFilters();
  const available = state.sharedPapers.length;
  const selectedFilter = filters.find((item) => item.id === state.selectedCollectionId);
  dom.modePill.textContent = "Student workspace";
  dom.modePill.className = "mode-pill student";
  dom.paperPanelTitle.textContent = selectedFilter ? selectedFilter.name : "Shared with me";
  dom.allCount.textContent = state.sharedPapers.length;
  dom.classCount.textContent = 0;
  dom.statTotal.textContent = state.sharedPapers.length;
  dom.statDrafts.textContent = available;
  dom.statCompleted.textContent = filters.length;
  const statLabels = document.querySelectorAll(".stat-grid span");
  if (statLabels[0]) statLabels[0].textContent = "Shared papers";
  if (statLabels[1]) statLabels[1].textContent = "Available to review";
  if (statLabels[2]) statLabels[2].textContent = "Classes";
  dom.currentPaperTitle.textContent = state.activeShare?.paper_title || "Open shared feedback";
  const allLabel = document.querySelector("[data-collection-id='all'] .collection-label");
  const allShort = document.querySelector("[data-collection-id='all'] .collection-short");
  if (allLabel) allLabel.textContent = "Shared with me";
  if (allShort) allShort.textContent = "All";
  dom.classesTab.classList.add("hidden");
  dom.collectionForm.classList.add("hidden");
  dom.guestCollectionNote.classList.add("hidden");
  dom.sharePaperBtn.classList.add("hidden");
  document.querySelectorAll(".workspace-actions [data-action='new-paper'], .workspace-actions [data-action='save-complete']").forEach((button) => {
    button.classList.add("hidden");
  });
  dom.collectionList.innerHTML = filters.map((item) => `
    <button type="button" class="collection-btn ${item.id === state.selectedCollectionId ? "active" : ""}" data-collection-id="${escapeHtml(item.id)}" aria-label="Open ${escapeHtml(item.name)} shared papers" title="${escapeHtml(item.name)}">
      <span class="collection-label">${escapeHtml(item.name)}</span>
      <span class="collection-short" aria-hidden="true">${escapeHtml(shortCollectionName(item.name))}</span>
      <span>${item.count}</span>
    </button>
  `).join("");
  document.querySelectorAll("[data-collection-id]").forEach((button) => {
    button.classList.toggle("active", button.dataset.collectionId === state.selectedCollectionId);
  });

  const shares = visibleSharedPapers();
  dom.paperList.innerHTML = shares.length ? shares.map((share) => `
    <article class="paper-card ${state.activeShare?.id === share.id ? "active" : ""}">
      <button type="button" data-action="open-share" data-share-id="${escapeHtml(share.id)}">
        <strong>${escapeHtml(share.paper_title || "Shared marked paper")}</strong>
        <span>${escapeHtml(share.class_name || "Shared feedback")}</span>
        <small>${share.word_count || 0} words · ${formatDate(share.shared_at)}</small>
      </button>
    </article>
  `).join("") : `
    <div class="empty-state">
      <strong>No shared papers here yet</strong>
      <span>When a teacher shares a marked paper with your account email, it will appear here.</span>
    </div>
  `;

  dom.editorEmpty.classList.toggle("hidden", Boolean(state.activeShare));
  dom.editorFrame.classList.toggle("hidden", !state.activeShare);
  if (state.activeShare) scheduleEditorFrameResize();
}

function renderClassPanel() {
  if (!isTeacherMode()) return;
  const currentClass = selectedClass();
  dom.selectedClassTitle.textContent = currentClass?.name || "Choose a class";
  dom.classList.innerHTML = state.classes.length ? state.classes.map((item) => {
    const count = state.classMembers.filter((member) => member.class_id === item.id).length;
    return `<button type="button" class="class-card ${item.id === state.selectedClassId ? "active" : ""}" data-action="open-class" data-class-id="${escapeHtml(item.id)}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${count} ${count === 1 ? "student" : "students"}</span>
    </button>`;
  }).join("") : `
    <div class="empty-state compact">
      <strong>No classes yet</strong>
      <span>Create a class, add student account emails, then share the current marked paper.</span>
    </div>
  `;
  const members = membersForSelectedClass();
  dom.studentForm.classList.toggle("hidden", !currentClass);
  dom.shareClassBtn.disabled = !currentClass || !state.activePaper || !members.length;
  dom.studentList.innerHTML = currentClass ? (members.length ? members.map((member) => `
    <article class="student-row">
      <div>
        <strong>${escapeHtml(member.student_name || member.student_email)}</strong>
        <span>${escapeHtml(member.student_email)}</span>
      </div>
      <button type="button" data-action="remove-student" data-member-id="${escapeHtml(member.id)}">Remove</button>
    </article>
  `).join("") : `
    <div class="empty-state compact">
      <strong>No students added</strong>
      <span>Add the email address students use for their accounts.</span>
    </div>
  `) : `
    <div class="empty-state compact">
      <strong>Select a class</strong>
      <span>Choose a class to manage its student list.</span>
    </div>
  `;
}

async function createCollection(event) {
  event.preventDefault();
  if (!isTeacherMode()) {
    setNotice(dom.workspaceNotice, "Create a teacher account to make new collections.");
    return;
  }
  const name = dom.collectionName.value.trim();
  if (!name) return;
  const collection = {
    id: newId(),
    owner_id: state.user?.id || null,
    name,
    description: "Saved marked papers",
    color: "#2563eb",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  dom.collectionName.value = "";
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("collections").upsert(collection).select().single();
    if (error) throw error;
    state.collections.unshift(data);
    state.selectedCollectionId = data.id;
    state.paperPanelOpen = true;
  } catch (error) {
    setNotice(dom.workspaceNotice, error.message || "Could not create the collection.");
    return;
  }
  renderWorkspace();
}

async function createClass(event) {
  event.preventDefault();
  if (!isTeacherMode()) {
    setNotice(dom.workspaceNotice, "Create or log in to a teacher account before making classes.");
    return;
  }
  const name = dom.className.value.trim();
  if (!name) return;
  const classRecord = {
    id: newId(),
    owner_id: state.user.id,
    name,
    description: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("classes").upsert(classRecord).select().single();
    if (error) throw error;
    state.classes.unshift(data);
    state.selectedClassId = data.id;
    state.classPanelOpen = true;
    state.paperPanelOpen = false;
    dom.className.value = "";
    renderWorkspace();
  } catch (error) {
    setNotice(dom.workspaceNotice, error.message || "Could not create this class.");
  }
}

async function addStudentToClass(event) {
  event.preventDefault();
  if (!isTeacherMode() || !selectedClass()) return;
  const email = normalizeEmail(dom.studentEmail.value);
  if (!email) return;
  const member = {
    id: newId(),
    class_id: state.selectedClassId,
    teacher_id: state.user.id,
    student_email: email,
    student_name: dom.studentName.value.trim(),
    created_at: new Date().toISOString()
  };
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("class_members")
      .upsert(member, { onConflict: "class_id,student_email" })
      .select()
      .single();
    if (error) throw error;
    state.classMembers = state.classMembers.filter((item) => !(item.class_id === data.class_id && item.student_email === data.student_email));
    state.classMembers.push(data);
    dom.studentEmail.value = "";
    dom.studentName.value = "";
    renderWorkspace();
  } catch (error) {
    setNotice(dom.workspaceNotice, error.message || "Could not add this student.");
  }
}

async function removeStudentFromClass(id) {
  if (!isTeacherMode()) return;
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from("class_members").delete().eq("id", id);
    if (error) throw error;
    state.classMembers = state.classMembers.filter((member) => member.id !== id);
    renderWorkspace();
  } catch (error) {
    setNotice(dom.workspaceNotice, error.message || "Could not remove this student.");
  }
}

async function createPaper() {
  const paper = {
    id: newId(),
    owner_id: state.user?.id || null,
    collection_id: state.selectedCollectionId === "all" ? state.collections[0]?.id || null : state.selectedCollectionId,
    title: "Untitled marked paper",
    student_name: "",
    status: "draft",
    word_count: 0,
    session_json: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (isTeacherMode()) {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from("papers").upsert(paper).select().single();
      if (error) throw error;
      state.papers.unshift(data);
      openPaper(data);
      return;
    } catch (error) {
      setNotice(dom.workspaceNotice, error.message || "Could not create the paper.");
      return;
    }
  }
  state.papers = [paper, ...realPapers()];
  const saved = await saveGuestWorkspace();
  openPaper(paper);
  if (!saved) {
    setNotice(dom.workspaceNotice, "This browser is blocking persistent guest storage, so this paper is saved only until the tab closes.");
  }
}

function openPaper(paper) {
  state.activePaper = paper;
  state.paperPanelOpen = false;
  prepareActiveEditor();
  setNotice(dom.workspaceNotice, "");
  renderWorkspace();
}

async function removePaper(id) {
  if (isTeacherMode()) {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from("papers").delete().eq("id", id);
      if (error) throw error;
    } catch (error) {
      setNotice(dom.workspaceNotice, error.message || "Could not remove this paper.");
      return;
    }
  }
  state.papers = state.papers.filter((paper) => paper.id !== id);
  if (state.mode === "guest" && !realPapers().length) state.papers = [sampleDraftPaper()];
  if (state.mode === "guest") await saveGuestWorkspace();
  if (state.activePaper?.id === id) {
    state.activePaper = state.papers[0] || null;
    prepareActiveEditor();
  }
  renderWorkspace();
}

function postEditor(message) {
  dom.editorFrame.contentWindow?.postMessage(message, "*");
}

function loadActivePaperIntoEditor() {
  if (!state.activePaper?.session_json) {
    setAutosaveStatus("Autosave ready", "idle");
    scheduleEditorFrameResize();
    return;
  }
  postEditor({
    type: "wfs:load-session",
    requestId: newId(),
    session: state.activePaper.session_json
  });
  scheduleEditorFrameResize();
}

function buildPaperRecord(session, status = state.activePaper?.status || "draft") {
  return {
    ...(state.activePaper || {}),
    id: state.activePaper?.id || newId(),
    owner_id: state.user?.id || null,
    collection_id: state.activePaper?.collection_id || (state.selectedCollectionId === "all" ? state.collections[0]?.id || null : state.selectedCollectionId),
    title: session.title || state.activePaper?.title || "Untitled marked paper",
    student_name: session.studentName || state.activePaper?.student_name || "",
    status,
    word_count: wordCountFromHtml(session.editorHtml),
    session_json: session,
    created_at: state.activePaper?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function persistPaperSession(session, options = {}) {
  const status = options.status || state.activePaper?.status || "draft";
  const source = options.source || "autosave";
  const expectedPaperId = options.paperId || state.activePaper?.id;
  if (!session || !state.activePaper) return;
  if (isSamplePaper(state.activePaper)) {
    setAutosaveStatus("Sample preview", "idle");
    return;
  }
  if (expectedPaperId && state.activePaper.id !== expectedPaperId) return;

  const snapshot = paperSnapshotKey(state.activePaper.id, status, session);
  if (source === "autosave" && snapshot === state.lastPersistedSnapshot) {
    setAutosaveStatus(isTeacherMode() ? "Autosaved to cloud" : "Autosaved locally", "saved");
    return;
  }

  if (source === "autosave" && state.autosaveInFlight) {
    window.clearTimeout(state.autosaveTimer);
    state.autosaveTimer = window.setTimeout(() => persistPaperSession(session, options), 900);
    return;
  }

  state.autosaveInFlight = true;
  setAutosaveStatus(source === "complete" ? "Saving completed paper..." : "Autosaving...", "saving");

  try {
    let persisted = buildPaperRecord(session, status);
    let guestSaved = true;
    if (isTeacherMode()) {
      const supabase = await getSupabase();
      const { data, error } = await supabase.from("papers").upsert(persisted).select().single();
      if (error) throw error;
      persisted = data;
    }
    const exists = state.papers.some((paper) => paper.id === persisted.id);
    state.papers = exists
      ? state.papers.map((paper) => paper.id === persisted.id ? persisted : paper)
      : [persisted, ...state.papers];
    state.activePaper = persisted;
    state.lastPersistedSnapshot = paperSnapshotKey(persisted.id, persisted.status || status, persisted.session_json || session);
    if (state.mode === "guest") guestSaved = await saveGuestWorkspace();
    renderWorkspace();
    if (source === "complete") {
      setAutosaveStatus("Marked complete", "saved");
      setNotice(dom.workspaceNotice, guestSaved
        ? "Saved as completed."
        : "Marked complete, but this browser is blocking persistent guest storage, so this paper is saved only until the tab closes.");
    } else {
      setAutosaveStatus(isTeacherMode() ? "Autosaved to cloud" : (guestSaved ? "Autosaved locally" : "Autosaved in this tab"), "saved");
      if (!guestSaved) {
        setNotice(dom.workspaceNotice, "This browser is blocking persistent guest storage, so this paper is saved only until the tab closes.");
      }
    }
  } catch (error) {
    setAutosaveStatus("Autosave failed", "error");
    setNotice(dom.workspaceNotice, error.message || "Could not save this paper.");
  } finally {
    state.autosaveInFlight = false;
  }
}

function queueAutosave(session) {
  if (!state.editorOpen || !state.activePaper || !session) return;
  if (isSamplePaper(state.activePaper)) {
    setAutosaveStatus("Sample preview", "idle");
    return;
  }
  const paperId = session.paperId || state.activePaper.id;
  if (paperId !== state.activePaper.id) return;
  window.clearTimeout(state.autosaveTimer);
  setAutosaveStatus("Autosaving...", "saving");
  state.autosaveTimer = window.setTimeout(() => {
    persistPaperSession(session, {
      paperId,
      status: state.activePaper?.status || "draft",
      source: "autosave"
    });
  }, 1200);
}

function requestEditorSession() {
  const requestId = newId();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("The editor did not respond. Try again after it finishes loading."));
    }, 5000);
    function handler(event) {
      const message = event.data || {};
      if (message.type !== "wfs:session" || message.requestId !== requestId) return;
      window.clearTimeout(timer);
      window.removeEventListener("message", handler);
      resolve(message.session);
    }
    window.addEventListener("message", handler);
    postEditor({ type: "wfs:get-session", requestId });
  });
}

async function savePaper(status = "draft") {
  if (!state.editorOpen) {
    setNotice(dom.workspaceNotice, "Open a paper in the editor before saving.");
    return;
  }
  if (state.activePaper && isSamplePaper(state.activePaper)) {
    setAutosaveStatus("Sample preview", "idle");
    setNotice(dom.workspaceNotice, "This is only a sample draft. Click New paper before saving your own marked paper.");
    return;
  }
  try {
    const session = await requestEditorSession();
    await persistPaperSession(session, {
      status,
      source: status === "completed" ? "complete" : "manual"
    });
  } catch (error) {
    setNotice(dom.workspaceNotice, error.message || "Could not save this paper.");
    setAutosaveStatus("Autosave failed", "error");
  }
}

function exportEditor(kind) {
  if (!state.editorOpen) {
    setNotice(dom.workspaceNotice, "Open a paper before exporting.");
    return;
  }
  postEditor({ type: kind === "pdf" ? "wfs:export-pdf" : "wfs:export-html" });
}

function canonicalFeedbackType(type) {
  const value = String(type || "grammar");
  return feedbackTypes.some(([id]) => id === value) ? value : "grammar";
}

function normalizeCriterionBand(value) {
  if (value === "" || value == null || Number.isNaN(Number(value))) return "";
  const rounded = Math.round(Number(value));
  return String(Math.min(9, Math.max(0, rounded)));
}

function formatBand(value) {
  if (value === "" || value == null || Number.isNaN(Number(value))) return "-";
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function roundedIeltsBand(scores = {}) {
  const values = scoreCriteria.map(([id]) => normalizeCriterionBand(scores[id]));
  if (values.some((value) => value === "")) return null;
  const numeric = values.map(Number);
  const average = numeric.reduce((sum, score) => sum + score, 0) / numeric.length;
  return Math.round(average * 2) / 2;
}

function buildScoreSummaryHtml(scores = {}) {
  const normalized = Object.fromEntries(scoreCriteria.map(([id]) => [id, normalizeCriterionBand(scores[id])]));
  if (!scoreCriteria.some(([id]) => normalized[id] !== "")) return "";
  const overall = roundedIeltsBand(scores);
  const rows = scoreCriteria.map(([id, label]) => `
    <div class="score-chip">
      <span>${escapeHtml(label)}</span>
      <strong>${formatBand(normalized[id])}</strong>
    </div>
  `).join("");
  return `<section class="score-summary">
    <div class="score-overall">
      <span>IELTS Writing</span>
      <strong>${escapeHtml(overall == null ? "Incomplete" : formatBand(overall))}</strong>
      <em>Overall band</em>
    </div>
    <div class="score-breakdown">${rows}</div>
  </section>`;
}

function sanitizeStudentEditorHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  template.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach((node) => node.remove());
  template.content.querySelectorAll(".image-resize-handle, .comment-marker").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) node.removeAttribute(attr.name);
    }
  });
  return template.innerHTML;
}

function prepareInteractiveWritingHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = sanitizeStudentEditorHtml(html);
  const seen = new Map();
  let number = 0;
  template.content.querySelectorAll(".feedback-node[data-feedback-type]").forEach((node, index) => {
    const type = canonicalFeedbackType(node.dataset.feedbackType);
    const id = node.dataset.feedbackId || `feedback-${index}`;
    node.dataset.feedbackType = type;
    feedbackTypes.forEach(([feedbackId]) => node.classList.remove(`fb-${feedbackId}`));
    node.classList.add("feedback-node", `fb-${type}`);
    if (!seen.has(id)) {
      number += 1;
      seen.set(id, number);
    }
    const marker = document.createElement("sup");
    marker.className = "comment-marker";
    marker.textContent = seen.get(id);
    node.appendChild(marker);
  });
  return template.innerHTML;
}

function buildStudentExportHtml(session = {}) {
  const title = session.title || "Writing Feedback";
  const readability = { theme: "light", textSize: 18, ...(session.readability || {}) };
  const theme = ["light", "dark", "contrast"].includes(readability.theme) ? readability.theme : "light";
  const textSize = Math.min(34, Math.max(14, Number(readability.textSize) || 18));
  const hasImage = Boolean(session.taskImage);
  const layoutClass = hasImage ? `content with-image ${session.layout === "image-top" ? "image-top" : "image-left"}` : "content";
  const writingHtml = prepareInteractiveWritingHtml(session.editorHtml || "");
  const labels = Object.fromEntries(feedbackTypes.map(([id, label]) => [id, label]));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root{--line:#d9dee7;--ink:#172033;--muted:#667085;--grammar-bg:#dbeafe;--grammar-border:#60a5fa;--grammar-text:#1d4ed8;--vocabulary-bg:#fef3c7;--vocabulary-border:#f59e0b;--vocabulary-text:#92400e;--spelling-bg:#ffedd5;--spelling-border:#fb923c;--spelling-text:#9a3412;--coherence-bg:#ede9fe;--coherence-border:#a78bfa;--coherence-text:#6d28d9;--task-bg:#cffafe;--task-border:#0891b2;--task-text:#0e7490;--style-bg:#f1f5f9;--style-border:#64748b;--style-text:#334155;--idea-bg:#fae8ff;--idea-border:#d946ef;--idea-text:#86198f;--student-text-size:${textSize}px}
    *{box-sizing:border-box}body{margin:0;background:#f4f6f8;color:var(--ink);font-family:Inter,Arial,Helvetica,sans-serif;line-height:1.65}.page{max-width:1060px;margin:0 auto;padding:34px 30px 42px}.header{margin-bottom:12px}.header h1{margin:0 0 6px;font-size:32px;line-height:1.12}.meta{color:var(--muted);font-size:14px}.prompt{white-space:pre-wrap;background:#fff;border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0;font-weight:700}.score-summary{display:grid;grid-template-columns:170px minmax(0,1fr);gap:12px;background:#fff;border:1px solid #fecaca;border-left:6px solid #b91c1c;border-radius:14px;padding:12px 14px;margin:0 0 18px}.score-overall{display:grid;align-content:center;gap:2px;background:#111827;color:#fff;border-radius:12px;padding:12px}.score-overall span{text-transform:uppercase;letter-spacing:.06em;font-size:11px;font-weight:800;color:#fecaca}.score-overall strong{font-size:34px;line-height:1}.score-overall em{font-style:normal;font-size:12px;color:#e5e7eb}.score-breakdown{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.score-chip{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px;font-weight:700}.score-chip span{color:#475569}.score-chip strong{display:grid;place-items:center;min-width:34px;height:30px;border-radius:999px;background:#b91c1c;color:#fff}.content{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;align-items:start}.content.with-image.image-left{grid-template-columns:minmax(260px,40%) minmax(0,1fr)}.task-image{display:flex;justify-content:center}.task-image img{width:min(100%,780px);height:auto;display:block;object-fit:contain;border:1px solid var(--line);border-radius:12px;background:#fff}.writing-stack{display:grid;gap:14px;min-width:0}.legend{display:flex;gap:7px;flex-wrap:wrap;margin:0}.legend span{border:1px solid currentColor;border-radius:8px;padding:5px 8px;font-size:13px;font-weight:800}.writing{position:relative;background:#fff;border:1px solid var(--line);border-radius:13px;padding:34px;font-size:var(--student-text-size);line-height:1.66;overflow-wrap:anywhere}.writing p{margin:0 0 17px}.writing p:last-child{margin-bottom:0}.editor-image-wrap{display:block;max-width:100%;margin:16px auto;text-align:center}.editor-image-wrap img{display:block;width:auto;max-width:100%;height:auto;margin:0 auto;border:1px solid var(--line);border-radius:10px;background:#fff}.suggest-add{color:#16a34a;font-weight:800}.suggest-delete{color:#dc2626;text-decoration:line-through;text-decoration-thickness:2px;background:#fef2f2}.feedback-node{border:1px solid currentColor;border-bottom-width:2px;border-radius:5px;padding:1px 3px;cursor:pointer;-webkit-box-decoration-break:clone;box-decoration-break:clone}.comment-marker{display:inline-grid;place-items:center;min-width:1.55em;height:1.55em;margin-left:4px;border-radius:999px;background:#111827;color:#fff!important;font-size:.68em;font-weight:900;line-height:1;vertical-align:super;box-shadow:0 0 0 2px #fff,0 1px 4px rgba(15,23,42,.25)}.fb-grammar{background:var(--grammar-bg);color:var(--grammar-text);border-color:var(--grammar-border);border-style:dotted}.fb-vocabulary{background:var(--vocabulary-bg);color:var(--vocabulary-text);border-color:var(--vocabulary-border);border-style:solid}.fb-spelling{background:var(--spelling-bg);color:var(--spelling-text);border-color:var(--spelling-border);border-style:dashed}.fb-coherence{background:var(--coherence-bg);color:var(--coherence-text);border-color:var(--coherence-border);border-style:double}.fb-task{background:var(--task-bg);color:var(--task-text);border-color:var(--task-border);border-style:solid;border-width:2px}.fb-style{background:var(--style-bg);color:var(--style-text);border-color:var(--style-border);border-style:dashed}.fb-idea{background:var(--idea-bg);color:var(--idea-text);border-color:var(--idea-border);border-style:solid}.side-note{position:fixed;z-index:10;width:min(360px,calc(100vw - 24px));max-height:min(420px,calc(100vh - 24px));overflow:auto;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 16px 40px rgba(17,24,39,.18);padding:14px;display:none}.side-note.open{display:block}.side-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}.side-head strong{margin-right:auto}.side-note button{border:1px solid var(--line);background:#fff;border-radius:6px;width:32px;height:32px;cursor:pointer}.side-note p{margin:0}.comment-images{display:grid;gap:8px;margin-top:10px}.comment-images img{display:block;width:100%;max-height:240px;border:1px solid var(--line);border-radius:8px;object-fit:contain}.theme-dark{background:#0b1120;color:#e5e7eb}.theme-dark .prompt,.theme-dark .score-summary,.theme-dark .writing,.theme-dark .side-note{background:#111827;color:#e5e7eb;border-color:#334155;box-shadow:none}.theme-dark .score-chip,.theme-dark .editor-image-wrap img{background:#172033;border-color:#334155}.theme-dark .score-chip span,.theme-dark .meta,.theme-dark .side-note p{color:#cbd5e1}.theme-dark .suggest-delete{background:#4a1010;color:#fecaca}.theme-contrast{background:#000;color:#000}.theme-contrast .prompt,.theme-contrast .score-summary,.theme-contrast .writing,.theme-contrast .side-note{background:#fff;color:#000;border:2px solid #000;box-shadow:none}.theme-contrast .feedback-node,.theme-contrast .legend span{border-width:2px!important}.theme-contrast .suggest-add{color:#006b2e!important;font-weight:900}.theme-contrast .suggest-delete{color:#b00020!important;background:#fff!important;text-decoration-thickness:3px}@media(max-width:900px){.content.with-image.image-left{grid-template-columns:1fr}.score-summary{grid-template-columns:1fr}.score-breakdown{grid-template-columns:1fr}.writing{padding:26px 20px}}
  </style>
</head>
<body class="student-export theme-${theme}">
  <main class="page">
    <section class="header">
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${session.studentName ? `Student: ${escapeHtml(session.studentName)}` : "Shared teacher feedback"}</div>
    </section>
    ${session.taskPrompt ? `<section class="prompt">${escapeHtml(session.taskPrompt)}</section>` : ""}
    ${buildScoreSummaryHtml(session.scores || {})}
    <section class="${layoutClass}">
      ${hasImage ? `<div class="task-image"><img src="${escapeHtml(session.taskImage)}" alt="Writing task visual prompt"></div>` : ""}
      <div class="writing-stack">
        <div class="legend">${feedbackTypes.map(([id, label]) => `<span class="fb-${id}">${escapeHtml(label)}</span>`).join("")}</div>
        <article class="writing"><div class="writing-content">${writingHtml}</div></article>
      </div>
    </section>
  </main>
  <aside id="sideNote" class="side-note" role="dialog" aria-label="Feedback note">
    <div class="side-head"><strong id="sideTitle"></strong><button type="button" id="closeNote" aria-label="Close">x</button></div>
    <div id="sideText"></div>
  </aside>
  <script>
    const labels=${JSON.stringify(labels)};
    const sideNote=document.getElementById("sideNote");
    const sideTitle=document.getElementById("sideTitle");
    const sideText=document.getElementById("sideText");
    function esc(value){return String(value||"").replace(/[&<>"']/g,function(char){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]})}
    function noteImages(node){try{const parsed=JSON.parse(node.dataset.feedbackImages||"[]");return Array.isArray(parsed)?parsed.filter(function(src){return /^(data:image\\/|https?:\\/\\/)/i.test(src)}):[]}catch{return[]}}
    function renderNote(node){const note=esc(node.dataset.feedbackNote||"No explanation was added.").replace(/\\n/g,"<br>");const images=noteImages(node).map(function(src,index){return '<img src="'+esc(src)+'" alt="Comment attachment '+(index+1)+'">'}).join("");sideText.innerHTML="<p>"+note+"</p>"+(images?'<div class="comment-images">'+images+"</div>":"")}
    function placeSideNote(target){const rect=target.getBoundingClientRect();const margin=12;const width=Math.min(360,window.innerWidth-24);const height=Math.min(420,window.innerHeight-24);let left=rect.right+margin;if(left+width>window.innerWidth-margin){left=rect.left-width-margin}if(left<margin)left=margin;let top=rect.top;if(top+height>window.innerHeight-margin){top=window.innerHeight-height-margin}if(top<margin)top=margin;sideNote.style.left=left+"px";sideNote.style.top=top+"px"}
    function closeNote(){sideNote.classList.remove("open")}
    document.querySelectorAll(".feedback-node").forEach(function(node){node.addEventListener("click",function(event){event.stopPropagation();const type=node.dataset.feedbackType||"";sideTitle.textContent=labels[type]||"Feedback";renderNote(node);placeSideNote(node);sideNote.classList.add("open")})});
    document.getElementById("closeNote").addEventListener("click",closeNote);
    document.addEventListener("click",function(event){if(!sideNote.contains(event.target))closeNote()});
    document.addEventListener("keydown",function(event){if(event.key==="Escape")closeNote()});
  <\/script>
</body>
</html>`;
}

async function shareActivePaperToClass() {
  if (!isTeacherMode()) {
    setNotice(dom.workspaceNotice, "Class sharing is available after logging in as a teacher.");
    return;
  }
  const currentClass = selectedClass();
  const members = membersForSelectedClass();
  if (!state.activePaper) {
    setNotice(dom.workspaceNotice, "Open a marked paper before sharing it.");
    return;
  }
  if (!currentClass) {
    state.classPanelOpen = true;
    state.paperPanelOpen = false;
    setNotice(dom.workspaceNotice, "Choose a class before sharing this paper.");
    renderWorkspace();
    return;
  }
  if (!members.length) {
    state.classPanelOpen = true;
    state.paperPanelOpen = false;
    setNotice(dom.workspaceNotice, "Add at least one student email to this class first.");
    renderWorkspace();
    return;
  }
  try {
    const session = await requestEditorSession();
    await persistPaperSession(session, {
      status: state.activePaper.status || "draft",
      source: "manual"
    });
    const paper = state.activePaper;
    const now = new Date().toISOString();
    const exportHtml = buildStudentExportHtml(session);
    const rows = members.map((member) => ({
      id: newId(),
      paper_id: paper.id,
      teacher_id: state.user.id,
      teacher_email: state.user.email || "",
      class_id: currentClass.id,
      class_name: currentClass.name,
      student_email: member.student_email,
      student_name: member.student_name || "",
      paper_title: paper.title || session.title || "Marked paper",
      paper_status: paper.status || "draft",
      word_count: paper.word_count || wordCountFromHtml(session.editorHtml),
      session_json: session,
      export_html: exportHtml,
      shared_at: now,
      updated_at: now
    }));
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("paper_shares")
      .upsert(rows, { onConflict: "paper_id,student_email" });
    if (error) throw error;
    setNotice(dom.workspaceNotice, `Shared "${paper.title || "this paper"}" with ${members.length} ${members.length === 1 ? "student" : "students"} in ${currentClass.name}.`);
  } catch (error) {
    setNotice(dom.workspaceNotice, error.message || "Could not share this paper.");
  }
}

async function openSharedPaper(share, options = {}) {
  state.activeShare = share;
  state.editorOpen = Boolean(share);
  state.paperPanelOpen = false;
  state.classPanelOpen = false;
  setAutosaveStatus("Read-only shared feedback", "saved");
  if (share) {
    dom.editorFrame.removeAttribute("src");
    dom.editorFrame.style.height = "720px";
    dom.editorFrame.srcdoc = share.export_html || buildStudentExportHtml(share.session_json || {});
  }
  if (!options.skipRender) renderWorkspace();
  scheduleEditorFrameResize();
}

document.addEventListener("click", async (event) => {
  const actionTarget = event.target.closest("[data-action]");
  const action = actionTarget?.dataset.action;
  if (!action) return;
  if (action === "show-signup") showAuth("signup", actionTarget.dataset.role || "teacher");
  if (action === "show-login") showAuth("login");
  if (action === "set-auth-role") setAuthRole(actionTarget.dataset.role);
  if (action === "back-landing") setView("landing");
  if (action === "start-guest") await openGuestWorkspace();
  if (action === "sign-out") signOut();
  if (action === "toggle-sidebar") {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    renderWorkspace();
  }
  if (action === "close-paper-panel") {
    state.paperPanelOpen = false;
    renderWorkspace();
  }
  if (action === "open-class-manager") {
    if (!isTeacherMode()) {
      setNotice(dom.workspaceNotice, "Class sharing is available after logging in as a teacher.");
      return;
    }
    state.classPanelOpen = true;
    state.paperPanelOpen = false;
    renderWorkspace();
  }
  if (action === "close-class-panel") {
    state.classPanelOpen = false;
    renderWorkspace();
  }
  if (action === "new-paper") createPaper();
  if (action === "save-complete") savePaper("completed");
  if (action === "share-active-paper") shareActivePaperToClass();
  if (action === "export-html") exportEditor("html");
  if (action === "export-pdf") exportEditor("pdf");
  if (action === "open-paper") {
    const paper = state.papers.find((item) => item.id === event.target.closest("[data-paper-id]").dataset.paperId);
    if (paper) openPaper(paper);
  }
  if (action === "open-share") {
    const share = state.sharedPapers.find((item) => item.id === event.target.closest("[data-share-id]").dataset.shareId);
    if (share) openSharedPaper(share);
  }
  if (action === "open-class") {
    state.selectedClassId = event.target.closest("[data-class-id]").dataset.classId;
    renderWorkspace();
  }
  if (action === "remove-student") removeStudentFromClass(event.target.closest("[data-member-id]").dataset.memberId);
  if (action === "remove-paper") removePaper(event.target.closest("[data-paper-id]").dataset.paperId);
});

document.addEventListener("click", (event) => {
  const collectionButton = event.target.closest("[data-collection-id]");
  if (!collectionButton) return;
  state.selectedCollectionId = collectionButton.dataset.collectionId;
  state.sidebarCollapsed = false;
  state.paperPanelOpen = true;
  state.classPanelOpen = false;
  renderWorkspace();
});

dom.authForm.addEventListener("submit", submitAuth);
dom.authSwitch.addEventListener("click", () => showAuth(state.authMode === "signup" ? "login" : "signup"));
dom.collectionForm.addEventListener("submit", createCollection);
dom.classForm.addEventListener("submit", createClass);
dom.studentForm.addEventListener("submit", addStudentToClass);
dom.paperSearch.addEventListener("input", (event) => {
  state.searchTerm = event.target.value;
  renderWorkspace();
});
dom.editorFrame.addEventListener("load", () => {
  if (!isStudentMode()) loadActivePaperIntoEditor();
  scheduleEditorFrameResize();
});
window.addEventListener("message", (event) => {
  if (isStudentMode()) return;
  if (event.source !== dom.editorFrame.contentWindow) return;
  const message = event.data || {};
  if (!message || typeof message !== "object") return;
  if (message.type === "wfs:editor-ready") {
    loadActivePaperIntoEditor();
  }
  if (message.type === "wfs:loaded") {
    scheduleEditorFrameResize();
  }
  if (message.type === "wfs:autosave-session") {
    queueAutosave(message.session);
    scheduleEditorFrameResize();
  }
});

setAutosaveStatus();
tryRestoreCloudSession();
