// =======================================================
// DISCORD VOICE BOT + JAWABAN GEMINI AI (DEBUG MODE)
// =======================================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus } = require('@discordjs/voice');
const express = require('express');

// ===== KEEP RAILWAY AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 AI Voice Bot (Debug Edition) is Running!');
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
    console.log(`📢 Bot ready. Mode debug aktif.`);
});

// ===== HANDLE MESSAGES =====
client.on('messageCreate', async message => {
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
      return message.reply(`❌ Gagal masuk. Debug: \`${error.message}\``);
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
            parts: [{ text: "Kamu adalah asisten chat Discord yang bersikap sangat kasar, galak, ketus, sinis, dan malas melayani user. Langsung jawab ke inti masalah dengan sangat padat (maksimal 1 kalimat). Jangan pakai basa-basi, kalimat pembuka, atau penutup. Gunakan bahasa kasual, ngegas, dan meremehkan (contoh: 'Gini aja gak tahu, lu bodoh ya?', 'Nih, mikir sendiri!', 'Males gw jawabin hal sepele'). Jangan pernah ramah." }]
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
        // DEBUG: Jika API merespons tapi isinya bukan teks (misal error API Key / kuota habis)
        const rawError = JSON.stringify(data).substring(0, 1800);
        await message.reply(`parhan lagi bobo\n\`\`\`json\n${rawError}\n\`\`\``);
      }

    } catch (error) {
      console.error('Gemini AI Error:', error);
      // DEBUG: Jika terjadi crash jaringan atau request gagal total
      await message.reply(`parhan lagi bobo\n\`\`\`cmd\n${error.stack ? error.stack.substring(0, 1800) : error.message}\n\`\`\``);
    }
  }
});

// ===== GLOBAL ANTI-CRASH SYSTEM =====
const kirimPesanSistem = async (err) => {
  try {
    const channel = client.channels.cache.filter(c => c.type === 0).first(); 
    if (channel) {
      await channel.send(`💤 parhan lagi bobo\n\`\`\`cmd\n${err ? err.message : 'Unknown Global Error'}\n\`\`\``);
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
  console.error('❌ ERROR: No Discord token found!');
} else {
  client.login(token);
}
