import { NextRequest, NextResponse } from "next/server";
import { anthropic, CLAUDE_MODEL_LIGHT } from "@/lib/ai/anthropic";

export async function POST(req: NextRequest) {
  try {
    const { name, category } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Le nom du produit est requis." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Clé API Anthropic manquante sur le serveur." }, { status: 500 });
    }

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL_LIGHT,
      max_tokens: 250,
      temperature: 0.7,
      system: "Tu es un copywriter professionnel spécialisé dans le e-commerce en Afrique. Rédige une description produit captivante, courte (2-3 phrases max), persuasive et vendeuse, adaptée au public local. N'ajoute aucune introduction ni conclusion, écris uniquement la description elle-même.",
      messages: [
        {
          role: "user",
          content: `Rédige une description attractive pour le produit suivant :\nNom : ${name}\nCatégorie : ${category || "Général"}`
        }
      ]
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return NextResponse.json({ description: text.trim() });
  } catch (err: any) {
    console.error("Error generating product description:", err);
    return NextResponse.json({ error: err.message || "Erreur interne de génération" }, { status: 500 });
  }
}
