import React, { useState } from "react";
import { Button } from "./ui/Button";
import { api } from "../services/api";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

export const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await api.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to send reset email. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-lg)",
  };

  const inputStyle = {
    background: "var(--bg-inset)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 theme-transition"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="max-w-md w-full rounded-2xl p-8 text-center" style={cardStyle}>
          <div
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: "var(--success-bg)", color: "var(--success)" }}
          >
            <CheckCircle size={32} />
          </div>
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Check your email
          </h2>
          <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
            We've sent a password reset link to{" "}
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>
              {email}
            </span>
          </p>
          <Link to="/mockmate/login">
            <Button variant="outline" className="w-full">
              Back to Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 theme-transition"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="max-w-md w-full rounded-2xl p-8" style={cardStyle}>
        <Link
          to="/mockmate/login"
          className="flex items-center mb-6 transition-colors"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={18} className="mr-1" /> Back to Login
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div
            className="p-3 rounded-xl mb-4"
            style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
          >
            <Mail size={32} />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Forgot Password?
          </h1>
          <p
            className="text-center mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            No worries, we'll send you reset instructions.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg focus:ring-2 outline-none transition-all"
              style={inputStyle}
              placeholder="Enter your email"
              required
            />
          </div>

          <Button type="submit" className="w-full" isLoading={loading}>
            Send Reset Link
          </Button>
        </form>
      </div>
    </div>
  );
};
