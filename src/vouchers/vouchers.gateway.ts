import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class VouchersGateway {
  @WebSocketServer()
  server: Server;

  notifyVoucherClaimed(data: any) {
    this.server.emit('voucher_claimed', data);
  }
}
