// =======================================================
// DISCORD VOICE BOT + JAWABAN GEMINI AI (PERSONA KASAR)
// =======================================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, VoiceConnectionStatus } = require('@discordjs/voice');
const express = require('express');

// ===== KEEP RAILWAY AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 AI Voice Bot (Ketus Edition) is Running!');
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
    console.log(`📢 Fitur Voice & AI Kasar udah siap. Lu mau nanya apaan?`);
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

    // Bersihkan teks dari mention bot atau prefix !tanya
    const prompt = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .replace('!tanya ', '')
      .trim();
    
    if (!prompt) {
      return message.reply('Ngetik apaan lu? Nanya yang jelas, jangan kosongan.');
    }

    try {
      // Efek bot sedang mengetik di Discord
      await message.channel.sendTyping();

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // INSTRUKSI PERSONA: Kasar, ketus, ngegas, langsung inti masalah
          systemInstruction: {
            parts: [{ text: "Kamu adalah asisten yang sangat ketus, sinis, kasar, dan malas melayani user. Jawab pertanyaan sesingkat dan sepadat mungkin, langsung ke inti masalah tanpa basa-basi. Gunakan gaya bahasa kasual, sedikit ngegas, atau meremehkan jika perlu (seperti: 'Gini aja gak tahu', 'Nih', 'Pikir sendiri'). Maksimal 1-2 kalimat. Jangan pernah pakai kata halo atau ramah lainnya." }]
          }
        })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const replyText = data.candidates[0].content.parts[0].text.substring(0, 1950);
        await message.reply(replyText);
      } else {
        await message.reply('Gagal dapet jawaban. AI-nya males jawab paling.');
      }

    } catch (error) {
      console.error('Gemini AI Error:', error);
      await message.reply('❌ Error. Otak gw lagi pusing, jgn nanya dulu.');
    }
  }
});

// ===== GLOBAL ANTI-CRASH SYSTEM =====
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});

// ===== START THE BOT =====
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ERROR: No Discord token found in Environment Variables!');
} else {
  client.login(token);
}
