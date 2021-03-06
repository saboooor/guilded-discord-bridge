const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
module.exports = async (discord, guilded, config) => {
	// Create data folders if they don't exist
	if (!fs.existsSync('./data')) fs.mkdirSync('./data');

	// Load webhook clients and inject them into the servers object
	config.servers.forEach(async srv => {
		if (!srv.discord.serverId) return discord.logger.error('Discord serverId not specified in config!');

		// Get the discord server and check if it exists
		const discserver = await discord.guilds.fetch(srv.discord.serverId).catch(err => discord.logger.error(err));
		if (!discserver) return discord.logger.error(`${srv.discord.serverId} Discord server Id doesn't exist!`);

		// Load the webhooks
		const webhooks = (await discserver.fetchWebhooks()).filter(w => w.owner.id == discord.user.id);
		if (srv.discord.per_channel_webhooks) {
			for (const bridge of srv.channels) {
				// Get the channel's webhook
				let webhook = webhooks.find(w => w.channelId == bridge.discord.channelId);

				// If the webhook doesn't exist, create it
				if (!webhook) {
					const channel = discserver.channels.cache.get(bridge.discord.channelId);
					webhook = await channel.createWebhook('Guilded-Discord Bridge', { reason: 'Webhook for Guilded-Discord Bridge' }).catch(err => discord.logger.error(err));
					if (!webhook) return discord.logger.error(`${discserver.name}'s #${channel.name} Webhook couldn't be created!`);
					else discord.logger.warn(`${discserver.name}'s #${channel.name} Webhook wasn't found, so it was created.`);
				}

				// Inject the webhook into the channel's object
				bridge.discord.webhook = webhook;
			}
		}
		else {
			// Get the discord server's webhook
			let webhook = webhooks.first();

			// If the webhook doesn't exist, create it
			if (!webhook) {
				const channel = discserver.channels.cache.filter(c => c.isText()).first();
				webhook = await channel.createWebhook('Guilded-Discord Bridge', { reason: 'Webhook for Guilded-Discord Bridge' }).catch(err => discord.logger.error(err));
				if (!webhook) return discord.logger.error(`${discserver.name}'s Webhook couldn't be created!`);
				else discord.logger.warn(`${discserver.name}'s Webhook wasn't found, so it was created.`);
			}

			// Inject the webhook into the server's discord object
			srv.discord = {
				serverId: discserver.id,
				webhook,
			};
		}

		// Log
		discord.logger.info(`${discserver.name}'s Webhook loaded`);

		// Load list config
		if (srv.lists) {
			if (!fs.existsSync('./data/lists')) fs.mkdirSync('./data/lists');
			for (const list of srv.lists) {
				if (!fs.existsSync(`./data/lists/${list.guilded.channelId}.json`)) fs.writeFileSync(`./data/lists/${list.guilded.channelId}.json`, '{}');
				const guilchannel = await guilded.channels.fetch(list.guilded.channelId);
				const discchannel = await discord.channels.cache.get(list.discord.channelId);
				const json = require(`../data/lists/${list.guilded.channelId}.json`);
				if (!json.items) {
					const items = await guilchannel.getItems();
					json.items = [];
					for (const item of items) {
						let member = guilded.members.cache.get(`${item.serverId}:${item.createdBy}`);
						if (!member) member = await guilded.members.fetch(item.serverId, item.createdBy).catch(err => guilded.logger.error(err));

						const ItemEmbed = new EmbedBuilder()
							.setColor(0x2f3136)
							.setTitle(item.message)
							.setTimestamp(Date.parse(item.updatedAt ?? item.createdAt));
						if (item.note && item.note.content) ItemEmbed.setDescription(item.note.content);

						const row = new ActionRowBuilder()
							.addComponents([
								new ButtonBuilder()
									.setEmoji({ name: '????' })
									.setCustomId(`list_toggle_${item.id}`)
									.setStyle(ButtonStyle.Secondary),
								new ButtonBuilder()
									.setEmoji({ name: '????' })
									.setCustomId(`list_note_${item.id}`)
									.setStyle(ButtonStyle.Secondary),
							]);

						const msg = await discchannel.send({ embeds: [ItemEmbed], components: [row] });

						json.items.push({
							id: item.id,
							messageId: msg.id,
						});

					}
					fs.writeFileSync(`./data/lists/${list.guilded.channelId}.json`, JSON.stringify(json));
				}
			}
		}

		// Load doc config
		if (srv.docs) {
			if (!fs.existsSync('./data/docs')) fs.mkdirSync('./data/docs');
			for (const doclist of srv.docs) {
				if (!fs.existsSync(`./data/docs/${doclist.guilded.channelId}.json`)) fs.writeFileSync(`./data/docs/${doclist.guilded.channelId}.json`, '{}');
				const guilchannel = await guilded.channels.fetch(doclist.guilded.channelId);
				const discchannel = await discord.channels.cache.get(doclist.discord.channelId);
				const json = require(`../data/docs/${doclist.guilded.channelId}.json`);
				if (!json.docs) {
					const docs = await guilchannel.getDocs();
					json.docs = [];
					for (const doc of docs) {
						let member = guilded.members.cache.get(`${doc.serverId}:${doc.createdBy}`);
						if (!member) member = await guilded.members.fetch(doc.serverId, doc.createdBy).catch(err => guilded.logger.error(err));

						const docEmbed = new EmbedBuilder()
							.setColor(0x2f3136)
							.setTitle(doc.title)
							.setDescription(doc.content)
							.setTimestamp(Date.parse(doc.updatedAt ?? doc.createdAt));

						const row = new ActionRowBuilder()
							.addComponents([
								new ButtonBuilder()
									.setEmoji({ name: '????' })
									.setCustomId(`doc_edit_${doc.id}`)
									.setStyle(ButtonStyle.Secondary),
							]);

						const msg = await discchannel.send({ embeds: [docEmbed], components: [row] });

						json.docs.push({
							id: doc.id,
							messageId: msg.id,
						});

					}
					fs.writeFileSync(`./data/docs/${doclist.guilded.channelId}.json`, JSON.stringify(json));
				}
			}
		}

		// Load text config
		if (srv.channels) {
			if (!fs.existsSync('./data/messages')) fs.mkdirSync('./data/messages');
			for (const bridge of srv.channels) {
				if (config.message_cache && config.message_cache.enabled && !config.message_cache.timeout && !config.message_cache.max_messages && !fs.existsSync(`./data/messages/${bridge.guilded.channelId}.json`)) {
					fs.writeFileSync(`./data/messages/${bridge.guilded.channelId}.json`, '[]');
				}
				else {
					fs.writeFileSync(`./data/messages/${bridge.guilded.channelId}.json`, '[]');
				}
			}
		}
	});

	// Load events
	[discord, guilded].forEach(client => {
		let count = 0;
		const files = fs.readdirSync(`./bridge/events/${client.type.name}/`);
		files.forEach(file => {
			if (!file.endsWith('.js')) {
				const subfiles = fs.readdirSync(`./bridge/events/${client.type.name}/${file}`).filter(subfile => subfile.endsWith('.js'));
				subfiles.forEach(subfile => {
					const event = require(`./events/${client.type.name}/${file}/${subfile}`);
					client.on(file, event.bind(null, discord, guilded, config));
					delete require.cache[require.resolve(`./events/${client.type.name}/${file}/${subfile}`)];
					count++;
				});
				return;
			}
			const event = require(`./events/${client.type.name}/${file}`);
			const eventName = file.split('.')[0];
			client.on(eventName, event.bind(null, discord, guilded, config));
			delete require.cache[require.resolve(`./events/${client.type.name}/${file}`)];
			count++;
		});
		client.logger.info(`${count} event listeners loaded`);
	});
};