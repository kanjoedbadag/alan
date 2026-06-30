// ================================
// DISCORD VOICE BOT - STAY IN VC
// ================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const express = require('express');

// ===== KEEP REPLIT / RAILWAY AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 Voice Bot is Running!');
});

// Perbaikan Utama untuk Railway: Menggunakan port dinamis dari environment
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
    console.log(`📢 Use !inhan`);
    console.log(`📢 Use !out`);
});

// ===== HANDLE MESSAGES =====
client.on('messageCreate', async message => {
  // Abaikan bot lain dan DM
  if (message.author.bot || !message.guild) return;

  // !in - Join voice channel
  if (message.content.toLowerCase() === '!in') {
    // Validasi: Pastikan user yang mengetik perintah berada di Voice Channel
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('❌ Kamu harus masuk ke voice channel terlebih dahulu!');
    }

    try {
      // Tinggalkan VC lama jika sedang tersambung
      if (voiceConnection) {
        voiceConnection.destroy();
      }

      // Gabung ke VC baru
      voiceConnection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      // Tunggu koneksi siap (Batas waktu 15 detik)
      await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000);
      
      // Hubungkan ke player kosong agar bot tetap bertahan di VC
      voiceConnection.subscribe(audioPlayer);
      
      message.reply(`✅ Berhasil masuk ke **${voiceChannel.name}**!`);
      console.log(`🔊 Joined VC: ${voiceChannel.name}`);
      
    } catch (error) {
      console.error('Join error:', error);
      message.reply('❌ Gagal masuk ke voice channel. Pastikan library audio sudah terinstall di hosting.');
      if (voiceConnection) {
        voiceConnection.destroy();
        voiceConnection = null;
      }
    }
  }

  // !out - Leave voice channel
  if (message.content.toLowerCase() === '!out') {
    if (voiceConnection) {
      voiceConnection.destroy();
      voiceConnection = null;
      message.reply('✅ Berhasil keluar dari voice channel!');
      console.log('🔇 Left voice channel');
    } else {
      message.reply('❌ Aku sedang tidak berada di voice channel mana pun!');
    }
  }

  // !ping - Check if bot is alive
  if (message.content.toLowerCase() === '!ping') {
    const latency = Date.now() - message.createdTimestamp;
    message.reply(`🏓 Pong! Latency: ${latency}ms | Voice: ${voiceConnection ? 'Connected 🔊' : 'Not connected 🔇'}`);
  }
});

// ===== HANDLE VOICE DISCONNECTS =====
client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.id === client.user.id && !newState.channelId && voiceConnection) {
    console.log('⚠️ Bot dikeluarkan dari voice channel!');
    voiceConnection = null;
  }
});

// ===== ERROR HANDLING =====
audioPlayer.on('error', error => {
  console.error('Audio player error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

// ===== START THE BOT =====
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ERROR: No Discord token found in Variables!');
} else {
  client.login(token);
}
