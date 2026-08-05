const net = require('net');
const dgram = require('dgram');

const PORT = process.env.PORT || 8080;

const server = net.createServer((socket) => {
  let udpSocket = null;
  let targetHost = null;
  let targetPort = null;
  let headerParsed = false;
  let bufferAcc = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    if (!headerParsed) {
      bufferAcc = Buffer.concat([bufferAcc, chunk]);
      const str = bufferAcc.toString('latin1');
      const delimiterIndex = str.indexOf('|');

      if (delimiterIndex !== -1) {
        const header = str.substring(0, delimiterIndex);
        const payload = bufferAcc.subarray(delimiterIndex + 1);
        
        const parts = header.split(':');
        if (parts.length === 3 && parts[0] === 'udp') {
          targetHost = parts[1];
          targetPort = parseInt(parts[2], 10);
          headerParsed = true;

          // Buat UDP Socket
          udpSocket = dgram.createSocket('udp4');

          // Terima balasan dari internet -> Forward balik ke Worker
          udpSocket.on('message', (msg) => {
            if (!socket.destroyed) {
              socket.write(msg);
            }
          });

          udpSocket.on('error', (err) => {
            udpSocket?.close();
            socket.destroy();
          });

          // Kirim sisa payload awal jika ada
          if (payload.length > 0) {
            udpSocket.send(payload, targetPort, targetHost);
          }
        } else {
          // Format salah, tutup koneksi
          socket.destroy();
        }
      }
    } else {
      // Jika header sudah pernah diparsing, langsung teruskan paket data berikutnya
      if (udpSocket && chunk.length > 0) {
        udpSocket.send(chunk, targetPort, targetHost);
      }
    }
  });

  socket.on('close', () => {
    if (udpSocket) udpSocket.close();
  });

  socket.on('error', () => {
    if (udpSocket) udpSocket.close();
    socket.destroy();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[UDP RELAY FIXED] Listening on port ${PORT}`);
});
