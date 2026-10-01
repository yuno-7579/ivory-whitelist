// ================================================
// 🤖 بوت السيرفر الجديد — ترحيب + تقديمات + تذاكر + لوجز
//    Discord Coding Store | Claude Powered
// ================================================

const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, SlashCommandBuilder,
    REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, PermissionFlagsBits, ChannelType, AuditLogEvent
} = require('discord.js');
const fs = require('fs');

// ============================================================
// ✅ الإعدادات — Environment Variables (Railway)
// ============================================================
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// --- الترحيب والـ auto role ---
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const AUTO_ROLE_ID = process.env.AUTO_ROLE_ID; // رول بيتحط تلقائي لأي عضو جديد

// --- التقديمات ---
const APPLICATIONS_CATEGORY_ID = process.env.APPLICATIONS_CATEGORY_ID; // الكاتيجوري اللي هتتفتح فيها رومات التقديم
const ADMIN_TEAM_ROLE_ID = process.env.ADMIN_TEAM_ROLE_ID;             // مين يشوف تقديمات الإدارة
const APPLICATION_TEAM_ROLE_ID = process.env.APPLICATION_TEAM_ROLE_ID; // مين يشوف التقديمات العادية
const PENDING_INTERVIEW_ROLE_ID = process.env.PENDING_INTERVIEW_ROLE_ID; // رول "معاينة" (انتظار المقابلة) — بيتحط في الحالتين

// --- التذاكر ---
const TICKETS_CATEGORY_ID = process.env.TICKETS_CATEGORY_ID;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

// --- اللوجز (حط ID الروم بتاع كل نوع، سيبه فاضي لو مش عايزه) ---
const LOG_CHANNELS = {
    ban: process.env.LOG_BAN_CHANNEL,
    unban: process.env.LOG_UNBAN_CHANNEL,
    kick: process.env.LOG_KICK_CHANNEL,
    timeout: process.env.LOG_TIMEOUT_CHANNEL,
    changeNickname: process.env.LOG_CHANGE_NICKNAME_CHANNEL,
    giveRole: process.env.LOG_GIVE_ROLE_CHANNEL,
    removeRole: process.env.LOG_REMOVE_ROLE_CHANNEL,
    roleDeleted: process.env.LOG_ROLE_DELETED_CHANNEL,
    createChannel: process.env.LOG_CREATE_CHANNEL_CHANNEL,
    deleteChannel: process.env.LOG_DELETE_CHANNEL_CHANNEL,
    editChannel: process.env.LOG_EDIT_CHANNEL_CHANNEL,
    channelPermissions: process.env.LOG_CHANNEL_PERMISSIONS_CHANNEL,
    editMessage: process.env.LOG_EDIT_MESSAGE_CHANNEL,
    deleteMessage: process.env.LOG_DELETE_MESSAGE_CHANNEL,
    joinVoice: process.env.LOG_JOIN_VOICE_CHANNEL,
    voiceLeft: process.env.LOG_VOICE_LEFT_CHANNEL,
    voiceSwitched: process.env.LOG_VOICE_SWITCHED_CHANNEL,
    voiceMove: process.env.LOG_VOICE_MOVE_CHANNEL,
    disconnectVoice: process.env.LOG_DISCONNECT_VOICE_CHANNEL,
    voiceStatus: process.env.LOG_VOICE_STATUS_CHANNEL,
    security: process.env.LOG_SECURITY_CHANNEL,
};

// ============================================================
// ✅ قواعد البيانات
// ============================================================
const TICKETS_DB_PATH = './tickets.json';
const APPS_DB_PATH = './applications.json';
function loadDB(path) {
    if (!fs.existsSync(path)) fs.writeFileSync(path, '{}');
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}
function saveDB(path, data) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

const activeApplications = new Map(); // channelId -> { userId, type, currentQuestion, answers }

// ============================================================
// ✅ أسئلة التقديمات — عدّل زي ما يناسبك
// ============================================================
const ADMIN_QUESTIONS = [
    'ليه عايز تبقى جزء من فريق الإدارة؟',
    'عندك خبرة سابقة في إدارة سيرفرات؟ لو أه، اشرح.',
    'لو شفت عضو في فريق الإدارة بيستغل صلاحيته، هتعمل إيه؟',
    'إيه أكتر وقت متاح عندك للمتابعة أسبوعيًا؟',
    'اذكر موقف صعب واجهته وإزاي تعاملت معاه.',
];

const REGULAR_QUESTIONS = [
    'اكتب اسمك الكامل اللي هتستخدمه في اللعبة.',
    'عمرك كام، ومن أي محافظة؟',
    'إزاي عرفت عن السيرفر؟',
    'إيه اللي بتدور عليه في تجربة اللعب هنا؟',
];

// ============================================================
// ✅ تشغيل البوت
// ============================================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

const commands = [
    new SlashCommandBuilder()
        .setName('apply-setup')
        .setDescription('إنشاء رسالة بدء التقديمات (للأدمن فقط)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('tickets-setup')
        .setDescription('إنشاء رسالة نظام التذاكر (للأدمن فقط)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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

async function sendLog(type, embed) {
    const channelId = LOG_CHANNELS[type];
    if (!channelId) return;
    try {
        const channel = await client.channels.fetch(channelId);
        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error(`❌ خطأ في إرسال لوج (${type}):`, err.message);
    }
}
function baseEmbed(color, title) {
    return new EmbedBuilder().setColor(color).setTitle(title).setTimestamp();
}

// ============================================================
// ✅ الترحيب + auto role
// ============================================================
client.on('guildMemberAdd', async (member) => {
    if (AUTO_ROLE_ID) {
        try { await member.roles.add(AUTO_ROLE_ID); } catch (err) { console.error('❌ خطأ في إضافة رول الدخول:', err.message); }
    }
    if (WELCOME_CHANNEL_ID) {
        try {
            const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('👋 عضو جديد انضم للسيرفر')
                .setDescription(`أهلاً بيك ${member} في السيرفر! اقرأ القوانين وابدأ تقديمك من قناة التقديمات.`)
                .setThumbnail(member.user.displayAvatarURL())
                .setFooter({ text: `عضو رقم ${member.guild.memberCount}` })
                .setTimestamp();
            await channel.send({ content: `${member}`, embeds: [embed] });
        } catch (err) {
            console.error('❌ خطأ في إرسال رسالة الترحيب:', err.message);
        }
    }
});

// ============================================================
// ✅ نظام التقديمات (إدارة / عادي)
// ============================================================
function buildApplyPanelEmbed() {
    return new EmbedBuilder()
        .setColor('#CC0000')
        .setTitle('📋 التقديمات')
        .setDescription('اختر نوع التقديم اللي عايز تقدمه من الأزرار تحت. هيتفتحلك روم خاص تجاوب فيه على الأسئلة.')
        .setFooter({ text: 'السيرفر الجديد' });
}
function buildApplyButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('apply_admin').setLabel('تقديم إدارة').setEmoji('🛡️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('apply_regular').setLabel('تقديم عادي').setEmoji('🪪').setStyle(ButtonStyle.Success)
    );
}
function buildQuestionEmbed(type, index) {
    const questions = type === 'admin' ? ADMIN_QUESTIONS : REGULAR_QUESTIONS;
    return new EmbedBuilder()
        .setColor('#CC0000')
        .setTitle(`سؤال ${index + 1} من ${questions.length}`)
        .setDescription(questions[index]);
}
function buildSummaryEmbed(member, type, answers) {
    const questions = type === 'admin' ? ADMIN_QUESTIONS : REGULAR_QUESTIONS;
    const embed = new EmbedBuilder()
        .setColor('#CC0000')
        .setTitle(`📋 ملخص تقديم ${type === 'admin' ? 'إدارة' : 'عادي'}`)
        .setDescription(`اللاعب: ${member}`)
        .setTimestamp();
    questions.forEach((q, i) => embed.addFields({ name: q, value: answers[i] || 'لم يتم الرد' }));
    return embed;
}
function buildResultEmbed(accepted) {
    return accepted
        ? new EmbedBuilder().setColor('#2ecc71').setTitle('✅ تم قبول تقديمك!')
            .setDescription('مبروك! اتحطلك رول معاينة، استنى فريق الإدارة يكلمك لتحديد موعد المقابلة.')
        : new EmbedBuilder().setColor('#CC0000').setTitle('❌ تم رفض تقديمك')
            .setDescription('للأسف اترفض تقديمك، تقدر تحاول تاني بعد فترة.');
}

client.on('interactionCreate', async (interaction) => {

    // ─── SLASH: /apply-setup ──────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'apply-setup') {
        await interaction.channel.send({ embeds: [buildApplyPanelEmbed()], components: [buildApplyButtons()] });
        await interaction.reply({ content: '✅ تم إنشاء رسالة التقديمات.', ephemeral: true });
        return;
    }

    // ─── SLASH: /tickets-setup ──────────
    if (interaction.isChatInputCommand() && interaction.commandName === 'tickets-setup') {
        const embed = new EmbedBuilder().setColor('#2B2D31').setTitle('🎫 نظام التذاكر')
            .setDescription('اضغط الزرار تحت لفتح تذكرة دعم.');
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Primary)
        );
        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ تم إنشاء رسالة التذاكر.', ephemeral: true });
        return;
    }

    // ─── BUTTON: بدء تقديم (إدارة أو عادي) ──────────
    if (interaction.isButton() && (interaction.customId === 'apply_admin' || interaction.customId === 'apply_regular')) {
        const type = interaction.customId === 'apply_admin' ? 'admin' : 'regular';
        const db = loadDB(APPS_DB_PATH);
        const key = interaction.user.id;

        const existing = db[key];
        if (existing && existing.status === 'open') {
            const stillExists = interaction.guild.channels.cache.has(existing.channelId)
                || await interaction.guild.channels.fetch(existing.channelId).catch(() => null);
            if (stillExists) {
                return interaction.reply({ content: `⚠️ عندك تقديم مفتوح بالفعل: <#${existing.channelId}>`, ephemeral: true });
            }
            delete db[key];
            activeApplications.delete(existing.channelId);
        }

        await interaction.deferReply({ ephemeral: true });

        const reviewRoleId = type === 'admin' ? ADMIN_TEAM_ROLE_ID : APPLICATION_TEAM_ROLE_ID;
        const appChannel = await interaction.guild.channels.create({
            name: `تقديم-${type === 'admin' ? 'اداره' : 'عادي'}-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: APPLICATIONS_CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: reviewRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
        });

        db[key] = { channelId: appChannel.id, type, status: 'open', answers: [] };
        saveDB(APPS_DB_PATH, db);
        activeApplications.set(appChannel.id, { userId: interaction.user.id, type, currentQuestion: 0, answers: [] });

        await appChannel.send({
            content: `أهلاً <@${interaction.user.id}> 👋\nبدأ تقديمك (${type === 'admin' ? 'إدارة' : 'عادي'}). جاوب على كل سؤال برسالة منفصلة.`,
            embeds: [buildQuestionEmbed(type, 0)]
        });
        await interaction.editReply({ content: `✅ تم فتح تقديمك: <#${appChannel.id}>` });
        return;
    }

    // ─── BUTTON: قبول / رفض تقديم ──────────
    if (interaction.isButton() && (interaction.customId.startsWith('app_accept_') || interaction.customId.startsWith('app_reject_'))) {
        const accepted = interaction.customId.startsWith('app_accept_');
        const targetUserId = interaction.customId.split('_')[2];
        const db = loadDB(APPS_DB_PATH);
        const appData = db[targetUserId];
        if (!appData) return interaction.reply({ content: '❌ بيانات التقديم غير موجودة.', ephemeral: true });

        if (accepted && PENDING_INTERVIEW_ROLE_ID) {
            try {
                const member = await interaction.guild.members.fetch(targetUserId);
                await member.roles.add(PENDING_INTERVIEW_ROLE_ID);
            } catch (err) { console.error('❌ خطأ في إضافة رول المعاينة:', err.message); }
        }

        try {
            const member = await interaction.guild.members.fetch(targetUserId);
            await member.send({ embeds: [buildResultEmbed(accepted)] }).catch(() => {
                interaction.channel.send({ content: `<@${targetUserId}>`, embeds: [buildResultEmbed(accepted)] });
            });
        } catch (err) { console.error('❌ خطأ في إرسال النتيجة:', err.message); }

        const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('app_done_accept').setLabel('قبول').setEmoji('✅').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('app_done_reject').setLabel('رفض').setEmoji('❌').setStyle(ButtonStyle.Danger).setDisabled(true)
        );
        await interaction.update({ components: [disabledRow] });
        await interaction.followUp({ content: `${accepted ? '✅ تم القبول' : '❌ تم الرفض'} بواسطة <@${interaction.user.id}>` });

        appData.status = accepted ? 'accepted' : 'rejected';
        saveDB(APPS_DB_PATH, db);

        setTimeout(async () => {
            try { await interaction.channel.delete(); } catch (e) { }
        }, 10000);
        return;
    }

    // ─── BUTTON: فتح تذكرة ──────────────────
    if (interaction.isButton() && interaction.customId === 'open_ticket') {
        const db = loadDB(TICKETS_DB_PATH);
        const key = interaction.user.id;
        const existing = db[key];
        if (existing && existing.status === 'open') {
            return interaction.reply({ content: `⚠️ عندك تذكرة مفتوحة بالفعل: <#${existing.channelId}>`, ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        const ticketChannel = await interaction.guild.channels.create({
            name: `تذكرة-${interaction.user.username}`,
            type: ChannelType.GuildText,
            parent: TICKETS_CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: SUPPORT_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
        });
        db[key] = { channelId: ticketChannel.id, status: 'open' };
        saveDB(TICKETS_DB_PATH, db);
        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );
        await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${SUPPORT_ROLE_ID}>`, embeds: [baseEmbed('#2B2D31', '🎫 تذكرة دعم').setDescription('اشرح مشكلتك أو طلبك وانتظر الرد.')], components: [closeRow] });
        await interaction.editReply({ content: `✅ تم فتح تذكرتك: <#${ticketChannel.id}>` });
        return;
    }

    // ─── BUTTON: إغلاق تذكرة ──────────────────
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        const db = loadDB(TICKETS_DB_PATH);
        const ownerId = Object.keys(db).find(uid => db[uid].channelId === interaction.channel.id);
        await interaction.reply({ content: '🔒 هيتم إغلاق التذكرة خلال 5 ثواني...' });
        if (ownerId) { db[ownerId].status = 'closed'; saveDB(TICKETS_DB_PATH, db); }
        setTimeout(async () => { try { await interaction.channel.delete(); } catch (e) { } }, 5000);
        return;
    }
});

// ============================================================
// ✅ استقبال إجابات التقديم كرسائل عادية
// ============================================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const app = activeApplications.get(message.channel.id);
    if (!app) return;
    if (message.author.id !== app.userId) return;

    app.answers.push(message.content);
    const db = loadDB(APPS_DB_PATH);
    if (db[app.userId]) db[app.userId].answers = app.answers;

    const questions = app.type === 'admin' ? ADMIN_QUESTIONS : REGULAR_QUESTIONS;
    if (app.currentQuestion + 1 < questions.length) {
        app.currentQuestion++;
        saveDB(APPS_DB_PATH, db);
        await message.channel.send({ embeds: [buildQuestionEmbed(app.type, app.currentQuestion)] });
    } else {
        saveDB(APPS_DB_PATH, db);
        const member = await message.guild.members.fetch(app.userId);
        const reviewRoleId = app.type === 'admin' ? ADMIN_TEAM_ROLE_ID : APPLICATION_TEAM_ROLE_ID;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`app_accept_${app.userId}`).setLabel('قبول').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`app_reject_${app.userId}`).setLabel('رفض').setEmoji('❌').setStyle(ButtonStyle.Danger)
        );
        await message.channel.send({
            content: `<@&${reviewRoleId}> التقديم خلص ✅ راجعوا الإجابات واتخذوا القرار 👇`,
            embeds: [buildSummaryEmbed(member, app.type, app.answers)],
            components: [row]
        });
        activeApplications.delete(message.channel.id);
    }
});

// ============================================================
// ✅ اللوجز (بان، كيك، رولات، رومات، رسايل، فويس)
// ============================================================
client.on('guildAuditLogEntryCreate', async (entry) => {
    const executor = entry.executor ? `<@${entry.executor.id}>` : 'غير معروف';
    switch (entry.action) {
        case AuditLogEvent.MemberBanAdd:
            await sendLog('ban', baseEmbed('#e74c3c', '🔨 حظر عضو').setDescription(`**العضو:** <@${entry.targetId}>\n**بواسطة:** ${executor}\n**السبب:** ${entry.reason || 'بدون سبب'}`));
            break;
        case AuditLogEvent.MemberBanRemove:
            await sendLog('unban', baseEmbed('#2ecc71', '✅ فك حظر عضو').setDescription(`**العضو:** <@${entry.targetId}>\n**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.MemberKick:
            await sendLog('kick', baseEmbed('#e67e22', '👢 طرد عضو').setDescription(`**العضو:** <@${entry.targetId}>\n**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.MemberUpdate:
            for (const change of entry.changes || []) {
                if (change.key === 'communication_disabled_until') {
                    await sendLog('timeout', baseEmbed('#f1c40f', '⏱️ تايم أوت').setDescription(`**العضو:** <@${entry.targetId}>\n**بواسطة:** ${executor}`));
                }
                if (change.key === 'nick') {
                    await sendLog('changeNickname', baseEmbed('#3498db', '✏️ تغيير نيك نيم').setDescription(`**العضو:** <@${entry.targetId}>\n**بواسطة:** ${executor}`));
                }
            }
            break;
        case AuditLogEvent.MemberRoleUpdate:
            for (const change of entry.changes || []) {
                if (change.key === '$add') for (const role of change.new || []) await sendLog('giveRole', baseEmbed('#2ecc71', '➕ إضافة رول').setDescription(`**العضو:** <@${entry.targetId}>\n**الرول:** <@&${role.id}>\n**بواسطة:** ${executor}`));
                if (change.key === '$remove') for (const role of change.new || []) await sendLog('removeRole', baseEmbed('#e74c3c', '➖ إزالة رول').setDescription(`**العضو:** <@${entry.targetId}>\n**الرول:** <@&${role.id}>\n**بواسطة:** ${executor}`));
            }
            break;
        case AuditLogEvent.RoleDelete:
            await sendLog('roleDeleted', baseEmbed('#e74c3c', '🗑️ حذف رول').setDescription(`**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.ChannelCreate:
            await sendLog('createChannel', baseEmbed('#2ecc71', '📁 إنشاء روم').setDescription(`**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.ChannelDelete:
            await sendLog('deleteChannel', baseEmbed('#e74c3c', '🗑️ حذف روم').setDescription(`**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.ChannelUpdate:
            await sendLog('editChannel', baseEmbed('#3498db', '✏️ تعديل روم').setDescription(`**الروم:** <#${entry.targetId}>\n**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.ChannelOverwriteCreate:
        case AuditLogEvent.ChannelOverwriteUpdate:
        case AuditLogEvent.ChannelOverwriteDelete:
            await sendLog('channelPermissions', baseEmbed('#9b59b6', '🔐 تعديل صلاحيات روم').setDescription(`**الروم:** <#${entry.targetId}>\n**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.MemberDisconnect:
            await sendLog('disconnectVoice', baseEmbed('#e74c3c', '🔌 فصل عضو من الفويس').setDescription(`**بواسطة:** ${executor}`));
            break;
        case AuditLogEvent.MemberMove:
            await sendLog('voiceMove', baseEmbed('#3498db', '➡️ نقل عضو في الفويس').setDescription(`**بواسطة:** ${executor}`));
            break;
    }
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (newMsg.author?.bot || oldMsg.content === newMsg.content) return;
    await sendLog('editMessage', baseEmbed('#3498db', '✏️ تعديل رسالة')
        .setDescription(`**العضو:** ${newMsg.author}\n**الروم:** <#${newMsg.channelId}>`)
        .addFields({ name: 'قبل', value: oldMsg.content?.slice(0, 1000) || '—' }, { name: 'بعد', value: newMsg.content?.slice(0, 1000) || '—' }));
});
client.on('messageDelete', async (msg) => {
    if (msg.author?.bot) return;
    await sendLog('deleteMessage', baseEmbed('#e74c3c', '🗑️ حذف رسالة')
        .setDescription(`**العضو:** ${msg.author || 'غير معروف'}\n**الروم:** <#${msg.channelId}>\n**المحتوى:** ${msg.content?.slice(0, 1000) || '—'}`));
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!oldState.channelId && newState.channelId) {
        return sendLog('joinVoice', baseEmbed('#2ecc71', '🎙️ دخول فويس').setDescription(`**العضو:** ${member}\n**الروم:** <#${newState.channelId}>`));
    }
    if (oldState.channelId && !newState.channelId) {
        return sendLog('voiceLeft', baseEmbed('#e67e22', '🚪 خروج من الفويس').setDescription(`**العضو:** ${member}\n**الروم:** <#${oldState.channelId}>`));
    }
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        return sendLog('voiceSwitched', baseEmbed('#3498db', '🔀 تبديل فويس').setDescription(`**العضو:** ${member}\n**من:** <#${oldState.channelId}>\n**إلى:** <#${newState.channelId}>`));
    }
    if (oldState.channel?.status !== newState.channel?.status) {
        await sendLog('voiceStatus', baseEmbed('#9b59b6', '💬 تغيير حالة الفويس').setDescription(`**الروم:** <#${newState.channelId}>`));
    }
});

client.login(TOKEN);
