const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
module.exports = async (discord, guilded, config, message) => {
	// Check if the message is by a bot
	if (message.author.bot) return;

	// Get the server config and check if it exists
	const srv = config.servers.find(s => s.discord.serverId == message.guild.id);
	if (!srv || !srv.docs) return;

	// Get the channel config and check if it exists
	const docbridge = srv.docs.find(b => b.discord.channelId == message.channel.id);
	if (!docbridge) return;

	// Delete the message
	message.delete();

	// Check if member has the required permission
	if (!message.member.permissionsIn(message.channel).has(PermissionsBitField.Flags[docbridge.discord.permission])) return;

	// Create the guilded doc
	const msgcontent = message.content.split('\n');
	const title = msgcontent.shift();
	const content = msgcontent.join('\n');
	if (!content || !title) return message.member.send('**Invalid document**\nPlease put the title in the first line and use a new line for the content.');
	if (config.debug) guilded.logger.info(`Doc create from Discord: ${JSON.stringify({ title, content })}`);
	const doc = await guilded.docs.create(docbridge.guilded.channelId, { title, content });

	// Create Embed with doc info
	const docEmbed = new EmbedBuilder()
		.setColor(0x2f3136)
		.setTitle(title)
		.setDescription(content)
		.setTimestamp(Date.parse(doc.createdAt));

	// Create row with buttons to edit
	const row = new ActionRowBuilder()
		.addComponents([
			new ButtonBuilder()
				.setEmoji({ name: '📝' })
				.setCustomId(`doc_edit_${doc.id}`)
				.setStyle(ButtonStyle.Secondary),
		]);

	// Send message
	const msg = await message.channel.send({ embeds: [docEmbed], components: [row] });

	const json = require(`../../../../data/docs/${doc.channelId}.json`);
	json.docs.push({
		id: doc.id,
		messageId: msg.id,
	});
	fs.writeFileSync(`./data/docs/${doc.channelId}.json`, JSON.stringify(json));
};