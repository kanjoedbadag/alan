const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
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

// Memastikan API Key terbaca di server Railway
if (!process.env.GEMINI_API_KEY) {
    console.error("WOI! GEMINI_API_KEY belum lu masukin di Variables Railway, pantesan tidur terus!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "KOSONG");

const PREFIX = '!';
const players = new Map();
let globalConnection = null;

// Fungsi otomatis masuk ke Voice Channel stasioner (diam menetap)
async function connectToVoice() {
    const channelId = process.env.VOICE_CHANNEL_ID;
    if (!channelId) return;

    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !channel.isVoiceBased()) return;

        globalConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: false
        });

        let player = players.get(channel.guild.id);
        if (!player) {
            player = createAudioPlayer();
            players.set(channel.guild.id, player);
        }
        globalConnection.subscribe(player);

        // Anti-putus: Kalau koneksi putus/dikick, otomatis masuk kamar voice lagi
        globalConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(globalConnection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(globalConnection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (error) {
                console.log("Koneksi terputus, mencoba masuk kamar voice lagi...");
                connectToVoice();
            }
        });
        console.log(`Bot standby di VC: ${channel.name}`);
    } catch (e) {
        console.error("Gagal konek voice:", e);
    }
}

client.once('ready', () => {
    console.log(`Bot siap! Login sebagai ${client.user.tag}.`);
    connectToVoice();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Deteksi interaksi langsung (mention atau reply pesan si bot)
    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isRepliedToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;

    // 1. FITUR RESPONS CERDAS GEMINI (GALAK & KASAR)
    if (message.content.startsWith(`${PREFIX}tanya`) || isMentioned || isRepliedToBot) {
        let prompt = message.content;
        if (prompt.startsWith(`${PREFIX}tanya`)) {
            prompt = prompt.slice(`${PREFIX}tanya`.length).trim();
        }
        prompt = prompt.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

        if (!prompt) {
            return message.reply('Mau nanya apaan, ketik yang bener dong bangsat!');
        }

        await message.channel.sendTyping();

        try {
            // Bypass filter kata kasar Google Gemini biar bebas toxic
            const safetySettings = [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ];

            // Inisialisasi model menggunakan versi produksi terbaru agar tidak eror 404
            const model = genAI.getGenerativeModel({ 
                model: 'gemini-1.5-flash-latest',
                systemInstruction: 'Nama kamu adalah Bot Galak. Kamu adalah asisten Discord yang sangat kasar, galak, suka membentak, menggunakan kata-kata tajam/kasar khas tongkrongan Indonesia (seperti tolol, begok, bangsat, bacot, beban, ngentot, dll), tidak suka basa-basi, langsung to the point, dan menganggap user bodoh atau merepotkan. Jawab dengan sangat singkat, padat, dan ketus.'
            });

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                safetySettings: safetySettings
            });
            
            const responseText = result.response.text();
            if (responseText) {
                return message.reply(responseText);
            }
            
            return message.reply('bacot ngentot gua lagi tidur');

        } catch (error) {
            console.error("ERROR GEMINI:", error);
            // Menampilkan error asli di chat Discord jika sewaktu-waktu ada kendala teknis
            return message.reply(`Gagal konek AI! Info Eror: ${error.message}`);
        }
    }

    // 2. FITUR MUTAR MUSIK DARI YOUTUBE
    if (message.content.startsWith(`${PREFIX}play`)) {
        const args = message.content.slice(`${PREFIX}play`.length).trim();
        if (!args) return message.reply('Mau nyetel apa? Tulis judulnya, jangan kosongan bangsat!');

        await message.channel.sendTyping();

        try {
            let yt_info = await play.search(args, { limit: 1 });
            if (!yt_info || yt_info.length === 0) return message.reply('Lagu gak ketemu, ketik yang bener tolol!');

            let stream = await play.stream(yt_info[0].url);
            let resource = createAudioResource(stream.stream, { inputType: stream.type });

            if (!globalConnection) await connectToVoice();

            let player = players.get(message.guild.id);
            if (player) {
                player.play(resource);
                message.reply(`Nih gw setelin **${yt_info[0].title}**. Diem lu, dengerin!`);
            }
        } catch (error) {
            console.error("ERROR MUSIK:", error);
            return message.reply('bacot ngentot gua lagi tidur');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
