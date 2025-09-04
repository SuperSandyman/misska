export type TimelineType = 'home' | 'local' | 'social' | 'global';

export const endpointForType = (t: TimelineType): string => {
    switch (t) {
        case 'home':
            return 'notes/timeline';
        case 'local':
            return 'notes/local-timeline';
        case 'social':
            return 'notes/hybrid-timeline';
        case 'global':
            return 'notes/global-timeline';
    }
};

export const channelForType = (t: TimelineType): string => {
    switch (t) {
        case 'home':
            return 'homeTimeline';
        case 'local':
            return 'localTimeline';
        case 'social':
            return 'hybridTimeline';
        case 'global':
            return 'globalTimeline';
    }
};

