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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Check your email
          </h2>
          <p className="text-slate-600 mb-8">
            We've sent a password reset link to{" "}
            <span className="font-medium text-slate-800">{email}</span>
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <Link
          to="/mockmate/login"
          className="flex items-center text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft size={18} className="mr-1" /> Back to Login
        </Link>

        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-blue-50 rounded-xl mb-4 text-blue-600">
            <Mail size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Forgot Password?
          </h1>
          <p className="text-slate-500 text-center mt-2">
            No worries, we'll send you reset instructions.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
