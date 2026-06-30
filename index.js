// ==========================================
// DISCORD VOICE BOT + INTEGRASI GEMINI AI (BULLETPROOF)
// ==========================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus } = require('@discordjs/voice');
const express = require('express');

// ===== KEEP REPLIT / RAILWAY AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 AI Voice Bot is Running!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Keep-alive server ready on port ${PORT}`));

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
  // Jangan merespons jika pesan dari bot sendiri atau bot lain
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
  // FITUR 2: JAWABAN OTOMATIS MENGGUNAKAN AI (Pake Fetch Langsung)
  // ----------------------------------------
  const isMentioned = message.mentions.has(client.user);
  const isCommand = message.content.startsWith('!tanya ');

  if (isMentioned || isCommand) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return message.reply('❌ API Key Gemini belum dimasukkan di Variables Railway!');
    }

    const prompt = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .replace('!tanya ', '')
      .trim();
    
    if (!prompt) {
      return message.reply('Ada yang bisa saya bantu? Silakan ketik pertanyaanmu.');
    }

    try {
      await message.channel.sendTyping();

      // Menggunakan fetch bawaan Node.js (Anti-crash akibat library versioning)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const replyText = data.candidates[0].content.parts[0].text.substring(0, 1950);
        await message.reply(replyText);
      } else {
        await message.reply('Maaf, saya tidak mendapatkan jawaban dari AI.');
      }

    } catch (error) {
      console.error('Gemini AI Error:', error);
      await message.reply('❌ Terjadi kendala teknis saat menghubungi AI.');
    }
  }
});

// Anti-crash global agar Railway tidak mematikan container saat ada error kecil
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ERROR: No Discord token found!');
} else {
  client.login(token);
