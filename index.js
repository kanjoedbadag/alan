const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, demuxProbe, getVoiceConnection } = require('@discordjs/voice');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const play = require('play-dl');
require('dotenv').config();

if (process.env.YT_COOKIE) {
    play.setToken({ youtube: { cookie: process.env.YT_COOKIE } });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates 
    ]
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "KOSONG");
const PREFIX = '!';
const players = new Map();

client.once('clientReady', () => {
    console.log(`Bot siap! Login sebagai ${client.user.tag}.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isRepliedToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;

    // 1. FITUR CHAT AI GEMINI
    if (message.content.startsWith(`${PREFIX}tanya`) || isMentioned || isRepliedToBot) {
        let prompt = message.content;
        if (prompt.startsWith(`${PREFIX}tanya`)) prompt = prompt.slice(`${PREFIX}tanya`.length).trim();
        prompt = prompt.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

        if (!prompt) return message.reply('Mau nanya apaan, ketik yang bener dong bangsat!');
        await message.channel.sendTyping();

        try {
            const safetySettings = [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ];

            const model = genAI.getGenerativeModel({ 
                model: 'gemini-2.5-flash',
                systemInstruction: 'Nama kamu adalah Bot Galak. Jawab dengan sangat kasar, galak, ketus, menggunakan kata-kata tajam khas tongkrongan Indonesia.'
            });

            const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], safetySettings: safetySettings });
            return message.reply(result.response.text() || 'bacot ngentot gua lagi tidur');
        } catch (error) {
            return message.reply(`Gagal konek AI! Info Eror: ${error.message}`);
        }
    }

    // ==========================================
    // 2. COMAND BARU: !join (SURUH BOT MASUK VC)
    // ==========================================
    if (message.content.startsWith(`${PREFIX}join`)) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('Lu masuk kamar voice dulu tolol, baru panggil gua!');
        }

        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false
            });
            return message.reply(`Gua udah masuk ke kamar **${voiceChannel.name}**, nih. Puas lu?!`);
        } catch (error) {
            console.error(error);
            return message.reply('Gagal masuk voice, cek permissions role gua di server!');
        }
    }

    // ==========================================
    // 3. COMAND BARU: !leave / !dc (USIR BOT DARI VC)
    // ==========================================
    if (message.content.startsWith(`${PREFIX}leave`) || message.content.startsWith(`${PREFIX}dc`)) {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) {
            return message.reply('Gua aja lagi gak di kamar voice mana-mana, pea!');
        }

        connection.destroy();
        return message.reply('Gua cabut! Males juga gua nongkrong ama lu pada.');
    }

    // 4. FITUR MUSIK (!play)
    if (message.content.startsWith(`${PREFIX}play`)) {
        const args = message.content.slice(`${PREFIX}play`.length).trim();
        if (!args) return message.reply('Mau nyetel apa? Tulis judulnya, jangan kosongan bangsat!');

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('Lu masuk kamar voice dulu tolol, gimana mau dengerin lagu!');
        }

        await message.channel.sendTyping();

        try {
            let yt_info = await play.search(args, { limit: 1 });
            if (!yt_info || yt_info.length === 0) return message.reply('Lagu gak ketemu, ketik yang bener tolol!');

            let stream = await play.stream(yt_info[0].url, { discordPlayerCompatibility: true });
            const { stream: probedStream, type } = await demuxProbe(stream.stream);
            let resource = createAudioResource(probedStream, { inputType: type });

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false
            });

            let player = players.get(message.guild.id);
            if (!player) {
                player = createAudioPlayer();
                players.set(message.guild.id, player);
            }

            connection.subscribe(player);
            player.play(resource);

            message.reply(`Nih gw setelin **${yt_info[0].title}** di kamar **${voiceChannel.name}**. Diem lu!`);

        } catch (error) {
            console.error("ERROR MUSIK:", error);
            return message.reply(`Gagal putar lagu! Masalah IP Server Terblokir (429) atau bot lu ga dikasih izin connect.`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
