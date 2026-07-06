const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
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

client.once('ready', () => {
    console.log(`Bot lu udah siap nih! Login sebagai ${client.user.tag}. Jangan beban ya!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 1. FITUR MUSIK
    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('Masuk voice channel dulu tolol! Gimana gw mau nyetel musik?');
        }

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

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            let player = players.get(message.guild.id);
            if (!player) {
                player = createAudioPlayer();
                players.set(message.guild.id, player);
                connection.subscribe(player);
            }

            player.play(resource);
            message.reply(`Nih gw setelin **${yt_info[0].title}**. Diem lu, dengerin!`);

        } catch (error) {
            console.error(error);
            // Sesuai request kalau limit/error
            message.reply('bacot ngentot gua lagi tidur');
        }
    }

    // 2. FITUR LEAVE
    else if (command === 'stop' || command === 'leave') {
        const connection = joinVoiceChannel({
            channelId: message.member.voice.channel?.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });
        
        if (connection) {
            connection.destroy();
            players.delete(message.guild.id);
            message.reply('Matiin kan? Puas lu? Gw cabut, males melayani lu.');
        } else {
            message.reply('Gw aja gak ada di VC, sok tahu lu suruh gw cabut!');
        }
    }

    // 3. FITUR CHAT GPT DENGAN PERSONA GALAK
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
            // Sesuai request kalau limit/error
            message.reply('bacot ngentot gua lagi tidur');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
