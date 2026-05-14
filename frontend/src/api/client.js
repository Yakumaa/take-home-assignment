/**
 * api/client.js
 *
 * Single axios instance with JWT injection via request interceptor.
 * All API functions are collected here — pages import from this file only.
 */

import axios from "axios";

// In Docker, Vite proxies /api/* to http://backend:8000/*
// In local dev (no Docker), set VITE_API_URL=http://localhost:8000
const BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach JWT from localStorage ────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: redirect to login on 401 ──────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────

export const login = (email, password) =>
  apiClient.post("/auth/login", { email, password });

export const register = (email, password) =>
  apiClient.post("/auth/register", { email, password });

// ── Candidates ───────────────────────────────────────────────────────────────

/**
 * List candidates with optional filters and pagination.
 * @param {Object} params - { status, role_applied, skill, keyword, page, page_size }
 */
export const listCandidates = (params = {}) =>
  apiClient.get("/candidates", { params });

export const getCandidate = (id) =>
  apiClient.get(`/candidates/${id}`);

export const createCandidate = (data) =>
  apiClient.post("/candidates", data);

export const updateCandidate = (id, data) =>
  apiClient.patch(`/candidates/${id}`, data);

export const deleteCandidate = (id) =>
  apiClient.delete(`/candidates/${id}`);

// ── Scores ───────────────────────────────────────────────────────────────────

export const submitScore = (candidateId, data) =>
  apiClient.post(`/candidates/${candidateId}/scores`, data);

// ── AI Summary ───────────────────────────────────────────────────────────────

/**
 * Trigger mock AI summary generation.
 * The backend awaits asyncio.sleep(2) before responding — this call will
 * take ~2 seconds. The caller should show a loading state for the duration.
 */
export const generateSummary = (candidateId) =>
  apiClient.post(`/candidates/${candidateId}/summary`);