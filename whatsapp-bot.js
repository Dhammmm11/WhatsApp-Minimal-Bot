#!/usr/bin/env node
/**
 * WhatsApp Minimalist Bot
 * Features: TagAll & HideTag Only
 * Author: Marr
 * Repository: github.com/Dhammmm11/WhatsApp-Minimal-Bot
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// CONFIGURASI
const CONFIG = {
    BOT_NAME: "VOID-TAG-BOT",
    PREFIX: "!",
    SESSION_PATH: "./sessions",
    MAX_TAG_MEMBERS: 100,
    VERSION: "1.0"
};

// Banner
console.log(`
╔══════════════════════════════════════╗
║     WHATSAPP TAG BOT BY MARR         ║
║     Features: !tagall & !hidetag     ║
║     Version: ${CONFIG.VERSION}                      ║
╚══════════════════════════════════════╝
`);

// Menu Interaktif
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function showMenu() {
    console.log('\n📱 PILIH METODE LOGIN:');
    console.log('1. QR Code (Scan dengan WhatsApp)');
    console.log('2. Pairing Code (Masukkan nomor)');
    console.log('3. Keluar');
    
    rl.question('Pilih (1-3): ', async (choice) => {
        switch(choice) {
            case '1':
                await startBot('qr');
                break;
            case '2':
                rl.question('Masukkan nomor WhatsApp (628xxxxxxx): ', async (number) => {
                    await startBot('pairing', number.replace(/\D/g, ''));
                });
                break;
            case '3':
                console.log('👋 Sampai jumpa!');
                rl.close();
                process.exit(0);
                break;
            default:
                console.log('❌ Pilihan tidak valid!');
                showMenu();
        }
    });
}

// Main Bot Function
async function startBot(loginMethod, phoneNumber = null) {
    console.log(`\n🚀 Memulai bot dengan metode: ${loginMethod.toUpperCase()}...`);
    
    // Buat folder session
    if (!fs.existsSync(CONFIG.SESSION_PATH)) {
        fs.mkdirSync(CONFIG.SESSION_PATH, { recursive: true });
    }
    
    try {
        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_PATH);
        const { version } = await fetchLatestBaileysVersion();
        
        // Buat socket WhatsApp
        const sock = makeWASocket({
            version,
            logger: { level: 'silent' },
            printQRInTerminal: loginMethod === 'qr',
            auth: state,
            browser: Browsers.ubuntu('Chrome'),
            syncFullHistory: false
        });
        
        // Handle connection
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr && loginMethod === 'qr') {
                console.log('\n🔗 Scan QR Code dengan WhatsApp:');
                console.log('1. Buka WhatsApp → Settings → Linked Devices');
                console.log('2. Pilih "Link a Device"');
                console.log('3. Scan QR di bawah:\n');
                qrcode.generate(qr, { small: true });
                
                // Save QR untuk Termux
                if (process.env.TERMUX_VERSION) {
                    fs.writeFileSync('/sdcard/whatsapp_qr.txt', qr);
                    console.log('\n📁 QR disimpan di: /sdcard/whatsapp_qr.txt');
                }
            }
            
            if (connection === 'open') {
                console.log('\n✅ Berhasil terhubung ke WhatsApp!');
                console.log(`🤖 Bot: ${CONFIG.BOT_NAME}`);
                console.log(`📞 Nomor: ${sock.user?.id?.split(':')[0] || 'Unknown'}`);
                console.log(`⚡ Prefix: ${CONFIG.PREFIX}`);
                console.log('='.repeat(40));
                console.log('💡 Command tersedia:');
                console.log(`• ${CONFIG.PREFIX}tagall [pesan]`);
                console.log(`• ${CONFIG.PREFIX}hidetag [pesan]`);
                console.log(`• ${CONFIG.PREFIX}menu`);
                console.log('='.repeat(40));
                console.log('\n🔄 Bot siap menerima command...\n');
                
                // Auto simpan credentials
                sock.ev.on('creds.update', saveCreds);
            }
            
            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                if (reason === DisconnectReason.loggedOut) {
                    console.log('❌ Logged out! Hapus folder sessions/ dan login ulang.');
                    process.exit(1);
                } else {
                    console.log('⏸️  Koneksi terputus, mencoba reconnect...');
                    startBot(loginMethod, phoneNumber);
                }
            }
        });
        
        // Pairing Code System
        if (loginMethod === 'pairing' && phoneNumber) {
            try {
                const pairingCode = await sock.requestPairingCode(phoneNumber);
                console.log('\n📱 PAIRING CODE:');
                console.log('='.repeat(30));
                console.log(`Nomor: ${phoneNumber}`);
                console.log(`Kode: ${pairingCode}`);
                console.log('='.repeat(30));
                console.log('\n📌 Cara pakai:');
                console.log('1. Buka WhatsApp → Settings → Linked Devices');
                console.log('2. Pilih "Link a Device"');
                console.log('3. Masukkan kode pairing di atas');
                
                // Save pairing code
                fs.writeFileSync('./pairing_code.txt', 
                    `Nomor: ${phoneNumber}\nKode: ${pairingCode}\nWaktu: ${new Date().toLocaleString()}`);
            } catch (error) {
                console.log('❌ Gagal mendapatkan pairing code!');
                console.log('Error:', error.message);
                process.exit(1);
            }
        }
        
        // Message Handler
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            await handleMessage(sock, msg);
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Message Handler
async function handleMessage(sock, msg) {
    try {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const isGroup = from.endsWith('@g.us');
        
        // Extract message text
        let body = '';
        const msgType = Object.keys(msg.message)[0];
        
        if (msgType === 'conversation') {
            body = msg.message.conversation;
        } else if (msgType === 'extendedTextMessage') {
            body = msg.message.extendedTextMessage.text;
        }
        
        // Log pesan
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${isGroup ? 'GROUP' : 'PV'} ${sender.split('@')[0]}: ${body.substring(0, 50)}...`);
        
        // Auto read
        await sock.readMessages([msg.key]);
        
        // Check prefix
        if (!body.startsWith(CONFIG.PREFIX)) return;
        
        // Parse command
        const args = body.slice(CONFIG.PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const text = args.join(' ');
        
        // Command handler
        switch(command) {
            case 'tagall':
                if (!isGroup) {
                    await sock.sendMessage(from, { text: '❌ Command ini hanya untuk grup!' });
                    return;
                }
                
                const group1 = await sock.groupMetadata(from);
                if (group1.participants.length > CONFIG.MAX_TAG_MEMBERS) {
                    await sock.sendMessage(from, { 
                        text: `❌ Member terlalu banyak (max: ${CONFIG.MAX_TAG_MEMBERS})` 
                    });
                    return;
                }
                
                const mentions1 = group1.participants.map(p => p.id);
                const mentionText1 = group1.participants.map(p => `@${p.id.split('@')[0]}`).join(' ');
                const message1 = text || '📢 Attention semua member!';
                
                await sock.sendMessage(from, {
                    text: `📢 TAG ALL\n\n${message1}\n\n${mentionText1}`,
                    mentions: mentions1
                });
                
                console.log(`✅ Tagall executed (${group1.participants.length} members)`);
                break;
                
            case 'hidetag':
                if (!isGroup) {
                    await sock.sendMessage(from, { text: '❌ Command ini hanya untuk grup!' });
                    return;
                }
                
                const group2 = await sock.groupMetadata(from);
                const mentions2 = group2.participants.map(p => p.id);
                const message2 = text || '👻 Pesan rahasia';
                
                // Zero-width space + hidden mentions
                const invisibleChar = '\u200B';
                const hiddenSpace = '‎'.repeat(5);
                
                await sock.sendMessage(from, {
                    text: `${invisibleChar}${hiddenSpace}${message2}${hiddenSpace}`,
                    mentions: mentions2
                });
                
                console.log(`✅ Hidetag executed (${group2.participants.length} members)`);
                break;
                
            case 'menu':
            case 'help':
                const helpText = `🤖 *${CONFIG.BOT_NAME}*\n\n` +
                               `*Command Tersedia:*\n` +
                               `• ${CONFIG.PREFIX}tagall [pesan] - Tag semua member\n` +
                               `• ${CONFIG.PREFIX}hidetag [pesan] - Tag tanpa notif\n` +
                               `• ${CONFIG.PREFIX}menu - Tampilkan ini\n\n` +
                               `_Made by Marr • github.com/Dhammmm11_`;
                await sock.sendMessage(from, { text: helpText });
                break;
                
            case 'ping':
                const start = Date.now();
                await sock.sendMessage(from, { text: '🏓 Pong!' });
                const latency = Date.now() - start;
                await sock.sendMessage(from, { 
                    text: `⏱️ Latency: ${latency}ms\n✅ Bot aktif!` 
                });
                break;
                
            default:
                await sock.sendMessage(from, { 
                    text: `❌ Command tidak dikenal!\nKetik ${CONFIG.PREFIX}menu untuk bantuan.` 
                });
        }
        
    } catch (error) {
        console.error('❌ Error handling message:', error.message);
    }
}

// Handle exit
process.on('SIGINT', () => {
    console.log('\n🛑 Bot dihentikan...');
    rl.close();
    process.exit(0);
});

// Start menu
showMenu();
