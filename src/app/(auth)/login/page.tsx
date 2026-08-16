"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (isMagicLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSuccessMsg("Lien magique envoyé par email ! Vérifiez votre boîte de réception.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Success: check if they belong to a business
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.user) {
          const { data: member } = await supabase
            .from("business_members")
            .select("business_id")
            .eq("user_id", session.session.user.id)
            .maybeSingle();

          if (!member) {
            router.push("/onboarding");
          } else {
            router.push("/");
          }
        } else {
          router.push("/");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-encre">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-xl font-black">Ravi de vous revoir</h2>
        <p className="text-xs text-encre/50 font-semibold">Connectez-vous à votre espace closeur</p>
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

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
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

        {!isMagicLink && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-bold text-encre/50">Mot de passe *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="magnetic-btn w-full bg-encre hover:bg-menthe hover:text-neige text-neige font-bold py-3 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
        >
          {loading ? "Connexion..." : isMagicLink ? "Envoyer le lien magique" : "Se connecter"}
        </button>
      </form>

      <div className="flex flex-col gap-3 text-center text-xs font-semibold mt-2">
        <button
          type="button"
          onClick={() => setIsMagicLink(!isMagicLink)}
          className="text-menthe hover:underline"
        >
          {isMagicLink ? "Se connecter avec un mot de passe" : "Se connecter sans mot de passe (Magic Link)"}
        </button>

        <div className="text-encre/50 mt-1">
          Nouveau sur Mon Closeur ?{" "}
          <Link href="/register" className="text-encre hover:underline font-bold">
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  );
}
