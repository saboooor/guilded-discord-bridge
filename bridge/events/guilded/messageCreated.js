function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
const fs = require('fs');
const { UserType } = require('guilded.js');
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

	// Check if the author is a bot and if the bot is allowed to send messages
	if (message.member.user.type == UserType.Bot && bridge.exempt_bots) return;

	// Get cached messages
	let json = require(`../../../data/messages/${bridge.guilded.channelId}.json`);

	// Parse all replies in the message
	const replies = [];
	if (message.replyMessageIds[0]) {
		for (const replyId of message.replyMessageIds) {
			if (json.find(m => m.guilded == replyId)) {
				const replyMsg = (await discord.channels.cache.get(bridge.discord.channelId).messages.fetch({ around: json.find(m => m.guilded == replyId).discord, limit: 1 })).first();
				if (replyMsg) replies.push(`${replyMsg.author} \`${replyMsg.content}\``);
			}
			else {
				const replyMsg = await guilded.messages.fetch(bridge.guilded.channelId, replyId).catch(err => guilded.logger.error(err));
				if (!replyMsg) return;
				replyMsg.member = guilded.members.cache.get(`${replyMsg.serverId}:${replyMsg.createdById}`);
				if (!replyMsg.member) replyMsg.member = await guilded.members.fetch(replyMsg.serverId, replyMsg.createdById).catch(err => guilded.logger.error(err));
				if (!replyMsg.member) replyMsg.member = { user: { name: replyMsg.createdById } };
				replies.push(`**${replyMsg.member.user.name}** \`${replyMsg.content}\``);
			}
		}
	}
	if (replies[0]) message.content = `${replies.join('\n')}\n\n${message.content}`;

	// Change the webhook channel to the bridge's channel
	if (srv.discord.webhook && srv.discord.webhook.channel != bridge.discord.channelId) await srv.discord.webhook.edit({ channel: bridge.discord.channelId });

	// Get the nameformat from the configs
	const nameformat = (bridge.discord.nameformat ?? srv.discord.nameformat ?? config.discord.nameformat).replace(/{name}/g, message.member.user.name);

	// Send the message	to the discord server
	const webhookopt = {
		avatarURL: message.member.user.avatar,
		username: nameformat,
		content: message.content,
		embeds: message.raw.embeds,
	};
	if (config.debug) discord.logger.info(`Message created from Guilded: ${JSON.stringify(webhookopt)}`);
	const discordmsg = bridge.discord.webhook ? await bridge.discord.webhook.send(webhookopt) : srv.discord.webhook.send(webhookopt);

	// Cache the message for editing and deleting
	if (!config.message_cache || !config.message_cache.enabled) return;
	const obj = {
		guilded: message.id,
		discord: discordmsg.id,
		fromGuilded: true,
	};
	json.push(obj);
	if (config.debug) discord.logger.info(`Cached message from Guilded: ${JSON.stringify(obj)}`);
	fs.writeFileSync(`./data/messages/${bridge.guilded.channelId}.json`, JSON.stringify(json));

	// Delete old cached message if max messages is reached
	if (config.message_cache.max_messages && json.length > config.message_cache.max_messages) {
		if (config.debug) discord.logger.info(`Deleted old cached message from Guilded: ${JSON.stringify(json[0])}`);
		json.shift();
		fs.writeFileSync(`./data/messages/${bridge.guilded.channelId}.json`, JSON.stringify(json));
	}

	// Delete cached message after the amount of time specified in the config
	if (config.message_cache.timeout) {
		await sleep(config.message_cache.timeout * 1000);
		if (config.debug) discord.logger.info(`Deleted old cached message from Guilded: ${JSON.stringify(obj)}`);
		json = require(`../../../../data/messages/${bridge.guilded.channelId}.json`);
		json.splice(json.indexOf(obj), 1);
		fs.writeFileSync(`./data/messages/${bridge.guilded.channelId}.json`, JSON.stringify(json));
	}
};