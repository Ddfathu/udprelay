const net = require('net');
const dgram = require('dgram');

const PORT = process.env.PORT || 8880;

const server = net.createServer((socket) => {
  let udpSocket = null;

  socket.on('data', (data) => {
    if (!udpSocket) {
      const bufferStr = data.toString('latin1');
      const delimiterIndex = bufferStr.indexOf('|');

      if (delimiterIndex !== -1) {
        const header = bufferStr.substring(0, delimiterIndex);
        const payload = data.subarray(delimiterIndex + 1);
        
        const parts = header.split(':');
        if (parts.length === 3 && parts[0] === 'udp') {
          const targetHost = parts[1];
          const targetPort = parseInt(parts[2], 10);

          udpSocket = dgram.createSocket('udp4');

          udpSocket.on('message', (msg) => {
            if (!socket.destroyed) socket.write(msg);
          });

          udpSocket.on('error', () => {
            udpSocket?.close();
            socket.destroy();
          });

          if (payload.length > 0) {
            udpSocket.send(payload, targetPort, targetHost);
          }
        }
      }
    } else {
      if (data.length > 0) udpSocket.send(data);
    }
  });

  socket.on('close', () => udpSocket?.close());
  socket.on('error', () => {
    udpSocket?.close();
    socket.destroy();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[UDP RELAY] Listening locally on port ${PORT}`);
});
