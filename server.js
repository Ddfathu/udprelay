const net = require('net');
const dgram = require('dgram');

const PORT = process.env.PORT || 8080;

const server = net.createServer((tcpSocket) => {
  let udpSocket = null;
  let targetHost = null;
  let targetPort = null;
  let isHandshakeDone = false;

  tcpSocket.on('data', (chunk) => {
    // 1. Parsing Header 'udp:host:port|'
    if (!isHandshakeDone) {
      const str = chunk.toString('latin1');
      const delimiterIndex = str.indexOf('|');

      if (delimiterIndex !== -1) {
        const header = str.substring(0, delimiterIndex);
        const payload = chunk.subarray(delimiterIndex + 1);

        const parts = header.split(':');
        if (parts.length === 3 && parts[0] === 'udp') {
          targetHost = parts[1];
          targetPort = parseInt(parts[2], 10);
          isHandshakeDone = true;

          // Buat Socket UDP
          udpSocket = dgram.createSocket('udp4');

          // FAST-FORWARD: Tangkap balasan UDP dan TULIS LANGSUNG ke TCP
          udpSocket.on('message', (msg) => {
            if (!tcpSocket.destroyed) {
              tcpSocket.write(msg);
            }
          });

          udpSocket.on('error', () => {
            cleanup();
          });

          udpSocket.on('close', () => {
            cleanup();
          });

          // Kirim payload awal (misal kueri DNS)
          if (payload.length > 0) {
            udpSocket.send(payload, targetPort, targetHost);
          }
        } else {
          cleanup();
        }
      }
    } else {
      // 2. Jika Handshake sudah beres, kirim sisa data langsung
      if (udpSocket && chunk.length > 0) {
        udpSocket.send(chunk, targetPort, targetHost);
      }
    }
  });

  function cleanup() {
    if (udpSocket) {
      try { udpSocket.close(); } catch(e){}
      udpSocket = null;
    }
    if (!tcpSocket.destroyed) {
      tcpSocket.destroy();
    }
  }

  tcpSocket.on('close', cleanup);
  tcpSocket.on('error', cleanup);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[UDP RELAY FAST-LOOP] Running on port ${PORT}`);
});
