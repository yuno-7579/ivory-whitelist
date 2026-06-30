// ================================================
// 🪪 IVORY RP — Whitelist Interview Bot
//    Discord Coding Store | Claude Powered
// ================================================

const {
    Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
    REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    PermissionFlagsBits, ChannelType
} = require('discord.js');
const fs = require('fs');

// ✅ الإعدادات — هتيجي من Environment Variables (Railway)
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; // الكاتيجوري اللي هتفتح فيها التيكتات
const CITIZEN_ROLE_ID = process.env.CITIZEN_ROLE_ID; // رول Citizen بعد القبول
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID; // رول الأدمن اللي يشوف التيكتات
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID; // روم اللوجز — يبعت فيه الإجابات + النتيجة

// ✅ قاعدة البيانات
const DB_PATH = './database.json';
function loadDB() {
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}');
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ✅ أسئلة المقابلة — عدّل أو زود زي ما تحب
const QUESTIONS = [
    {
        title: '1️⃣ السؤال الأول — التعريف بالشخصية',
        text: 'اكتب اسم شخصيتك الكامل (الاسم الأول والأخير) واللي هتستخدمه في الرولبلاي.'
    },
    {
        title: '2️⃣ السؤال الثاني — تعريف الرولبلاي',
        text: 'إيه هو الرولبلاي بالنسبة لك؟ اشرح بكلامك الخاص.'
    },
    {
        title: '3️⃣ السؤال الثالث — تعريف قصة الشخصية',
        text: 'اكتب قصة شخصيتك الاساسية و يجب ان لا تقل عن 150 كلمة.'
    },
    {
        title: '4️⃣ السؤال الرابع — معنى ForcedRP',
        text: 'إيه معنى "ForcedRP" وليه ممنوع في السيرفر؟'
    },
    {
        title: '5️⃣ السؤال الخامس — معنى Meta Gaming',
        text: 'إيه الفرق بين "Meta Gaming" و"In-Character / Out-of-Character"؟ اشرح بمثال.'
    },
    {
        title: '6️⃣ السؤال السادس — موقف RP',
        text: 'لو شخصيتك في السيرفر اتعرضت لحادث وكسرت رجلها، إزاي هتتعامل مع الموقف من ناحية الرولبلاي؟'
    },
    {
        title: '7️⃣ السؤال السابع — السرقة والقتل',
        text: 'إيه القوانين اللي بتحكم السرقة أو القتل في السيرفر؟ ولازم يكون فيه إيه قبل ما حد يعمل أي منهم؟'
    },
    {
        title: '8️⃣ السؤال التامن — Fail RP',
        text: 'وضّح معنى "Fail RP" واديني مثال واحد عليه.'
    },
    {
        title: '9️⃣ السؤال التاسع — مخالفة قانون لحظة دخولك',
        text: 'لو شفت لاعب تاني بيعمل مخالفة واضحة للقوانين قدامك، هتعمل إيه؟'
    },
    {
        title: '1️⃣0️⃣ السؤال العاشر — RDM/VDM',
        text: 'وضّح معنى "RDM/VDM" واديني مثالين عليه.'
    },
];

// ✅ تخزين حالة كل تيكت (الأسئلة اللي بيتم سؤالها)
const activeInterviews = new Map(); // channelId -> { userId, currentQuestion, answers }

// ✅ تشغيل البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ✅ الأوامر
const commands = [
    new SlashCommandBuilder()
        .setName('whitelist-setup')
        .setDescription('إنشاء رسالة بدء المقابلة (للأدمن فقط)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

client.once('ready', async () => {
    console.log(`✅ البوت شغال: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('✅ الأوامر اتسجلت!');
    } catch (err) {
        console.error('❌ خطأ في تسجيل الأوامر:', err);
    }
});

// ✅ بناء Embed رسالة البدء (شبيه بالصورة)
function buildWelcomeEmbed() {
    return new EmbedBuilder()
        .setColor('#CC0000')
        .setTitle('Welcome to B3R RP Roleplay Server')
        .setDescription(
            '**We are glad to have you here**\n\n' +
            'Ready to begin your whitelist interview? Click the button below to start your interview ticket. ' +
            'A member of our admin team will review your answers and guide you through the next steps.\n\n' +
            'Please make sure you have read the server rules before starting.'
        )
        .setFooter({ text: '🪪 B3R RP' });
}

// ✅ بناء Embed سؤال
function buildQuestionEmbed(index) {
    const q = QUESTIONS[index];
    return new EmbedBuilder()
        .setColor('#CC0000')
        .setTitle(q.title)
        .setDescription(q.text)
        .setFooter({ text: `السؤال ${index + 1} من ${QUESTIONS.length} | B3R RP` });
}

// ✅ بناء Embed نتيجة المقابلة (تجميع الإجابات للأدمن)
function buildSummaryEmbed(member, answers) {
    const embed = new EmbedBuilder()
        .setColor('#CC0000')
        .setTitle('📋 ملخص إجابات المقابلة')
        .setDescription(`اللاعب: <@${member.id}>\nمرر على الإجابات وقرر القبول أو الرفض 👇`)
        .setFooter({ text: 'B3R RP | نظام Whitelist' })
        .setTimestamp();

    QUESTIONS.forEach((q, i) => {
        embed.addFields({
            name: q.title,
            value: answers[i] ? `\`\`${answers[i]}\`\`` : '`لم يتم الرد`'
        });
    });

    return embed;
}

// ✅ بناء Embed نتيجة للاعب (قبول/رفض)
function buildResultEmbed(accepted) {
    if (accepted) {
        return new EmbedBuilder()
            .setColor('#00CC44')
            .setTitle('✅ تم قبول طلبك!')
            .setDescription(
                'تهانينا! تم قبول طلب الـ Whitelist بتاعك في **B3R RP**.\n\n' +
                'تم إعطاؤك رتبة **Citizen** وأصبح بإمكانك الانضمام للسيرفر والبدء في تجربة الرولبلاي 🎉'
            )
            .setFooter({ text: 'B3R RP | نظام Whitelist' })
            .setTimestamp();
    } else {
        return new EmbedBuilder()
            .setColor('#CC0000')
            .setTitle('❌ تم رفض طلبك')
            .setDescription(
                'نأسف، تم رفض طلب الـ Whitelist بتاعك في **B3R RP**.\n\n' +
                'يمكنك مراجعة قوانين السيرفر وإعادة التقديم بعد فترة من خلال فتح مقابلة جديدة.'
            )
            .setFooter({ text: 'B3R RP | نظام Whitelist' })
            .setTimestamp();
    }
}

// ✅ بناء Embed اللوج — الإجابات كاملة + النتيجة (يتبعت في روم اللوجز)
function buildLogEmbed(member, answers, accepted, decidedBy) {
    const embed = new EmbedBuilder()
        .setColor(accepted ? '#00CC44' : '#CC0000')
        .setTitle(accepted ? '✅ تم قبول طلب Whitelist' : '❌ تم رفض طلب Whitelist')
        .setDescription(
            `**اللاعب:** <@${member.id}> (${member.user.tag})\n` +
            `**القرار بواسطة:** <@${decidedBy}>\n` +
            `**الحالة:** ${accepted ? 'مقبول ✅' : 'مرفوض ❌'}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'B3R RP | سجل المقابلات' })
        .setTimestamp();

    QUESTIONS.forEach((q, i) => {
        embed.addFields({
            name: q.title,
            value: answers[i] ? `\`\`${answers[i]}\`\`` : '`لم يتم الرد`'
        });
    });

    return embed;
}

// ✅ التفاعلات
client.on('interactionCreate', async (interaction) => {

    // ─── SLASH COMMAND: /whitelist-setup ──────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'whitelist-setup') {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_interview')
                .setLabel('Start Interview')
                .setEmoji('🪪')
                .setStyle(ButtonStyle.Success)
        );

        await interaction.channel.send({ embeds: [buildWelcomeEmbed()], components: [row] });
        await interaction.reply({ content: '✅ تم إنشاء رسالة المقابلة.', ephemeral: true });
        return;
    }

    // ─── BUTTON: Start Interview ──────────────────
    if (interaction.isButton() && interaction.customId === 'start_interview') {
        const db = loadDB();

        // تحقق لو عنده تيكت مفتوح خلاص
        const existing = db[interaction.user.id];
        if (existing && existing.status === 'open') {
            return interaction.reply({
                content: `⚠️ عندك تيكت مقابلة مفتوح بالفعل: <#${existing.channelId}>`,
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // ✅ عمل التيكت
        const ticketChannel = await interaction.guild.channels.create({
            name: `مقابلة-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                {
                    id: interaction.guild.roles.everyone,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                },
                {
                    id: ADMIN_ROLE_ID,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                }
            ]
        });

        // حفظ حالة التيكت
        db[interaction.user.id] = {
            channelId: ticketChannel.id,
            status: 'open',
            currentQuestion: 0,
            answers: []
        };
        saveDB(db);

        activeInterviews.set(ticketChannel.id, {
            userId: interaction.user.id,
            currentQuestion: 0,
            answers: []
        });

        // رسالة ترحيب + أول سؤال
        await ticketChannel.send({
            content: `أهلاً <@${interaction.user.id}> 👋\nبدأت مقابلة الـ Whitelist بتاعتك. جاوب على كل سؤال برسالة منفصلة.`,
            embeds: [buildQuestionEmbed(0)]
        });

        await interaction.editReply({ content: `✅ تم فتح تيكت المقابلة: <#${ticketChannel.id}>` });
        return;
    }

    // ─── BUTTON: Accept / Reject ──────────────────
    if (interaction.isButton() && (interaction.customId.startsWith('accept_') || interaction.customId.startsWith('reject_'))) {
        const targetUserId = interaction.customId.split('_')[1];
        const accepted = interaction.customId.startsWith('accept_');
        const db = loadDB();

        const ticketData = db[targetUserId];
        if (!ticketData) {
            return interaction.reply({ content: '❌ بيانات التيكت غير موجودة.', ephemeral: true });
        }

        // إعطاء الرول لو قبول
        if (accepted) {
            try {
                const member = await interaction.guild.members.fetch(targetUserId);
                await member.roles.add(CITIZEN_ROLE_ID);
            } catch (err) {
                console.error('❌ خطأ في إعطاء الرول:', err);
            }
        }

        // بعت النتيجة للاعب
        try {
            const member = await interaction.guild.members.fetch(targetUserId);
            await member.send({ embeds: [buildResultEmbed(accepted)] }).catch(() => {
                // لو الخاص مقفول، بعت في التيكت
                interaction.channel.send({ content: `<@${targetUserId}>`, embeds: [buildResultEmbed(accepted)] });
            });
        } catch (err) {
            console.error('❌ خطأ في إرسال النتيجة:', err);
        }

        // تحديث الرسالة وتعطيل الأزرار
        const resultText = accepted ? '✅ تم قبول الطلب' : '❌ تم رفض الطلب';
        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_done').setLabel('قبول').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('reject_done').setLabel('رفض').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(true)
        );

        await interaction.update({ components: [disabledRow] });
        await interaction.followUp({ content: `${resultText} بواسطة <@${interaction.user.id}>` });

        // ✅ إرسال اللوج (الإجابات + النتيجة) لروم اللوجز
        if (LOG_CHANNEL_ID) {
            try {
                const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
                const member = await interaction.guild.members.fetch(targetUserId);
                const logEmbed = buildLogEmbed(member, ticketData.answers || [], accepted, interaction.user.id);
                await logChannel.send({ embeds: [logEmbed] });
            } catch (err) {
                console.error('❌ خطأ في إرسال اللوج:', err);
            }
        }

        // تحديث الحالة
        ticketData.status = accepted ? 'accepted' : 'rejected';
        saveDB(db);

        // قفل التيكت بعد 10 ثواني
        setTimeout(async () => {
            try {
                await interaction.channel.delete();
            } catch (e) { }
        }, 10000);

        return;
    }
});

// ✅ استقبال إجابات الأسئلة كرسائل عادية
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const interview = activeInterviews.get(message.channel.id);
    if (!interview) return;
    if (message.author.id !== interview.userId) return;

    // حفظ الإجابة
    interview.answers.push(message.content);

    const db = loadDB();
    if (db[interview.userId]) {
        db[interview.userId].answers = interview.answers;
        db[interview.userId].currentQuestion = interview.currentQuestion + 1;
    }

    // لو فيه سؤال جاي
    if (interview.currentQuestion + 1 < QUESTIONS.length) {
        interview.currentQuestion++;
        if (db[interview.userId]) db[interview.userId].currentQuestion = interview.currentQuestion;
        saveDB(db);

        await message.channel.send({ embeds: [buildQuestionEmbed(interview.currentQuestion)] });
    } else {
        // ✅ خلصت كل الأسئلة — بعت الملخص للأدمن مع أزرار القبول/الرفض
        saveDB(db);

        const member = await message.guild.members.fetch(interview.userId);
        const summaryEmbed = buildSummaryEmbed(member, interview.answers);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_${interview.userId}`).setLabel('قبول').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`reject_${interview.userId}`).setLabel('رفض').setEmoji('❌').setStyle(ButtonStyle.Danger)
        );

        await message.channel.send({
            content: `<@&${ADMIN_ROLE_ID}> المقابلة خلصت ✅ راجع الإجابات واتخذ القرار 👇`,
            embeds: [summaryEmbed],
            components: [row]
        });

        // إزالة من القائمة النشطة (هيتم القرار من خلال الأزرار)
        activeInterviews.delete(message.channel.id);
    }
});

client.login(TOKEN);

