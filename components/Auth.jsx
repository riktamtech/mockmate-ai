import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { api } from "../services/api";
import { Code2, Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";
import { useThemeStore } from "../store/useThemeStore";

export const Auth = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [pendingUserData, setPendingUserData] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";

  useEffect(() => {
    let isMounted = true;

    const checkAndRedirect = async () => {
      if (user) {
        redirectAuthenticatedUser(user);
        return;
      }

      const token = localStorage.getItem("token");

      if (token) {
        try {
          const userData = await api.getMe();
          if (isMounted) {
            if (onLoginSuccess) onLoginSuccess(userData);
            redirectAuthenticatedUser(userData);
          }
          return;
        } catch (err) {
          localStorage.removeItem("token");
        }
      }

      if (isMounted) {
        setCheckingAuth(false);
      }
    };

    checkAndRedirect();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (checkingAuth) return;

    const initializeGoogleOneTap = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id:
            "29688754422-1cm4i8vdffevoav9pfuo624gbk9p43oq.apps.googleusercontent.com",
          callback: handleGoogleResponse,
        });
        const parentDiv = document.getElementById("googleSignInDiv");
        if (parentDiv) {
          window.google.accounts.id.renderButton(parentDiv, {
            theme: isDark ? "filled_black" : "outline",
            size: "large",
            width: parentDiv?.offsetWidth || 350,
          });
        }
      }
    };

    if (!window.google) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleOneTap;
      document.body.appendChild(script);
    } else {
      initializeGoogleOneTap();
    }
  }, [checkingAuth]);

  const redirectAuthenticatedUser = (userData) => {
    if (userData.isAdmin) {
      navigate("/mockmate/admin", { replace: true });
    } else if (!userData.profileCompleted) {
      navigate("/mockmate/candidate/profile-setup", { replace: true });
    } else {
      navigate("/mockmate/candidate/dashboard", { replace: true });
    }
  };

  const navigateAfterAuth = (data, isNewRegistration = false) => {
    if (data.isAdmin) {
      navigate("/mockmate/admin");
    } else if (isNewRegistration || !data.profileCompleted) {
      navigate("/mockmate/candidate/profile-setup");
    } else {
      navigate("/mockmate/candidate/dashboard");
    }
  };

  const handleGoogleResponse = async (response) => {
    setLoading(true);
    try {
      const data = await api.googleLogin(response.credential);
      localStorage.setItem("token", data.token);
      onLoginSuccess(data);
      navigateAfterAuth(data, data.isNewUser);
    } catch (err) {
      console.error(err);
      setError("Google Login failed.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center theme-transition"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-full animate-spin"
            style={{
              border: "4px solid var(--border)",
              borderTopColor: "var(--accent)",
            }}
          />
          <p style={{ color: "var(--text-muted)" }}>Checking authentication...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let data;
      if (isLogin) {
        data = await api.login(email, password);
        localStorage.setItem("token", data.token);
        onLoginSuccess(data);
        navigateAfterAuth(data, false);
      } else {
        data = await api.register(name, email, password);
        setPendingUserData(data);
        setShowOtpScreen(true);
      }
    } catch (err) {
      if (
        err.response?.status === 403 &&
        err.response?.data?.message === "Email not verified"
      ) {
        try {
          await api.sendOtp(email);
          setError(
            "Please verify your email before logging in. A new code has been sent.",
          );
          setShowOtpScreen(true);
        } catch (otpErr) {
          setError("Email not verified. Failed to send new OTP code.");
        }
      } else {
        setError(
          err.message || "Authentication failed. Please check credentials.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.verifyOtp(email, otp);
      localStorage.setItem("token", data.token);
      onLoginSuccess(data);
      navigateAfterAuth(data, false);
    } catch (err) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpSending(true);
    setError("");
    try {
      await api.sendOtp(email);
      setError("");
      alert("OTP sent successfully!");
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setOtpSending(false);
    }
  };

  const handleBackToRegister = () => {
    setShowOtpScreen(false);
    setOtp("");
    setPendingUserData(null);
  };

  /* ── Shared card style ── */
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

  if (showOtpScreen) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 theme-transition"
        style={{ background: "var(--bg-base)" }}
      >
        <div className="max-w-md w-full rounded-2xl p-8" style={cardStyle}>
          <button
            onClick={handleBackToRegister}
            className="flex items-center mb-6 transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <ArrowLeft size={18} className="mr-1" /> Back
          </button>

          <div className="flex flex-col items-center mb-8">
            <div
              className="p-3 rounded-xl mb-4"
              style={{ background: "var(--success-bg)", color: "var(--success)" }}
            >
              <Mail size={32} />
            </div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Verify Your Email
            </h1>
            <p className="text-center mt-2" style={{ color: "var(--text-muted)" }}>
              We've sent a 6-digit code to
              <br />
              <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                {email}
              </span>
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

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full p-3 text-center text-2xl tracking-widest rounded-lg focus:ring-2 focus:ring-offset-0 outline-none transition-colors"
                style={{
                  ...inputStyle,
                  focusRingColor: "var(--focus-ring)",
                }}
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              isLoading={loading}
              disabled={otp.length !== 6}
            >
              Verify & Continue
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span style={{ color: "var(--text-muted)" }}>
              Didn't receive the code?{" "}
            </span>
            <button
              onClick={handleResendOtp}
              disabled={otpSending}
              className="hover:underline disabled:opacity-50"
              style={{ color: "var(--accent)" }}
            >
              {otpSending ? "Sending..." : "Resend OTP"}
            </button>
          </div>
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
            <Code2 size={32} />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>
          <p style={{ color: "var(--text-muted)" }}>
            Log in to MockMate AI Portal
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
          {!isLogin && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded-lg focus:ring-2 outline-none transition-colors"
                style={inputStyle}
                required
              />
            </div>
          )}
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
              className="w-full p-2 rounded-lg focus:ring-2 outline-none transition-colors"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 rounded-lg focus:ring-2 outline-none transition-colors"
              style={inputStyle}
              required
            />
          </div>

          <Button type="submit" className="w-full" isLoading={loading}>
            {isLogin ? "Login" : "Sign Up"}
          </Button>

          {isLogin && (
            <div className="text-right mt-2">
              <span
                onClick={() => navigate("/mockmate/forgot-password")}
                className="text-sm cursor-pointer hover:underline"
                style={{ color: "var(--accent)" }}
              >
                Forgot Password?
              </span>
            </div>
          )}
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span
              className="w-full"
              style={{ borderTop: "1px solid var(--border)" }}
            />
          </div>
          <div className="relative flex justify-center text-sm">
            <span
              className="px-2"
              style={{
                background: "var(--bg-surface)",
                color: "var(--text-muted)",
              }}
            >
              Or continue with
            </span>
          </div>
        </div>

        <div
          id="googleSignInDiv"
          className="w-full flex justify-center mb-6"
        ></div>

        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="hover:underline"
            style={{ color: "var(--accent)" }}
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
};
