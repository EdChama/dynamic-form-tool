import type {
  ApiFailure,
  ApiSuccess,
  AuthSession,
  BuilderDefinition,
  EditableFormSummary,
  FormSummary,
  FormVersionDetail,
  FormVersionSummary,
  ManagedUser,
  NotificationItem,
  PublicForm,
  SubmissionPayload,
  SubmissionRecord,
} from '../types/forms';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://dynaform-api.edchama.site/api';

async function request<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const body = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || body.status === 'error') {
    throw body;
  }

  return body.data;
}

export const apiClient = {
  login(email: string, password: string): Promise<AuthSession> {
    return request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  me(token: string): Promise<AuthSession['user']> {
    return request<AuthSession['user']>('/auth/me', undefined, token);
  },

  listNotifications(token: string): Promise<NotificationItem[]> {
    return request<NotificationItem[]>('/notifications', undefined, token);
  },

  markNotificationRead(token: string, notificationId: string): Promise<unknown> {
    return request(`/notifications/${notificationId}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, token);
  },

  listEditableForms(token: string): Promise<EditableFormSummary[]> {
    return request<EditableFormSummary[]>('/admin/forms', undefined, token);
  },

  listUsers(token: string): Promise<ManagedUser[]> {
    return request<ManagedUser[]>('/admin/users', undefined, token);
  },

  createForm(token: string, definition: BuilderDefinition): Promise<unknown> {
    return request('/admin/forms', {
      method: 'POST',
      body: JSON.stringify(definition),
    }, token);
  },

  updateForm(token: string, formId: string, definition: BuilderDefinition): Promise<unknown> {
    return request(`/admin/forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify(definition),
    }, token);
  },

  publishForm(token: string, formId: string): Promise<unknown> {
    return request(`/admin/forms/${formId}/publish`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, token);
  },

  deleteForm(token: string, formId: string): Promise<unknown> {
    return request(`/admin/forms/${formId}`, {
      method: 'DELETE',
    }, token);
  },

  listFormVersions(token: string, formId: string): Promise<FormVersionSummary[]> {
    return request<FormVersionSummary[]>(`/admin/forms/${formId}/versions`, undefined, token);
  },

  getFormVersion(token: string, formId: string, versionId: string): Promise<FormVersionDetail> {
    return request<FormVersionDetail>(`/admin/forms/${formId}/versions/${versionId}`, undefined, token);
  },

  listAdminSubmissions(token: string, formId: string): Promise<SubmissionRecord[]> {
    return request<SubmissionRecord[]>(`/admin/forms/${formId}/submissions`, undefined, token);
  },

  listForms(): Promise<FormSummary[]> {
    return request<FormSummary[]>('/forms');
  },

  getForm(slug: string, accessKey?: string): Promise<PublicForm> {
    const query = accessKey ? `?access_key=${encodeURIComponent(accessKey)}` : '';
    return request<PublicForm>(`/forms/${slug}${query}`);
  },

  submitForm(slug: string, payload: SubmissionPayload, accessKey?: string): Promise<{ id: string; submission_reference: string; created_at: string }> {
    const query = accessKey ? `?access_key=${encodeURIComponent(accessKey)}` : '';
    return request(`/forms/${slug}/submissions${query}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
