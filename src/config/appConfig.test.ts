/* global describe, expect, test */

import {
    buildAccountId,
    buildAccountLabel,
    buildLegacyAccountId,
    migrateConfigState,
    resolveAccountInState
} from './accountState.js';

describe('appConfig helpers', () => {
    test('buildAccountId prefers stable user id', () => {
        expect(buildAccountId('https://misskey.io', 'user-1', 'alice', 'misskey.io')).toBe(
            'https://misskey.io#user:user-1'
        );
    });

    test('migrateConfigState normalizes legacy single-account config', () => {
        const state = migrateConfigState({
            baseUrl: 'misskey.io/',
            accountId: buildLegacyAccountId('https://misskey.io', 'alice', 'misskey.io'),
            username: 'alice',
            host: 'misskey.io'
        });

        expect(state.currentAccountId).toBe('https://misskey.io#alice@misskey.io');
        expect(state.accounts).toEqual([
            {
                id: 'https://misskey.io#alice@misskey.io',
                baseUrl: 'https://misskey.io',
                userId: undefined,
                username: 'alice',
                host: 'misskey.io',
                label: buildAccountLabel('https://misskey.io', 'alice', 'misskey.io'),
                legacyIds: []
            }
        ]);
    });

    test('migrateConfigState keeps current account only when it exists', () => {
        const state = migrateConfigState({
            currentAccountId: 'missing',
            accounts: [
                {
                    id: 'https://a.example#user:1',
                    baseUrl: 'https://a.example',
                    userId: '1',
                    username: 'alice',
                    host: 'a.example'
                },
                {
                    id: 'https://b.example#user:2',
                    baseUrl: 'https://b.example',
                    userId: '2',
                    username: 'bob',
                    host: 'b.example'
                }
            ]
        });

        expect(state.currentAccountId).toBe('https://a.example#user:1');
        expect(state.accounts).toHaveLength(2);
        expect(state.accounts[0]?.legacyIds).toEqual(['https://a.example#alice@a.example']);
    });

    test('resolveAccountInState supports numbered selectors', () => {
        const state = migrateConfigState({
            accounts: [
                {
                    id: 'https://a.example#user:1',
                    baseUrl: 'https://a.example',
                    userId: '1',
                    username: 'same',
                    host: 'a.example'
                },
                {
                    id: 'https://b.example#user:2',
                    baseUrl: 'https://b.example',
                    userId: '2',
                    username: 'same',
                    host: 'b.example'
                }
            ]
        });

        expect(resolveAccountInState(state, '2')?.id).toBe('https://b.example#user:2');
    });
});
