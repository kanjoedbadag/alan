// ==========================================
// DISCORD VOICE BOT + INTEGRASI GEMINI AI
// ==========================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const { GoogleGenAI } = require('@google/genai'); // Library resmi terbaru Google AI
const express = require('express');

// ===== KEEP REPLIT / RAILWAY AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 AI Voice Bot is Running!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Keep-alive server ready on port ${PORT}`));

// ===== INITIALIZE GEMINI AI =====
// Mengambil API Key dari environment variables Railway
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    console.log(`📢 Hubungi saya di chat, saya akan menjawab menggunakan AI!`);
});

// ===== HANDLE MESSAGES =====
client.on('messageCreate', async message => {
  // Abaikan bot lain dan DM
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
  
  // Bot akan menjawab jika di-mention ATAU jika kamu ingin dia menjawab semua chat, hapus baris "if (message.mentions...)"
  if (message.mentions.has(client.user) || message.content.startsWith('!tanya ')) {
    
    // Ambil teks pertanyaan (hilangkan mention atau kata !tanya)
    const prompt = message.content.replace(/<@!?\d+>/g, '').replace('!tanya ', '').trim();
    
    if (!prompt) {
      return message.reply('Ada yang bisa saya bantu? Silakan ketik pertanyaanmu.');
    }

    // Beri tanda kalau bot sedang mengetik/berpikir
    await message.channel.sendTyping();

    try {
      // Memanggil model Gemini 2.5 Flash (Model tercepat dan terbaru)
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      // Kirim jawaban AI ke Discord
      if (response.text) {
        // Potong jawaban jika melebihi batas karakter Discord (2000 karakter)
        const replyText = response.text.substring(0, 1950);
        message.reply(replyText);
      } else {
        message.reply('Maaf, saya tidak bisa memproses jawaban untuk pertanyaan itu.');
      }

    } catch (error) {
      console.error('Gemini AI Error:', error);
      message.reply('❌ Maaf, otak AI saya sedang mengalami gangguan teknis.');
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
