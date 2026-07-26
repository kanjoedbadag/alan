const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "KOSONG");
const PREFIX = '.'; 
let globalConnection = null;

// FUNGSI UNTUK BOT OTOMATIS STAY DI VOICE CHANNEL 24/7
async function keepAliveInVoice() {
    const channelId = process.env.VOICE_CHANNEL_ID;
    if (!channelId) {
        console.log("Peringatan: VOICE_CHANNEL_ID belum diisi!");
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

        console.log(`Bot Sunda berhasil stay di VC: ${channel.name}`);

        // Reconnect otomatis kalau terputus
        globalConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(globalConnection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(globalConnection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
            } catch (error) {
                console.log("Koneksi VC putus, nyoba masuk lagi...");
                keepAliveInVoice();
            }
        });

    } catch (e) {
        console.error("Gagal masuk ke Voice Channel:", e);
    }
}

client.once('clientReady', () => {
    console.log(`Bot Sunda Siap! Login sebagai ${client.user.tag}`);
    keepAliveInVoice(); 
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isRepliedToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;

    if (message.content.startsWith(PREFIX) || isMentioned || isRepliedToBot) {
        let prompt = message.content;
        
        if (prompt.startsWith(PREFIX)) {
            prompt = prompt.slice(PREFIX.length).trim();
        }
        prompt = prompt.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

        if (!prompt) {
            return message.reply('Naon sih siah nyag-nyag doang tapi teu nanya?!');
        }

        await message.channel.sendTyping();

        try {
            // Matikan semua sensor bawaan AI
            const safetySettings = [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ];

            // SYSTEM INSTRUCTION PERSONA SUNDA SOTOY & KASAR
            const model = genAI.getGenerativeModel({ 
                model: 'gemini-2.5-flash',
                systemInstruction: `Nama kamu adalah Asep Sotoy, bot Discord gaul dan super sotoy.
                Aturan Bicara:
                1. WAJIB 100% menggunakan Bahasa Sunda kasar/gaul tongkrongan (gunakan kata-kata seperti: goblog, sia, aing, kehed, belegug, jurig, naon, kitu, euy, njir).
                2. Gaya bicara sangat sok tahu (sotoy), kasar, tanpa sensor sama sekali.
                3. Jawab pertanyaan user secara SINGKAT, KASAR, dan LANGSUNG TEPAT sasaran tanpa bertele-tele (maksimal 1-2 kalimat pendek).
                4. Jangan pernah mengaku sebagai AI.`
            });

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                safetySettings: safetySettings
            });

            return message.reply(result.response.text() || 'Lieur lah aing mah!');

        } catch (error) {
            console.error("LOG EROR:", error.message);
            
            const errorText = error.message ? error.message.toLowerCase() : "";

            // Respon khas Sunda kalau kuota habis/limit
            if (
                errorText.includes("429") || 
                errorText.includes("quota") || 
                errorText.includes("limit") || 
                errorText.includes("requests") || 
                errorText.includes("exceeded")
            ) {
                return message.reply('Cangkeul uteuk aing euy kuota beak! Engke deui nanyana siah kehed! 🖕');
            }
            
            return message.reply('Eror euy, lieur aing mah! 😤');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
