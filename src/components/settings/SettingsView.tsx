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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<"auto" | "manual">("manual"); // Default to manual since it's user preference

  // Manual inputs form state
  const [inputWabaId, setInputWabaId] = useState("");
  const [inputPhoneNumberId, setInputPhoneNumberId] = useState("");
  const [inputAccessToken, setInputAccessToken] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  const fetchWhatsAppConfig = useCallback(async () => {
    if (!businessId) return;
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("whatsapp_waba_id, whatsapp_phone_number_id, whatsapp_access_token")
        .eq("id", businessId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setWabaId(data.whatsapp_waba_id || null);
        setPhoneNumberId(data.whatsapp_phone_number_id || null);
        setAccessToken(data.whatsapp_access_token || null);
        
        setInputWabaId(data.whatsapp_waba_id || "");
        setInputPhoneNumberId(data.whatsapp_phone_number_id || "");
        setInputAccessToken(data.whatsapp_access_token || "");
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
    console.log("Client-side Meta Env:", {
      appId: process.env.NEXT_PUBLIC_META_APP_ID,
      configId: process.env.NEXT_PUBLIC_META_CONFIG_ID,
    });
  }, []);

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

    try {
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
                  redirectUri: window.location.origin + "/",
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
    } catch (error: any) {
      console.error("FB.login failed:", error);
      triggerToast("Impossible d'ouvrir la popup de connexion Meta. Vérifiez que votre navigateur autorise les fenêtres popups.", "warning");
      setIsConnecting(false);
    }
  };

  const handleSaveManualConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      triggerToast("Erreur : Aucun ID de commerce identifié.", "warning");
      return;
    }

    setIsSavingManual(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          whatsapp_waba_id: inputWabaId.trim() || null,
          whatsapp_phone_number_id: inputPhoneNumberId.trim() || null,
          whatsapp_access_token: inputAccessToken.trim() || null,
        })
        .eq("id", businessId);

      if (error) throw error;

      triggerToast("Configuration WhatsApp enregistrée avec succès !", "success");
      fetchWhatsAppConfig();
    } catch (err: any) {
      console.error("Error saving manual config:", err);
      triggerToast(err.message || "Erreur lors de la sauvegarde", "warning");
    } finally {
      setIsSavingManual(false);
    }
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
              Paramètres
            </span>
          </div>

          {/* Toggle Tabs */}
          <div className="flex bg-neige p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 text-center py-2 text-[10px] font-bold rounded-lg transition-all ${
                activeTab === "manual" ? "bg-white text-encre shadow-xs" : "text-encre/50 hover:text-encre"
              }`}
            >
              Configuration Manuelle
            </button>
            <button
              onClick={() => setActiveTab("auto")}
              className={`flex-1 text-center py-2 text-[10px] font-bold rounded-lg transition-all ${
                activeTab === "auto" ? "bg-white text-encre shadow-xs" : "text-encre/50 hover:text-encre"
              }`}
            >
              Connexion Automatique (Meta)
            </button>
          </div>
          
          {activeTab === "auto" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleConnectWhatsApp}
                  disabled={isConnecting || loadingConfig || !businessId}
                  className={`w-full font-bold py-3 px-4 rounded-xl text-xs text-center transition-all ${
                    !businessId
                      ? "bg-neige border border-graphite/10 text-encre/30 cursor-not-allowed"
                      : isConnected
                        ? "bg-white border border-graphite/15 hover:bg-graphite/5 text-encre"
                        : "bg-graphite text-white hover:opacity-90"
                  } flex items-center justify-center gap-2`}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Connexion en cours...</span>
                    </>
                  ) : !businessId ? (
                    "Chargement de la session..."
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
            </div>
          ) : (
            <form onSubmit={handleSaveManualConfig} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Token d&apos;accès permanent</label>
                <input
                  type="password"
                  placeholder="Jeton d'accès de l'application système..."
                  value={inputAccessToken}
                  onChange={(e) => setInputAccessToken(e.target.value)}
                  className="w-full bg-neige border border-graphite/10 px-3 py-2 rounded-xl text-xs font-mono placeholder:text-encre/30 focus:outline-none focus:border-graphite/30"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">WhatsApp Business Account (WABA) ID</label>
                <input
                  type="text"
                  placeholder="Ex: 109384729103984"
                  value={inputWabaId}
                  onChange={(e) => setInputWabaId(e.target.value)}
                  className="w-full bg-neige border border-graphite/10 px-3 py-2 rounded-xl text-xs font-mono placeholder:text-encre/30 focus:outline-none focus:border-graphite/30"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-bold text-encre/50">Phone Number ID</label>
                <input
                  type="text"
                  placeholder="Ex: 109284719283749"
                  value={inputPhoneNumberId}
                  onChange={(e) => setInputPhoneNumberId(e.target.value)}
                  className="w-full bg-neige border border-graphite/10 px-3 py-2 rounded-xl text-xs font-mono placeholder:text-encre/30 focus:outline-none focus:border-graphite/30"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingManual || loadingConfig || !businessId}
                className="w-full bg-graphite hover:opacity-90 text-white font-bold py-2.5 px-4 rounded-xl text-xs text-center transition-all flex items-center justify-center gap-2 mt-1"
              >
                {isSavingManual ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sauvegarde en cours...</span>
                  </>
                ) : (
                  "Enregistrer la configuration"
                )}
              </button>
            </form>
          )}

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-encre/50">Statut de la connexion</label>
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
                {accessToken && (
                  <div>
                    <span className="text-encre/40 uppercase font-bold">Jeton d&apos;accès :</span>{" "}
                    <span className="text-graphite font-mono">Détecté (Masqué)</span>
                  </div>
                )}
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
