declare class Peer {
    constructor();
    constructor(id: string);
    on(event: 'open', callback: (id: string) => void): void;
    on(event: 'connection', callback: (conn: DataConnection) => void): void;
    connect(id: string): DataConnection;
}

interface DataConnection {
    on(event: 'data', callback: (data: any) => void): void;
    on(event: 'close', callback: () => void): void;
    send(data: any): void;
    open: boolean;
}
