const { makeWASocket, useMultiFileAuthState, downloadContentFromMessage, jidDecode } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { createSticker, StickerTypes } = require('wa-sticker-formatter');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());

let socket;

async function connectWhatsapp() {
  const auth = await useMultiFileAuthState("session");
  socket = makeWASocket({
    printQRInTerminal: true,
    browser: ["YGTECH", "", ""],
    auth: auth.state,
    logger: pino({ level: "silent" }),
  });

  socket.ev.on("creds.update", auth.saveCreds);
  socket.ev.on("connection.update", async ({ connection }) => {
    if (connection === "open") {
      console.log("BOT WHATSAPP SUDAH SIAP✅ -- BY YGTECH!");
    } else if (connection === "close") {
      console.log("Connection closed. Reconnecting...");
      await connectWhatsapp();
    }
  });

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    const chat = messages[0];
    const pesan = (chat.message?.extendedTextMessage?.text ?? chat.message?.ephemeralMessage?.message?.extendedTextMessage?.text ?? chat.message?.conversation)?.toLowerCase() || "";
    const command = pesan.split(" ")[0];

    switch (command) {
      case "test":
        await socket.sendMessage(chat.key.remoteJid, { text: "Ini adalah pesan otomatis" }, { quoted: chat });
        break;

      case ".h":
      case ".hidetag":
        const args = pesan.split(" ").slice(1).join(" ");

        if (!chat.key.remoteJid.includes("@g.us")) {
          await socket.sendMessage(chat.key.remoteJid, { text: "*Command ini hanya bisa di gunakan di grub!!*" }, { quoted: chat });
          return;
        }

        const metadata = await socket.groupMetadata(chat.key.remoteJid);
        const participants = metadata.participants.map((v) => v.id);

        socket.sendMessage(chat.key.remoteJid, {
          text: args,
          mentions: participants
        });

        break;
    }

    if (chat.message?.imageMessage?.caption == '.sticker' && chat.message?.imageMessage) {
      const getMedia = async (msg) => {
        const messageType = Object.keys(msg?.message)[0];
        const stream = await downloadContentFromMessage(msg.message[messageType], messageType.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        return buffer;
      };

      const mediaData = await getMedia(chat);
      const stickerOption = {
        pack: "DapaSticker",
        author: "DapiCode",
        type: StickerTypes.FULL,
        quality: 50
      };

      const generateSticker = await createSticker(mediaData, stickerOption);
      await socket.sendMessage(chat.key.remoteJid, { sticker: generateSticker });
    }
  });
}

connectWhatsapp();

const targetNumber = 
// API endpoint to send message
app.post('/sendMessage', async (req, res) => {
  const { remoteJid, text } = req.body;

  if (!remoteJid || !text) {
    return res.status(400).json({ error: 'remoteJid and text are required' });
  }

  try {
    console.log(`Sending message to ${remoteJid}: ${text}`);
    const decodedJid = jidDecode(remoteJid);
    if (!decodedJid || !decodedJid.user) {
      return res.status(400).json({ error: 'Invalid JID' });
    }

    await socket.sendMessage(remoteJid, { text });
    console.log('Message sent successfully');
    res.status(200).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Failed to send message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
