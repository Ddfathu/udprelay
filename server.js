const net = require('net');
const dgram = require('dgram');

const PORT = process.env.PORT || 8080;

const server = net.createServer((socket) => {
  let udpSockets = new Map(); // Simpan session berdasarkan target (host:port)

  socket.on('data', (chunk) => {
    try {
      // Cari delimiter '|'
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

          let udpSocket = udpSockets.get(sessionKey);

          if (!udpSocket) {
            // Buat socket UDP baru untuk sesi target ini
            udpSocket = dgram.createSocket('udp4');

            udpSocket.on('message', (msg) => {
              if (!socket.destroyed) {
                socket.write(msg);
              }
            });

            udpSocket.on('error', () => {
              try { udpSocket.close(); } catch(e){}
              udpSockets.delete(sessionKey);
            });

            udpSocket.on('close', () => {
              udpSockets.delete(sessionKey);
            });

            udpSockets.set(sessionKey, udpSocket);
          }

          // Kirim payload data UDP
          if (payload.length > 0) {
            udpSocket.send(payload, targetPort, targetHost);
          }
        }
      }
    } catch (err) {
      console.error('[RELAY ERROR]', err.message);
    }
  });

  socket.on('close', () => {
    udpSockets.forEach((soc) => {
      try { soc.close(); } catch(e){}
    });
    udpSockets.clear();
  });

  socket.on('error', () => {
    socket.destroy();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[UDP RELAY UNILENTA ENGINE] Ready on port ${PORT}`);
});
