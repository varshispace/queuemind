import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://queuemind-backend.onrender.com";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Invalid credentials");
      }

      localStorage.setItem("staff", JSON.stringify(data));

      navigate("/dashboard");

    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">

      <div className="w-full max-w-md">

        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-lg border border-mind-100 p-8 space-y-6"
        >

          <div className="text-center">
            <div className="text-4xl mb-3">🧠</div>

            <h1 className="text-2xl font-display font-extrabold text-mind-700">
              Staff Login
            </h1>

            <p className="text-sm text-mind-400 mt-2">
              Authorized QueueMind staff only
            </p>
          </div>


          <div>
            <label className="block text-sm font-semibold text-mind-700 mb-2">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@queuemind.com"
              required
              className="w-full border border-mind-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-mind-200"
            />
          </div>


          <div>
            <label className="block text-sm font-semibold text-mind-700 mb-2">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="w-full border border-mind-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-mind-200"
            />
          </div>


          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}


          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mind-700 text-white rounded-xl py-3 font-semibold hover:bg-mind-800 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

        </form>

      </div>

    </div>
  );
}