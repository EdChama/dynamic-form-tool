import { Bell, Check, ClipboardList, Edit3, FileText, LayoutDashboard, Lock, LogOut, RefreshCcw, Send, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './api/client';
import { DynamicForm } from './components/forms/DynamicForm';
import { FormBuilder } from './components/forms/FormBuilder';
import type {
  AuthUser,
  BuilderDefinition,
  EditableFormSummary,
  FormSummary,
  ManagedUser,
  NotificationItem,
  PublicForm,
  SubmissionPayload,
  SubmissionRecord,
} from './types/forms';

interface ToastMessage {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

type WorkspacePage = 'dashboard' | 'forms' | 'users' | 'notifications';

export function App() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialFormSlug = initialParams.get('form') ?? '';
  const [page, setPage] = useState<WorkspacePage>('dashboard');
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [editableForms, setEditableForms] = useState<EditableFormSummary[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(() => initialFormSlug);
  const [accessKey, setAccessKey] = useState<string>(() => initialParams.get('access_key') ?? '');
  const [selectedForm, setSelectedForm] = useState<PublicForm | null>(null);
  const [selectedAdminFormId, setSelectedAdminFormId] = useState('');
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [token, setToken] = useState(() => localStorage.getItem('dynamic-form-token') ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('password123');
  const [showAdminLogin, setShowAdminLogin] = useState(() => initialFormSlug === '');
  const [isLoadingForms, setIsLoadingForms] = useState(true);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read_at).length, [notifications]);
  const selectedAdminForm = editableForms.find((form) => form.id === selectedAdminFormId) ?? editableForms[0] ?? null;

  useEffect(() => {
    void loadForms();
  }, []);

  useEffect(() => {
    if (token && !user) {
      void restoreSession(token);
    }
  }, [token]);

  useEffect(() => {
    if (selectedSlug && !user) {
      void loadForm(selectedSlug);
    }
  }, [selectedSlug, accessKey, user]);

  useEffect(() => {
    if (token && selectedAdminFormId) {
      void loadSubmissions(selectedAdminFormId);
    } else {
      setSubmissions([]);
    }
  }, [token, selectedAdminFormId]);

  async function loadForms() {
    setIsLoadingForms(true);
    setError(null);

    try {
      const data = await retryRequest(() => apiClient.listForms(), 5);
      setForms(data);
      setSelectedSlug((current) => current || (showAdminLogin ? '' : data[0]?.slug || ''));
    } catch {
      setError('Forms are not available yet. Confirm the API is reachable and migrations completed successfully.');
      showToast('Forms are not available yet. The API may still be starting or migrating.', 'error');
    } finally {
      setIsLoadingForms(false);
    }
  }

  async function restoreSession(activeToken: string) {
    try {
      const activeUser = await apiClient.me(activeToken);
      setUser(activeUser);
      setShowAdminLogin(false);
      setPage('dashboard');
      await loadEditableForms(activeToken);
      await loadNotifications(activeToken, true);
      if (activeUser.role === 'admin') {
        await loadManagedUsers(activeToken);
      }
    } catch {
      localStorage.removeItem('dynamic-form-token');
      setToken('');
      setUser(null);
      setShowAdminLogin(true);
    }
  }

  async function login() {
    setError(null);
    try {
      const session = await apiClient.login(email, password);
      localStorage.setItem('dynamic-form-token', session.token);
      setToken(session.token);
      setUser(session.user);
      setShowAdminLogin(false);
      setPage('dashboard');
      await loadEditableForms(session.token);
      await loadNotifications(session.token, true);
      if (session.user.role === 'admin') {
        await loadManagedUsers(session.token);
      }
      showToast(`Signed in as ${session.user.name}`, 'success');
    } catch {
      setError('Login failed. Use the seeded admin or manager credentials.');
      showToast('Login failed. Use the seeded admin or manager credentials.', 'error');
    }
  }

  function logout() {
    localStorage.removeItem('dynamic-form-token');
    setToken('');
    setUser(null);
    setNotifications([]);
    setManagedUsers([]);
    setSelectedAdminFormId('');
    setSubmissions([]);
    setPage('dashboard');
    setShowAdminLogin(true);
  }

  async function loadEditableForms(activeToken = token) {
    if (!activeToken) {
      return;
    }
    const data = await apiClient.listEditableForms(activeToken);
    setEditableForms(data);
    setSelectedAdminFormId((current) => current || data[0]?.id || '');
  }

  async function loadManagedUsers(activeToken = token) {
    if (!activeToken) {
      return;
    }
    setManagedUsers(await apiClient.listUsers(activeToken));
  }

  async function loadSubmissions(formId: string) {
    if (!token || !formId) {
      return;
    }

    setIsLoadingSubmissions(true);
    try {
      setSubmissions(await apiClient.listAdminSubmissions(token, formId));
    } catch {
      showToast('Unable to load submissions for this form.', 'error');
      setSubmissions([]);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }

  async function loadForm(slug: string) {
    setIsLoadingForm(true);
    setError(null);

    try {
      setSelectedForm(await apiClient.getForm(slug, accessKey));
    } catch {
      setError('Unable to load the selected form.');
      showToast('Unable to load the selected form.', 'error');
    } finally {
      setIsLoadingForm(false);
    }
  }

  async function submitSelectedForm(payload: SubmissionPayload) {
    if (!selectedForm) {
      throw new Error('No form selected');
    }

    const result = await apiClient.submitForm(selectedForm.slug, payload, accessKey);
    showToast(`Submission saved as ${result.submission_reference}`, 'success');
    return result;
  }

  async function saveBuilderForm(definition: BuilderDefinition, formId?: string) {
    if (!token) {
      throw new Error('Login required');
    }
    if (formId) {
      await apiClient.updateForm(token, formId, definition);
      showToast('Form version saved. Notifications were sent.', 'success');
    } else {
      await apiClient.createForm(token, definition);
      showToast('Form draft created. Notifications were sent.', 'success');
    }
    await loadForms();
    await loadEditableForms(token);
    await loadNotifications(token);
  }

  async function publishBuilderForm(formId: string) {
    if (!token) {
      throw new Error('Login required');
    }
    await apiClient.publishForm(token, formId);
    await loadForms();
    await loadEditableForms(token);
    await loadNotifications(token);
    showToast('Form published. Notifications were sent.', 'success');
  }

  async function deleteBuilderForm(formId: string) {
    if (!token) {
      throw new Error('Login required');
    }
    await apiClient.deleteForm(token, formId);
    await loadForms();
    await loadEditableForms(token);
    await loadNotifications(token);
    showToast('Form archived. Notifications were sent.', 'success');
  }

  async function loadBuilderVersions(formId: string) {
    if (!token) {
      throw new Error('Login required');
    }

    return apiClient.listFormVersions(token, formId);
  }

  async function loadBuilderVersion(formId: string, versionId: string) {
    if (!token) {
      throw new Error('Login required');
    }

    return apiClient.getFormVersion(token, formId, versionId);
  }

  async function loadNotifications(activeToken = token, announceUnread = false) {
    if (!activeToken) {
      return;
    }

    const data = await apiClient.listNotifications(activeToken);
    setNotifications(data);

    if (announceUnread) {
      data.filter((item) => !item.read_at).slice(0, 3).forEach((item) => showToast(item.subject, 'info'));
    }
  }

  async function markNotificationRead(notificationId: string) {
    if (!token) {
      return;
    }

    await apiClient.markNotificationRead(token, notificationId);
    setNotifications((current) => current.map((item) => (
      item.id === notificationId
        ? { ...item, status: 'read', read_at: new Date().toISOString() }
        : item
    )));
  }

  function showToast(message: string, tone: ToastMessage['tone'] = 'info') {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 6000);
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  async function retryRequest<T>(request: () => Promise<T>, attempts: number): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await request();
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt * 700));
        }
      }
    }

    throw lastError;
  }

  return (
    <main className="app-shell">
      <div className="toast-region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`}>
            <span>{toast.tone === 'success' ? <Check size={16} /> : <Bell size={16} />}</span>
            <p>{toast.message}</p>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <aside className="sidebar" aria-label={user ? 'Workspace navigation' : 'Available forms'}>
        <div className="brand">
          <FileText aria-hidden="true" size={24} />
          <div>
            <h1>Dynamic Forms</h1>
            <p>{user ? 'Admin workspace' : 'Schema-driven submissions'}</p>
          </div>
        </div>

        {user ? (
          <>
            <nav className="side-nav" aria-label="Workspace">
              <button className={page === 'dashboard' ? 'active' : ''} type="button" onClick={() => setPage('dashboard')}>
                <LayoutDashboard size={18} /> Dashboard
              </button>
              <button className={page === 'forms' ? 'active' : ''} type="button" onClick={() => setPage('forms')}>
                <ClipboardList size={18} /> Forms
              </button>
              <button className={page === 'users' ? 'active' : ''} type="button" onClick={() => setPage('users')}>
                <Users size={18} /> Users
              </button>
              <button className={page === 'notifications' ? 'active' : ''} type="button" onClick={() => setPage('notifications')}>
                <Bell size={18} /> Notifications
                {unreadCount > 0 ? <span className="nav-badge">{unreadCount}</span> : null}
              </button>
            </nav>
            <div className="side-account">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <small>{user.role}</small>
              <button className="secondary-button compact" type="button" onClick={logout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          </>
        ) : (
          <>
            <button className="icon-button" type="button" onClick={loadForms} aria-label="Refresh forms">
              <RefreshCcw aria-hidden="true" size={18} />
            </button>
            <div className="mode-switch">
              <button
                className={!showAdminLogin ? 'active' : ''}
                type="button"
                onClick={() => {
                  setShowAdminLogin(false);
                  setSelectedSlug((current) => current || forms[0]?.slug || '');
                }}
              >
                Fill forms
              </button>
              <button className={showAdminLogin ? 'active' : ''} type="button" onClick={() => setShowAdminLogin(true)}>
                Admin login
              </button>
            </div>
            {!showAdminLogin ? (
              <div className="form-list">
                {isLoadingForms ? <div className="muted">Loading forms...</div> : null}
                {!isLoadingForms && forms.length === 0 ? <div className="muted">No completed public forms found.</div> : null}
                {forms.map((form) => (
                  <button
                    key={form.slug}
                    className={form.slug === selectedSlug ? 'form-list-item active' : 'form-list-item'}
                    type="button"
                    onClick={() => {
                      setAccessKey('');
                      setSelectedSlug(form.slug);
                    }}
                  >
                    <strong>{form.name}</strong>
                    <span>Version {form.version_number}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </aside>

      <section className="content">
        {error ? <div className="page-error">{error}</div> : null}

        {!user && showAdminLogin ? (
          <LoginPanel email={email} password={password} setEmail={setEmail} setPassword={setPassword} onLogin={login} />
        ) : null}

        {!user && !showAdminLogin ? (
          <>
            {isLoadingForm ? <div className="loading-panel">Loading selected form...</div> : null}
            {!isLoadingForm && selectedForm ? (
              <DynamicForm form={selectedForm} onSubmit={submitSelectedForm} />
            ) : null}
            {!isLoadingForms && !isLoadingForm && !selectedForm ? (
              <div className="page-surface empty-submit-state">
                <div>
                  <p className="eyebrow">Forms</p>
                  <h2>No form selected</h2>
                  <p>
                    Choose a completed public form from the left panel, or open a restricted form with its shared link.
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={() => void loadForms()}>
                  <RefreshCcw size={16} /> Refresh forms
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {user && page === 'dashboard' ? (
          <DashboardPage
            forms={editableForms}
            submissions={submissions}
            unreadCount={unreadCount}
            user={user}
            onOpenForms={() => setPage('forms')}
            onOpenNotifications={() => setPage('notifications')}
          />
        ) : null}

        {user && page === 'forms' ? (
          <FormsWorkspace
            forms={editableForms}
            selectedForm={selectedAdminForm}
            submissions={submissions}
            isLoadingSubmissions={isLoadingSubmissions}
            onRefreshSubmissions={() => selectedAdminFormId ? loadSubmissions(selectedAdminFormId) : Promise.resolve()}
            builder={(
              <FormBuilder
                forms={editableForms}
                onSave={saveBuilderForm}
                onPublish={publishBuilderForm}
                onDelete={deleteBuilderForm}
                onLoadVersions={loadBuilderVersions}
                onLoadVersion={loadBuilderVersion}
                onRefresh={() => loadEditableForms()}
                onSelectedFormChange={setSelectedAdminFormId}
              />
            )}
          />
        ) : null}

        {user && page === 'users' ? (
          <UsersPage user={user} users={managedUsers} onRefresh={() => loadManagedUsers()} />
        ) : null}

        {user && page === 'notifications' ? (
          <NotificationsPage notifications={notifications} onRefresh={() => loadNotifications()} onMarkRead={markNotificationRead} />
        ) : null}
      </section>
    </main>
  );
}

function LoginPanel({
  email,
  password,
  setEmail,
  setPassword,
  onLogin,
}: {
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onLogin: () => void;
}) {
  return (
    <div className="login-panel">
      <Lock size={22} />
      <h2>Admin login</h2>
      <p>Seeded development credentials are prefilled.</p>
      <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <button className="primary-button" type="button" onClick={onLogin}>Login</button>
    </div>
  );
}

function DashboardPage({
  forms,
  submissions,
  unreadCount,
  user,
  onOpenForms,
  onOpenNotifications,
}: {
  forms: EditableFormSummary[];
  submissions: SubmissionRecord[];
  unreadCount: number;
  user: AuthUser;
  onOpenForms: () => void;
  onOpenNotifications: () => void;
}) {
  const draftCount = forms.filter((form) => form.status === 'draft').length;
  const completedCount = forms.filter((form) => form.status === 'completed').length;
  const restrictedCount = forms.filter((form) => form.access_level === 'restricted').length;

  return (
    <div className="workspace-stack">
      <section className="page-surface dashboard-hero">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Welcome back, {user.name}</h2>
          <p>Manage forms from draft to publication, collect responses, and review system activity from the workspace menu.</p>
        </div>
        <div className="button-row">
          <button className="primary-button compact" type="button" onClick={onOpenForms}>
            <Edit3 size={16} /> Open forms
          </button>
          <button className="secondary-button" type="button" onClick={onOpenNotifications}>
            <Bell size={16} /> Notifications
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Workspace summary">
        <article className="metric-card">
          <span>Total forms</span>
          <strong>{forms.length}</strong>
        </article>
        <article className="metric-card">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </article>
        <article className="metric-card">
          <span>Drafts</span>
          <strong>{draftCount}</strong>
        </article>
        <article className="metric-card">
          <span>Restricted links</span>
          <strong>{restrictedCount}</strong>
        </article>
        <article className="metric-card">
          <span>Selected-form submissions</span>
          <strong>{submissions.length}</strong>
        </article>
        <article className="metric-card">
          <span>Unread notifications</span>
          <strong>{unreadCount}</strong>
        </article>
      </section>

      <section className="page-surface flow-panel">
        <div className="page-header">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2>From design to collection</h2>
            <p>The app flow is designed around a complete form lifecycle.</p>
          </div>
          <Send size={24} aria-hidden="true" />
        </div>
        <div className="flow-steps">
          <article>
            <strong>1. Create or edit</strong>
            <p>Open Forms, choose a saved form or start a new one, then define fields, validations, access, and status.</p>
          </article>
          <article>
            <strong>2. Preview and publish</strong>
            <p>Preview the current draft, save a version description, and publish when the form is ready to collect data.</p>
          </article>
          <article>
            <strong>3. Collect responses</strong>
            <p>Public and restricted links render the stored schema and validate submissions against the backend.</p>
          </article>
          <article>
            <strong>4. Review activity</strong>
            <p>Use Forms for submissions and Notifications for system events such as saved versions and new responses.</p>
          </article>
        </div>
      </section>
    </div>
  );
}

function FormsWorkspace({
  forms,
  selectedForm,
  submissions,
  isLoadingSubmissions,
  onRefreshSubmissions,
  builder,
}: {
  forms: EditableFormSummary[];
  selectedForm: EditableFormSummary | null;
  submissions: SubmissionRecord[];
  isLoadingSubmissions: boolean;
  onRefreshSubmissions: () => Promise<void>;
  builder: ReactNode;
}) {
  return (
    <div className="workspace-stack">
      <section className="page-surface">
        <div className="page-header">
          <div>
            <p className="eyebrow">Forms</p>
            <h2>Design, publish, and collect</h2>
            <p>{forms.length} editable form{forms.length === 1 ? '' : 's'} available. Select a form to edit it and review collected submissions below.</p>
          </div>
          <Edit3 size={24} aria-hidden="true" />
        </div>
        <div className="flow-strip" aria-label="Form flow">
          <span>Editor</span>
          <span>Version history</span>
          <span>Preview</span>
          <span>Publish/share</span>
          <span>Submissions</span>
        </div>
      </section>
      {builder}
      <section className="page-surface">
        <div className="page-header">
          <div>
            <p className="eyebrow">Submissions</p>
            <h2>{selectedForm ? selectedForm.name : 'Select a form'}</h2>
            <p>{selectedForm ? 'Submitted records for the selected form.' : 'Choose a saved form in the editor to view submissions.'}</p>
          </div>
          <button className="icon-button light" type="button" onClick={() => void onRefreshSubmissions()} aria-label="Refresh submissions">
            <RefreshCcw size={16} />
          </button>
        </div>
        {isLoadingSubmissions ? <p className="muted">Loading submissions...</p> : null}
        {!isLoadingSubmissions && submissions.length === 0 ? <div className="empty-state">No submissions have been received for this form yet.</div> : null}
        {submissions.length > 0 ? (
          <div className="submission-table">
            {submissions.map((submission) => (
              <article className="submission-row" key={submission.id}>
                <div>
                  <strong>{submission.submission_reference}</strong>
                  <span>v{submission.version_number ?? '-'} - {new Date(submission.created_at).toLocaleString()}</span>
                </div>
                <pre>{JSON.stringify(submission.payload_json, null, 2)}</pre>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function UsersPage({ user, users, onRefresh }: { user: AuthUser; users: ManagedUser[]; onRefresh: () => Promise<void> }) {
  const canViewUsers = user.role === 'admin';

  return (
    <section className="page-surface">
      <div className="page-header">
        <div>
          <p className="eyebrow">Users</p>
          <h2>Role management</h2>
          <p>CI4 Shield-backed roles are represented by the users table and enforced by API route policies.</p>
        </div>
        <button className="icon-button light" type="button" onClick={() => void onRefresh()} aria-label="Refresh users" disabled={!canViewUsers}>
          <RefreshCcw size={16} />
        </button>
      </div>
      {!canViewUsers ? <div className="empty-state">Only admins can view the user directory.</div> : null}
      {canViewUsers ? (
        <div className="user-grid">
          {users.map((managedUser) => (
            <article className="user-card" key={managedUser.id}>
              <strong>{managedUser.name}</strong>
              <span>{managedUser.email}</span>
              <small>{managedUser.role} - {managedUser.is_active ? 'active' : 'inactive'}</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NotificationsPage({
  notifications,
  onRefresh,
  onMarkRead,
}: {
  notifications: NotificationItem[];
  onRefresh: () => Promise<void>;
  onMarkRead: (notificationId: string) => Promise<void>;
}) {
  const unread = notifications.filter((notification) => !notification.read_at).length;

  return (
    <section className="page-surface">
      <div className="page-header">
        <div>
          <p className="eyebrow">Notifications</p>
          <h2>System events</h2>
          <p>{unread} unread notification{unread === 1 ? '' : 's'}.</p>
        </div>
        <button className="icon-button light" type="button" onClick={() => void onRefresh()} aria-label="Refresh notifications">
          <RefreshCcw size={16} />
        </button>
      </div>
      {notifications.length === 0 ? <div className="empty-state">No notifications yet.</div> : null}
      <div className="notification-list">
        {notifications.map((notification) => (
          <article key={notification.id} className={notification.read_at ? 'notification-card read' : 'notification-card'}>
            <div>
              <h3>{notification.subject}</h3>
              <p>{notification.body}</p>
              <small>{new Date(notification.created_at).toLocaleString()}</small>
            </div>
            {!notification.read_at ? (
              <button className="secondary-button compact" type="button" onClick={() => void onMarkRead(notification.id)}>
                Mark read
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
