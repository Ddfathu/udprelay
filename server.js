const net = require('net');
const dgram = require('dgram');

const PORT = process.env.PORT || 8080;

const server = net.createServer((tcpSocket) => {
  let udpSocket = null;
  let targetHost = null;
  let targetPort = null;
  let isHeaderParsed = false;
  let accumulatedBuffer = Buffer.alloc(0);

  tcpSocket.on('data', (chunk) => {
    // Gabungkan chunk data baru ke buffer penampung
    accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);

    // 1. Parsing Header jika belum berhasil diparsing
    if (!isHeaderParsed) {
      const delimiterIndex = accumulatedBuffer.indexOf('|');

      if (delimiterIndex !== -1) {
        const headerStr = accumulatedBuffer.subarray(0, delimiterIndex).toString('latin1');
        const remainingPayload = accumulatedBuffer.subarray(delimiterIndex + 1);

        const parts = headerStr.split(':');
        if (parts.length === 3 && parts[0] === 'udp') {
          targetHost = parts[1];
          targetPort = parseInt(parts[2], 10);
          isHeaderParsed = true;

          // Inisialisasi Socket UDP
          udpSocket = dgram.createSocket('udp4');

          // Terima respon UDP dari Internet -> Kirim balik ke Worker (TCP)
          udpSocket.on('message', (msg) => {
            if (!tcpSocket.destroyed) {
              tcpSocket.write(msg);
            }
          });

          udpSocket.on('error', () => cleanup());
          udpSocket.on('close', () => cleanup());

          // Kirim sisa payload jika ada data setelah tanda '|'
          if (remainingPayload.length > 0) {
            udpSocket.send(remainingPayload, targetPort, targetHost);
            accumulatedBuffer = Buffer.alloc(0); // Kosongkan buffer
          }
        } else {
          // Format header salah
          cleanup();
        }
      }
    } else {
      // 2. Header sudah ter-parse, langsung kirim seluruh data berikutnya via UDP
      if (udpSocket && accumulatedBuffer.length > 0) {
        udpSocket.send(accumulatedBuffer, targetPort, targetHost);
        accumulatedBuffer = Buffer.alloc(0); // Kosongkan buffer
      }
    }
  });

  function cleanup() {
    if (udpSocket) {
      try { udpSocket.close(); } catch (e) {}
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
  console.log(`[UDP RELAY STATE-MACHINE] Ready on port ${PORT}`);
});
