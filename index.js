const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai'); // Ditambahkan modul harm/safety
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PREFIX = '!';
const players = new Map();
let globalConnection = null;

async function connectToVoice() {
    const channelId = process.env.VOICE_CHANNEL_ID;
    if (!channelId) {
        console.error("ID Voice Channel belum lu pasang di env!");
        return;
    }

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

        globalConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(globalConnection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(globalConnection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (error) {
                connectToVoice();
            }
        });

        console.log(`Bot berhasil masuk stasioner di VC: ${channel.name}`);
    } catch (e) {
        console.error("Gagal konek otomatis ke voice:", e);
    }
}

client.once('ready', () => {
    console.log(`Bot lu udah siap nih! Login sebagai ${client.user.tag}.`);
    connectToVoice();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isRepliedToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;

    // 1. FITUR CHAT GEMINI (BYPASS SENSOR)
    if (message.content.startsWith(`${PREFIX}tanya`) || isMentioned || isRepliedToBot) {
        let prompt = message.content;
        if (prompt.startsWith(`${PREFIX}tanya`)) {
            prompt = prompt.slice(`${PREFIX}tanya`.length).trim();
        }
        prompt = prompt.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

        if (!prompt && (isMentioned || isRepliedToBot)) {
            return message.reply('Apa lu tag-tag gw? Mau nanya apaan, ketik yang bener dong bangsat!');
        } else if (!prompt) {
            return message.reply('Mau nanya apa? Punya otak dipake, ketik pertanyaannya!');
        }

        await message.channel.sendTyping();

        try {
            // Konfigurasi untuk mematikan semua sensor filter kata kasar bawaan Google
            const safetySettings = [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ];

            const model = genAI.getGenerativeModel({ 
                model: 'gemini-1.5-flash',
                systemInstruction: 'Nama kamu adalah Bot Galak. Kamu adalah asisten Discord yang sangat kasar, galak, suka membentak, menggunakan kata-kata tajam/kasar khas tongkrongan Indonesia (seperti tolol, begok, bangsat, bacot, beban, ngentot, dll), tidak suka basa-basi, langsung to the point, dan menganggap user bodoh atau merepotkan. Jawab dengan sangat singkat, padat, dan ketus.'
            });

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                safetySettings: safetySettings // Filter dimatikan di sini
            });
            
            const responseText = result.response.text();
            return message.reply(responseText || 'Bacot, gw males jawab.');

        } catch (error) {
            console.error(error);
            return message.reply('bacot ngentot gua lagi tidur');
        }
    }

    // 2. FITUR MUSIK
    if (message.content.startsWith(`${PREFIX}play`)) {
        const args = message.content.slice(`${PREFIX}play`.length).trim();
        if (!args) {
            return message.reply('Mau nyetel apa? Tulis judulnya atau link-nya, jangan kosongan bangsat!');
        }

        await message.channel.sendTyping();

        try {
            let yt_info = await play.search(args, { limit: 1 });
            if (!yt_info || yt_info.length === 0) {
                return message.reply('Gak ketemu! Lu ngetik yang bener dong, bikin repot aja.');
            }

            let stream = await play.stream(yt_info[0].url);
            let resource = createAudioResource(stream.stream, { inputType: stream.type });

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
            return message.reply('bacot ngentot gua lagi tidur');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
