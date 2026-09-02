import React, { useState, useEffect, useCallback, useRef } from "react";
import { Settings, AlertTriangle, Database, CheckCircle2, RefreshCw, Sparkles, Phone, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "../../lib/supabase/client";
import { BusinessPhoneNumber } from "../../types";

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
  
  // Meta Ads States
  const [metaAdsToken, setMetaAdsToken] = useState<string | null>(null);
  const [metaAdsAccountId, setMetaAdsAccountId] = useState<string | null>(null);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingAds, setIsConnectingAds] = useState(false);
  const [activeTab, setActiveTab] = useState<"auto" | "manual">("manual"); // Default to manual since it's user preference

  // Manual inputs form state
  const [inputWabaId, setInputWabaId] = useState("");
  const [inputPhoneNumberId, setInputPhoneNumberId] = useState("");
  const [inputAccessToken, setInputAccessToken] = useState("");
  
  const [inputMetaAdsToken, setInputMetaAdsToken] = useState("");
  const [inputMetaAdsAccountId, setInputMetaAdsAccountId] = useState("");
  
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [isSavingManualAds, setIsSavingManualAds] = useState(false);
  // Secondary Numbers state
  const [secondaryNumbers, setSecondaryNumbers] = useState<BusinessPhoneNumber[]>([]);
  const [newSecondaryLabel, setNewSecondaryLabel] = useState("");
  const [isConnectingSecondary, setIsConnectingSecondary] = useState(false);
  
  // Secondary Manual Fallback State
  const [showManualSecondary, setShowManualSecondary] = useState(false);
  const [manualSecPhoneId, setManualSecPhoneId] = useState("");
  const [manualSecWabaId, setManualSecWabaId] = useState("");
  const [manualSecToken, setManualSecToken] = useState("");
  const [isSavingManualSec, setIsSavingManualSec] = useState(false);
  const [isSubscribingWebhooks, setIsSubscribingWebhooks] = useState(false);
  
  // Evolution QR Code & Pairing Code State
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [evolutionQRModal, setEvolutionQRModal] = useState<{ open: boolean; instanceName: string; qrcode: string; pairingCode: string; label: string } | null>(null);
  const [qrStatusText, setQrStatusText] = useState("En attente du scan...");
  const [connectTabMode, setConnectTabMode] = useState<"pairing" | "qr">("pairing");
  const [pairingPhone, setPairingPhone] = useState("");
  const [isRequestingPairing, setIsRequestingPairing] = useState(false);

  const handleGenerateEvolutionQR = async () => {
    if (!businessId) {
      triggerToast("Erreur : Aucun ID de commerce identifié.", "warning");
      return;
    }
    setIsGeneratingQR(true);
    setQrStatusText("En attente de connexion...");
    try {
      const res = await fetch("/api/whatsapp/evolution/create-instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          label: newSecondaryLabel.trim() || `Commerciale ${secondaryNumbers.length + 1}`,
          phoneNumber: pairingPhone.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Échec de génération du QR Code");
      }
      setEvolutionQRModal({
        open: true,
        instanceName: data.instanceName,
        qrcode: data.qrcode,
        pairingCode: data.pairingCode,
        label: data.label
      });
      triggerToast(`Instance créée pour ${data.label} !`, "success");
      fetchWhatsAppConfig();
    } catch (err: any) {
      triggerToast(err.message || "Erreur de génération QR Code", "warning");
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleFetchPairingCode = async () => {
    if (!evolutionQRModal?.instanceName || !pairingPhone.trim()) {
      triggerToast("Veuillez saisir votre numéro de téléphone WhatsApp.", "warning");
      return;
    }
    setIsRequestingPairing(true);
    try {
      const res = await fetch(`/api/whatsapp/evolution/refresh-qr?instanceName=${evolutionQRModal.instanceName}&phoneNumber=${pairingPhone.trim()}`);
      const data = await res.json();
      if (data.pairingCode) {
        setEvolutionQRModal(prev => prev ? { ...prev, pairingCode: data.pairingCode, qrcode: data.qrcode || prev.qrcode } : null);
        triggerToast("Code à 8 chiffres généré avec succès !", "success");
      } else {
        triggerToast("Impossible d'obtenir le code à 8 chiffres pour ce numéro.", "warning");
      }
    } catch (err) {
      triggerToast("Erreur d'obtention du code à 8 chiffres", "warning");
    } finally {
      setIsRequestingPairing(false);
    }
  };

  const refreshQRCode = async () => {
    if (!evolutionQRModal?.instanceName) return;
    try {
      const res = await fetch(`/api/whatsapp/evolution/refresh-qr?instanceName=${evolutionQRModal.instanceName}&phoneNumber=${pairingPhone.trim()}`);
      const data = await res.json();
      if (data.qrcode || data.pairingCode) {
        setEvolutionQRModal(prev => prev ? {
          ...prev,
          qrcode: data.qrcode || prev.qrcode,
          pairingCode: data.pairingCode || prev.pairingCode
        } : null);
      }
    } catch (err) {
      console.error("Error refreshing QR:", err);
    }
  };

  const checkQRStatus = async () => {
    if (!evolutionQRModal?.instanceName) return;
    try {
      const res = await fetch(`/api/whatsapp/evolution/status?instanceName=${evolutionQRModal.instanceName}`);
      const data = await res.json();
      if (data.connected) {
        setQrStatusText("🟢 Connecté avec succès !");
        triggerToast("Félicitations ! Le compte WhatsApp est connecté.", "success");
        setTimeout(() => {
          setEvolutionQRModal(null);
        }, 2000);
      } else {
        setQrStatusText(`Statut actuel : ${data.state || "Non connecté"}`);
      }
    } catch (err) {
      console.error("Error checking QR status:", err);
    }
  };

  const pendingSignupData = useRef<{ waba_id?: string; phone_number_id?: string } | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.event === "FINISH" && data?.data) {
          pendingSignupData.current = {
            waba_id: data.data.waba_id,
            phone_number_id: data.data.phone_number_id,
          };
          console.log("Captured WA_EMBEDDED_SIGNUP selection:", pendingSignupData.current);
        }
      } catch (e) {
        // Message non lié à l'Embedded Signup, on ignore
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleSyncWebhooks = async () => {
    setIsSubscribingWebhooks(true);
    try {
      const res = await fetch("/api/whatsapp/subscribe-webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de souscription");
      triggerToast("Abonnement Webhook souscrit avec succès auprès de Meta pour tous vos numéros !", "success");
    } catch (err: any) {
      triggerToast(err.message || "Erreur de souscription Webhook", "warning");
    } finally {
      setIsSubscribingWebhooks(false);
    }
  };

  const fetchWhatsAppConfig = useCallback(async () => {
    if (!businessId) return;
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("whatsapp_waba_id, whatsapp_phone_number_id, whatsapp_access_token, meta_ads_access_token, meta_ads_account_id")
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

        // Set Meta Ads
        setMetaAdsToken(data.meta_ads_access_token || null);
        setMetaAdsAccountId(data.meta_ads_account_id || null);
        setInputMetaAdsToken(data.meta_ads_access_token || "");
        setInputMetaAdsAccountId(data.meta_ads_account_id || "");
      }

      // Fetch Secondary Numbers
      let { data: secData, error: secErr } = await supabase
        .from("business_phone_numbers")
        .select("*")
        .eq("business_id", businessId);

      if (secErr || !secData || secData.length === 0) {
        const { data: fallbackSec } = await supabase
          .from("business_phone_numbers")
          .select("*");
        if (fallbackSec && fallbackSec.length > 0) {
          secData = fallbackSec;
        }
      }

      if (secData && secData.length > 0) {
        setSecondaryNumbers(secData);
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
    pendingSignupData.current = null;

    const processLoginResponse = async (response: any) => {
      console.log("FB.login response:", JSON.stringify(response));
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
              wabaId: pendingSignupData.current?.waba_id,
              phoneNumberId: pendingSignupData.current?.phone_number_id,
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
    };

    try {
      window.FB.login(
        (response: any) => {
          processLoginResponse(response);
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {
              business: {
                id: "367996209724981",
              },
            },
          },
        }
      );
    } catch (error: any) {
      console.error("FB.login failed:", error);
      triggerToast("Impossible d'ouvrir la popup de connexion Meta. Vérifiez que votre navigateur autorise les fenêtres popups.", "warning");
      setIsConnecting(false);
    }
  };

  const handleConnectSecondaryWhatsApp = () => {
    if (!businessId) {
      triggerToast("Erreur : Aucun ID de commerce identifié.", "warning");
      return;
    }

    if (!window.FB) {
      triggerToast("Le SDK Meta n'est pas encore chargé. Veuillez patienter ou recharger la page.", "warning");
      return;
    }

    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
    setIsConnectingSecondary(true);

    // Timeout safety to reset spinner if popup is blocked or closed without callback
    const timeoutId = setTimeout(() => {
      setIsConnectingSecondary((prev) => {
        if (prev) {
          triggerToast("Si la fenêtre de connexion Meta ne s'est pas ouverte, vérifiez que votre navigateur autorise les popups ou utilisez l'ajout manuel ci-dessous.", "warning");
        }
        return false;
      });
    }, 10000);

    const processSecondaryLoginResponse = async (response: any) => {
      clearTimeout(timeoutId);
      console.log("FB.login response:", JSON.stringify(response));
      if (response.authResponse) {
        const code = response.authResponse.code;
        try {
          const res = await fetch("/api/whatsapp/embedded-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              businessId,
              redirectUri: window.location.origin + "/",
              isSecondary: true,
              label: newSecondaryLabel.trim() || "Commerciale 1",
              wabaId: pendingSignupData.current?.waba_id,
              phoneNumberId: pendingSignupData.current?.phone_number_id,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Échec de l'intégration du numéro secondaire.");
          }

          triggerToast(`Numéro secondaire (${data.displayPhoneNumber || ""}) connecté en mode Coexistence !`, "success");
          setNewSecondaryLabel("");
          fetchWhatsAppConfig();
        } catch (err: any) {
          console.error("Error in secondary exchange:", err);
          triggerToast(err.message || "Erreur de connexion WhatsApp secondaire", "warning");
        } finally {
          setIsConnectingSecondary(false);
        }
      } else {
        triggerToast("Le processus de connexion Meta a été annulé ou bloqué par le navigateur.", "warning");
        setIsConnectingSecondary(false);
      }
    };

    try {
      pendingSignupData.current = null;
      window.FB.login(
        (response: any) => {
          processSecondaryLoginResponse(response);
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: {
            setup: {
              business: {
                id: "367996209724981",
              },
            },
          },
        }
      );
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("FB.login failed:", error);
      triggerToast("Impossible d'ouvrir la popup de connexion Meta.", "warning");
      setIsConnectingSecondary(false);
    }
  };

  const handleSaveManualSecondary = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeBusId = businessId || "00000000-0000-0000-0000-000000000001";
    if (!manualSecPhoneId.trim()) {
      triggerToast("Veuillez saisir le Phone Number ID.", "warning");
      return;
    }

    setIsSavingManualSec(true);
    try {
      const targetLabel = newSecondaryLabel.trim() || `Commerciale ${secondaryNumbers.length + 1}`;
      const { data: savedData, error } = await supabase
        .from("business_phone_numbers")
        .upsert({
          business_id: activeBusId,
          phone_number: manualSecPhoneId.trim(),
          phone_number_id: manualSecPhoneId.trim(),
          whatsapp_phone_number_id: manualSecPhoneId.trim(),
          waba_id: manualSecWabaId.trim() || null,
          access_token: manualSecToken.trim() || null,
          conversation_mode: "human_coexistence",
          label: targetLabel
        }, {
          onConflict: 'phone_number_id'
        })
        .select()
        .single();

      if (error) throw error;

      const newSecItem = savedData || {
        id: String(Date.now()),
        business_id: businessId,
        phone_number_id: manualSecPhoneId.trim(),
        whatsapp_phone_number_id: manualSecPhoneId.trim(),
        label: targetLabel,
        conversation_mode: "human_coexistence"
      };

      setSecondaryNumbers(prev => {
        const filtered = prev.filter(n => n.phone_number_id !== manualSecPhoneId.trim());
        return [...filtered, newSecItem];
      });

      triggerToast("Numéro secondaire enregistré avec succès !", "success");
      setManualSecPhoneId("");
      setManualSecWabaId("");
      setManualSecToken("");
      setNewSecondaryLabel("");
      setShowManualSecondary(false);
      fetchWhatsAppConfig();
    } catch (err: any) {
      console.error("Error saving manual secondary number:", err);
      triggerToast(err.message || "Erreur lors de l'enregistrement manuel", "warning");
    } finally {
      setIsSavingManualSec(false);
    }
  };

  const handleDeleteSecondaryNumber = async (id: string) => {
    try {
      setSecondaryNumbers(prev => prev.filter(n => n.id !== id));
      const { error } = await supabase.from("business_phone_numbers").delete().eq("id", id);
      if (error) throw error;
      triggerToast("Numéro secondaire supprimé.", "info");
      fetchWhatsAppConfig();
    } catch (err: any) {
      triggerToast(err.message || "Erreur lors de la suppression", "warning");
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

  const handleConnectMetaAds = () => {
    if (!businessId) {
      triggerToast("Erreur : Aucun ID de commerce identifié.", "warning");
      return;
    }

    if (!window.FB) {
      triggerToast("Le SDK Meta n'est pas encore chargé. Veuillez patienter ou recharger la page.", "warning");
      return;
    }

    setIsConnectingAds(true);

    try {
      window.FB.login(
        async (response: any) => {
          if (response.authResponse) {
            const code = response.authResponse.code;
            try {
              const res = await fetch("/api/meta-ads/connect", {
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
                throw new Error(data.error || "Échec de l'intégration Meta Ads.");
              }

              triggerToast(`Meta Ads connecté avec succès ! Compte publicitaire ID : ${data.adAccountId || ""}`, "success");
              fetchWhatsAppConfig();
            } catch (err: any) {
              console.error("Error in exchange:", err);
              triggerToast(err.message || "Erreur de connexion Meta Ads", "warning");
            } finally {
              setIsConnectingAds(false);
            }
          } else {
            triggerToast("Le processus de connexion Meta Ads a été annulé.", "warning");
            setIsConnectingAds(false);
          }
        },
        {
          scope: "ads_read,read_insights",
          response_type: "code",
          override_default_response_type: true
        }
      );
    } catch (error: any) {
      console.error("FB.login failed:", error);
      triggerToast("Impossible d'ouvrir la popup de connexion Meta Ads. Vérifiez que votre navigateur autorise les fenêtres popups.", "warning");
      setIsConnectingAds(false);
    }
  };

  const handleSaveManualMetaAds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      triggerToast("Erreur : Aucun ID de commerce identifié.", "warning");
      return;
    }

    setIsSavingManualAds(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          meta_ads_access_token: inputMetaAdsToken.trim() || null,
          meta_ads_account_id: inputMetaAdsAccountId.trim() || null,
        })
        .eq("id", businessId);

      if (error) throw error;

      triggerToast("Configuration Meta Ads enregistrée !", "success");
      fetchWhatsAppConfig();
    } catch (err: any) {
      console.error("Error saving manual ads config:", err);
      triggerToast(err.message || "Erreur lors de la sauvegarde", "warning");
    } finally {
      setIsSavingManualAds(false);
    }
  };

  const isConnected = !!phoneNumberId && !!wabaId;
  const isAdsConnected = !!metaAdsToken && !!metaAdsAccountId;

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

        {/* Secondary Phone Numbers for Commercial Coexistence Mode */}
        <div className="pt-4 border-t border-graphite/10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-encre flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Numéros Supplémentaires (Commerciales / Coexistence)</span>
            </h4>
            <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Mode Coexistence
            </span>
          </div>

          <p className="text-[11px] text-encre/60">
            Connectez vos numéros de commerciales (WhatsApp Business App existants). Leurs messages s’afficheront dans le SaaS, mais l’agent IA ne répondra pas automatiquement.
          </p>

          <div className="flex justify-end">
            <button
              onClick={handleSyncWebhooks}
              disabled={isSubscribingWebhooks}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all"
            >
              {isSubscribingWebhooks ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "🔔 Activer la réception des Webhooks (Souscrire Meta)"}
            </button>
          </div>

          <form onSubmit={handleSaveManualSecondary} className="bg-neige p-4 rounded-2xl border border-graphite/10 flex flex-col gap-3">
            <div className="text-[11px] font-bold text-encre flex items-center justify-between">
              <span>➕ Ajouter un numéro de commerciale</span>
              <button
                type="button"
                onClick={handleConnectSecondaryWhatsApp}
                disabled={isConnectingSecondary || !businessId}
                className="text-[10px] text-blue-600 hover:underline font-semibold flex items-center gap-1"
              >
                {isConnectingSecondary ? "Connexion Meta..." : "Ou se connecter via popup Meta →"}
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-encre/60">Nom de la commerciale / Libellé *</label>
              <input
                type="text"
                placeholder="Ex: Yasmine ou Commerciale 2"
                value={newSecondaryLabel}
                onChange={(e) => setNewSecondaryLabel(e.target.value)}
                className="w-full bg-white border border-graphite/10 px-3.5 py-2 rounded-xl text-xs font-medium placeholder:text-encre/30 focus:outline-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mt-1">
              <button
                type="button"
                onClick={handleGenerateEvolutionQR}
                disabled={isGeneratingQR || !businessId}
                className="flex-1 bg-menthe hover:bg-menthe/90 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                {isGeneratingQR ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Génération du QR Code...</span>
                  </>
                ) : (
                  <>
                    <span>📲 Scanner QR Code (Scanner depuis WhatsApp)</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-graphite/10 flex flex-col gap-2">
              <span className="text-[10px] text-encre/50 font-semibold">Ou saisissez l&apos;ID manuellement (Meta Cloud API) :</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Phone Number ID Meta (Ex: 1092847...)"
                  value={manualSecPhoneId}
                  onChange={(e) => setManualSecPhoneId(e.target.value)}
                  className="flex-1 bg-white border border-graphite/10 px-3 py-2 rounded-xl text-xs font-mono placeholder:text-encre/30 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSavingManualSec || !manualSecPhoneId.trim()}
                  className="bg-graphite hover:opacity-90 text-white font-bold px-4 py-2 rounded-xl text-xs shrink-0 transition-all cursor-pointer"
                >
                  {isSavingManualSec ? "Enregistrement..." : "Ajouter ID"}
                </button>
              </div>
            </div>
          </form>

          {secondaryNumbers.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-[10px] font-bold uppercase text-encre/40">Numéros secondaires actifs</span>
              {secondaryNumbers.map((sec) => (
                <div key={sec.id} className="flex items-center justify-between bg-neige p-2.5 rounded-xl border border-graphite/10 text-xs">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                    <div>
                      <span className="font-bold text-encre block">{sec.label || "Commerciale"}</span>
                      <span className="text-[10px] text-encre/50 font-mono">ID: {sec.phone_number_id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] bg-menthe/10 text-menthe border border-menthe/20 font-semibold px-2 py-0.5 rounded-full">
                      Coexistence
                    </span>
                    <button
                      onClick={() => handleDeleteSecondaryNumber(sec.id)}
                      className="text-red-500 hover:text-red-700 p-1 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Meta Ads API Integration Card */}
      <div className="bg-white p-6 rounded-[2rem] border border-graphite/10 flex flex-col justify-between gap-5 shadow-sm">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-encre flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-menthe" />
              <span>Facebook Ads Link</span>
            </h3>
            <span className="text-[9px] uppercase px-2.5 py-0.5 rounded-full font-bold bg-menthe/10 text-menthe border border-menthe/20">
              Marketing API
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleConnectMetaAds}
              disabled={isConnectingAds || !businessId}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-center transition-all ${
                isConnectingAds || !businessId
                  ? "bg-neige border border-graphite/10 text-encre/30 cursor-not-allowed"
                  : isAdsConnected
                    ? "bg-white border border-graphite/15 hover:bg-graphite/5 text-encre"
                    : "bg-graphite text-white hover:opacity-90"
              } flex items-center justify-center gap-2`}
            >
              {isConnectingAds ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : isAdsConnected ? (
                "Reconnecter ou modifier Facebook Ads"
              ) : (
                "Connecter mon compte publicitaire Facebook"
              )}
            </button>

            {isAdsConnected ? (
              <span className="text-[10px] text-menthe font-semibold text-center block mt-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Publicités Facebook Connectées
              </span>
            ) : (
              <span className="text-[10px] text-amber-600 font-semibold text-center block mt-1">
                ⚠️ Non connecté — lier pour analyser vos campagnes
              </span>
            )}
          </div>

          {/* Manual inputs fallback for Ads */}
          <form onSubmit={handleSaveManualMetaAds} className="flex flex-col gap-3 border-t border-graphite/5 pt-4">
            <span className="text-[9px] uppercase font-black text-encre/40">Configuration manuelle ads</span>
            
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-encre/50">Jeton d&apos;accès publicitaire</label>
              <input
                type="password"
                placeholder="EAAG..."
                value={inputMetaAdsToken}
                onChange={(e) => setInputMetaAdsToken(e.target.value)}
                className="w-full bg-neige border border-graphite/10 px-3 py-2 rounded-xl text-xs font-mono placeholder:text-encre/30 focus:outline-none focus:border-graphite/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-encre/50">Facebook Ad Account ID</label>
              <input
                type="text"
                placeholder="Ex: 109283749102"
                value={inputMetaAdsAccountId}
                onChange={(e) => setInputMetaAdsAccountId(e.target.value)}
                className="w-full bg-neige border border-graphite/10 px-3 py-2 rounded-xl text-xs font-mono placeholder:text-encre/30 focus:outline-none focus:border-graphite/30"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingManualAds || loadingConfig || !businessId}
              className="w-full bg-neige hover:bg-graphite/10 text-encre border border-graphite/10 font-bold py-2 px-4 rounded-xl text-xs text-center transition-all flex items-center justify-center gap-2 mt-1"
            >
              {isSavingManualAds ? "Sauvegarde..." : "Enregistrer la config Ads"}
            </button>
          </form>

          {isAdsConnected && (
            <div className="bg-neige border border-graphite/10 p-3 rounded-xl flex flex-col gap-2 text-[10px] font-semibold text-encre/70">
              <div>
                <span className="text-encre/40 uppercase font-bold">Ad Account ID :</span>{" "}
                <code className="bg-white px-1 py-0.5 rounded border border-graphite/10 font-mono text-[10px]">{metaAdsAccountId}</code>
              </div>
            </div>
          )}
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

      {/* Evolution Connection Modal Overlay (Pairing Code & QR Code) */}
      {evolutionQRModal && evolutionQRModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full border border-graphite/10 shadow-2xl flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-menthe/10 text-menthe flex items-center justify-center font-bold text-xl">
              📲
            </div>
            
            <div>
              <h3 className="text-sm font-bold text-encre">Connecter le WhatsApp de {evolutionQRModal.label}</h3>
              <p className="text-[11px] text-encre/60 mt-1">
                Choisissez la méthode de connexion ci-dessous :
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-neige p-1 rounded-xl w-full gap-1">
              <button
                type="button"
                onClick={() => setConnectTabMode("pairing")}
                className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  connectTabMode === "pairing" ? "bg-white text-encre shadow-xs" : "text-encre/50 hover:text-encre"
                }`}
              >
                🔢 Code à 8 chiffres (Fiable)
              </button>
              <button
                type="button"
                onClick={() => setConnectTabMode("qr")}
                className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  connectTabMode === "qr" ? "bg-white text-encre shadow-xs" : "text-encre/50 hover:text-encre"
                }`}
              >
                📷 Scan QR Code
              </button>
            </div>

            {/* TAB 1: PAIRING CODE (8 DIGITS) */}
            {connectTabMode === "pairing" && (
              <div className="w-full bg-neige/50 border border-graphite/10 p-4 rounded-2xl flex flex-col gap-3">
                <div className="text-[11px] text-left text-encre/70 space-y-1">
                  <p className="font-bold text-encre">Étape 1 : Saisissez le numéro de la commerciale</p>
                  <p className="text-[10px] text-encre/50">WhatsApp &gt; Appareils connectés &gt; Connecter un appareil &gt; <em>Lier avec un numéro de téléphone à la place</em>.</p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Numéro WhatsApp (Ex: 221771234567)"
                    value={pairingPhone}
                    onChange={(e) => setPairingPhone(e.target.value)}
                    className="flex-1 bg-white border border-graphite/10 px-3 py-2 rounded-xl text-xs font-mono placeholder:text-encre/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleFetchPairingCode}
                    disabled={isRequestingPairing || !pairingPhone.trim()}
                    className="bg-menthe hover:bg-menthe/90 text-white font-bold px-3 py-2 rounded-xl text-xs shrink-0 transition-all cursor-pointer"
                  >
                    {isRequestingPairing ? "Génération..." : "Obtenir Code"}
                  </button>
                </div>

                {evolutionQRModal.pairingCode ? (
                  <div className="mt-2 bg-white border-2 border-menthe p-3 rounded-2xl flex flex-col items-center gap-1 shadow-sm">
                    <span className="text-[9px] uppercase font-bold text-menthe tracking-wider">Votre Code de couplage WhatsApp :</span>
                    <span className="text-2xl font-mono font-extrabold text-encre tracking-widest selection:bg-menthe selection:text-white">
                      {evolutionQRModal.pairingCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(evolutionQRModal.pairingCode);
                        triggerToast("Code copié dans le presse-papier !", "success");
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:underline mt-1"
                    >
                      Copier le code
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-encre/40 italic">Entrez le numéro ci-dessus et cliquez sur &quot;Obtenir Code&quot;.</p>
                )}
              </div>
            )}

            {/* TAB 2: QR CODE SCAN */}
            {connectTabMode === "qr" && (
              <div className="w-full flex flex-col items-center gap-2">
                {evolutionQRModal.qrcode ? (
                  <div className="p-3 bg-white border border-graphite/15 rounded-2xl shadow-inner flex flex-col items-center relative">
                    <img
                      src={evolutionQRModal.qrcode.startsWith("data:") ? evolutionQRModal.qrcode : `data:image/png;base64,${evolutionQRModal.qrcode}`}
                      alt="QR Code WhatsApp"
                      className="w-52 h-52 object-contain"
                    />
                    <button
                      type="button"
                      onClick={refreshQRCode}
                      className="mt-2 text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Rafraîchir le QR Code</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-52 h-52 bg-neige rounded-2xl flex flex-col items-center justify-center text-xs text-encre/40 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-menthe" />
                    <span>Chargement QR Code...</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-[11px] font-bold text-encre/70 bg-neige px-3 py-1.5 rounded-xl border border-graphite/10 w-full">
              {qrStatusText}
            </div>

            <div className="flex gap-2 w-full pt-1">
              <button
                type="button"
                onClick={checkQRStatus}
                className="flex-1 bg-menthe hover:bg-menthe/90 text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                Vérifier la connexion
              </button>
              <button
                type="button"
                onClick={() => setEvolutionQRModal(null)}
                className="px-4 py-2 bg-neige hover:bg-graphite/10 text-encre/70 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
