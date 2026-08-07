import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../auth";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Wrapper for AuthProvider
function Wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  mockFetch.mockReset();
  // Reset window.location.href
  Object.defineProperty(window, "location", {
    value: { href: "/" },
    writable: true,
  });
});

describe("useAuth()", () => {
  describe("checkAuth()", () => {
    it("checks auth status on mount", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "1", email: "test@example.com", name: "Test" } }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual({
        id: "1",
        email: "test@example.com",
        name: "Test",
      });
    });

    it("handles unauthenticated state", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: null }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("handles fetch error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe("requestMagicLink()", () => {
    it("sends magic link successfully", async () => {
      // First call for checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: null }),
      });

      // Second call for requestMagicLink
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ link: "http://localhost:3000/api/auth/verify?token=abc" }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.requestMagicLink("test@example.com");
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/magic-link",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        })
      );
    });

    it("throws on API error", async () => {
      // First call for checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: null }),
      });

      // Second call for requestMagicLink
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Rate limit exceeded" }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.requestMagicLink("test@example.com");
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe("Rate limit exceeded");
        }
      });
    });
  });

  describe("logout()", () => {
    it("logs out successfully", async () => {
      // First call for checkAuth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "1", email: "test@example.com", name: "Test" } }),
      });

      // Second call for logout
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Logged out" }),
      });

      const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(window.location.href).toBe("/login");
    });
  });
});
