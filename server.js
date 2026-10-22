
import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
];

app.get("/api/status", (req, res) => {
  res.json({ configured: Boolean(client) });
});

app.post("/api/solve", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        error: "AI belum disediakan. Semak fail .env dan API key."
      });
    }

    const { messages, imageDataUrl } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Masukkan soalan Matematik dahulu."
      });
    }

    if (messages.length > 20) {
      return res.status(400).json({
        error: "Perbualan terlalu panjang. Mulakan chat baharu."
      });
    }

    const cleanMessages = [];

    for (const message of messages) {
      if (
        !message ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.content !== "string" ||
        message.content.length > 4000
      ) {
        return res.status(400).json({
          error: "Format mesej tidak sah."
        });
      }

      cleanMessages.push({
        role: message.role,
        content: message.content
      });
    }

    const lastMessage = cleanMessages.at(-1);

    if (lastMessage.role !== "user" || !lastMessage.content.trim()) {
      return res.status(400).json({
        error: "Soalan terakhir tidak sah."
      });
    }

    const input = cleanMessages.map((message, index) => {
      const isLast = index === cleanMessages.length - 1;

      if (isLast && imageDataUrl) {
        if (typeof imageDataUrl !== "string") {
          throw new Error("Data gambar tidak sah.");
        }

        const match = imageDataUrl.match(
          /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/
        );

        if (!match || !allowedImageTypes.includes(match[1])) {
          throw new Error(
            "Gambar mestilah JPEG, PNG, WEBP atau GIF."
          );
        }

        if (imageDataUrl.length > 6_000_000) {
          throw new Error(
            "Gambar terlalu besar. Pilih gambar yang lebih kecil."
          );
        }

        return {
          role: message.role,
          content: [
            {
              type: "input_text",
              text: message.content
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high"
            }
          ]
        };
      }

      return {
        role: message.role,
        content: message.content
      };
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: `
Anda ialah MathGenius AI, tutor Matematik yang sabar dan tepat.
Jawab dalam Bahasa Melayu yang mudah difahami pelajar sekolah.
Terangkan penyelesaian langkah demi langkah.
Nyatakan formula, pengiraan, dan jawapan akhir dengan jelas.
Jika soalan tidak lengkap atau gambar tidak jelas, minta penjelasan.
Jika pengguna bertanya soalan susulan, rujuk perbualan sebelumnya.
Jangan mereka-reka maklumat daripada gambar yang tidak jelas.
Semak pengiraan sebelum memberikan jawapan.
      `.trim(),
      input
    });

    res.json({
      answer: response.output_text ||
        "Maaf, AI tidak menghasilkan jawapan teks. Cuba sekali lagi."
    });
  } catch (error) {
    console.error("Ralat AI:", error.message);

    if (
      error.message.startsWith("Gambar") ||
      error.message.startsWith("Data gambar")
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({
      error: "AI tidak dapat menjawab sekarang. Semak sambungan atau konfigurasi API."
    });
  }
});

app.listen(PORT, () => {
  console.log(`MathGenius AI berjalan di http://localhost:${PORT}`);
});
