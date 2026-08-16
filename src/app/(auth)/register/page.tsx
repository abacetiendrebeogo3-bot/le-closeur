"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });
      if (error) throw error;

      if (data?.session) {
        // If auto-logged in, go directly to onboarding
        router.push("/onboarding");
      } else {
        setSuccessMsg("Inscription réussie ! Un email de confirmation vous a été envoyé pour activer votre compte. Après confirmation, connectez-vous pour configurer votre entreprise.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-encre">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-xl font-black">Rejoindre Mon Closeur</h2>
        <p className="text-xs text-encre/50 font-semibold">Créez votre compte de closing automatisé</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold text-center">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-xs font-semibold text-center">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-encre/50">Adresse email *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
            className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-encre/50">Mot de passe *</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="•••••••• (6 caractères min)"
            className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="magnetic-btn w-full bg-encre hover:bg-menthe hover:text-neige text-neige font-bold py-3 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
        >
          {loading ? "Création..." : "Créer mon compte"}
        </button>
      </form>

      <div className="flex flex-col gap-3 text-center text-xs font-semibold mt-2">
        <div className="text-encre/50">
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="text-encre hover:underline font-bold">
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
