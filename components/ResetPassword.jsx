import React, { useState } from "react";
import { Button } from "./ui/Button";
import { api } from "../services/api";
import { KeyRound, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useParams, useNavigate, Link } from "react-router-dom";

export const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const { resettoken } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      await api.resetPassword(resettoken, password);
      setSuccess(true);
      setTimeout(() => {
        navigate("/mockmate/login");
      }, 3000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to reset password. Link might be invalid or expired.",
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
            Password Reset Successful
          </h2>
          <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
            Your password has been successfully updated. Redirecting to login...
          </p>
          <Link to="/mockmate/login">
            <Button className="w-full">Login Now</Button>
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
        <div className="flex flex-col items-center mb-8">
          <div
            className="p-3 rounded-xl mb-4"
            style={{ background: "var(--accent-bg)", color: "var(--accent)" }}
          >
            <KeyRound size={32} />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            Set New Password
          </h1>
          <p
            className="text-center mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            Must be at least 6 characters.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm flex items-start gap-2"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              New Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 rounded-lg focus:ring-2 outline-none transition-all pr-10"
                style={inputStyle}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 rounded-lg focus:ring-2 outline-none transition-all pr-10"
                style={inputStyle}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            isLoading={loading}
            disabled={
              loading || password !== confirmPassword || password.length < 6
            }
          >
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  );
};
