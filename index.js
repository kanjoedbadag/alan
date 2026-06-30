// =======================================================
// DISCORD VOICE BOT + JAWABAN GEMINI AI (PARHAN EDITION)
// =======================================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus } = require('@discordjs/voice');
const express = require('express');

// ===== KEEP RAILWAY AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 AI Voice Bot (Parhan Bobo Edition) is Running!');
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
    console.log(`📢 Bot ready. Jangan diganggu, ntar parhan bangun.`);
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
      return message.reply('❌ Lu masuk voice channel dulu baru manggil gw, jgn bikin bingung!');
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

      message.reply(`✅ Yaudah gw otw masuk ke **${voiceChannel.name}**.`);
      return;
    } catch (error) {
      console.error('Join error:', error);
      return message.reply('❌ Gagal masuk. Hosting lu error atau gimana nih.');
    }
  }

  if (message.content.toLowerCase() === '!out') {
    if (voiceConnection) {
      voiceConnection.destroy();
      voiceConnection = null;
      return message.reply('✅ Dah ya, gw keluar dari voice channel!');
    } else {
      return message.reply('❌ Lah? Gw aja lagi gak di voice channel mana-mana.');
    }
  }

  // ----------------------------------------
  // FITUR 2: JAWABAN OTOMATIS MENGGUNAKAN AI
  // ----------------------------------------
  const isMentioned = message.mentions.has(client.user);
  const isCommand = message.content.startsWith('!tanya ');

  if (isMentioned || isCommand) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return message.reply('❌ API Key Gemini belum lu pasang di Variables Railway!');
    }

    const prompt = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .replace('!tanya ', '')
      .trim();
    
    if (!prompt) {
      return message.reply('Ngetik apaan lu? Nanya yang jelas, jangan kosongan.');
    }

    try {
      await message.channel.sendTyping();

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{ text: "Kamu adalah asisten chat Discord yang bersikap sangat ketus, cuek, sinis, dan malas melayani user. Langsung jawab ke inti masalah tanpa basa-basi (maksimal 1-2 kalimat). Gunakan gaya bahasa kasual, ngegas, atau meremehkan secara sarkas (contoh: 'Gini aja gak tahu', 'Nih', 'Pikir sendiri'). Jangan pernah pakai kata halo atau ramah lainnya." }]
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const replyText = data.candidates[0].content.parts[0].text.substring(0, 1950);
        await message.reply(replyText);
      } else {
        // AI nolak jawab/kosong tapi ga bikin crash
        await message.reply('Gagal dapet jawaban. AI-nya males jawab paling.');
      }

    } catch (error) {
      console.error('Gemini AI Error:', error);
      await message.reply('parhan lagi bobo');
    }
  }
});

// ===== GLOBAL ANTI-CRASH SYSTEM (PARHAN LAGI BOBO) =====
// Mengirim pesan otomatis ke channel saat terjadi error fatal di latar belakang

const kirimPesanSistem = async (errorLog) => {
  try {
    // AMBIL ID CHANNEL otomatis dari tempat bot terakhir aktif atau via Env Variable
    // Supaya aman, kita cari text channel pertama yang bisa diakses bot untuk ngasih tau
    const channel = client.channels.cache.filter(c => c.type === 0).first(); 
    if (channel) {
      await channel.send('💤 parhan lagi bobo');
    }
  } catch (e) {
    console.error('Gagal ngirim pesan anti-crash:', e);
  }
};

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
  kirimPesanSistem(error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  kirimPesanSistem(error);
});

// ===== START THE BOT =====
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ERROR: No Discord
