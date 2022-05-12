function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
const { MessageMentions: { ChannelsPattern, RolesPattern, UsersPattern } } = require('discord.js');
const { Embed } = require('guilded.js');
module.exports = async (discord, guilded, config, message) => {
	// Get the server config and check if it exists
	const srv = config.servers.find(s => s.discord.serverId == message.guild.id);
	if (!srv) return;

	// Check if the message is by the bot or webhook
	if (message.author.id == discord.user.id || message.webhookId == srv.discord.webhook.id) return;

	// Get the channel config and check if it exists
	const bridge = srv.channels.find(b => b.discord.channelId == message.channel.id);
	if (!bridge) return;

	// Parse all channel mentions
	const channelMatches = [...message.content.matchAll(ChannelsPattern)];
	channelMatches.forEach(match => {
		const channel = discord.channels.cache.get(match[1]);
		message.content = message.content.replace(match[0], `#${channel.name}`);
	});

	// Parse all role mentions
	const roleMatches = [...message.content.matchAll(RolesPattern)];
	roleMatches.forEach(match => {
		const role = message.guild.roles.cache.get(match[1]);
		message.content = message.content.replace(match[0], `@${role.name}`);
	});

	// Parse all user mentions
	const userMatches = [...message.content.matchAll(UsersPattern)];
	userMatches.forEach(match => {
		const user = discord.users.cache.get(match[1]);
		message.content = message.content.replace(match[0], `@${user.tag}`);
	});

	const sticker = message.stickers.first();
	if (sticker) {
		const imgurl = sticker.url;
		if (imgurl.endsWith('json')) return discord.logger.info('Sticker is a JSON file, not supported yet, skipping...');
		const stickerEmbed = new Embed()
			.setTitle(`**Sticker:** ${sticker.name}`)
			.setImage(imgurl)
			.setColor(0x32343d);
		message.embeds.push(stickerEmbed);
	}

	const attachment = message.attachments.first();
	if (attachment) {
		const imgurl = attachment.url;
		const attachEmbed = new Embed()
			.setColor(0x32343d)
			.setTitle('**Attachment**')
			.setDescription(`**[${attachment.name}](${imgurl})**`);
		if (attachment.contentType.split('/')[0] == 'image') attachEmbed.setImage(imgurl);
		message.embeds.push(attachEmbed);
	}

	// Get the nameformat from the configs
	const nameformat = (bridge.guilded.nameformat ?? srv.guilded.nameformat ?? config.guilded.nameformat).replace(/{name}/g, message.author.tag);

	// Send the message	to the guilded server
	const guildedmsg = message.embeds ?
		await srv.guilded.whclient.send(`${nameformat}${message.content}`, message.embeds) :
		await guilded.messages.send(bridge.guilded.channelId, { content: `${nameformat}${message.content}` });

	// Cache the message for editing and deleting
	if (!config.message_expiry) return;
	if (!bridge.messages) bridge.messages = {};
	const { id, channelId } = guildedmsg;
	bridge.messages[message.id] = { id, channelId };

	// Delete cached message after the amount of time specified in the config
	await sleep(config.message_expiry * 1000);
	delete bridge.messages[message.id];
};