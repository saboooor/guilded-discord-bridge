function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
module.exports = async (discord, guilded, config, message) => {
	// Get the server config and check if it exists
	const srv = config.servers.find(s => s.guilded.serverId == message.serverId);
	if (!srv) return;

	// Check if the message is by the bot or has no content or embeds
	if (message.createdById == guilded.user.id || (!message.content && !message.raw.embeds)) return;

	// Get the channel config and check if it exists
	const bridge = srv.channels.find(b => b.guilded.channelId == message.channelId);
	if (!bridge) return;

	// Get the message author and check if it exists
	message.member = guilded.members.cache.get(`${message.serverId}:${message.createdById}`);
	if (!message.member) message.member = await guilded.members.fetch(message.serverId, message.createdById).catch(err => guilded.logger.error(err));
	if (!message.member) return;

	// Change the webhook channel to the bridge's channel
	await srv.discord.webhook.edit({ channel: bridge.discord.channelId });

	// Get the nameformat from the configs
	const nameformat = (bridge.discord.nameformat ?? srv.discord.nameformat ?? config.discord.nameformat).replace(/{name}/g, message.member.user.name);

	// Send the message	to the discord server
	const discordmsg = await srv.discord.webhook.send({
		avatarURL: message.member.user.avatar,
		username: nameformat,
		content: message.content,
		embeds: message.raw.embeds,
	});

	// Cache the message for editing and deleting
	if (!config.message_expiry) return;
	if (!bridge.messages) bridge.messages = {};
	bridge.messages[message.id] = discordmsg.id;

	// Delete cached message after the amount of time specified in the config
	await sleep(config.message_expiry * 1000);
	delete bridge.messages[message.id];
};