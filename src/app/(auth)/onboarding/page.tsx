"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        
        // If they already have a business linked, bypass onboarding
        const { data: member } = await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (member) {
          router.push("/");
        }
      }
    };
    checkUserSession();
  }, [router]);

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !ownerName.trim()) {
      setErrorMsg("Toutes les informations sont requises.");
      return;
    }
    if (!user) return;

    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Insert new business
      const newBusinessId = crypto.randomUUID();
      const { error: busErr } = await supabase
        .from("businesses")
        .insert({
          id: newBusinessId,
          name: businessName.trim(),
          owner_name: ownerName.trim(),
        });
      if (busErr) throw busErr;

      // 2. Map user to business in business_members
      const { error: memErr } = await supabase
        .from("business_members")
        .insert({
          business_id: newBusinessId,
          user_id: user.id,
          role: "owner"
        });
      if (memErr) throw memErr;

      // 3. Redirect to dashboard
      router.push("/");
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de la configuration.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center text-xs text-encre/50 py-8 font-semibold">
        Chargement de votre session...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-encre">
      <div className="flex flex-col gap-1 text-center">
        <h2 className="text-xl font-black">Configurez votre Business</h2>
        <p className="text-xs text-encre/50 font-semibold">Démarrez votre espace de closing IA</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleOnboarding} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-encre/50">Nom de votre commerce / business *</label>
          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Ex: Tiedrebeogo Shop, Wilfried Boutique..."
            className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-encre/50">Nom complet du propriétaire *</label>
          <input
            type="text"
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Ex: Wilfried Tiedrebeogo"
            className="bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="magnetic-btn w-full bg-encre hover:bg-menthe hover:text-neige text-neige font-bold py-3 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
        >
          {loading ? "Création..." : "Finaliser la configuration"}
        </button>
      </form>
    </div>
  );
}
