const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

if (!process.env.GEMINI_API_KEY) {
    console.error("WOI! GEMINI_API_KEY belum lu masukin di Variables Railway!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "KOSONG");
const PREFIX = '!';

client.once('clientReady', () => {
    console.log(`Bot AI Siap! Login sebagai ${client.user.tag}.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user) && !message.mentions.everyone;
    const isRepliedToBot = message.reference && (await message.channel.messages.fetch(message.reference.messageId)).author.id === client.user.id;

    // FITUR CHAT GEMINI (GALAK & KASAR)
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
            const safetySettings = [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ];

            const model = genAI.getGenerativeModel({ 
                model: 'gemini-2.5-flash',
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
            return message.reply(`Gagal konek AI! Info Eror: ${error.message}`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
