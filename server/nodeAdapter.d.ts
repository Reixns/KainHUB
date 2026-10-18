import type { IncomingMessage } from 'node:http';

export function handleNodeRequest(req: IncomingMessage): Promise<Request>;
