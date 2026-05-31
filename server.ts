import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API health and system status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    runtime: 'Node.js ' + process.version,
    framework: 'Express.js + Vite (Fullstack)',
    uptime: process.uptime(),
    memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
    engine: 'Gemini 2.5'
  });
});

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, isSearchMode, isThinkingMode } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const latestMessage = messages[messages.length - 1];
    
    // We can pass past history too, but for simplicity we'll just handle 
    // a basic chat using chats.create and looping history or just passing
    // it. But `chat.sendMessage` handles a session. To use stateless,
    // we can format the messages as a single prompt with system instruction, 
    // or just use generating content with multiple turns if we mapped it correctly.
    // For easiest robust implementation, just map to contents:
    const contents = messages.map(msg => {
      const parts: any[] = [];
      
      // Add text content if present
      if (msg.content && msg.content.trim()) {
        parts.push({ text: msg.content });
      }
      
      // Add attachments as inlineData parts
      if (msg.attachments && Array.isArray(msg.attachments)) {
        msg.attachments.forEach((att: any) => {
          if (att.base64 && att.type) {
            let rawBase64 = att.base64;
            // Clean up base64 prefix if present
            if (rawBase64.includes(';base64,')) {
              rawBase64 = rawBase64.split(';base64,')[1];
            }
            parts.push({
              inlineData: {
                mimeType: att.type,
                data: rawBase64
              }
            });
          }
        });
      }
      
      // Gemini expects at least one part in contents
      if (parts.length === 0) {
        parts.push({ text: ' ' });
      } else if (parts.every((p: any) => !p.text)) {
        // If attachments are provided but there's no user message text, prompt the model to analyze them
        parts.unshift({ text: 'Tolong analisis berkas yang terlampir.' });
      }
      
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: parts
      };
    });

    const config: any = {
      systemInstruction: 'You are NovaGPT, a helpful, smart, and concise AI assistant.',
    };

    if (isSearchMode) {
      config.tools = [{ googleSearch: {} }];
    }

    if (isThinkingMode) {
      config.thinkingConfig = { thinkingLevel: 'HIGH' };
      config.systemInstruction += ' Pengguna telah mengaktifkan Mode Berpikir Mendalam. Tolong lakukan penalaran analisis yang sangat mendalam, rinci, logis, dan runtun. Tunjukkan proses berpikir beralasan Anda sebelum mencapai solusi praktis akhir.';
    }

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function callWithRetry(modelName: string, maxAttempts = 3, initialDelay = 1200): Promise<any> {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`Menghubungi Gemini model "${modelName}" (Percobaan ${attempt}/${maxAttempts})...`);
          const res = await ai.models.generateContent({
            model: modelName,
            contents: contents,
            config: config
          });
          return res;
        } catch (err: any) {
          const isQuota = err.status === 429 || 
                          err.message?.includes('429') || 
                          err.message?.includes('quota') || 
                          err.message?.includes('limit') ||
                          err.message?.includes('exhausted') ||
                          err.message?.includes('RESOURCE_EXHAUSTED');
          
          if (isQuota && attempt < maxAttempts) {
            const backoffTime = initialDelay * Math.pow(1.8, attempt - 1) + Math.random() * 300;
            console.warn(`[Auto-Retry] Terdeteksi RESOURCE_EXHAUSTED pada "${modelName}". Menunggu ${Math.round(backoffTime)}ms sebelum mencoba lagi...`);
            await sleep(backoffTime);
          } else {
            throw err;
          }
        }
      }
    }

    let response;
    try {
      response = await callWithRetry('gemini-2.5-flash', 4, 1200);
    } catch (firstErr: any) {
      const isQuotaError = firstErr.status === 429 || 
                           firstErr.message?.includes('429') || 
                           firstErr.message?.includes('quota') || 
                           firstErr.message?.includes('limit') ||
                           firstErr.message?.includes('exhausted') ||
                           firstErr.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaError) {
        console.warn('Utama gemini-2.5-flash gagal kuota, beralih ke fallback gemini-3.5-flash...');
        try {
          response = await callWithRetry('gemini-3.5-flash', 3, 1000);
          console.log('Sukses menggunakan model fallback gemini-3.5-flash.');
        } catch (secondErr: any) {
          console.warn('Fallback gemini-3.5-flash juga gagal, beralih ke fallback kedua gemini-3.1-flash-lite...');
          try {
            response = await callWithRetry('gemini-3.1-flash-lite', 3, 1000);
            console.log('Sukses menggunakan model fallback gemini-3.1-flash-lite.');
          } catch (thirdErr: any) {
            console.error('Semua model fallback gagal total:', thirdErr);
            throw thirdErr;
          }
        }
      } else {
        throw firstErr;
      }
    }

    res.json({ 
      text: response.text,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
    });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const isQuotaError = error.status === 429 || 
                         error.message?.includes('429') || 
                         error.message?.includes('quota') || 
                         error.message?.includes('limit') ||
                         error.message?.includes('exhausted') ||
                         error.message?.includes('RESOURCE_EXHAUSTED');
                         
    if (isQuotaError) {
      return res.status(429).json({ 
        error: '⚠️ Batas Kuota Gemini API Terlampaui (RESOURCE_EXHAUSTED).\n\nLayanan API publik saat ini sedang sangat sibuk dan melebihi batasan kuota per detik/menit dari Google Generative AI.\n\nTips Solusi:\n1. Tunggu 10-30 detik kemudian coba kirim ulang pesan Anda.\n2. Jika Anda memiliki Kunci API Gemini sendiri, Anda dapat mengaturnya di menu Pengaturan / Settings di atas untuk menghindari batasan kuota bersama.',
        isQuota: true
      });
    }
    res.status(500).json({ error: error.message || 'Error communicating with AI' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // We use all here for Express v5 catch-all, but if it is v4 we use *
    // Package.json has express 4.21.2, so we use *
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
