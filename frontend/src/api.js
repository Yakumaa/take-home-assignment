import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Authentication
 */
export const authAPI = {
  // Register a new reviewer account
  register: (email, password) =>
    api.post('/auth/register', { email, password }),

  // Login to get a JWT token
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
};

/**
 * Candidates
 */
export const candidatesAPI = {
  // Get list of candidates with filters and page-based pagination
  getList: ({ status, role_applied, skill, keyword, page = 1, page_size = 20 } = {}) => {
    const params = { page, page_size };
    if (status) params.status = status;
    if (role_applied) params.role_applied = role_applied;
    if (skill) params.skill = skill;
    if (keyword) params.keyword = keyword;
    
    return api.get('/candidates', { params });
  },

  // Create a new candidate (Admin only)
  create: (candidateData) =>
    api.post('/candidates', candidateData),

  // Get single candidate detail with scores
  getDetail: (id) =>
    api.get(`/candidates/${id}`),

  // Update candidate status or internal_notes
  update: (id, updateData) =>
    api.patch(`/candidates/${id}`, updateData),

  // Soft delete a candidate (Admin only)
  delete: (id) =>
    api.delete(`/candidates/${id}`),

  // Submit score for a candidate
  submitScore: (id, scoreData) =>
    api.post(`/candidates/${id}/scores`, scoreData),

  // Get AI summary (2-second simulated delay on backend)
  getSummary: (id) =>
    api.post(`/candidates/${id}/summary`),

  // Helper method to establish an SSE connection for live score updates
  // Note: Native EventSource doesn't support custom headers (like Bearer tokens) easily.
  // This helper uses the modern fetch API to read the SSE stream manually.
  streamScores: async function* (id) {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}/candidates/${id}/stream`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep incomplete chunk in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6);
          try {
            yield JSON.parse(dataStr);
          } catch (e) {
            console.error("Failed to parse SSE data", e);
          }
        }
      }
    }
  }
};

export default api;