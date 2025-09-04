import { MisskeyClient } from '../../api/client.js';
import { endpointForType, type TimelineType } from './endpoints.js';
import type { TimelineNote } from './utils.js';

export const fetchTimeline = async (
    client: MisskeyClient,
    tlType: TimelineType,
    limit: number,
    untilId?: string
): Promise<TimelineNote[]> => {
    const ep = endpointForType(tlType);
    const body: Record<string, unknown> = { limit };
    if (untilId) body.untilId = untilId;
    return client.post<TimelineNote[]>(ep, body);
};

