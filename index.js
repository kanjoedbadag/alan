// ==========================================
// DISCORD VOICE BOT + INTEGRASI GEMINI AI (FIXED)
// ==========================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const { GoogleGenAI } = require('@google/genai'); 
const express = require('express');

// ===== KEEP REPLIT / RAILWAY AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 AI Voice Bot is Running!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Keep-alive server ready on port ${PORT}`));

// ===== INITIALIZE GEMINI AI =====
// Inisialisasi aman: Jika key belum ada, bot tidak akan langsung crash saat start
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

// ===== DISCORD BOT SETUP =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let voiceConnection = null;
const audioPlayer = createAudioPlayer();

// ===== WHEN BOT IS READY =====
client.once('clientReady', (c) => {
    console.log(`✅ Logged in as ${c.user.tag}!`);
    console.log(`📢 Fitur Voice & AI Siap Digunakan!`);
});

// ===== HANDLE MESSAGES =====
client.on('messageCreate', async message => {
  // PROTEKSI UTAMA: Jangan merespons jika pesan berasal dari bot itu sendiri atau bot lain
  if (message.author.bot || !message.guild) return;

  // ----------------------------------------
  // FITUR 1: PERINTAH SUARA (!in dan !out)
  // ----------------------------------------
  
  if (message.content.toLowerCase() === '!in') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('❌ Kamu harus masuk ke voice channel terlebih dahulu!');
    }

    try {
      if (voiceConnection) voiceConnection.destroy();

      voiceConnection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      voiceConnection.on(VoiceConnectionStatus.Ready, () => {
        console.log(`🔊 Joined VC: ${voiceChannel.name}`);
        voiceConnection.subscribe(audioPlayer);
      });

      message.reply(`✅ Mencoba masuk ke **${voiceChannel.name}**...`);
      return;
    } catch (error) {
      console.error('Join error:', error);
      return message.reply('❌ Gagal masuk karena masalah jaringan hosting.');
    }
  }

  if (message.content.toLowerCase() === '!out') {
    if (voiceConnection) {
      voiceConnection.destroy();
      voiceConnection = null;
      return message.reply('✅ Berhasil keluar dari voice channel!');
    } else {
      return message.reply('❌ Aku sedang tidak berada di voice channel mana pun!');
    }
  }

  // ----------------------------------------
  // FITUR 2: JAWABAN OTOMATIS MENGGUNAKAN AI
  // ----------------------------------------
  
  const isMentioned = message.mentions.has(client.user);
  const isCommand = message.content.startsWith('!tanya ');

  if (isMentioned || isCommand) {
    
    // Jika API Key lupa dimasukkan di Railway
    if (!ai) {
      return message.reply('❌ Fitur AI belum aktif. Pastikan GEMINI_API_KEY sudah diisi di Variables Railway!');
    }

    // Bersihkan teks dari mention atau prefix perintah
    const prompt = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .replace('!tanya ', '')
      .trim();
    
    if (!prompt) {
      return message.reply('Ada yang bisa saya bantu? Silakan ketik pertanyaanmu setelah mention atau perintah.');
    }

    try {
      // Efek bot sedang mengetik di Discord
      await message.channel.sendTyping();

      // Panggilan API Gemini 2.5 Flash yang benar
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      if (response && response.text) {
        const replyText = response.text.substring(0, 1950);
        await message.reply(replyText);
      } else {
        await message.reply('Maaf, saya tidak mendapatkan jawaban dari otak AI saya.');
      }

    } catch (error) {
      console.error('Gemini AI Error:', error);
      await message.reply('❌ Maaf, proses AI mengalami kendala teknis saat menjawab.');
    }
  }
});

// ===== ERROR HANDLING =====
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// ===== START THE BOT =====
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ERROR: No Discord token found!');
} else {
  client.login(token);
}
