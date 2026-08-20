import React, { useState, useEffect, useCallback } from "react";
import { Settings, AlertTriangle, Database, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase/client";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

interface SettingsViewProps {
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
  ownerName: string;
  businessId: string | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ triggerToast, ownerName, businessId }) => {
  const [wabaId, setWabaId] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const fetchWhatsAppConfig = useCallback(async () => {
    if (!businessId) return;
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("whatsapp_waba_id, whatsapp_phone_number_id")
        .eq("id", businessId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setWabaId(data.whatsapp_waba_id || null);
        setPhoneNumberId(data.whatsapp_phone_number_id || null);
      }
    } catch (err) {
      console.error("Error fetching WhatsApp configuration:", err);
    } finally {
      setLoadingConfig(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchWhatsAppConfig();
  }, [businessId, fetchWhatsAppConfig]);

  useEffect(() => {
    // Initialize the Meta SDK if it exists, or schedule it
    const initFb = () => {
      if (window.FB) {
        const appId = process.env.NEXT_PUBLIC_META_APP_ID;
        if (!appId) {
          console.warn("NEXT_PUBLIC_META_APP_ID is not configured in env variables.");
        }
        window.FB.init({
          appId: appId || "",
          cookie: true,
          xfbml: true,
          version: "v19.0",
        });
      }
    };

    if (window.FB) {
      initFb();
    } else {
      window.fbAsyncInit = initFb;
    }
  }, []);

  const handleConnectWhatsApp = () => {
    if (!businessId) {
      triggerToast("Erreur : Aucun ID de commerce identifié.", "warning");
      return;
    }

    if (!window.FB) {
      triggerToast("Le SDK Meta n'est pas encore chargé. Veuillez patienter ou recharger la page.", "warning");
      return;
    }

    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
    if (!configId) {
      console.warn("NEXT_PUBLIC_META_CONFIG_ID env variable is not set.");
    }

    setIsConnecting(true);

    window.FB.login(
      async (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          try {
            const res = await fetch("/api/whatsapp/embedded-signup", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                code,
                businessId,
                redirectUri: window.location.origin,
              }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || "Échec de l'intégration WhatsApp.");
            }

            triggerToast(`WhatsApp connecté avec succès ! Numéro : ${data.displayPhoneNumber || ""}`, "success");
            fetchWhatsAppConfig();
          } catch (err: any) {
            console.error("Error in exchange:", err);
            triggerToast(err.message || "Erreur de connexion WhatsApp", "warning");
          } finally {
            setIsConnecting(false);
          }
        } else {
          triggerToast("Le processus de connexion Meta a été annulé.", "warning");
          setIsConnecting(false);
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
        },
      }
    );
  };

  const isConnected = !!phoneNumberId && !!wabaId;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full text-encre">
      
      {/* Meta API Integration Card */}
      <div className="bg-white p-6 rounded-[2rem] border border-graphite/10 flex flex-col justify-between gap-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-encre flex items-center gap-2">
              <Settings className="w-4 h-4 text-menthe" />
              <span>Intégration API WhatsApp</span>
            </h3>
            <span className="text-[9px] uppercase px-2.5 py-0.5 rounded-full font-bold bg-menthe/10 text-menthe border border-menthe/20">
              Embedded Signup
            </span>
          </div>
          
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleConnectWhatsApp}
              disabled={isConnecting || loadingConfig}
              className={`w-full font-bold py-3 px-4 rounded-xl text-xs text-center transition-all ${
                isConnected
                  ? "bg-white border border-graphite/15 hover:bg-graphite/5 text-encre"
                  : "bg-graphite text-white hover:opacity-90"
              } flex items-center justify-center gap-2`}
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : isConnected ? (
                "Reconnecter ou modifier le compte WhatsApp"
              ) : (
                "Connecter mon WhatsApp Business"
              )}
            </button>
            {isConnected ? (
              <span className="text-[10px] text-menthe font-semibold text-center block mt-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> WhatsApp Business connecté
              </span>
            ) : (
              <span className="text-[10px] text-amber-600 font-semibold text-center block mt-1">
                ⚠️ Non connecté — cliquez sur le bouton pour lier votre compte
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-encre/50">Statut de la connexion Meta</label>
              <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-bold ${
                isConnected ? "bg-menthe/5 border-menthe/15 text-menthe" : "bg-neige text-encre/50 border-graphite/10"
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? "bg-menthe" : "bg-graphite"}`}></span>
                <span>{isConnected ? "Opérationnel" : "Non configuré"}</span>
              </div>
            </div>

            {isConnected && (
              <div className="bg-neige border border-graphite/10 p-3 rounded-xl flex flex-col gap-2 text-[10px] font-semibold text-encre/70">
                <div>
                  <span className="text-encre/40 uppercase font-bold">WABA ID :</span>{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-graphite/10 font-mono text-[10px]">{wabaId}</code>
                </div>
                <div>
                  <span className="text-encre/40 uppercase font-bold">Phone Number ID :</span>{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-graphite/10 font-mono text-[10px]">{phoneNumberId}</code>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/50 text-amber-800 rounded-xl border border-amber-200/50 text-[10px] flex gap-2.5 items-start font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-bold text-encre">Sécurité d’accès</span><br />
            L’API Meta requiert un jeton d’accès permanent stocké de manière isolée pour {ownerName || "Tiedrebeogo Wilfried"}.
          </div>
        </div>
      </div>

      {/* Database/Sync card */}
      <div className="bg-white p-6 rounded-[2rem] border border-graphite/10 flex flex-col justify-between gap-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-encre flex items-center gap-2">
              <Database className="w-4 h-4 text-menthe" />
              <span>Synchronisation Supabase</span>
            </h3>
            <span className="text-[9px] uppercase px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Phase 3
            </span>
          </div>
          
          <p className="text-xs text-encre/60 leading-relaxed font-semibold">
            Les données locales de sessions (prospects, commandes, livreurs, catalogue) seront synchronisées en temps réel avec votre base de données Supabase.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase font-bold text-encre/50">Base de données active</label>
            <div className="flex items-center gap-2 bg-neige text-encre/40 border border-graphite/10 px-3 py-2.5 rounded-xl text-xs font-mono font-semibold">
              <span>(Aucune base de données connectée)</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => triggerToast("Option disponible après connexion Supabase (Phase 3)", "warning")}
          className="magnetic-btn bg-neige hover:bg-graphite/10 text-encre/50 border border-graphite/15 font-bold py-3 rounded-xl text-center text-xs transition-all shadow-xs"
        >
          Forcer la synchronisation (Indisponible)
        </button>
      </div>

    </div>
  );
};
