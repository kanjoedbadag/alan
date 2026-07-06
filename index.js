const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const { OpenAI } = require('openai');
const play = require('play-dl');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const PREFIX = '!';
const players = new Map();
let globalConnection = null;

// Fungsi untuk membuat bot selalu connect ke VC tujuan
async function connectToVoice() {
    const channelId = process.env.VOICE_CHANNEL_ID;
    if (!channelId) {
        console.error("ID Voice Channel belum lu pasang di env, goblok!");
        return;
    }

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isVoiceBased()) {
            console.error("ID Channel kagak valid atau bukan voice channel!");
            return;
        }

        globalConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false // Agar bot tidak deafen jika ingin mendengarkan fitur lain nanti
        });

        // Setup player kalau belum ada
        let player = players.get(channel.guild.id);
        if (!player) {
            player = createAudioPlayer();
            players.set(channel.guild.id, player);
        }
        globalConnection.subscribe(player);

        // Anti-putus: Kalau dc otomatis sambungkan ulang
        globalConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                console.log("Koneksi putus, mencoba masuk lagi...");
                await Promise.race([
                    entersState(globalConnection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(globalConnection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (error) {
                // Kalau beneran dc, reconnect manual
                connectToVoice();
            }
        });

        console.log(`Bot berhasil masuk stasioner di VC: ${channel.name}`);
    } catch (e) {
        console.error("Gagal konek otomatis ke voice:", e);
    }
}

client.once('ready', () => {
    console.log(`Bot lu udah siap nih! Login sebagai ${client.user.tag}. Jangan beban ya!`);
    // Jalankan fungsi auto-join saat bot nyala
    connectToVoice();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. FITUR MUSIK
    if (command === 'play') {
        const query = args.join(' ');
        if (!query) {
            return message.reply('Mau nyetel apa? Tulis judulnya atau link-nya, jangan kosongan bangsat!');
        }

        await message.channel.sendTyping();

        try {
            let yt_info = await play.search(query, { limit: 1 });
            if (!yt_info || yt_info.length === 0) {
                return message.reply('Gak ketemu! Lu ngetik yang bener dong, bikin repot aja.');
            }

            let stream = await play.stream(yt_info[0].url);
            let resource = createAudioResource(stream.stream, { inputType: stream.type });

            // Pastikan koneksi aman, kalau belum ada kita paksa buat ulang
            if (!globalConnection) {
                await connectToVoice();
            }

            let player = players.get(message.guild.id);
            if (player) {
                player.play(resource);
                message.reply(`Nih gw setelin **${yt_info[0].title}**. Diem lu, dengerin!`);
            } else {
                message.reply('Sabar nyet, player audio belum siap.');
            }

        } catch (error) {
            console.error(error);
            message.reply('bacot ngentot gua lagi tidur');
        }
    }

    // 2. FITUR CHAT GPT DENGAN PERSONA GALAK
    else if (command === 'tanya') {
        const prompt = args.join(' ');
        if (!prompt) return message.reply('Mau nanya apa? Punya otak dipake, ketik pertanyaannya!');

        await message.channel.sendTyping();

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { 
                        role: 'system', 
                        content: 'Nama kamu adalah Bot Galak. Kamu adalah asisten Discord yang sangat kasar, galak, suka membentak, menggunakan kata-kata tajam/kasar khas tongkrongan Indonesia, tidak suka basa-basi, langsung to the point, dan menganggap user bodoh atau merepotkan. Jawab dengan sangat singkat, padat, dan ketus.' 
                    },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 150
            });

            const replyText = response.choices[0].message.content;
            message.reply(replyText);

        } catch (error) {
            console.error(error);
            message.reply('bacot ngentot gua lagi tidur');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
