import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

export default function Login() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem(
        "staff",
        JSON.stringify(response.data)
      );

      navigate("/dashboard");

    } catch (error) {
      alert("Invalid credentials");
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center">

      <form
        onSubmit={handleLogin}
        className="p-8 rounded-xl shadow-md bg-white space-y-4"
      >

        <h1 className="text-2xl font-bold">
          Staff Login
        </h1>


        <input
          className="border p-3 rounded w-full"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />


        <input
          className="border p-3 rounded w-full"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
        />


        <button
          className="bg-purple-600 text-white px-6 py-2 rounded"
        >
          Login
        </button>


      </form>

    </div>
  )
}