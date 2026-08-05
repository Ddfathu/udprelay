const net = require('net');
const dgram = require('dgram');

const PORT = process.env.PORT || 8080;

const server = net.createServer((tcpSocket) => {
  // Map untuk menyimpan socket UDP aktif per-target agar session WebRTC/DNS tidak bentrok
  const udpSessions = new Map();

  tcpSocket.on('data', (chunk) => {
    try {
      const str = chunk.toString('latin1');
      const delimiterIndex = str.indexOf('|');

      if (delimiterIndex !== -1) {
        const header = str.substring(0, delimiterIndex);
        const payload = chunk.subarray(delimiterIndex + 1);
        const parts = header.split(':');

        if (parts.length === 3 && parts[0] === 'udp') {
          const targetHost = parts[1];
          const targetPort = parseInt(parts[2], 10);
          const sessionKey = `${targetHost}:${targetPort}`;

          let udpSocket = udpSessions.get(sessionKey);

          if (!udpSocket) {
            udpSocket = dgram.createSocket('udp4');

            // Tangkap balasan UDP dari Twilio -> Kirim ke TCP Worker
            udpSocket.on('message', (msg) => {
              if (!tcpSocket.destroyed) {
                // Tulis balik paket UDP mentah ke TCP Stream
                tcpSocket.write(msg);
              }
            });

            udpSocket.on('error', () => {
              try { udpSocket.close(); } catch(e){}
              udpSessions.delete(sessionKey);
            });

            udpSocket.on('close', () => {
              udpSessions.delete(sessionKey);
            });

            udpSessions.set(sessionKey, udpSocket);
          }

          if (payload.length > 0) {
            udpSocket.send(payload, targetPort, targetHost);
          }
        }
      } else {
        // Jika data berikutnya datang tanpa header baru (stream lanjutan)
        udpSessions.forEach((udpSocket, key) => {
          const [host, port] = key.split(':');
          udpSocket.send(chunk, parseInt(port, 10), host);
        });
      }
    } catch (err) {
      // Ignore framing errors
    }
  });

  function closeAllSessions() {
    udpSessions.forEach((soc) => {
      try { soc.close(); } catch(e){}
    });
    udpSessions.clear();
    if (!tcpSocket.destroyed) tcpSocket.destroy();
  }

  tcpSocket.on('close', closeAllSessions);
  tcpSocket.on('error', closeAllSessions);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[UDP RELAY WEBRTC READY] Listening on port ${PORT}`);
});
