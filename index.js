// ================================
// DISCORD VOICE BOT - STAY IN VC
// ================================

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const express = require('express');

// ===== KEEP REPLIT AWAKE =====
const app = express();
app.get('/', (req, res) => {
  res.send('🤖 Voice Bot is Running!');
});
app.listen(3000, () => console.log('✅ Keep-alive server ready'));

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
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}!`);
  console.log(`📢 Use !join`);
  console.log(`📢 Use !leave`);
});

// ===== HANDLE MESSAGES =====
client.on('messageCreate', async message => {
  // Ignore other bots and DMs
  if (message.author.bot || !message.guild) return;

  // !join - Join voice channel
  if (message.content.toLowerCase() === '!oilan') {
    try {
      // Leave current VC if in one
      if (voiceConnection) {
        voiceConnection.destroy();
      }

      // Join new VC
      voiceConnection = joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false, // Bot deafens itself (won't hear others)
        selfMute: false // Bot can speak if needed
      });

      // Wait for connection
      await entersState(voiceConnection, VoiceConnectionStatus.Ready, 30_000);
      
      // Subscribe to audio player (plays silent audio)
      voiceConnection.subscribe(audioPlayer);
      
      message.reply(`✅ Joined **${message.member.voice.channel.name}**! I'll stay here until you use \`!leave\`.`);
      console.log(`🔊 Joined VC: ${message.member.voice.channel.name}`);
      
    } catch (error) {
      console.error('Join error:', error);
    }
  }

  // !leave - Leave voice channel
  if (message.content.toLowerCase() === '!mebur') {
    if (voiceConnection) {
      voiceConnection.destroy();
      voiceConnection = null;
      message.reply('✅ Left the voice channel!');
      console.log('🔇 Left voice channel');
    } else {
      message.reply('❌ I\'m not in a voice channel!');
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
  // If bot was moved or disconnected
  if (oldState.id === client.user.id && !newState.channelId && voiceConnection) {
    console.log('⚠️ Bot was disconnected from voice!');
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
// Get token from Secrets (we'll set this up next)
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ ERROR: No Discord token found!');
  console.log('💡 Go to Tools → Secrets and add DISCORD_TOKEN');
} else {
  client.login(token);

}

