"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { gsap } from "gsap";
import { supabase } from "../../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isMagicLink, setIsMagicLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    gsap.fromTo(".auth-card-content",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
    );
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Veuillez saisir votre adresse email.");
      return;
    }
    if (!isMagicLink && !password) {
      setErrorMsg("Veuillez saisir votre mot de passe.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (isMagicLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setSuccessMsg("Lien magique envoyé par email ! Vérifiez votre boîte de réception.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMsg("Veuillez saisir votre adresse email d'abord dans le champ ci-dessus.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setSuccessMsg("Email de réinitialisation de mot de passe envoyé ! Vérifiez votre boîte de réception.");
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de la demande de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card-content flex flex-col gap-6 text-encre">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-xl font-black">Ravi de vous revoir</h2>
        <p className="text-xs text-encre/50 font-semibold">Connectez-vous à votre espace closeur</p>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-semibold text-center transition-all animate-pulse">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-green-50 border border-green-100 text-green-700 rounded-2xl text-xs font-semibold text-center transition-all">
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
            disabled={loading}
            className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold w-full disabled:opacity-60"
          />
        </div>

        {!isMagicLink && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase font-bold text-encre/50">Mot de passe *</label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-[10px] text-menthe hover:underline font-bold"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="bg-neige border border-graphite/10 rounded-xl pl-4 pr-10 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold w-full disabled:opacity-60"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-encre/40 hover:text-encre disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="magnetic-btn w-full bg-encre hover:bg-menthe hover:text-neige text-neige font-bold py-3 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Connexion en cours...</span>
            </>
          ) : (
            <span>{isMagicLink ? "Envoyer le lien magique" : "Se connecter"}</span>
          )}
        </button>
      </form>

      <div className="flex flex-col gap-3 text-center text-xs font-semibold mt-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => setIsMagicLink(!isMagicLink)}
          className="text-menthe hover:underline disabled:opacity-50"
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
