const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  server: {
    start: (params) => request('/server/start', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

    stop: () => request('/server/stop', {
      method: 'POST',
    }),

    getStatus: () => request('/server/status'),
  },

  client: {
    start: (params) => request('/client/start', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  },

  test: {
    getStatus: (testId) => request(`/test/status/${testId}`),

    getResults: (testId) => request(`/test/results/${testId}`),

    stop: (testId) => request(`/test/stop/${testId}`, {
      method: 'POST',
    }),

    delete: (testId) => request(`/test/${testId}`, {
      method: 'DELETE',
    }),

    deleteAll: () => request('/test', {
      method: 'DELETE',
    }),

    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.append('status', params.status);
      if (params.limit) query.append('limit', params.limit);
      if (params.offset) query.append('offset', params.offset);

      return request(`/test/list?${query}`);
    },
  },

  binary: {
    getInfo: () => request('/binary/info'),
  },
};
