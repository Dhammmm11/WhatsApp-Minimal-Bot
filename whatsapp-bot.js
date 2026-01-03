#!/usr/bin/env node
/**
 * WhatsApp Bot - FIXED VERSION
 * Fixed: logger.child error
 * Author: Marr
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino'); // ✅ FIX: Tambah pino
const readline = require('readline');
const fs = require('fs');

// Config
const CONFIG = {
    BOT_NAME: "VOID-TAG-BOT",
    PREFIX: "!",
    SESSION_PATH: "./sessions"
};

console.log(`
╔══════════════════════════════════╗
║     WHATSAPP BOT BY MARR         ║
║     Fixed Version                ║
╚══════════════════════════════════╝
`);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function showMenu() {
    console.log('\n📱 LOGIN METHOD:');
    console.log('1. QR Code');
    console.log('2. Pairing Code');
    console.log('3. Exit');
    
    rl.question('Choose (1-3): ', async (choice) => {
        if (choice === '1') {
            await startBot('qr');
        } else if (choice === '2') {
            rl.question('Enter WhatsApp number (628xxxxxxx): ', async (number) => {
                await startBot('pairing', number.replace(/\D/g, ''));
            });
        } else if (choice === '3') {
            console.log('👋 Bye!');
            rl.close();
            process.exit(0);
        } else {
            console.log('❌ Invalid!');
            showMenu();
        }
    });
}

async function startBot(loginMethod, phoneNumber = null) {
    console.log(`\n🚀 Starting with ${loginMethod.toUpperCase()}...`);
    
    if (!fs.existsSync(CONFIG.SESSION_PATH)) {
        fs.mkdirSync(CONFIG.SESSION_PATH, { recursive: true });
    }
    
    try {
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_PATH);
        const { version } = await fetchLatestBaileysVersion();
        
        // ✅ FIX: Gunakan pino sebagai logger
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }), // ✅ INI FIXNYA
            printQRInTerminal: loginMethod === 'qr',
            auth: state,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false
        });
        
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && loginMethod === 'qr') {
                console.log('\n🔗 Scan QR dengan WhatsApp:');
                qrcode.generate(qr, { small: true });
            }
            
            if (connection === 'open') {
                console.log('\n✅ Connected!');
                console.log(`🤖 Bot: ${CONFIG.BOT_NAME}`);
                console.log(`📞 Number: ${sock.user?.id?.split(':')[0]}`);
                console.log('💡 Commands: !tagall, !hidetag, !menu');
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log('Reconnecting...');
                    startBot(loginMethod, phoneNumber);
                }
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        // Pairing Code
        if (loginMethod === 'pairing' && phoneNumber) {
            try {
                const pairingCode = await sock.requestPairingCode(phoneNumber);
                console.log('\n📱 PAIRING CODE:');
                console.log('='.repeat(30));
                console.log(`Number: ${phoneNumber}`);
                console.log(`Code: ${pairingCode}`);
                console.log('='.repeat(30));
                console.log('\nEnter this code in WhatsApp:');
                console.log('Settings → Linked Devices → Link a Device');
                
                fs.writeFileSync('./pairing_code.txt', 
                    `Number: ${phoneNumber}\nCode: ${pairingCode}`);
            } catch (error) {
                console.log('❌ Failed to get pairing code:', error.message);
            }
        }
        
        // Message handler
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            const from = msg.key.remoteJid;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            
            // Auto read
            await sock.readMessages([msg.key]);
            
            if (text.startsWith(CONFIG.PREFIX + 'tagall')) {
                try {
                    const group = await sock.groupMetadata(from);
                    const members = group.participants;
                    const mentions = members.map(m => m.id);
                    const message = text.replace(CONFIG.PREFIX + 'tagall', '').trim() || 'Hello everyone!';
                    
                    await sock.sendMessage(from, {
                        text: `📢 ${message}\n\n${members.map(m => `@${m.id.split('@')[0]}`).join(' ')}`,
                        mentions: mentions
                    });
                    
                    console.log(`✓ Tagged ${members.length} members`);
                } catch (e) {
                    console.log('❌ Tagall failed');
                }
            }
            
            if (text.startsWith(CONFIG.PREFIX + 'hidetag')) {
                try {
                    const group = await sock.groupMetadata(from);
                    const members = group.participants;
                    const mentions = members.map(m => m.id);
                    const message = text.replace(CONFIG.PREFIX + 'hidetag', '').trim() || 'Hidden message';
                    
                    await sock.sendMessage(from, {
                        text: `\u200B${message}`,
                        mentions: mentions
                    });
                    
                    console.log(`✓ Hidden tag ${members.length} members`);
                } catch (e) {
                    console.log('❌ Hidetag failed');
                }
            }
            
            if (text.startsWith(CONFIG.PREFIX + 'menu')) {
                await sock.sendMessage(from, {
                    text: `🤖 *${CONFIG.BOT_NAME}*\n\nCommands:\n• ${CONFIG.PREFIX}tagall [message]\n• ${CONFIG.PREFIX}hidetag [message]\n• ${CONFIG.PREFIX}menu\n\nBy Marr`
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

showMenu();

process.on('SIGINT', () => {
    console.log('\n🛑 Stopped');
    rl.close();
    process.exit(0);
});
